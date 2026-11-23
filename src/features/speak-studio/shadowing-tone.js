// Shadowing (#4), Per-Syllable Scoring (#11), Tone Graph (#12), Smart Review (#7)
import { SHADOWING_SETS, TONE_DRILLS } from './data.js';
import {
  scorePronunciation,
  detectPitchYIN,
  idealToneContour,
  getDueReviewItems,
  updateReviewItem
} from './scoring.js';
import {
  startSpeechRecognition,
  hasSpeechRecognition,
  speakSlow,
  getCharPinyinMap,
  addToReviewQueue,
  renderPronunciationBreakdownHtml
} from './speech.js';

/**
 * Shadowing / Repeat-After-Me (#4 + #11)
 */
export function createShadowingController(core) {
  const topics = ['ทั้งหมด', ...new Set(SHADOWING_SETS.map((s) => s.topic))];
  const state = {
    topic: 'ทั้งหมด',
    idx: 0,
    listening: false,
    recCtrl: null,
    heard: '',
    pronResult: null
  };

  function getFiltered() {
    return state.topic === 'ทั้งหมด'
      ? SHADOWING_SETS
      : SHADOWING_SETS.filter((s) => s.topic === state.topic);
  }

  function render(host) {
    const esc = core.escapeHtml;
    const list = getFiltered();
    const item = list[state.idx % list.length] || SHADOWING_SETS[0];
    const canMic = hasSpeechRecognition();

    host.innerHTML = `
      <div class="ss-card">
        <div class="ss-card-top">
          <div>
            <h3 class="ss-title">🔁 Shadowing — ฝึกพูดตามทีละพยางค์</h3>
            <p class="ss-muted">ฟังต้นฉบับ (ปกติ หรือช้า 0.6x) แล้วพูดตาม ระบบจะเทียบเสียงทีละตัวอักษร สีเขียว/เหลือง/แดง</p>
          </div>
          <span class="ss-pill">${(state.idx % list.length) + 1} / ${list.length} · ${esc(item.level)}</span>
        </div>

        <div class="ss-chip-row">
          ${topics.map((t) => `
            <button type="button" class="ss-chip ${t === state.topic ? 'active' : ''}" data-topic="${esc(t)}">${esc(t)}</button>
          `).join('')}
        </div>

        <div class="ss-card" style="background:var(--sys-surface-2);align-items:center;text-align:center;padding:20px 14px">
          <div class="ss-hz hanzi-font" style="font-size:26px">${esc(item.hz)}</div>
          <div class="ss-py" style="font-size:15px">${esc(item.py)}</div>
          <div class="ss-th" style="font-size:14px">${esc(item.th)}</div>

          <div class="ss-actions" style="justify-content:center;margin-top:12px">
            <button type="button" class="btn-secondary" id="ss-sh-play">🔊 ฟังปกติ (1.0x)</button>
            <button type="button" class="btn-secondary" id="ss-sh-slow">🐢 ฟังช้า (0.6x)</button>
            ${canMic ? `
              <button type="button" class="btn-primary" id="ss-sh-mic">
                ${state.listening ? '⏹️ กำลังฟัง...' : '🎙️ กดพูดตาม'}
              </button>
            ` : `<span class="ss-muted">เบราว์เซอร์ไม่รองรับ SpeechRecognition</span>`}
          </div>
        </div>

        ${state.heard ? `<div class="ss-muted">🎤 ระบบได้ยินว่า: <strong class="hanzi-font">${esc(state.heard)}</strong></div>` : ''}
        ${renderPronunciationBreakdownHtml(core, state.pronResult)}

        <div class="ss-actions" style="justify-content:space-between">
          <button type="button" class="btn-secondary" id="ss-sh-prev">← ประโยคก่อนหน้า</button>
          <button type="button" class="btn-secondary" id="ss-sh-save">➕ เพิ่มเข้าทบทวน</button>
          <button type="button" class="btn-primary" id="ss-sh-next">ประโยคถัดไป →</button>
        </div>
      </div>
    `;

    host.querySelectorAll('.ss-chip[data-topic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.topic = btn.dataset.topic;
        state.idx = 0;
        state.heard = '';
        state.pronResult = null;
        render(host);
      });
    });

    host.querySelector('#ss-sh-play')?.addEventListener('click', () => core.speak(item.hz));
    host.querySelector('#ss-sh-slow')?.addEventListener('click', () => speakSlow(core, item.hz, 0.6));
    host.querySelector('#ss-sh-prev')?.addEventListener('click', () => {
      state.idx = (state.idx - 1 + list.length) % list.length;
      state.heard = '';
      state.pronResult = null;
      render(host);
    });
    host.querySelector('#ss-sh-next')?.addEventListener('click', () => {
      state.idx = (state.idx + 1) % list.length;
      state.heard = '';
      state.pronResult = null;
      render(host);
    });
    host.querySelector('#ss-sh-save')?.addEventListener('click', (e) => {
      addToReviewQueue(core, { hz: item.hz, py: item.py, th: item.th, source: `Shadowing: ${item.topic}` });
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = '✓ เพิ่มแล้ว';
      core.showToast('เพิ่มเข้าคิวทบทวนพรุ่งนี้แล้ว', 'SAVED');
    });

    host.querySelector('#ss-sh-mic')?.addEventListener('click', () => {
      if (state.listening) { state.recCtrl?.stop(); return; }
      state.recCtrl = startSpeechRecognition({
        lang: 'zh-CN',
        onStart: () => { state.listening = true; render(host); },
        onResult: async (heard) => {
          state.listening = false;
          state.heard = heard;
          const map = await getCharPinyinMap(core);
          state.pronResult = scorePronunciation(item.hz, item.py, heard, map);
          if (state.pronResult.score >= 75) {
            core.playChime?.('ok');
            core.addXp(10, 'speak-shadowing-pass');
            core.logActivity?.(1);
          } else {
            core.playChime?.('err');
            addToReviewQueue(core, { hz: item.hz, py: item.py, th: item.th, source: 'Shadowing (ฝึกซ้ำ)' });
            core.showToast('เพิ่มประโยคนี้เข้าคิวทบทวนอัตโนมัติ', 'REVIEW');
          }
          render(host);
        },
        onError: (msg) => { state.listening = false; core.showToast(msg, 'MIC'); render(host); },
        onEnd: () => { if (state.listening) { state.listening = false; render(host); } }
      });
    });
  }

  return { render };
}

/**
 * Tone Graph (#12) — Web Audio YIN pitch contour vs ideal Mandarin tone curve
 */
export function createToneGraphController(core) {
  const state = {
    drillIdx: 0,
    recording: false,
    pitchPoints: [], // normalized 0..1
    statusMsg: 'กดปุ่ม "เริ่มอัดเสียง" แล้วออกเสียงคำด้านบนให้ชัดเจน (ทำงานแบบออฟไลน์ 100%)',
    audioCtx: null,
    stream: null,
    rafId: null
  };

  function stopCapture() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    if (state.audioCtx) {
      state.audioCtx.close().catch(() => {});
      state.audioCtx = null;
    }
    state.recording = false;
  }

  function drawCanvas(canvas, drill) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, rect.width || 480);
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);
    const padX = 28;
    const padY = 22;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    // Grid lines (5-level Chao tone scale 1..5)
    ctx.strokeStyle = 'rgba(142, 142, 147, 0.25)';
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#8e8e93';
    for (let lvl = 1; lvl <= 5; lvl++) {
      const y = padY + plotH * (1 - (lvl - 1) / 4);
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
      ctx.fillText(String(lvl), 8, y + 4);
    }

    // Ideal tone contour (dashed blue)
    const ideal = idealToneContour(drill.tones, 28);
    ctx.save();
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ideal.forEach((val, idx) => {
      const x = padX + (idx / Math.max(1, ideal.length - 1)) * plotW;
      const y = padY + (1 - val) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Learner pitch contour (solid green/orange)
    if (state.pitchPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#34c759';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      state.pitchPoints.forEach((val, idx) => {
        const x = padX + (idx / Math.max(1, state.pitchPoints.length - 1)) * plotW;
        const y = padY + (1 - val) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  async function startCapture(host, drill) {
    if (!navigator.mediaDevices?.getUserMedia) {
      state.statusMsg = 'เบราว์เซอร์นี้ไม่รองรับการเข้าถึงไมโครโฟน (Web Audio API)';
      render(host);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      state.stream = stream;
      state.audioCtx = audioCtx;
      state.recording = true;
      state.pitchPoints = [];
      state.statusMsg = 'กำลังจับเสียงวรรณยุกต์... ออกเสียงได้เลย!';
      render(host);

      const rawHz = [];
      const buf = new Float32Array(analyser.fftSize);
      const startedAt = performance.now();
      const maxMs = drill.tones.length > 1 ? 2400 : 1600;

      const loop = () => {
        if (!state.recording) return;
        analyser.getFloatTimeDomainData(buf);
        const hz = detectPitchYIN(buf, audioCtx.sampleRate);
        if (hz > 0) {
          rawHz.push(hz);
          // Normalize log-pitch relative to speaker's own range
          const logs = rawHz.map((f) => Math.log2(f));
          const minL = Math.min(...logs);
          const maxL = Math.max(...logs);
          const span = Math.max(0.45, maxL - minL); // at least ~5 semitones span
          state.pitchPoints = logs.map((l) => Math.min(0.95, Math.max(0.08, 0.15 + ((l - minL) / span) * 0.72)));
          drawCanvas(host.querySelector('#ss-tg-canvas'), drill);
        }

        if (performance.now() - startedAt >= maxMs) {
          stopCapture();
          state.statusMsg = rawHz.length >= 4
            ? `จับระดับเสียงได้ ${rawHz.length} จุด — เปรียบเทียบเส้นสีเขียว (เสียงคุณ) กับเส้นประสีฟ้า (เสียงมาตรฐาน)`
            : 'เสียงเบาเกินไป ลองพูดใกล้ไมโครโฟนมากขึ้นแล้วกดลองใหม่นะ';
          if (rawHz.length >= 4) core.addXp(5, 'speak-tone-graph');
          render(host);
          return;
        }
        state.rafId = requestAnimationFrame(loop);
      };
      state.rafId = requestAnimationFrame(loop);
    } catch (_) {
      stopCapture();
      state.statusMsg = 'ไม่สามารถเปิดไมโครโฟนได้ กรุณาอนุญาตสิทธิ์ไมโครโฟน';
      render(host);
    }
  }

  function render(host) {
    const esc = core.escapeHtml;
    const drill = TONE_DRILLS[state.drillIdx % TONE_DRILLS.length];
    const toneLabels = drill.tones.map((t) => (t === 5 ? 'เบา' : `เสียง ${t}`)).join(' + ');

    host.innerHTML = `
      <div class="ss-card">
        <div class="ss-card-top">
          <div>
            <h3 class="ss-title">📈 กราฟวรรณยุกต์ (Tone Graph)</h3>
            <p class="ss-muted">ฝึกออกเสียงวรรณยุกต์ 1–4 และเสียงเบา เส้นประสีฟ้า = มาตรฐาน · เส้นสีเขียว = เสียงของคุณ</p>
          </div>
          <span class="ss-pill">${esc(toneLabels)}</span>
        </div>

        <div class="ss-chip-row">
          ${TONE_DRILLS.map((d, i) => `
            <button type="button" class="ss-chip ${i === state.drillIdx ? 'active' : ''}" data-idx="${i}">
              ${esc(d.hz)} (${esc(d.py)})
            </button>
          `).join('')}
        </div>

        <div class="ss-card" style="background:var(--sys-surface-2);align-items:center;text-align:center">
          <div class="ss-hz hanzi-font" style="font-size:32px">${esc(drill.hz)}</div>
          <div class="ss-py" style="font-size:16px">${esc(drill.py)}</div>
          <div class="ss-th">${esc(drill.th)}</div>
          <div class="ss-actions" style="justify-content:center;margin-top:8px">
            <button type="button" class="btn-secondary" id="ss-tg-play">🔊 ฟังต้นฉบับ</button>
            <button type="button" class="btn-primary" id="ss-tg-rec">
              ${state.recording ? '⏹️ หยุดอัด' : '🎙️ เริ่มอัดเสียงวาดกราฟ'}
            </button>
          </div>
        </div>

        <div class="ss-canvas-wrap">
          <canvas id="ss-tg-canvas" class="ss-canvas" aria-label="กราฟเปรียบเทียบระดับเสียงวรรณยุกต์"></canvas>
        </div>
        <p class="ss-muted">${esc(state.statusMsg)}</p>
      </div>
    `;

    drawCanvas(host.querySelector('#ss-tg-canvas'), drill);

    host.querySelectorAll('.ss-chip[data-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopCapture();
        state.drillIdx = Number(btn.dataset.idx);
        state.pitchPoints = [];
        state.statusMsg = 'กดปุ่ม "เริ่มอัดเสียงวาดกราฟ" แล้วลองออกเสียงเทียบกับเส้นประสีฟ้า';
        render(host);
      });
    });

    host.querySelector('#ss-tg-play')?.addEventListener('click', () => core.speak(drill.hz));
    host.querySelector('#ss-tg-rec')?.addEventListener('click', () => {
      if (state.recording) {
        stopCapture();
        render(host);
      } else {
        startCapture(host, drill);
      }
    });
  }

  return { render, stop: stopCapture };
}

/**
 * Smart Review Queue (#7) — Speak-it exercises for sentences missed earlier
 */
export function createSmartReviewController(core) {
  const state = {
    idx: 0,
    listening: false,
    recCtrl: null,
    pronResult: null,
    heard: ''
  };

  function getQueue() {
    const ext = core.getExt('speak-studio') || {};
    return Array.isArray(ext.reviewQueue) ? ext.reviewQueue : [];
  }

  function saveQueue(nextQueue) {
    core.setExt('speak-studio', { reviewQueue: nextQueue }, { save: true, reason: 'speak-review-update' });
  }

  function render(host) {
    const esc = core.escapeHtml;
    const today = core.todayKey(0);
    const queue = getQueue();
    const due = getDueReviewItems(queue, today);
    const canMic = hasSpeechRecognition();

    if (queue.length === 0) {
      host.innerHTML = `
        <div class="ss-card" style="text-align:center;padding:28px 16px">
          <div style="font-size:36px">🎉</div>
          <h3 class="ss-title">ยังไม่มีประโยคในคิวทบทวน</h3>
          <p class="ss-muted">เมื่อคุณกด "เพิ่มเข้าทบทวน" จากรายงานผล Roleplay / ถามครู หรือพูด Shadowing ได้คะแนนต่ำกว่า 75% ประโยคจะถูกเก็บไว้ทบทวนที่นี่อัตโนมัติ</p>
        </div>
      `;
      return;
    }

    const activeList = due.length > 0 ? due : queue;
    const item = activeList[state.idx % activeList.length];

    host.innerHTML = `
      <div class="ss-card">
        <div class="ss-card-top">
          <div>
            <h3 class="ss-title">🧠 ทบทวนพูดอัจฉริยะ (Smart Review)</h3>
            <p class="ss-muted">ครบกำหนดวันนี้ ${due.length} ประโยค · ทั้งหมดในคิว ${queue.length} ประโยค</p>
          </div>
          <span class="ss-pill">${due.length > 0 ? 'ถึงเวลาทบทวน' : 'ฝึกซ้ำล่วงหน้า'}</span>
        </div>

        <div class="ss-card" style="background:var(--sys-surface-2);align-items:center;text-align:center;padding:20px 14px">
          <span class="ss-muted" style="font-size:12px">ที่มา: ${esc(item.source || 'Speak Studio')} · ผ่านต่อเนื่อง ${item.streak || 0} ครั้ง</span>
          <div class="ss-hz hanzi-font" style="font-size:26px;margin-top:6px">${esc(item.hz)}</div>
          ${item.py ? `<div class="ss-py" style="font-size:15px">${esc(item.py)}</div>` : ''}
          ${item.th ? `<div class="ss-th">${esc(item.th)}</div>` : ''}

          <div class="ss-actions" style="justify-content:center;margin-top:12px">
            <button type="button" class="btn-secondary" id="ss-rv-play">🔊 ฟัง</button>
            <button type="button" class="btn-secondary" id="ss-rv-slow">🐢 0.6x</button>
            ${canMic ? `<button type="button" class="btn-primary" id="ss-rv-mic">${state.listening ? '⏹️ กำลังฟัง...' : '🎙️ พูดทบทวน'}</button>` : ''}
            <button type="button" class="btn-secondary" id="ss-rv-pass">✓ ทำได้แล้ว (ข้ามไปพรุ่งนี้)</button>
          </div>
        </div>

        ${state.heard ? `<div class="ss-muted">🎤 ระบบได้ยินว่า: <strong class="hanzi-font">${esc(state.heard)}</strong></div>` : ''}
        ${renderPronunciationBreakdownHtml(core, state.pronResult)}

        <div class="ss-actions" style="justify-content:space-between">
          <button type="button" class="btn-secondary" id="ss-rv-remove">🗑️ ลบออกจากคิว</button>
          <button type="button" class="btn-secondary" id="ss-rv-next">ประโยคถัดไป →</button>
        </div>
      </div>
    `;

    const markResult = (passed) => {
      const nextDay = core.todayKey(passed ? Math.min(7, (item.streak || 0) + 1) : 0);
      const updated = queue.map((q) => (q.id === item.id ? updateReviewItem(q, passed, nextDay, today) : q));
      saveQueue(updated);
      if (passed) {
        core.playChime?.('ok');
        core.addXp(10, 'speak-review-pass');
        core.showToast('ทบทวนผ่านแล้ว! นัดทบทวนรอบถัดไปเรียบร้อย', '+10 XP');
      }
      state.idx += 1;
      state.heard = '';
      state.pronResult = null;
      render(host);
    };

    host.querySelector('#ss-rv-play')?.addEventListener('click', () => core.speak(item.hz));
    host.querySelector('#ss-rv-slow')?.addEventListener('click', () => speakSlow(core, item.hz, 0.6));
    host.querySelector('#ss-rv-pass')?.addEventListener('click', () => markResult(true));
    host.querySelector('#ss-rv-next')?.addEventListener('click', () => {
      state.idx += 1;
      state.heard = '';
      state.pronResult = null;
      render(host);
    });
    host.querySelector('#ss-rv-remove')?.addEventListener('click', () => {
      saveQueue(queue.filter((q) => q.id !== item.id));
      state.heard = '';
      state.pronResult = null;
      render(host);
    });

    host.querySelector('#ss-rv-mic')?.addEventListener('click', () => {
      if (state.listening) { state.recCtrl?.stop(); return; }
      state.recCtrl = startSpeechRecognition({
        lang: 'zh-CN',
        onStart: () => { state.listening = true; render(host); },
        onResult: async (heard) => {
          state.listening = false;
          state.heard = heard;
          const map = await getCharPinyinMap(core);
          state.pronResult = scorePronunciation(item.hz, item.py, heard, map);
          if (state.pronResult.score >= 75) {
            markResult(true);
          } else {
            core.playChime?.('err');
            render(host);
          }
        },
        onError: (msg) => { state.listening = false; core.showToast(msg, 'MIC'); render(host); },
        onEnd: () => { if (state.listening) { state.listening = false; render(host); } }
      });
    });
  }

  return { render };
}
