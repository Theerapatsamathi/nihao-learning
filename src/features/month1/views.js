// UI Views for Month-1 Starter Pack (Home/30-Day Blueprint, 20 Tone Pairs + Traps, 64 Mnemonics, 50 Survival Sentences)
import { TONE_PAIRS, THAI_TRAPS, MONTH1_DAYS_15_30, HANZI_MNEMONICS, SURVIVAL_50 } from './data-month1.js';
import { calcMonth1Stats, getTodayBlueprintDay } from './logic.js';
import { openQuickDict, showStrokePreview } from './quick-dict.js';
import { renderGuidedRunner, toggleBeginnerMode } from './guided-session.js';

const uiState = { subTab: 'home', survCat: 'all', mnemQuery: '', toneQuiz: null };

export function renderMonth1Tab(core, host) {
  if (!host) return;
  const ext = core.getExt('month1');
  const stats = calcMonth1Stats(core.state.progress, ext);
  const todayDay = getTodayBlueprintDay(core.state.progress, ext);

  host.innerHTML = `
    <div class="m1-subnav">
      <button type="button" class="m1-pill ${uiState.subTab === 'home' ? 'active' : ''}" data-sub="home">🌱 แผน 30 วัน</button>
      <button type="button" class="m1-pill ${uiState.subTab === 'tones' ? 'active' : ''}" data-sub="tones">🎵 20 คู่วรรณยุกต์ (${stats.tonePairsDone}/20)</button>
      <button type="button" class="m1-pill ${uiState.subTab === 'mnem' ? 'active' : ''}" data-sub="mnem">🧠 64 ภาพจำอักษร (${stats.mnemonicsDone}/64)</button>
      <button type="button" class="m1-pill ${uiState.subTab === 'surv' ? 'active' : ''}" data-sub="surv">🗣️ 50 ประโยคเอาตัวรอด</button>
      <button type="button" class="m1-pill m1-dict-pill" id="m1-open-dict-btn">🔍 ค้นศัพท์ (/)</button>
    </div>
    <div id="m1-view-body"></div>
  `;

  host.querySelectorAll('[data-sub]').forEach(b => {
    b.addEventListener('click', () => {
      uiState.subTab = b.dataset.sub;
      renderMonth1Tab(core, host);
    });
  });
  host.querySelector('#m1-open-dict-btn')?.addEventListener('click', () => openQuickDict(core));

  const body = host.querySelector('#m1-view-body');
  if (uiState.subTab === 'home') renderHomeView(core, body, host, ext, stats, todayDay);
  else if (uiState.subTab === 'tones') renderTonesView(core, body, host, ext);
  else if (uiState.subTab === 'mnem') renderMnemonicsView(core, body, host, ext);
  else if (uiState.subTab === 'surv') renderSurvivalView(core, body, host, ext);
}

function renderHomeView(core, body, rootHost, ext, stats, todayDay) {
  const beginnerOn = Boolean(ext.beginnerMode);
  const doneToday = ext.lastGuidedDate === core.todayKey();
  const done15_30 = new Set(Array.isArray(ext.doneDays) ? ext.doneDays : []);

  body.innerHTML = `
    <div class="card-panel m1-hero">
      <div class="m1-hero-left">
        <div class="m1-tag">🌱 เส้นทางเดือนแรก (0 → HSK 1) · ความคืบหน้า ${stats.pct}%</div>
        <h2 style="margin:8px 0 6px">วันนี้เรียน Day ${todayDay} / 30 ${doneToday ? '✅ เรียนครบแล้ว!' : ''}</h2>
        <p class="m1-muted" style="margin:0 0 14px">กดปุ่มเดียวพาไล่ครบ: วอร์มอัพคำเดิม → คู่วรรณยุกต์ → พูดตาม 5 ประโยคเอาตัวรอด (15 นาทีจบ)</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn-primary" id="m1-start-guided">▶ เริ่มเรียนวันนี้ (15 นาที)</button>
          <label class="m1-toggle-chip">
            <input type="checkbox" id="m1-beginner-chk" ${beginnerOn ? 'checked' : ''}>
            <span>โหมดเดือนแรก (ซ่อนเมนูขั้นสูง)</span>
          </label>
        </div>
      </div>
      <div class="m1-kpi-mini">
        <div><strong>${stats.totalDaysDone}/30</strong><span>วัน</span></div>
        <div><strong>${stats.tonePairsDone}/20</strong><span>คู่เสียง</span></div>
        <div><strong>${stats.mnemonicsDone}/64</strong><span>อักษรจำได้</span></div>
      </div>
    </div>

    <div class="card-panel" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h3 style="margin:0">📅 แผน 30 วันครบเดือนแรก</h3>
        <button type="button" class="btn-secondary" id="m1-go-plan14">เปิดแผน Day 1–14 (พินอิน) →</button>
      </div>
      <div class="m1-muted" style="font-size:13px;margin-bottom:12px">
        <b>สัปดาห์ 1–2 (Day 1–14):</b> พินอิน วรรณยุกต์ และ 32 อักษรพื้นฐาน (เชื่อมกับแท็บ "แผนเรียน 14 วัน")<br>
        <b>สัปดาห์ 3–4 (Day 15–30):</b> คำศัพท์เอาตัวรอด 20 คู่เสียง สนทนาจริง และสอบจบเดือนแรก
      </div>
      <div class="m1-days-grid">
        ${MONTH1_DAYS_15_30.map(d => {
          const isDone = done15_30.has(d.day);
          const isCur = d.day === todayDay;
          return `
            <div class="m1-day-card ${isDone ? 'done' : ''} ${isCur ? 'current' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="m1-tag">Day ${d.day} · W${d.week}</span>
                <button type="button" class="m1-check-btn" data-toggle-day="${d.day}" title="ติ๊กผ่าน">${isDone ? '✅' : '○'}</button>
              </div>
              <div style="font-weight:700;margin:6px 0 3px">${core.escapeHtml(d.title)}</div>
              <div class="m1-muted" style="font-size:12px;margin-bottom:8px">${core.escapeHtml(d.focus)}</div>
              <div class="m1-chip-row">
                ${d.words.map(w => `<button type="button" class="m1-chip hanzi-font" data-say="${core.escapeHtml(w)}">🔊 ${core.escapeHtml(w)}</button>`).join('')}
              </div>
              <div style="margin-top:10px">
                <button type="button" class="btn-secondary m1-mini-btn" data-go-tab="${d.tab}">เปิดฝึกบทนี้ →</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  body.querySelector('#m1-start-guided')?.addEventListener('click', () => {
    renderGuidedRunner(core, body, () => renderMonth1Tab(core, rootHost));
  });
  body.querySelector('#m1-beginner-chk')?.addEventListener('change', (e) => {
    toggleBeginnerMode(core, e.target.checked);
  });
  body.querySelector('#m1-go-plan14')?.addEventListener('click', () => core.switchTab('plan'));
  body.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.say)));
  body.querySelectorAll('[data-go-tab]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.goTab === 'month1') { uiState.subTab = 'tones'; renderMonth1Tab(core, rootHost); }
    else core.switchTab(b.dataset.goTab);
  }));
  body.querySelectorAll('[data-toggle-day]').forEach(b => b.addEventListener('click', () => {
    const dNum = Number(b.dataset.toggleDay);
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.doneDays) ? cur.doneDays : []);
      if (s.has(dNum)) s.delete(dNum); else s.add(dNum);
      cur.doneDays = [...s];
      return cur;
    }, { save: true, reason: `อัปเดต Day ${dNum}` });
    renderMonth1Tab(core, rootHost);
  }));
}

function renderTonesView(core, body, rootHost, ext) {
  const doneSet = new Set(Array.isArray(ext.tonePairsDone) ? ext.tonePairsDone : []);

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <h3 style="margin:0">🎵 20 คู่วรรณยุกต์ (Tone Pairs Mastery)</h3>
          <div class="m1-muted" style="font-size:13px">ฝึกฟังและพูดตามครบทั้ง 20 คู่เสียง — เคล็ดลับให้สำเนียงจีนเป๊ะตั้งแต่เดือนแรก</div>
        </div>
        <button type="button" class="btn-primary" id="m1-tone-quiz-btn">🎧 ทดสอบฟังแยกคู่เสียง</button>
      </div>
      <div id="m1-tone-quiz-box"></div>
      <div class="m1-tone-grid">
        ${TONE_PAIRS.map(t => {
          const ok = doneSet.has(t.id);
          return `
            <div class="m1-tone-card ${ok ? 'done' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="m1-tag">${core.escapeHtml(t.label)}</span>
                <button type="button" class="m1-check-btn" data-tp-done="${t.id}">${ok ? '✅' : '○'}</button>
              </div>
              <div class="m1-hz hanzi-font" style="margin-top:6px">${core.escapeHtml(t.hz)}</div>
              <div class="m1-py">${core.escapeHtml(t.py)}</div>
              <div class="m1-muted" style="font-size:12.5px">${core.escapeHtml(t.th)}</div>
              <div class="m1-tip">💡 ${core.escapeHtml(t.tip)}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-say="${core.escapeHtml(t.hz)}">🔊 ฟัง</button>
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-slow="${core.escapeHtml(t.hz)}">🐢 ช้า</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card-panel" style="margin-top:16px">
      <h3 style="margin:0 0 8px">⚠️ กับดักเสียงคนไทยโดยเฉพาะ (Thai-Speaker Traps)</h3>
      <div class="m1-traps-grid">
        ${THAI_TRAPS.map(tr => `
          <div class="m1-trap-card">
            <div style="font-weight:700;margin-bottom:4px">${core.escapeHtml(tr.title)}</div>
            <div class="m1-muted" style="font-size:12.5px;margin-bottom:10px">${core.escapeHtml(tr.tip)}</div>
            ${tr.pairs.map(p => `
              <div class="m1-trap-pair">
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-say="${core.escapeHtml(p.a.hz)}">🔊 <b class="hanzi-font">${core.escapeHtml(p.a.hz)}</b> ${core.escapeHtml(p.a.py)} (${core.escapeHtml(p.a.th)})</button>
                <span class="m1-muted">vs</span>
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-say="${core.escapeHtml(p.b.hz)}">🔊 <b class="hanzi-font">${core.escapeHtml(p.b.hz)}</b> ${core.escapeHtml(p.b.py)} (${core.escapeHtml(p.b.th)})</button>
              </div>`).join('')}
          </div>`).join('')}
      </div>
    </div>
  `;

  body.querySelectorAll('[data-tp-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.tpSay)));
  body.querySelectorAll('[data-tp-slow]').forEach(b => b.addEventListener('click', () => {
    const prev = core.state.rate;
    core.state.rate = 0.6;
    core.speak(b.dataset.tpSlow, () => { core.state.rate = prev; });
  }));
  body.querySelectorAll('[data-tp-done]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.tpDone;
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.tonePairsDone) ? cur.tonePairsDone : []);
      if (s.has(id)) s.delete(id); else s.add(id);
      cur.tonePairsDone = [...s];
      return cur;
    }, { save: true });
    renderMonth1Tab(core, rootHost);
  }));
  body.querySelector('#m1-tone-quiz-btn')?.addEventListener('click', () => startTonePairQuiz(core, body.querySelector('#m1-tone-quiz-box')));
}

function startTonePairQuiz(core, box) {
  if (!box) return;
  const target = TONE_PAIRS[Math.floor(Math.random() * TONE_PAIRS.length)];
  const distractors = core.shuffleArray(TONE_PAIRS.filter(x => x.id !== target.id)).slice(0, 3);
  const options = core.shuffleArray([target, ...distractors]);
  core.speak(target.hz);

  box.innerHTML = `
    <div class="m1-quiz-inline">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong>🎧 ฟังแล้วเลือกคู่เสียงที่ได้ยิน:</strong>
        <button type="button" class="btn-secondary m1-mini-btn" id="m1-tq-replay">🔊 ฟังอีกครั้ง</button>
      </div>
      <div class="m1-chip-row">
        ${options.map(o => `<button type="button" class="btn-secondary" data-tq-pick="${o.id}">${core.escapeHtml(o.label)} (${core.escapeHtml(o.hz)})</button>`).join('')}
      </div>
      <div id="m1-tq-fb" style="margin-top:8px;font-size:13px"></div>
    </div>`;
  box.querySelector('#m1-tq-replay')?.addEventListener('click', () => core.speak(target.hz));
  box.querySelectorAll('[data-tq-pick]').forEach(b => b.addEventListener('click', () => {
    const ok = b.dataset.tqPick === target.id;
    core.playChime(ok ? 'ok' : 'err');
    const fb = box.querySelector('#m1-tq-fb');
    if (ok) {
      core.addXp(5, 'ตอบถูกคู่เสียง!');
      fb.innerHTML = `<span style="color:var(--sys-green-text,#16a34a);font-weight:700">✓ ถูกต้อง! ${core.escapeHtml(target.hz)} (${core.escapeHtml(target.py)}) = ${core.escapeHtml(target.label)}</span> <button type="button" class="btn-primary m1-mini-btn" id="m1-tq-next">ข้อต่อไป →</button>`;
    } else {
      fb.innerHTML = `<span style="color:var(--sys-red-text,#dc2626);font-weight:700">✗ เฉลยคือ ${core.escapeHtml(target.label)}: ${core.escapeHtml(target.hz)} (${core.escapeHtml(target.py)})</span> <button type="button" class="btn-primary m1-mini-btn" id="m1-tq-next">ลองข้อใหม่ →</button>`;
    }
    box.querySelector('#m1-tq-next')?.addEventListener('click', () => startTonePairQuiz(core, box));
  }));
}

function renderMnemonicsView(core, body, rootHost, ext) {
  const doneSet = new Set(Array.isArray(ext.mnemonicsDone) ? ext.mnemonicsDone : []);
  const q = uiState.mnemQuery.trim().toLowerCase();
  const list = HANZI_MNEMONICS.filter(m => !q || m.hz.includes(q) || m.py.toLowerCase().includes(q) || m.th.toLowerCase().includes(q));

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div>
          <h3 style="margin:0">🧠 64 ภาพจำตัวอักษรจีนเดือนแรก (Thai Mnemonics)</h3>
          <div class="m1-muted" style="font-size:13px">จำอักษรจีนจากเรื่องเล่าภาษาไทย ไม่ต้องท่องจำแบบนกแก้วนกขุนทอง · กด ✍️ เพื่อดูลำดับขีด</div>
        </div>
        <input type="search" id="m1-mnem-search" class="vb-search" style="max-width:220px" placeholder="ค้นหาตัวอักษร/ความหมาย..." value="${core.escapeHtml(uiState.mnemQuery)}">
      </div>
      <div id="m1-mnem-stroke" class="m1-stroke-box" hidden></div>
      <div class="m1-mnem-grid">
        ${list.map(m => {
          const ok = doneSet.has(m.hz);
          return `
            <div class="m1-mnem-card ${ok ? 'done' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div class="m1-mnem-char hanzi-font">${core.escapeHtml(m.hz)}</div>
                <button type="button" class="m1-check-btn" data-mn-done="${core.escapeHtml(m.hz)}">${ok ? '✅' : '○'}</button>
              </div>
              <div class="m1-py">${core.escapeHtml(m.py)} · <b>${core.escapeHtml(m.th)}</b></div>
              <div class="m1-tag" style="margin:4px 0">${core.escapeHtml(m.parts)}</div>
              <div class="m1-muted" style="font-size:12.5px;line-height:1.45">${core.escapeHtml(m.story)}</div>
              <div class="m1-tip" style="margin-top:6px">ตัวอย่าง: ${core.escapeHtml(m.ex)}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button type="button" class="btn-secondary m1-mini-btn" data-mn-say="${core.escapeHtml(m.hz)}">🔊 ฟัง</button>
                <button type="button" class="btn-secondary m1-mini-btn" data-mn-stroke="${core.escapeHtml(m.hz)}">✍️ ลำดับขีด</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  body.querySelector('#m1-mnem-search')?.addEventListener('input', (e) => {
    uiState.mnemQuery = e.target.value;
    renderMnemonicsView(core, body, rootHost, ext);
  });
  body.querySelectorAll('[data-mn-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.mnSay)));
  body.querySelectorAll('[data-mn-stroke]').forEach(b => b.addEventListener('click', () => {
    showStrokePreview(core, b.dataset.mnStroke, body.querySelector('#m1-mnem-stroke'));
  }));
  body.querySelectorAll('[data-mn-done]').forEach(b => b.addEventListener('click', () => {
    const ch = b.dataset.mnDone;
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.mnemonicsDone) ? cur.mnemonicsDone : []);
      if (s.has(ch)) s.delete(ch); else s.add(ch);
      cur.mnemonicsDone = [...s];
      return cur;
    }, { save: true });
    renderMonth1Tab(core, rootHost);
  }));
}

function renderSurvivalView(core, body, rootHost, ext) {
  const doneSet = new Set(Array.isArray(ext.survivalDone) ? ext.survivalDone : []);
  const cats = [
    { id: 'all', label: 'ทั้งหมด (50)' },
    { id: 'greet', label: 'ทักทาย (10)' },
    { id: 'food', label: 'กิน/ชานม (10)' },
    { id: 'shop', label: 'ซื้อของ (10)' },
    { id: 'travel', label: 'เดินทาง (10)' },
    { id: 'help', label: 'ขอความช่วยเหลือ (10)' }
  ];
  const items = uiState.survCat === 'all' ? SURVIVAL_50 : SURVIVAL_50.filter(x => x.cat === uiState.survCat);

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <h3 style="margin:0">🗣️ 50 ประโยคเอาตัวรอดเดือนแรก (HSK 1 ล้วน)</h3>
          <div class="m1-muted" style="font-size:13px">คัดเฉพาะประโยคที่ใช้จริงทุกวัน ฟังช้า 0.6x แล้วพูดตามจนคล่อง</div>
        </div>
        <button type="button" class="btn-primary" id="m1-surv-roleplay">🎙️ ลองใช้จริงใน AI Roleplay →</button>
      </div>
      <div class="m1-chip-row" style="margin-bottom:14px">
        ${cats.map(c => `<button type="button" class="m1-chip ${uiState.survCat === c.id ? 'active' : ''}" data-scat="${c.id}">${c.label}</button>`).join('')}
      </div>
      <div class="m1-list">
        ${items.map((s) => {
          const ok = doneSet.has(s.hz);
          return `
            <div class="m1-item ${ok ? 'done' : ''}">
              <div>
                <span class="m1-tag">${core.escapeHtml(s.catLabel)}</span>
                <div class="m1-hz hanzi-font" style="margin-top:4px">${core.escapeHtml(s.hz)}</div>
                <div class="m1-py">${core.escapeHtml(s.py)}</div>
                <div class="m1-muted">${core.escapeHtml(s.th)} · 💡 ${core.escapeHtml(s.tip)}</div>
              </div>
              <div class="m1-row-btns">
                <button type="button" class="btn-secondary m1-mini-btn" data-ss-slow="${core.escapeHtml(s.hz)}">🐢 0.6x</button>
                <button type="button" class="btn-secondary m1-mini-btn" data-ss-say="${core.escapeHtml(s.hz)}">🔊 ฟัง</button>
                <button type="button" class="btn-primary m1-mini-btn" data-ss-done="${core.escapeHtml(s.hz)}">${ok ? '✓ คล่องแล้ว' : 'ฝึกแล้ว'}</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  body.querySelector('#m1-surv-roleplay')?.addEventListener('click', () => core.switchTab('speak-studio'));
  body.querySelectorAll('[data-scat]').forEach(b => b.addEventListener('click', () => {
    uiState.survCat = b.dataset.scat;
    renderSurvivalView(core, body, rootHost, ext);
  }));
  body.querySelectorAll('[data-ss-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.ssSay)));
  body.querySelectorAll('[data-ss-slow]').forEach(b => b.addEventListener('click', () => {
    const prev = core.state.rate;
    core.state.rate = 0.6;
    core.speak(b.dataset.ssSlow, () => { core.state.rate = prev; });
  }));
  body.querySelectorAll('[data-ss-done]').forEach(b => b.addEventListener('click', () => {
    const hz = b.dataset.ssDone;
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.survivalDone) ? cur.survivalDone : []);
      if (s.has(hz)) s.delete(hz); else s.add(hz);
      cur.survivalDone = [...s];
      return cur;
    }, { save: true });
    renderMonth1Tab(core, rootHost);
  }));
}
