// Immersion & Retention Tools:
// 1. 🔁 Shadowing 3-Round Auto Loop (Listen+Pinyin -> Shadow Together -> Blind Speak)
// 2. 🎧 Hands-Free Audio Loop Player (Commute / Shower mode)
// 3. 🌙 Bedtime 3-Minute Sleep Consolidation (180s gentle review)

import { SURVIVAL_50 } from './data-month1.js';
import { buildGuidedSession, getTodayBlueprintDay } from './logic.js';
import { colorizePinyin, renderMicWaveHtml } from './ux-utils.js';
import { hasSpeechRecognition, startSpeechRecognition } from '../speak-studio/speech.js';
import { scorePronunciation } from '../speak-studio/scoring.js';

function collectPracticePool(core, source = 'today') {
  const ext = core.getExt('month1') || {};
  const todayDay = getTodayBlueprintDay(core.state.progress, ext);
  if (source === 'mistakes') {
    const ms = (core.state.progress?.mistakes || [])
      .filter(m => m && m.hanzi)
      .map(m => ({ hz: m.hanzi, py: m.pinyin || '', th: m.meaning || m.answer || '' }));
    if (ms.length >= 3) return ms;
  }
  if (source === 'survival') {
    return SURVIVAL_50.slice(0, 25);
  }
  const s = buildGuidedSession(todayDay, core.state.progress?.mistakes || [], { intensity: 5 });
  return s.speakItems.length ? s.speakItems : SURVIVAL_50.slice(0, 15);
}

/* ==========================================================================
   1. 🔁 Shadowing 3-Round Auto Loop
   ========================================================================== */
export function renderShadowing3RoundRunner(core, host, onExit) {
  const pool = collectPracticePool(core, 'today').slice(0, 10);
  let idx = 0;
  let round = 1; // 1 = Listen+Pinyin, 2 = Shadow Together, 3 = Blind Speak
  let listening = false;
  let lastHeard = '';
  let lastScore = null;
  let activeMic = null;

  const stopMic = () => {
    listening = false;
    if (activeMic) { try { activeMic.stop(); } catch { /* ignore */ } activeMic = null; }
  };

  const render = () => {
    const item = pool[idx] || SURVIVAL_50[0];
    const isBlind = round === 3;
    const roundTitle = round === 1
      ? 'รอบที่ 1/3: ฟังเสียงต้นฉบับ + ดูพินอินสีวรรณยุกต์'
      : round === 2
        ? 'รอบที่ 2/3: พูดทับพร้อมเสียงต้นฉบับ (Shadowing)'
        : 'รอบที่ 3/3: ปิดตาพูดเองจากความจำล้วน (Blind Speak)';

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🔁 Shadowing 3 รอบ · ประโยค ${idx + 1}/${pool.length}</span>
            <h3 style="margin:6px 0 2px">${roundTitle}</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">ทำครบ 3 รอบต่อประโยคเพื่อให้กล้ามเนื้อปากจำจังหวะภาษาจีนอัตโนมัติ</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="sh3-exit">← กลับ</button>
        </div>

        <div class="m1-speak-exam-box" style="margin:14px 0">
          <div class="m1-muted" style="font-size:13.5px;margin-bottom:6px">ความหมาย: "${core.escapeHtml(item.th)}"</div>
          ${isBlind ? `
            <div style="font-size:22px;font-weight:700;padding:18px 0;color:var(--sys-accent-text,#0066d6)">🙈 ซ่อนตัวจีนและพินอินแล้ว — พูดจากความจำเลย!</div>
          ` : `
            <div class="hanzi-font" style="font-size:32px;font-weight:700;letter-spacing:2px;margin-bottom:4px">${core.escapeHtml(item.hz)}</div>
            <div class="m1-py" style="font-size:18px;margin-bottom:10px">${colorizePinyin(item.py)}</div>
          `}

          <div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px">
            ${round === 1 ? `
              <button type="button" class="btn-secondary" id="sh3-play">🔊 ฟังต้นฉบับ</button>
              <button type="button" class="btn-primary" id="sh3-next-round">ไปรอบที่ 2 (พูดทับเสียง) →</button>
            ` : round === 2 ? `
              <button type="button" class="btn-primary" id="sh3-shadow-go">🔁 เล่นเสียง + พูดตามพร้อมกัน</button>
              <button type="button" class="btn-secondary" id="sh3-next-round">ไปรอบที่ 3 (ปิดตาพูดเอง) →</button>
            ` : `
              <button type="button" class="btn-primary ${listening ? 'is-listening' : ''}" id="sh3-blind-mic">
                ${listening ? '🔴 กำลังฟัง... พูดเลย!' : '🎙️ กดพูดจากความจำล้วน'}
              </button>
              ${renderMicWaveHtml(listening)}
              <button type="button" class="btn-secondary" id="sh3-next-item">ประโยคถัดไป →</button>
            `}
          </div>

          ${lastScore !== null ? `
            <div class="m1-status-pill ${lastScore >= 80 ? 'pass' : 'fail'}" style="margin-top:12px">
              ความแม่นยำรอบปิดตา: ${lastScore}% ${lastHeard ? `(ได้ยิน: ${core.escapeHtml(lastHeard)})` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    if (round === 1) setTimeout(() => core.speak(item.hz), 120);

    host.querySelector('#sh3-exit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
    host.querySelector('#sh3-play')?.addEventListener('click', () => core.speak(item.hz));
    host.querySelector('#sh3-shadow-go')?.addEventListener('click', () => {
      core.speak(item.hz);
      core.showToast('🗣️ พูดทับพร้อมเสียงต้นฉบับเลย!');
    });
    host.querySelector('#sh3-next-round')?.addEventListener('click', () => {
      stopMic();
      round += 1;
      lastScore = null;
      lastHeard = '';
      render();
    });
    host.querySelector('#sh3-blind-mic')?.addEventListener('click', () => {
      if (listening) { stopMic(); render(); return; }
      if (!hasSpeechRecognition()) return core.showToast('เบราว์เซอร์นี้ไม่รองรับไมค์ Web Speech');
      listening = true;
      lastHeard = '';
      render();
      activeMic = startSpeechRecognition({
        lang: 'zh-CN',
        onResult: (txt) => {
          lastHeard = txt || '';
          const res = scorePronunciation(item.hz, item.py, lastHeard);
          lastScore = res.score;
          stopMic();
          if (lastScore >= 80) {
            core.playChime('ok', true);
            core.addXp(5, 'ผ่าน Shadowing รอบปิดตา!');
          }
          render();
        },
        onError: () => { stopMic(); render(); },
        onEnd: () => { if (listening) { stopMic(); render(); } }
      });
    });
    host.querySelector('#sh3-next-item')?.addEventListener('click', () => {
      stopMic();
      idx = (idx + 1) % pool.length;
      round = 1;
      lastScore = null;
      lastHeard = '';
      render();
    });
  };

  render();
}

/* ==========================================================================
   2. 🎧 Hands-Free Audio Loop Player (Commute / Shower Mode)
   ========================================================================== */
export function renderAudioLoopRunner(core, host, onExit) {
  let source = 'today';
  let pool = collectPracticePool(core, source);
  let idx = 0;
  let playing = false;
  let phase = 'พร้อมเล่น';
  let rate = 1.0;
  let timer = null;

  const clearLoop = () => {
    playing = false;
    if (timer) { clearTimeout(timer); timer = null; }
    try { window.speechSynthesis?.cancel?.(); } catch { /* ignore */ }
  };

  const playStep = () => {
    if (!playing || !pool.length) return;
    const item = pool[idx % pool.length];
    phase = '🔊 กำลังอ่านภาษาจีน (ความเร็วปกติ)...';
    render();
    const prevRate = core.state.rate;
    core.state.rate = rate;
    core.speak(item.hz, () => {
      core.state.rate = prevRate;
      if (!playing) return;
      phase = '🗣️ เว้น 3 วิ — พูดตามออกเสียงเลย!';
      render();
      timer = setTimeout(() => {
        if (!playing) return;
        phase = '🐢 อ่านซ้ำช้าๆ ชัดๆ (0.75x)...';
        render();
        core.state.rate = 0.75;
        core.speak(item.hz, () => {
          core.state.rate = prevRate;
          if (!playing) return;
          timer = setTimeout(() => {
            if (!playing) return;
            idx = (idx + 1) % pool.length;
            playStep();
          }, 1400);
        });
      }, 3000);
    });
  };

  const render = () => {
    const item = pool[idx % pool.length] || SURVIVAL_50[0];
    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🎧 Hands-Free Audio Loop · ฟังวนตอนเดินทาง/อาบน้ำ</span>
            <h3 style="margin:6px 0 2px">เครื่องเล่นฟังวนอัตโนมัติ (จีน → เว้น 3 วิพูดตาม → จีนช้า)</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">เปิดทิ้งไว้ฟังตอนขับรถ เดิน หรืออาบน้ำ ไม่ต้องแตะหน้าจอ</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="al-exit">← กลับ</button>
        </div>

        <div class="m1-subnav" style="margin-top:12px">
          <button type="button" class="m1-pill ${source === 'today' ? 'active' : ''}" data-al-src="today">📖 บทเรียนปัจจุบัน</button>
          <button type="button" class="m1-pill ${source === 'survival' ? 'active' : ''}" data-al-src="survival">🗣️ 50 ประโยคเอาตัวรอด</button>
          <button type="button" class="m1-pill ${source === 'mistakes' ? 'active' : ''}" data-al-src="mistakes">⚠️ คำที่เคยผิด</button>
        </div>

        <div class="m1-speak-exam-box" style="margin:12px 0;padding:24px 16px">
          <div class="m1-status-pill ${playing ? 'pass' : 'pending'}" style="margin-bottom:10px">${phase} (${idx + 1}/${pool.length})</div>
          <div class="hanzi-font" style="font-size:34px;font-weight:700;letter-spacing:2px">${core.escapeHtml(item.hz)}</div>
          <div class="m1-py" style="font-size:18px;margin:6px 0">${colorizePinyin(item.py)}</div>
          <div class="m1-muted" style="font-size:14px;margin-bottom:16px">${core.escapeHtml(item.th)}</div>

          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-secondary" id="al-prev">⏮ ก่อนหน้า</button>
            <button type="button" class="btn-primary ux-primary-cta" id="al-toggle">${playing ? '⏸ หยุดพัก' : '▶️ เริ่มเล่นวนอัตโนมัติ'}</button>
            <button type="button" class="btn-secondary" id="al-next">ถัดไป ⏭</button>
          </div>
        </div>
      </div>
    `;

    host.querySelector('#al-exit')?.addEventListener('click', () => { clearLoop(); onExit?.(); });
    host.querySelectorAll('[data-al-src]').forEach(b => b.addEventListener('click', () => {
      clearLoop();
      source = b.dataset.alSrc || 'today';
      pool = collectPracticePool(core, source);
      idx = 0;
      phase = 'พร้อมเล่น';
      render();
    }));
    host.querySelector('#al-toggle')?.addEventListener('click', () => {
      if (playing) {
        clearLoop();
        phase = 'หยุดพักชั่วคราว';
        render();
      } else {
        playing = true;
        playStep();
      }
    });
    host.querySelector('#al-prev')?.addEventListener('click', () => {
      const was = playing;
      clearLoop();
      idx = (idx - 1 + pool.length) % pool.length;
      if (was) { playing = true; playStep(); } else render();
    });
    host.querySelector('#al-next')?.addEventListener('click', () => {
      const was = playing;
      clearLoop();
      idx = (idx + 1) % pool.length;
      if (was) { playing = true; playStep(); } else render();
    });
  };

  render();
}

/* ==========================================================================
   3. 🌙 Bedtime 3-Minute Sleep Consolidation (180s Gentle Review)
   ========================================================================== */
export function renderBedtime3MinRunner(core, host, onExit) {
  const pool = collectPracticePool(core, 'mistakes').slice(0, 12);
  let idx = 0;
  let remaining = 180;
  let revealed = false;

  const timerId = setInterval(() => {
    remaining -= 1;
    const el = host.querySelector('#bt-clock');
    if (el) {
      const mm = String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0');
      const ss = String(Math.max(0, remaining) % 60).padStart(2, '0');
      el.textContent = `${mm}:${ss}`;
    }
    if (remaining <= 0) {
      clearInterval(timerId);
      core.addXp(20, '🌙 ทวนก่อนนอนครบ 3 นาที (Sleep Consolidation)!');
      core.showToast('🌙 ทวนก่อนนอนครบ 3 นาทีแล้ว! ฝันดีครับ 晚安!');
    }
  }, 1000);

  const cleanup = () => clearInterval(timerId);

  const render = () => {
    const item = pool[idx % pool.length] || SURVIVAL_50[0];
    const mm = String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0');
    const ss = String(Math.max(0, remaining) % 60).padStart(2, '0');

    host.innerHTML = `
      <div class="card-panel m1-runner" style="background:linear-gradient(135deg, rgba(30,27,75,0.12), rgba(15,23,42,0.12))">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🌙 ทวนก่อนนอน 3 นาที (Sleep Consolidation)</span>
            <h3 style="margin:6px 0 2px">ทวนเบาๆ ก่อนหลับให้สมองล็อกความจำระยะยาว</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">เวลาที่เหลือ: <b id="bt-clock" class="tabular-nums">${mm}:${ss}</b> · คำที่ ${idx + 1}/${pool.length}</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="bt-exit">← กลับ</button>
        </div>

        <div class="m1-speak-exam-box" style="margin:14px 0;padding:26px 16px">
          <div class="hanzi-font" style="font-size:38px;font-weight:700;letter-spacing:2px">${core.escapeHtml(item.hz)}</div>
          ${revealed ? `
            <div class="m1-py" style="font-size:19px;margin:8px 0 4px">${colorizePinyin(item.py)}</div>
            <div style="font-size:16px;font-weight:600;margin-bottom:14px">${core.escapeHtml(item.th)}</div>
          ` : `
            <div class="m1-muted" style="margin:12px 0 16px">นึกเสียงและความหมายในใจ แล้วกดเฉลย...</div>
          `}

          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-secondary" id="bt-listen">🔊 ฟังช้าๆ (0.75x)</button>
            ${!revealed ? `<button type="button" class="btn-primary" id="bt-reveal">👁️ เฉลย</button>` : `<button type="button" class="btn-primary" id="bt-next">คำถัดไป →</button>`}
          </div>
        </div>
      </div>
    `;

    host.querySelector('#bt-exit')?.addEventListener('click', () => { cleanup(); onExit?.(); });
    host.querySelector('#bt-listen')?.addEventListener('click', () => {
      const prev = core.state.rate;
      core.state.rate = 0.75;
      core.speak(item.hz, () => { core.state.rate = prev; });
    });
    host.querySelector('#bt-reveal')?.addEventListener('click', () => {
      revealed = true;
      const prev = core.state.rate;
      core.state.rate = 0.75;
      core.speak(item.hz, () => { core.state.rate = prev; });
      render();
    });
    host.querySelector('#bt-next')?.addEventListener('click', () => {
      idx = (idx + 1) % pool.length;
      revealed = false;
      render();
    });
  };

  render();
}
