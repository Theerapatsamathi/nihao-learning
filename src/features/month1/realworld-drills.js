// Real-World Challenge runners:
// 1) Unscripted Situation Speaking  2) Street Listening (speed + ambience)
// 3) Pattern Substitution Workshop   4) Blind Hanzi Dictation (no outline)
import {
  STREET_LEVELS,
  UNSCRIPTED_PASS_PCT,
  PATTERNS,
  buildUnscriptedSession,
  gradeSituationAnswer,
  evaluateUnscriptedSession,
  buildStreetListeningSet,
  evaluateStreetSet,
  buildPatternDrill,
  gradePatternAnswer,
  evaluatePatternDrill,
  buildBlindDictationSet,
  judgeBlindResult,
  recordRealWorldResult
} from './realworld-logic.js';
import { getTodayBlueprintDay } from './logic.js';
import { hasSpeechRecognition, startSpeechRecognition } from '../speak-studio/speech.js';

function currentMaxDay(core) {
  return getTodayBlueprintDay(core.state.progress, core.getExt('month1') || {});
}

function persist(core, kind, key, payload, extraPatch) {
  const tk = core.todayKey();
  core.setExt('month1', (cur) => {
    let rw = recordRealWorldResult(cur.realWorld, kind, key, payload, tk);
    if (extraPatch) rw = extraPatch(rw);
    return { ...cur, realWorld: rw };
  }, { save: true, reason: `ด่านโลกจริง: ${kind}` });
}

function wasPassedBefore(core, kind, key) {
  return Boolean(core.getExt('month1')?.realWorld?.[kind]?.[key]?.passed);
}

function speakAtRate(core, hz, rate) {
  const prev = core.state.rate;
  core.state.rate = rate;
  try { core.speak(hz); } finally { core.state.rate = prev; }
}

// --- Web Audio ambience (café babble / subway rumble) ---
export function startAmbience(kind = 'cafe') {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return { stop() {} };
  let ctx;
  try { ctx = new Ctx(); } catch { return { stop() {} }; }
  try { ctx.resume?.(); } catch { /* ignore */ }

  const len = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);
  const nodes = [];

  const makeLayer = (filterType, freq, q, gainVal, lfoHz, lfoDepth) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    nodes.push(src);
    if (lfoHz) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoHz;
      const depth = ctx.createGain();
      depth.gain.value = lfoDepth;
      lfo.connect(depth);
      depth.connect(g.gain);
      lfo.start();
      nodes.push(lfo);
    }
  };

  if (kind === 'subway') {
    makeLayer('lowpass', 320, 0.7, 0.9, 0.12, 0.35);
    makeLayer('bandpass', 900, 0.6, 0.12, 0.5, 0.08);
  } else {
    // café: overlapping "voice-band" layers with syllabic amplitude modulation
    makeLayer('bandpass', 700, 0.8, 0.35, 3.1, 0.22);
    makeLayer('bandpass', 1300, 0.7, 0.28, 4.7, 0.18);
    makeLayer('lowpass', 500, 0.5, 0.25, 0.2, 0.1);
  }
  master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.8);

  return {
    stop() {
      try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); } catch { /* ignore */ }
      setTimeout(() => {
        nodes.forEach(n => { try { n.stop(); } catch { /* ignore */ } });
        try { ctx.close(); } catch { /* ignore */ }
      }, 320);
    }
  };
}

function head(core, tag, title, desc, pct, exitId = 'rw-exit') {
  return `
    <div class="m1-runner-head">
      <div>
        <span class="m1-tag">${core.escapeHtml(tag)}</span>
        <h3 style="margin:6px 0 2px">${core.escapeHtml(title)}</h3>
        ${desc ? `<p class="m1-muted" style="margin:0;font-size:12.5px">${core.escapeHtml(desc)}</p>` : ''}
      </div>
      <button type="button" class="btn-secondary m1-mini-btn" id="${exitId}">ออก</button>
    </div>
    <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.max(4, pct)}%"></div></div>`;
}

// ---------------------------------------------------------------------------
// 1) Unscripted Situation Speaking
// ---------------------------------------------------------------------------
export function renderUnscriptedSpeakingRunner(core, host, onDone) {
  const items = buildUnscriptedSession(currentMaxDay(core), 5, Date.now());
  const maxTries = 2;
  let idx = 0;
  const best = new Array(items.length).fill(null);
  const tries = new Array(items.length).fill(0);
  const hinted = new Array(items.length).fill(false);
  let heard = '';
  let err = '';
  let listening = false;
  let mic = null;
  const sr = hasSpeechRecognition();
  const stopMic = () => { if (mic) { try { mic.stop(); } catch { /* ignore */ } mic = null; } };

  const applyGrade = (text) => {
    tries[idx] += 1;
    const g = gradeSituationAnswer(items[idx], text);
    const pts = hinted[idx] ? Math.floor(g.points * 0.5 * 2) / 2 : g.points;
    const rec = { ...g, points: pts, text };
    if (!best[idx] || rec.points >= best[idx].points) best[idx] = rec;
    heard = text;
    core.playChime(g.passedItem ? 'ok' : 'err', true);
  };

  const finish = () => {
    stopMic();
    const res = evaluateUnscriptedSession(best.map(b => (b ? b.points : 0)));
    const first = !wasPassedBefore(core, 'unscripted', 'session');
    persist(core, 'unscripted', 'session', { pct: res.pct, passed: res.passed });
    if (res.passed) {
      core.addXp(first ? 60 : 15, `🗣️ ผ่านด่านพูดสดไร้สคริปต์ (${res.pct}%)`);
      core.spawnConfetti(30);
      core.playChime('levelup', true);
    } else {
      core.playChime('err', true);
    }
    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div style="text-align:center;padding:10px 6px 4px">
          <div style="font-size:48px">${res.passed ? '🗣️🏆' : '🔄'}</div>
          <span class="m1-status-pill ${res.passed ? 'pass' : 'fail'}">${res.passed ? `✅ พูดสดผ่านเกณฑ์ ≥ ${UNSCRIPTED_PASS_PCT}%` : `❌ ยังไม่ถึง ${UNSCRIPTED_PASS_PCT}% — ซ้อมแล้วท้าใหม่ได้ไม่จำกัด`}</span>
          <h2 style="margin:10px 0 4px" class="tabular-nums">${res.earned} / ${res.max} คะแนน (${res.pct}%)</h2>
        </div>
        <div class="m1-list">
          ${items.map((it, i) => `
            <div class="m1-item ${best[i] && best[i].passedItem ? 'done' : ''}" style="flex-direction:column;align-items:stretch">
              <div class="m1-muted" style="font-size:12.5px">${core.escapeHtml(it.cue)}</div>
              <div style="font-weight:700;margin-top:4px">${best[i] ? `${best[i].points}/2 คะแนน` : '0/2 (ไม่ได้ตอบ)'}${best[i] && best[i].missing.length ? ` · ขาด: ${core.escapeHtml(best[i].missing.join(', '))}` : ''}</div>
              <div class="hanzi-font" style="font-size:18px;margin-top:4px">${core.escapeHtml(it.model.hz)} <span class="m1-py">${core.escapeHtml(it.model.py)}</span></div>
              <div style="margin-top:6px"><button type="button" class="btn-secondary m1-mini-btn" data-say="${i}">🔊 ฟังประโยคตัวอย่าง</button></div>
            </div>`).join('')}
        </div>
        <div class="m1-runner-foot" style="justify-content:center;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn-primary" id="rw-again">🗣️ สุ่มสถานการณ์ชุดใหม่ท้าอีกครั้ง</button>
          <button type="button" class="btn-secondary" id="rw-done">กลับหน้าหลัก</button>
        </div>
      </div>`;
    host.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => core.speak(items[Number(b.dataset.say)].model.hz)));
    host.querySelector('#rw-again')?.addEventListener('click', () => renderUnscriptedSpeakingRunner(core, host, onDone));
    host.querySelector('#rw-done')?.addEventListener('click', () => onDone?.());
  };

  const render = () => {
    const it = items[idx];
    const cur = best[idx];
    host.innerHTML = `
      <div class="card-panel m1-runner">
        ${head(core, `🗣️ พูดสดไร้สคริปต์ · สถานการณ์ ${idx + 1}/${items.length}`, 'พูดภาษาจีนตามสถานการณ์ โดยไม่มีตัวจีน/พินอินให้ดู', `ครบทุกประเด็นที่ต้องสื่อ = 2 คะแนน · พูดได้ ${maxTries} ครั้ง · รวมต้อง ≥ ${UNSCRIPTED_PASS_PCT}%`, Math.round((idx / items.length) * 100))}
        <div class="m1-speak-exam-box">
          <div style="font-size:17px;font-weight:700;line-height:1.5;margin-bottom:12px">${core.escapeHtml(it.cue)}</div>
          <div class="m1-muted" style="font-size:12.5px;margin-bottom:10px">ต้องสื่อให้ครบ ${it.groups.length} ประเด็น</div>
          ${hinted[idx] ? `<div class="m1-chip-row" style="justify-content:center;margin-bottom:10px">${it.groups.map(g => `<span class="m1-chip">${core.escapeHtml(g.label)}</span>`).join('')}</div>` : `<button type="button" class="btn-secondary m1-mini-btn" id="rw-hint" style="margin-bottom:10px">💡 ขอคำใบ้ (หักคะแนนครึ่งหนึ่ง)</button>`}
          ${sr ? `
            <div><button type="button" class="btn-primary m1-mic-exam-btn ${listening ? 'is-listening' : ''}" id="rw-mic" ${tries[idx] >= maxTries && !listening ? 'disabled' : ''}>${listening ? '🔴 กำลังฟัง... พูดเลย!' : `🎙️ กดพูดออกไมค์ (${tries[idx]}/${maxTries})`}</button></div>
          ` : `
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              <input type="text" id="rw-typed" class="vb-search" style="max-width:340px" placeholder="เบราว์เซอร์ไม่รองรับไมค์ — พิมพ์ประโยคจีนหรือพินอินที่จะพูด">
              <button type="button" class="btn-primary" id="rw-typed-go" ${tries[idx] >= maxTries ? 'disabled' : ''}>ตรวจ (${tries[idx]}/${maxTries})</button>
            </div>`}
          ${err ? `<div style="color:var(--sys-red-text,#dc2626);font-size:13px;margin-top:10px">${core.escapeHtml(err)}</div>` : ''}
          ${cur ? `
            <div class="m1-speak-grade-card ${cur.passedItem ? 'ok' : 'err'}">
              <div style="font-weight:700">${cur.passedItem ? '✓ สื่อสารครบทุกประเด็น!' : `สื่อได้ ${cur.hits}/${cur.total} ประเด็น`} · ${cur.points}/2 คะแนน</div>
              ${heard ? `<div class="m1-muted" style="font-size:12.5px;margin-top:2px">ระบบได้ยิน: <b class="hanzi-font">${core.escapeHtml(heard)}</b></div>` : ''}
              ${cur.missing.length ? `<div style="font-size:12.5px;margin-top:4px">ยังขาด: ${core.escapeHtml(cur.missing.join(', '))}</div>` : ''}
              ${(cur.passedItem || tries[idx] >= maxTries) ? `<div class="hanzi-font" style="margin-top:6px;font-size:16px">ตัวอย่าง: ${core.escapeHtml(it.model.hz)} <span class="m1-py">${core.escapeHtml(it.model.py)}</span></div>` : ''}
            </div>` : ''}
        </div>
        <div class="m1-runner-foot">
          <button type="button" class="btn-primary" id="rw-next" ${cur && (cur.passedItem || tries[idx] >= maxTries) ? '' : 'disabled'}>${idx + 1 < items.length ? 'สถานการณ์ถัดไป →' : '📊 ส่งผลสอบพูดสด →'}</button>
        </div>
      </div>`;

    host.querySelector('#rw-exit')?.addEventListener('click', () => { stopMic(); onDone?.(); });
    host.querySelector('#rw-hint')?.addEventListener('click', () => { hinted[idx] = true; render(); });
    host.querySelector('#rw-next')?.addEventListener('click', () => {
      stopMic(); heard = ''; err = ''; idx += 1;
      if (idx >= items.length) finish(); else render();
    });
    host.querySelector('#rw-typed-go')?.addEventListener('click', () => {
      const v = host.querySelector('#rw-typed')?.value || '';
      if (!v.trim() || tries[idx] >= maxTries) return;
      err = ''; applyGrade(v); render();
    });
    host.querySelector('#rw-mic')?.addEventListener('click', () => {
      if (listening) { stopMic(); listening = false; render(); return; }
      if (tries[idx] >= maxTries) return;
      err = ''; listening = true; render();
      mic = startSpeechRecognition({
        lang: 'zh-CN',
        onResult(txt) { listening = false; applyGrade(txt); render(); },
        onError(m) { listening = false; err = m; render(); },
        onEnd() { if (listening) { listening = false; render(); } }
      });
    });
  };

  render();
}

// ---------------------------------------------------------------------------
// 2) Street Listening
// ---------------------------------------------------------------------------
export function renderStreetListeningRunner(core, host, onDone, levelId = null) {
  const ext = core.getExt('month1') || {};
  if (!levelId) {
    host.innerHTML = `
      <div class="card-panel m1-runner">
        ${head(core, '🎧 ฟังคนจีนพูดจริง', 'เลือกระดับความสมจริงของเสียง', 'ผ่านต้อง ≥ 90% (9/10 ข้อ) · สุ่มข้อใหม่ทุกครั้งที่ท้า', 5)}
        <div class="m1-list">
          ${Object.values(STREET_LEVELS).map(lv => {
            const r = ext.realWorld?.street?.[lv.id];
            return `
              <div class="m1-item ${r?.passed ? 'done' : ''}">
                <div>
                  <div style="font-weight:700">${core.escapeHtml(lv.label)}</div>
                  <div class="m1-muted" style="font-size:12.5px">ฟังซ้ำได้ ${lv.replays} ครั้งต่อข้อ ${lv.noise ? '· มีเสียงคาเฟ่/รถไฟใต้ดินคลอ' : ''} ${r ? `· สถิติ ${r.bestPct}%` : ''}</div>
                </div>
                <button type="button" class="btn-primary m1-mini-btn" data-lv="${lv.id}">${r?.passed ? '🔄 ท้าอีกรอบ' : '▶ เริ่มฟัง'}</button>
              </div>`;
          }).join('')}
        </div>
        <div class="m1-muted" style="font-size:12px;margin-top:10px">💡 แนะนำเปิดเสียงปานกลาง หูฟังจะเห็นผลชัดที่สุดในโหมดเสียงรบกวน</div>
      </div>`;
    host.querySelector('#rw-exit')?.addEventListener('click', () => onDone?.());
    host.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => renderStreetListeningRunner(core, host, onDone, b.dataset.lv)));
    return;
  }

  const set = buildStreetListeningSet(levelId, currentMaxDay(core), 10, Date.now());
  const level = set.level;
  const ambience = level.noise ? startAmbience(set.noiseKind) : { stop() {} };
  let idx = 0;
  let correct = 0;
  let replaysLeft = level.replays;
  let answered = null;
  const wrong = [];

  const cleanup = () => ambience.stop();
  const play = () => speakAtRate(core, set.questions[idx].hz, level.rate);

  const render = () => {
    if (idx >= set.questions.length) {
      cleanup();
      const res = evaluateStreetSet(correct, set.questions.length, level.passPct);
      const first = !wasPassedBefore(core, 'street', level.id);
      persist(core, 'street', level.id, { pct: res.pct, passed: res.passed });
      if (res.passed) {
        core.addXp(first ? 40 : 10, `🎧 ผ่านด่านฟังจริง: ${level.label}`);
        core.spawnConfetti(26);
        core.playChime('levelup', true);
      } else {
        core.playChime('err', true);
      }
      host.innerHTML = `
        <div class="card-panel m1-runner" style="text-align:center;padding:24px 16px">
          <div style="font-size:48px">${res.passed ? '🎧🏆' : '🔄'}</div>
          <span class="m1-status-pill ${res.passed ? 'pass' : 'fail'}">${res.passed ? `✅ ผ่านด่าน ${core.escapeHtml(level.label)}` : `❌ ต้อง ≥ ${level.passPct}% — ยังไม่ผ่าน`}</span>
          <h2 style="margin:10px 0" class="tabular-nums">${res.correct} / ${res.total} ข้อ (${res.pct}%)</h2>
          ${wrong.length ? `<div class="m1-missed-panel" style="text-align:left"><h4 style="margin:0 0 8px">ข้อที่พลาด (ฟังซ้ำให้ชินหู):</h4><div class="m1-list">${wrong.map((w, i) => `
            <div class="m1-item"><div><div class="m1-hz hanzi-font">${core.escapeHtml(w.hz)} <span class="m1-py">${core.escapeHtml(w.py)}</span></div><div class="m1-muted">${core.escapeHtml(w.th)}</div></div>
            <div class="m1-row-btns"><button type="button" class="btn-secondary m1-mini-btn" data-wslow="${i}">🐢 ช้า</button><button type="button" class="btn-secondary m1-mini-btn" data-wfast="${i}">⚡ เร็ว</button></div></div>`).join('')}</div></div>` : ''}
          <div class="m1-runner-foot" style="justify-content:center;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="rw-retry">🎧 ท้าระดับนี้อีกครั้ง (สุ่มข้อใหม่)</button>
            <button type="button" class="btn-secondary" id="rw-levels">เลือกระดับอื่น</button>
            <button type="button" class="btn-secondary" id="rw-done">กลับหน้าหลัก</button>
          </div>
        </div>`;
      host.querySelectorAll('[data-wslow]').forEach(b => b.addEventListener('click', () => speakAtRate(core, wrong[Number(b.dataset.wslow)].hz, 0.6)));
      host.querySelectorAll('[data-wfast]').forEach(b => b.addEventListener('click', () => speakAtRate(core, wrong[Number(b.dataset.wfast)].hz, 1.2)));
      host.querySelector('#rw-retry')?.addEventListener('click', () => renderStreetListeningRunner(core, host, onDone, level.id));
      host.querySelector('#rw-levels')?.addEventListener('click', () => renderStreetListeningRunner(core, host, onDone, null));
      host.querySelector('#rw-done')?.addEventListener('click', () => onDone?.());
      return;
    }

    const q = set.questions[idx];
    host.innerHTML = `
      <div class="card-panel m1-runner">
        ${head(core, `🎧 ${level.label} · ข้อ ${idx + 1}/${set.questions.length}`, 'ฟังแล้วเลือกความหมายภาษาไทย', `เหลือสิทธิ์ฟังซ้ำ ${replaysLeft} ครั้ง ${set.noiseKind ? `· เสียงฉาก: ${set.noiseKind === 'subway' ? 'รถไฟใต้ดิน' : 'คาเฟ่'}` : ''}`, Math.round((idx / set.questions.length) * 100))}
        <div style="margin-bottom:12px"><button type="button" class="btn-primary" id="rw-replay" ${replaysLeft <= 0 || answered ? 'disabled' : ''}>🔊 ฟังอีกครั้ง (${replaysLeft})</button></div>
        <div class="m1-exam-choices">
          ${q.options.map((o, oi) => `<button type="button" class="m1-exam-opt" data-opt="${oi}" ${answered ? 'disabled' : ''} ${answered && oi === q.answer ? 'style="border-color:var(--sys-green,#34c759);background:rgba(52,199,89,.12)"' : ''} ${answered && oi === answered.picked && !answered.ok ? 'style="border-color:var(--sys-red,#ff3b30);background:rgba(255,59,48,.1)"' : ''}><span class="m1-opt-num">${oi + 1}</span><span>${core.escapeHtml(o)}</span></button>`).join('')}
        </div>
        ${answered ? `
          <div class="m1-speak-grade-card ${answered.ok ? 'ok' : 'err'}" style="margin-top:12px">
            <div style="font-weight:700">${answered.ok ? '✓ ถูกต้อง!' : '✗ ยังไม่ถูก'}</div>
            <div class="hanzi-font" style="margin-top:4px">${core.escapeHtml(q.hz)} <span class="m1-py">${core.escapeHtml(q.py)}</span> = ${core.escapeHtml(q.th)}</div>
          </div>
          <div class="m1-runner-foot"><button type="button" class="btn-primary" id="rw-next">${idx + 1 < set.questions.length ? 'ข้อถัดไป →' : 'ดูผล →'}</button></div>` : ''}
      </div>`;
    host.querySelector('#rw-exit')?.addEventListener('click', () => { cleanup(); onDone?.(); });
    host.querySelector('#rw-replay')?.addEventListener('click', () => { if (replaysLeft > 0) { replaysLeft -= 1; play(); render(); } });
    host.querySelector('#rw-next')?.addEventListener('click', () => { idx += 1; answered = null; replaysLeft = level.replays; render(); if (idx < set.questions.length) setTimeout(play, 350); });
    host.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => {
      const picked = Number(b.dataset.opt);
      const ok = picked === q.answer;
      answered = { picked, ok };
      if (ok) { correct += 1; core.playChime('ok', true); } else { wrong.push(q); core.playChime('err', true); }
      render();
    }));
  };

  render();
  setTimeout(play, 700);
}

// ---------------------------------------------------------------------------
// 3) Pattern Substitution Workshop
// ---------------------------------------------------------------------------
export function renderPatternWorkshopRunner(core, host, onDone, patternId = null) {
  const ext = core.getExt('month1') || {};
  if (!patternId) {
    host.innerHTML = `
      <div class="card-panel m1-runner">
        ${head(core, '🧩 โรงฝึกพลิกแพลงประโยค (举一反三)', 'เลือกโครงสร้างไวยากรณ์ที่อยากฝึก', 'เรียงแผ่นคำ 5 ข้อติดจากโครงสร้างเดียวกัน — ต้องถูกครบ 5/5', 5)}
        <div class="m1-list">
          ${PATTERNS.map(p => {
            const r = ext.realWorld?.pattern?.[p.id];
            return `
              <div class="m1-item ${r?.passed ? 'done' : ''}">
                <div>
                  <div style="font-weight:700">${core.escapeHtml(p.title)}</div>
                  <div class="m1-muted" style="font-size:12.5px">${core.escapeHtml(p.rule)}</div>
                </div>
                <button type="button" class="btn-primary m1-mini-btn" data-pat="${p.id}">${r?.passed ? '✅ ฝึกซ้ำ' : '▶ เริ่มฝึก'}</button>
              </div>`;
          }).join('')}
        </div>
        <div class="m1-runner-foot"><button type="button" class="btn-secondary" id="rw-pat-random">🎲 สุ่มโครงสร้างให้</button></div>
      </div>`;
    host.querySelector('#rw-exit')?.addEventListener('click', () => onDone?.());
    host.querySelectorAll('[data-pat]').forEach(b => b.addEventListener('click', () => renderPatternWorkshopRunner(core, host, onDone, b.dataset.pat)));
    host.querySelector('#rw-pat-random')?.addEventListener('click', () => renderPatternWorkshopRunner(core, host, onDone, PATTERNS[Math.floor(Math.random() * PATTERNS.length)].id));
    return;
  }

  const drill = buildPatternDrill(patternId, Date.now());
  let idx = 0;
  let correct = 0;
  let picked = [];
  let feedback = null;

  const render = () => {
    if (idx >= drill.items.length) {
      const res = evaluatePatternDrill(correct, drill.items.length);
      const first = !wasPassedBefore(core, 'pattern', drill.pattern.id);
      persist(core, 'pattern', drill.pattern.id, { pct: res.pct, passed: res.passed });
      if (res.passed) {
        core.addXp(first ? 35 : 8, `🧩 ผ่านโรงฝึกโครงสร้าง ${drill.pattern.title}`);
        core.spawnConfetti(24);
        core.playChime('levelup', true);
      } else {
        core.playChime('err', true);
      }
      host.innerHTML = `
        <div class="card-panel m1-runner" style="text-align:center;padding:24px 16px">
          <div style="font-size:48px">${res.passed ? '🧩🏆' : '🔄'}</div>
          <span class="m1-status-pill ${res.passed ? 'pass' : 'fail'}">${res.passed ? '✅ พลิกแพลงถูกครบ 5/5' : `❌ ได้ ${res.correct}/5 — ต้องถูกครบทุกข้อ`}</span>
          <h3 style="margin:10px 0 4px">${core.escapeHtml(drill.pattern.title)}</h3>
          <div class="m1-runner-foot" style="justify-content:center;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="rw-pat-again">🧩 ฝึกโครงสร้างนี้อีกรอบ (สลับข้อใหม่)</button>
            <button type="button" class="btn-secondary" id="rw-pat-menu">เลือกโครงสร้างอื่น</button>
            <button type="button" class="btn-secondary" id="rw-done">กลับหน้าหลัก</button>
          </div>
        </div>`;
      host.querySelector('#rw-pat-again')?.addEventListener('click', () => renderPatternWorkshopRunner(core, host, onDone, drill.pattern.id));
      host.querySelector('#rw-pat-menu')?.addEventListener('click', () => renderPatternWorkshopRunner(core, host, onDone, null));
      host.querySelector('#rw-done')?.addEventListener('click', () => onDone?.());
      return;
    }

    const it = drill.items[idx];
    const built = picked.map(i => it.tiles[i].hz);
    host.innerHTML = `
      <div class="card-panel m1-runner">
        ${head(core, `🧩 ${drill.pattern.title} · ข้อ ${idx + 1}/${drill.items.length}`, `เรียงเป็นประโยค: "${it.th}"`, drill.pattern.rule, Math.round((idx / drill.items.length) * 100))}
        <div class="m1-order-answer">
          ${picked.length ? picked.map((ti, pos) => `<button type="button" class="m1-order-chip chosen" data-unpick="${pos}" ${feedback ? 'disabled' : ''}><span class="hanzi-font">${core.escapeHtml(it.tiles[ti].hz)}</span><small class="m1-tile-py">${core.escapeHtml(it.tiles[ti].py)}</small></button>`).join('') : '<span class="m1-muted">แตะแผ่นคำด้านล่างมาเรียง...</span>'}
        </div>
        <div class="m1-order-bank">
          ${it.tiles.map((t, ti) => `<button type="button" class="m1-order-chip" data-pick="${ti}" ${picked.includes(ti) || feedback ? 'disabled' : ''}><span class="hanzi-font">${core.escapeHtml(t.hz)}</span><small class="m1-tile-py">${core.escapeHtml(t.py)}</small></button>`).join('')}
        </div>
        ${feedback ? `
          <div class="m1-speak-grade-card ${feedback.ok ? 'ok' : 'err'}" style="margin-top:12px">
            <div style="font-weight:700">${feedback.ok ? '✓ ถูกต้อง!' : '✗ ยังไม่ถูก'}</div>
            <div class="hanzi-font" style="margin-top:4px">${core.escapeHtml(it.expectedHz)} <span class="m1-py">${core.escapeHtml(it.expectedPy)}</span></div>
          </div>
          <div class="m1-runner-foot" style="gap:8px"><button type="button" class="btn-secondary" id="rw-pat-say">🔊 ฟังประโยค</button><button type="button" class="btn-primary" id="rw-pat-next">${idx + 1 < drill.items.length ? 'ข้อถัดไป →' : 'ดูผล →'}</button></div>
        ` : `
          <div class="m1-runner-foot" style="justify-content:space-between;gap:8px">
            <button type="button" class="btn-secondary" id="rw-pat-clear" ${picked.length ? '' : 'disabled'}>ล้าง</button>
            <button type="button" class="btn-primary" id="rw-pat-submit" ${picked.length === it.tiles.length ? '' : 'disabled'}>ส่งคำตอบ →</button>
          </div>`}
      </div>`;
    host.querySelector('#rw-exit')?.addEventListener('click', () => onDone?.());
    host.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { picked.push(Number(b.dataset.pick)); render(); }));
    host.querySelectorAll('[data-unpick]').forEach(b => b.addEventListener('click', () => { picked.splice(Number(b.dataset.unpick), 1); render(); }));
    host.querySelector('#rw-pat-clear')?.addEventListener('click', () => { picked = []; render(); });
    host.querySelector('#rw-pat-submit')?.addEventListener('click', () => {
      const ok = gradePatternAnswer(it, built);
      if (ok) { correct += 1; core.playChime('ok', true); } else { core.playChime('err', true); }
      feedback = { ok };
      render();
    });
    host.querySelector('#rw-pat-say')?.addEventListener('click', () => core.speak(it.expectedHz));
    host.querySelector('#rw-pat-next')?.addEventListener('click', () => { idx += 1; picked = []; feedback = null; render(); });
  };

  render();
}

// ---------------------------------------------------------------------------
// 4) Blind Hanzi Dictation (no outline, no hint)
// ---------------------------------------------------------------------------
export function renderBlindDictationRunner(core, host, onDone) {
  const items = buildBlindDictationSet(currentMaxDay(core), 5, Date.now());
  const status = new Array(items.length).fill('pending'); // pending | pass | skipped
  let idx = 0;
  let lastResult = null;
  let loadError = false;
  const HW = window.HanziWriter;

  const finish = () => {
    const passedChars = items.filter((_, i) => status[i] === 'pass').map(it => it.hz);
    const needed = items.filter((_, i) => status[i] !== 'skipped').length;
    const ok = passedChars.length >= 3 && passedChars.length === needed;
    const pct = Math.round((passedChars.length / items.length) * 100);
    const first = !wasPassedBefore(core, 'blind', 'session');
    persist(core, 'blind', 'session', { pct, passed: ok }, (rw) => ({
      ...rw,
      blindChars: [...new Set([...(Array.isArray(rw.blindChars) ? rw.blindChars : []), ...passedChars])]
    }));
    if (ok) {
      core.addXp(first ? 50 : 12, `✍️ เขียนไร้รอยประครบ ${passedChars.length} ตัว`);
      core.spawnConfetti(28);
      core.playChime('levelup', true);
    }
    host.innerHTML = `
      <div class="card-panel m1-runner" style="text-align:center;padding:24px 16px">
        <div style="font-size:48px">${ok ? '✍️🏆' : '✍️'}</div>
        <span class="m1-status-pill ${ok ? 'pass' : 'fail'}">${ok ? '✅ เขียนได้โดยไม่ดูแบบ!' : 'ยังเขียนไม่ครบ'}</span>
        <h3 style="margin:10px 0">ผ่าน ${passedChars.length}/${items.length} ตัว</h3>
        <div class="m1-chip-row" style="justify-content:center">${items.map((it, i) => `<span class="m1-chip hanzi-font ${status[i] === 'pass' ? 'active' : ''}" style="font-size:20px">${core.escapeHtml(it.hz)}</span>`).join('')}</div>
        <div class="m1-runner-foot" style="justify-content:center;gap:10px;flex-wrap:wrap;margin-top:16px">
          <button type="button" class="btn-primary" id="rw-bl-again">✍️ สุ่มอักษรชุดใหม่เขียนอีกรอบ</button>
          <button type="button" class="btn-secondary" id="rw-done">กลับหน้าหลัก</button>
        </div>
      </div>`;
    host.querySelector('#rw-bl-again')?.addEventListener('click', () => renderBlindDictationRunner(core, host, onDone));
    host.querySelector('#rw-done')?.addEventListener('click', () => onDone?.());
  };

  const mountWriter = () => {
    const it = items[idx];
    const box = host.querySelector('#rw-bl-box');
    if (!box || !HW) return;
    box.innerHTML = '';
    loadError = false;
    const isDark = document.documentElement.classList.contains('theme-dark');
    const writer = HW.create(box, it.hz, {
      width: 260,
      height: 260,
      padding: 18,
      showCharacter: false,
      showOutline: false,
      showHintAfterMisses: false,
      highlightOnComplete: true,
      drawingWidth: 16,
      strokeColor: isDark ? '#f5f5f7' : '#1d1d1f',
      drawingColor: isDark ? '#0a84ff' : '#007aff',
      onLoadCharDataError: () => {
        loadError = true;
        const msg = host.querySelector('#rw-bl-msg');
        if (msg) msg.textContent = 'โหลดข้อมูลลำดับขีดของตัวนี้ไม่ได้ (ต้องต่ออินเทอร์เน็ต) — กดข้ามได้';
        const skip = host.querySelector('#rw-bl-skip');
        if (skip) skip.hidden = false;
      }
    });
    writer.quiz({
      onMistake: () => {
        const msg = host.querySelector('#rw-bl-msg');
        if (msg) msg.textContent = 'ขีดไม่ตรง! (ไม่มีขีดใบ้ให้ในโหมดนี้ — ผิดได้ไม่เกิน 1 ครั้งต่อตัว)';
      },
      onComplete: (summary) => {
        const j = judgeBlindResult(summary?.totalMistakes || 0);
        lastResult = j;
        if (j.passed) { status[idx] = 'pass'; core.playChime('ok', true); } else { core.playChime('err', true); }
        const msg = host.querySelector('#rw-bl-msg');
        if (msg) msg.textContent = j.passed ? `✓ เขียนได้ (พลาด ${j.mistakes} ครั้ง)` : `✗ พลาด ${j.mistakes} ครั้ง (เกินกำหนด) — ลองเขียนตัวนี้ใหม่`;
        core.speak(it.hz);
        const next = host.querySelector('#rw-bl-next'); if (next) next.hidden = !j.passed;
        const retry = host.querySelector('#rw-bl-retry'); if (retry) retry.hidden = j.passed;
      }
    });
  };

  const render = () => {
    if (idx >= items.length) { finish(); return; }
    const it = items[idx];
    lastResult = null;
    host.innerHTML = `
      <div class="card-panel m1-runner">
        ${head(core, `✍️ เขียนตามคำบอกไร้รอยประ · ตัวที่ ${idx + 1}/${items.length}`, `เขียนตัวอักษรที่แปลว่า "${it.th}"`, 'ไม่มีเส้นร่าง ไม่มีขีดใบ้ — ลากขีดตามลำดับจากความจำ (พลาดได้ไม่เกิน 1 ครั้ง)', Math.round((idx / items.length) * 100))}
        ${HW ? `
          <div style="text-align:center">
            <div class="m1-py" style="font-size:18px;margin-bottom:6px">${core.escapeHtml(it.py)}</div>
            <button type="button" class="btn-secondary m1-mini-btn" id="rw-bl-say" style="margin-bottom:8px">🔊 ฟังเสียงตัวอักษร</button>
            <div id="rw-bl-box" style="display:inline-block;width:260px;height:260px;border:2px solid #e11d48;border-radius:6px;background:#fffdf7;position:relative;background-image:linear-gradient(to right,transparent 49.6%,rgba(225,29,72,.3) 50%,transparent 50.4%),linear-gradient(to bottom,transparent 49.6%,rgba(225,29,72,.3) 50%,transparent 50.4%)"></div>
            <div id="rw-bl-msg" class="m1-muted" style="min-height:22px;margin-top:8px;font-size:13px">เริ่มลากขีดแรกได้เลย</div>
          </div>
          <div class="m1-runner-foot" style="justify-content:center;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-secondary" id="rw-bl-retry" hidden>🔄 เขียนตัวนี้ใหม่</button>
            <button type="button" class="btn-secondary" id="rw-bl-skip" hidden>ข้ามตัวนี้ (ไม่นับ)</button>
            <button type="button" class="btn-primary" id="rw-bl-next" hidden>${idx + 1 < items.length ? 'ตัวถัดไป →' : 'ดูผล →'}</button>
          </div>` : `<div class="m1-muted" style="padding:16px 0">ไม่พบตัวเขียน HanziWriter (ต้องโหลดหน้าเว็บให้สมบูรณ์ก่อน)</div>`}
      </div>`;
    host.querySelector('#rw-exit')?.addEventListener('click', () => onDone?.());
    host.querySelector('#rw-bl-say')?.addEventListener('click', () => core.speak(it.hz));
    host.querySelector('#rw-bl-retry')?.addEventListener('click', () => render());
    host.querySelector('#rw-bl-skip')?.addEventListener('click', () => { status[idx] = 'skipped'; idx += 1; render(); });
    host.querySelector('#rw-bl-next')?.addEventListener('click', () => { idx += 1; render(); });
    setTimeout(() => core.speak(it.hz), 250);
    mountWriter();
  };

  render();
}
