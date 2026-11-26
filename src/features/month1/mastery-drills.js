// Complete Mastery Loop Runners:
// 1) Auto-Enroll Day Vocabulary/Sentences into FSRS (`enrollDayInFsrs`)
// 2) Objective Quiz-Backed FSRS Morning Gate (`renderFsrsQuizGate`)
// 3) 7/21-Day Memory Decay Speed Re-Verify (`renderDecayReverifyRunner`)
// 4) 4-Second Reflex Speaking Trainer (`renderReflexSpeakingRunner`)
// 5) Infinite Adaptive Weakness Grinder (`renderWeaknessGrinder`)
// 6) Weekly Cumulative Boss Exam Day 7/14/21/30 >=95% (`renderWeeklyBossRunner`)

import {
  DAILY_MASTERY_PASS_PCT,
  collectDayFsrsItems,
  getDueMonth1FsrsCards,
  gradeQuizFsrsResponse,
  buildDecayPopQuiz,
  buildWeeklyBossExam,
  diagnoseWeakDaysFromBoss,
  buildReflexPrompts,
  buildWeaknessQueue,
  gradeSpeakingExamItem,
  evaluateDailyMasteryAttempt,
  getProgressivePinyin,
  getTodayBlueprintDay
} from './logic.js';
import { SURVIVAL_50 } from './data-month1.js';
import { computeNextFsrs } from '../../modules/srs-sm2.js';
import { hasSpeechRecognition, startSpeechRecognition, getCharPinyinMap } from '../speak-studio/speech.js';
import { stripToneAndNumber, splitPinyinSyllables } from '../speak-studio/scoring.js';

/**
 * Automatically enrolls all studied items of `dayNum` into `ext.month1.fsrsDeck`
 * AND syncs matching words into global `progress.vocabLearned` + `progress.vocabSrs`.
 */
export function enrollDayInFsrs(core, dayNum) {
  const tk = core.todayKey();
  const items = collectDayFsrsItems(dayNum);
  core.setExt('month1', (cur) => {
    const deck = { ...(cur.fsrsDeck || {}) };
    for (const item of items) {
      const existing = deck[item.id];
      const nextSrs = existing?.srs
        ? existing.srs
        : computeNextFsrs(null, 'good', tk, Date.now());
      deck[item.id] = {
        ...item,
        enrolledAt: existing?.enrolledAt || tk,
        srs: nextSrs,
        updatedAt: Date.now()
      };
    }
    return { ...cur, fsrsDeck: deck };
  }, { save: false });

  // Also link matching single/compound words in global vocab bank into vocabLearned & vocabSrs
  const allWords = Array.isArray(core.allVocabWords) ? core.allVocabWords : [];
  if (allWords.length && core.state?.progress) {
    const p = core.state.progress;
    p.vocabLearned = p.vocabLearned || {};
    p.vocabSrs = p.vocabSrs || {};
    const hzSet = new Set(items.map(x => x.hz));
    for (const w of allWords) {
      const whz = w.hanzi || w.zh || '';
      if (whz && hzSet.has(whz)) {
        if (!p.vocabLearned[w.id]) p.vocabLearned[w.id] = tk;
        if (!p.vocabSrs[w.id]) p.vocabSrs[w.id] = computeNextFsrs(null, 'good', tk, Date.now());
      }
    }
  }
}

/**
 * 1) Objective Quiz-Backed FSRS Runner (Morning Gate or Anytime Review).
 * Forces answering multiple-choice before revealing; wrong cards re-queue until 0 due remain!
 */
export function renderFsrsQuizGate(core, host, { onCleared, onExit, gateForDay = null } = {}) {
  const tk = core.todayKey();
  const ext = core.getExt('month1') || {};
  const initialDue = getDueMonth1FsrsCards(ext.fsrsDeck || {}, tk);
  if (!initialDue.length) {
    onCleared?.();
    return;
  }

  const queue = [...initialDue];
  let idx = 0;
  let shownAt = Date.now();
  let feedback = null;
  let currentChoices = null;

  const buildChoicesFor = (card) => {
    const others = core.shuffleArray(SURVIVAL_50.filter(x => x.th !== card.th)).slice(0, 3).map(x => x.th);
    return core.shuffleArray([card.th, ...others]);
  };

  const render = () => {
    if (idx >= queue.length) {
      core.addXp(20, '🧠 เคลียร์การ์ดทวน FSRS ประจำวันครบทุกใบ!');
      core.spawnConfetti(28);
      core.playChime('levelup', true);
      host.innerHTML = `
        <div class="card-panel m1-runner" style="text-align:center;padding:28px 18px">
          <div style="font-size:48px">🧠✨</div>
          <h2 style="margin:8px 0">เคลียร์การ์ดทวน FSRS ครบ 100% แล้ว! (+20 XP)</h2>
          <p class="m1-muted">ความจำเก่าถูกล็อกเข้าสมองระยะยาวเรียบร้อย พร้อมเปิดรับบทเรียนใหม่แล้วครับ</p>
          <div style="display:flex;justify-content:center;gap:10px;margin-top:16px;flex-wrap:wrap">
            ${gateForDay ? `<button type="button" class="btn-primary" id="m1-fsrs-go-day">🚀 เข้าสู่บทเรียน Day ${gateForDay} ต่อทันที →</button>` : ''}
            <button type="button" class="btn-secondary" id="m1-fsrs-done">กลับหน้าหลัก</button>
          </div>
        </div>
      `;
      host.querySelector('#m1-fsrs-go-day')?.addEventListener('click', () => onCleared?.());
      host.querySelector('#m1-fsrs-done')?.addEventListener('click', () => (gateForDay ? onCleared?.() : onExit?.()));
      return;
    }

    const card = queue[idx];
    if (!currentChoices) {
      currentChoices = buildChoicesFor(card);
      shownAt = Date.now();
    }
    const rPct = Math.round((card.retrievability || 0.9) * 100);
    const pyHint = getProgressivePinyin(card.hz, card.py, Math.max(15, card.sourceDay || 15));

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">${gateForDay ? `🔒 ด่านทวน FSRS ก่อนเริ่ม Day ${gateForDay}` : '🧠 ทวนความจำ Quiz-FSRS'} · ใบที่ ${idx + 1}/${queue.length}</span>
            <h3 style="margin:6px 0 2px">ต้องตอบให้ถูกครบทุกใบก่อนเปิดบทใหม่ (โอกาสจำได้ตอนนี้ ${rPct}%)</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">ระบบจับเวลาตอบจริงเพื่อคำนวณวันทวนรอบถัดไปอัตโนมัติ (ตอบผิดวนซ้ำจนจำแม่น)</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="m1-fsrs-exit">ออก</button>
        </div>
        <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.round((idx / queue.length) * 100)}%"></div></div>

        <div class="m1-speak-exam-box" style="margin-bottom:14px">
          <div class="hanzi-font" style="font-size:34px;font-weight:700">${core.escapeHtml(card.hz)}</div>
          ${feedback ? `<div class="m1-py" style="font-size:17px;margin-top:4px">${core.escapeHtml(card.py)}</div>` : (pyHint ? `<div class="m1-py" style="margin-top:4px">${core.escapeHtml(pyHint)}</div>` : '')}
          <div style="margin-top:10px">
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-fsrs-audio">🔊 ฟังเสียง</button>
          </div>
        </div>

        ${feedback ? `
          <div class="m1-speak-grade-card ${feedback.ok ? 'ok' : 'err'}" style="text-align:center">
            <div style="font-weight:700;font-size:15px">${core.escapeHtml(feedback.msg)}</div>
            <div class="m1-muted" style="font-size:13px;margin-top:4px">${core.escapeHtml(card.hz)} (${core.escapeHtml(card.py)}) = <b>${core.escapeHtml(card.th)}</b></div>
          </div>
          <div class="m1-runner-foot">
            <button type="button" class="btn-primary" id="m1-fsrs-next">การ์ดถัดไป →</button>
          </div>
        ` : `
          <div class="m1-exam-choices">
            ${currentChoices.map((opt, ci) => `
              <button type="button" class="m1-exam-opt" data-f-pick="${ci}">
                <span class="m1-opt-num">${ci + 1}</span>
                <span>${core.escapeHtml(opt)}</span>
              </button>
            `).join('')}
          </div>
        `}
      </div>
    `;

    host.querySelector('#m1-fsrs-exit')?.addEventListener('click', () => onExit?.());
    host.querySelector('#m1-fsrs-audio')?.addEventListener('click', () => core.speak(card.hz));
    host.querySelectorAll('[data-f-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const picked = currentChoices[Number(btn.dataset.fPick)];
        const elapsedMs = Date.now() - shownAt;
        const isCorrect = picked === card.th;
        const rate = gradeQuizFsrsResponse({ isCorrect, elapsedMs });
        const nextSrs = computeNextFsrs(card.srs, rate, tk, Date.now());

        core.setExt('month1', (cur) => {
          const deck = { ...(cur.fsrsDeck || {}) };
          deck[card.id] = { ...card, srs: nextSrs, updatedAt: Date.now() };
          return { ...cur, fsrsDeck: deck };
        }, { save: true });

        core.speak(card.hz);
        if (!isCorrect) {
          queue.push({ ...card, srs: nextSrs });
          core.playChime('err', true);
          feedback = { ok: false, msg: `✗ ยังไม่ถูก! ระบบจัดเข้าท้ายคิวให้ทวนซ้ำในรอบนี้ทันที` };
        } else {
          core.playChime('ok', true);
          feedback = {
            ok: true,
            msg: `✓ ถูกต้องใน ${(elapsedMs / 1000).toFixed(1)} วินาที! (ระดับ ${rate.toUpperCase()} → นัดทวนอีก +${nextSrs.interval} วัน)`
          };
        }
        render();
      });
    });
    host.querySelector('#m1-fsrs-next')?.addEventListener('click', () => {
      idx += 1;
      feedback = null;
      currentChoices = null;
      render();
    });
  };

  render();
}

/**
 * 2) 7/21-Day Memory Decay Speed Re-Verify Runner (5 items = 6 points, >=95% required).
 */
export function renderDecayReverifyRunner(core, host, dayNum, onDone) {
  const pop = buildDecayPopQuiz(dayNum, { seed: Date.now() });
  let qIdx = 0;
  let quizCorrect = 0;
  let selectedOrder = [];
  let speakRes = null;
  let modelUsed = false;
  let tries = 0;
  let micListening = false;
  let activeMic = null;
  let charPyMap = null;
  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  const stopMic = () => {
    if (activeMic) {
      try { activeMic.stop(); } catch { /* ignore */ }
      activeMic = null;
    }
  };

  const renderFinish = () => {
    const spPts = speakRes ? speakRes.points : 0;
    const evalRes = evaluateDailyMasteryAttempt({
      quizCorrect,
      quizTotal: pop.questions.length,
      speakingPoints: spPts,
      speakingMax: 2
    });
    const tk = core.todayKey();
    core.setExt('month1', (cur) => {
      const dm = { ...(cur.dayMastery || {}) };
      const prev = dm[dayNum] || {};
      if (evalRes.passed) {
        dm[dayNum] = {
          ...prev,
          lastVerifiedAt: tk,
          verifyTier: (Number(prev.verifyTier) || 0) + 1,
          updatedAt: Date.now()
        };
      }
      return { ...cur, dayMastery: dm };
    }, { save: true });

    if (evalRes.passed) {
      core.addXp(25, `🔔 ยืนยันความจำระยะยาว Day ${dayNum} ผ่านฉลุย (${evalRes.pct}%)!`);
      core.spawnConfetti(30);
      core.playChime('levelup', true);
    } else {
      core.playChime('err', true);
    }

    host.innerHTML = `
      <div class="card-panel m1-runner" style="text-align:center;padding:26px 18px">
        <div style="font-size:48px">${evalRes.passed ? '🛡️' : '⚠️'}</div>
        <span class="m1-status-pill ${evalRes.passed ? 'pass' : 'fail'}">
          ${evalRes.passed ? `✅ ความจำ Day ${dayNum} ยังแน่นปึ้ก (${evalRes.pct}%)!` : `❌ ได้ ${evalRes.pct}% — ความจำเริ่มจาง ต้องทบทวนซ้ำ!`}
        </span>
        <h3 style="margin:10px 0 6px">${evalRes.earnedPoints} / ${evalRes.totalPoints} คะแนน (เกณฑ์ ≥ ${DAILY_MASTERY_PASS_PCT}%)</h3>
        <div style="display:flex;justify-content:center;gap:10px;margin-top:16px;flex-wrap:wrap">
          ${!evalRes.passed ? `<button type="button" class="btn-primary" id="m1-dec-retry">🔄 สอบเช็กความจำใหม่อีกครั้ง</button>` : ''}
          <button type="button" class="btn-secondary" id="m1-dec-done">กลับหน้าหลัก</button>
        </div>
      </div>
    `;
    host.querySelector('#m1-dec-retry')?.addEventListener('click', () => renderDecayReverifyRunner(core, host, dayNum, onDone));
    host.querySelector('#m1-dec-done')?.addEventListener('click', () => onDone?.());
  };

  const renderStep = () => {
    if (qIdx < pop.questions.length) {
      const q = pop.questions[qIdx];
      if (q.kind === 'order') {
        const built = selectedOrder.map(i => q.tiles[i]).join('');
        host.innerHTML = `
          <div class="card-panel m1-runner">
            <div class="m1-runner-head">
              <div>
                <span class="m1-tag">🔔 เช็กความจำเสื่อม Day ${dayNum} · ข้อ ${qIdx + 1}/5</span>
                <h3 style="margin:6px 0 2px">${core.escapeHtml(q.prompt)}</h3>
              </div>
              <button type="button" class="btn-secondary m1-mini-btn" id="m1-dec-exit">ออก</button>
            </div>
            <div class="m1-order-answer">
              ${selectedOrder.length
                ? selectedOrder.map((ti, pos) => `<button type="button" class="m1-order-chip chosen" data-unpick="${pos}"><span class="hanzi-font">${core.escapeHtml(q.tiles[ti])}</span></button>`).join('')
                : '<span class="m1-muted">แตะแผ่นคำด้านล่าง...</span>'}
            </div>
            <div class="m1-order-bank">
              ${q.tiles.map((t, ti) => `<button type="button" class="m1-order-chip" data-pick="${ti}" ${selectedOrder.includes(ti) ? 'disabled' : ''}><span class="hanzi-font">${core.escapeHtml(t)}</span>${q.tilePinyins?.[ti] ? `<small class="m1-tile-py">${core.escapeHtml(q.tilePinyins[ti])}</small>` : ''}</button>`).join('')}
            </div>
            <div class="m1-runner-foot">
              <button type="button" class="btn-primary" id="m1-dec-sub" ${selectedOrder.length === q.tiles.length ? '' : 'disabled'}>ส่งคำตอบ →</button>
            </div>
          </div>
        `;
        host.querySelector('#m1-dec-exit')?.addEventListener('click', () => { stopMic(); onDone?.(); });
        host.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { selectedOrder.push(Number(b.dataset.pick)); renderStep(); }));
        host.querySelectorAll('[data-unpick]').forEach(b => b.addEventListener('click', () => { selectedOrder.splice(Number(b.dataset.unpick), 1); renderStep(); }));
        host.querySelector('#m1-dec-sub')?.addEventListener('click', () => {
          if (built === q.expectedHz) { quizCorrect++; core.playChime('ok', true); } else { core.playChime('err', true); }
          selectedOrder = [];
          qIdx++;
          renderStep();
        });
        return;
      }

      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">🔔 เช็กความจำเสื่อม Day ${dayNum} · ข้อ ${qIdx + 1}/5</span>
              <h3 style="margin:6px 0 4px">${core.escapeHtml(q.prompt)}</h3>
            </div>
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-dec-exit">ออก</button>
          </div>
          ${q.audioHz ? `<div style="margin-bottom:12px"><button type="button" class="btn-primary m1-mini-btn" id="m1-dec-aud">🔊 ฟังเสียง</button></div>` : ''}
          <div class="m1-exam-choices">
            ${q.options.map((o, oi) => `<button type="button" class="m1-exam-opt" data-opt="${oi}"><span class="m1-opt-num">${oi + 1}</span><span>${core.escapeHtml(o)}</span></button>`).join('')}
          </div>
        </div>
      `;
      if (q.audioHz) {
        setTimeout(() => core.speak(q.audioHz), 60);
        host.querySelector('#m1-dec-aud')?.addEventListener('click', () => core.speak(q.audioHz));
      }
      host.querySelector('#m1-dec-exit')?.addEventListener('click', () => { stopMic(); onDone?.(); });
      host.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => {
        if (Number(b.dataset.opt) === q.answer) { quizCorrect++; core.playChime('ok', true); } else { core.playChime('err', true); }
        qIdx++;
        renderStep();
      }));
      return;
    }

    // Item 5: Speaking check
    const sp = pop.speakingPrompts[0];
    const sr = hasSpeechRecognition();
    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🔔 เช็กความจำเสื่อม Day ${dayNum} · ข้อ 5/5 (พูดออกเสียง)</span>
            <h3 style="margin:6px 0 2px">พูดประโยคนี้ให้ชัดเจนเพื่อยืนยันความจำ</h3>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="m1-dec-exit">ออก</button>
        </div>
        <div class="m1-speak-exam-box">
          <div class="m1-muted">"${core.escapeHtml(sp.th)}"</div>
          <div class="hanzi-font" style="font-size:30px;font-weight:700;margin:4px 0">${core.escapeHtml(sp.hz)}</div>
          <div class="m1-py" style="font-size:17px;margin-bottom:10px">${core.escapeHtml(sp.py)}</div>
          <button type="button" class="btn-secondary m1-mini-btn" id="m1-dec-model" ${modelUsed ? 'disabled' : ''} style="margin-bottom:10px">
            ${modelUsed ? '✓ ฟังต้นฉบับแล้ว' : '🔊 ฟังต้นฉบับนำ (1/1 ครั้ง)'}
          </button>
          <div>
            ${sr ? `<button type="button" class="btn-primary m1-mic-exam-btn ${micListening ? 'is-listening' : ''}" id="m1-dec-mic" ${tries >= 2 && !micListening ? 'disabled' : ''}>${micListening ? '🔴 กำลังฟัง...' : `🎙️ กดพูดออกไมค์ (${tries}/2)`}</button>`
              : `<input type="text" id="m1-dec-pyin" class="vb-search" placeholder="พิมพ์พินอิน + เลขวรรณยุกต์..."> <button type="button" class="btn-primary" id="m1-dec-pysub">ตรวจ</button>`}
          </div>
          ${speakRes ? `<div class="m1-speak-grade-card ${speakRes.points >= 1.5 ? 'ok' : 'err'}"><b>${core.escapeHtml(speakRes.gradeLabel)}</b></div>` : ''}
        </div>
        <div class="m1-runner-foot">
          <button type="button" class="btn-primary" id="m1-dec-fin" ${speakRes ? '' : 'disabled'}>ดูผลยืนยันความจำ →</button>
        </div>
      </div>
    `;
    host.querySelector('#m1-dec-exit')?.addEventListener('click', () => { stopMic(); onDone?.(); });
    host.querySelector('#m1-dec-model')?.addEventListener('click', () => { modelUsed = true; core.speak(sp.hz); renderStep(); });
    host.querySelector('#m1-dec-mic')?.addEventListener('click', () => {
      if (micListening) { stopMic(); micListening = false; renderStep(); return; }
      micListening = true; renderStep();
      activeMic = startSpeechRecognition({
        lang: 'zh-CN',
        onResult(txt) {
          micListening = false; tries++;
          const g = gradeSpeakingExamItem({ targetHz: sp.hz, targetPy: sp.py, heardText: txt, charPinyinMap: charPyMap });
          if (!speakRes || g.points >= speakRes.points) speakRes = g;
          core.playChime(g.points >= 1.5 ? 'ok' : 'err', true);
          renderStep();
        },
        onError() { micListening = false; renderStep(); },
        onEnd() { if (micListening) { micListening = false; renderStep(); } }
      });
    });
    host.querySelector('#m1-dec-pysub')?.addEventListener('click', () => {
      const val = host.querySelector('#m1-dec-pyin')?.value || '';
      tries++;
      speakRes = gradeSpeakingExamItem({ targetHz: sp.hz, targetPy: sp.py, typedPinyinFallback: val });
      renderStep();
    });
    host.querySelector('#m1-dec-fin')?.addEventListener('click', () => { stopMic(); renderFinish(); });
  };

  renderStep();
}

/**
 * 3) 4-Second Reflex Speaking Trainer (`renderReflexSpeakingRunner`).
 * Forces rapid-fire spoken reaction before the 4s (or 6s) countdown expires!
 */
export function renderReflexSpeakingRunner(core, host, onDone) {
  const maxDay = getTodayBlueprintDay(core.state.progress, core.getExt('month1'));
  const prompts = buildReflexPrompts(maxDay, 8, Date.now());
  let limitSec = 4;
  let idx = 0;
  let hits = 0;
  let combo = 0;
  let bestCombo = 0;
  let roundActive = false;
  let remainingMs = 4000;
  let roundStartMs = 0;
  let timerId = null;
  let activeMic = null;
  let roundResult = null;
  let charPyMap = null;
  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  const cleanup = () => {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (activeMic) { try { activeMic.stop(); } catch { /* ignore */ } activeMic = null; }
    roundActive = false;
  };

  const render = () => {
    if (idx >= prompts.length) {
      cleanup();
      const pct = Math.round((hits / prompts.length) * 100);
      if (hits > 0) core.addXp(hits * 4, `⚡ พูดสวนกลับไวสำเร็จ ${hits}/${prompts.length} ประโยค!`);
      host.innerHTML = `
        <div class="card-panel m1-runner" style="text-align:center;padding:28px 18px">
          <div style="font-size:48px">⚡🎙️</div>
          <h2 style="margin:8px 0">จบด่านพูดสวนกลับไว! ทันเวลา ${hits}/${prompts.length} ข้อ (${pct}%)</h2>
          <p class="m1-muted">คอมโบพูดไวต่อเนื่องสูงสุด: <b>${bestCombo} ข้อติด</b> · ได้รับ +${hits * 4} XP</p>
          <div style="display:flex;justify-content:center;gap:10px;margin-top:16px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="m1-rfx-again">⚡ ซ้อมพูดไวชุดใหม่อีกรอบ</button>
            <button type="button" class="btn-secondary" id="m1-rfx-done">กลับหน้าหลัก</button>
          </div>
        </div>
      `;
      host.querySelector('#m1-rfx-again')?.addEventListener('click', () => renderReflexSpeakingRunner(core, host, onDone));
      host.querySelector('#m1-rfx-done')?.addEventListener('click', () => onDone?.());
      return;
    }

    const p = prompts[idx];
    const sr = hasSpeechRecognition();
    const barPct = roundActive ? Math.max(0, Math.round((remainingMs / (limitSec * 1000)) * 100)) : 100;

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">⚡ โหมดพูดสวนกลับฉับพลัน · ข้อ ${idx + 1}/${prompts.length} ${combo >= 2 ? `· 🔥 คอมโบ x${combo}` : ''}</span>
            <h3 style="margin:6px 0 2px">${core.escapeHtml(p.cue)}</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">ฝึกสมองสั่งปากพูดภาษาจีนทันทีภายใน ${limitSec} วินาทีโดยไม่ลังเล!</p>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button type="button" class="m1-chip ${limitSec === 4 ? 'active' : ''}" data-set-sec="4">⚡ 4 วิ</button>
            <button type="button" class="m1-chip ${limitSec === 6 ? 'active' : ''}" data-set-sec="6">🐢 6 วิ</button>
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-rfx-exit">ออก</button>
          </div>
        </div>

        <div class="m1-prog" style="height:10px">
          <div class="m1-prog-fill" id="m1-rfx-bar" style="width:${barPct}%;background:${barPct < 35 ? '#dc2626' : 'var(--sys-accent,#007aff)'};transition:width 0.1s linear"></div>
        </div>

        <div class="m1-speak-exam-box">
          <div class="hanzi-font" style="font-size:34px;font-weight:700">${core.escapeHtml(p.hz)}</div>
          <div class="m1-py" style="font-size:18px;margin:4px 0 12px">${core.escapeHtml(p.py)}</div>

          ${!roundActive && !roundResult ? `
            <button type="button" class="btn-primary" id="m1-rfx-go">🎙️ เริ่มจับเวลา ${limitSec} วินาที & พูดเลย!</button>
          ` : ''}

          ${roundActive ? `
            <div style="font-size:20px;font-weight:700;color:#dc2626;margin-bottom:8px" id="m1-rfx-timer">
              🔴 รีบพูดเลย! เหลือเวลา ${(remainingMs / 1000).toFixed(1)}s
            </div>
            ${!sr ? `
              <div style="display:flex;gap:8px;justify-content:center">
                <input type="text" id="m1-rfx-in" class="vb-search" placeholder="พิมพ์พินอินด่วน..." autofocus>
                <button type="button" class="btn-primary" id="m1-rfx-sub">ส่ง!</button>
              </div>
            ` : ''}
          ` : ''}

          ${roundResult ? `
            <div class="m1-speak-grade-card ${roundResult.ok ? 'ok' : 'err'}">
              <div style="font-weight:700">${core.escapeHtml(roundResult.msg)}</div>
            </div>
            <div style="margin-top:12px;display:flex;justify-content:center;gap:8px">
              <button type="button" class="btn-secondary m1-mini-btn" id="m1-rfx-listen">🔊 ฟังต้นฉบับ</button>
              ${!roundResult.ok ? `<button type="button" class="btn-secondary m1-mini-btn" id="m1-rfx-retry-one">🔄 ลองข้อนี้ใหม่</button>` : ''}
              <button type="button" class="btn-primary m1-mini-btn" id="m1-rfx-next">ข้อถัดไป →</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    host.querySelector('#m1-rfx-exit')?.addEventListener('click', () => { cleanup(); onDone?.(); });
    host.querySelectorAll('[data-set-sec]').forEach(b => b.addEventListener('click', () => {
      if (roundActive) return;
      limitSec = Number(b.dataset.setSec) || 4;
      render();
    }));
    host.querySelector('#m1-rfx-listen')?.addEventListener('click', () => core.speak(p.hz));
    host.querySelector('#m1-rfx-retry-one')?.addEventListener('click', () => {
      roundResult = null;
      render();
    });
    host.querySelector('#m1-rfx-next')?.addEventListener('click', () => {
      roundResult = null;
      idx++;
      render();
    });

    host.querySelector('#m1-rfx-go')?.addEventListener('click', () => {
      cleanup();
      roundActive = true;
      roundResult = null;
      roundStartMs = Date.now();
      remainingMs = limitSec * 1000;
      render();

      timerId = setInterval(() => {
        remainingMs = Math.max(0, limitSec * 1000 - (Date.now() - roundStartMs));
        const barEl = host.querySelector('#m1-rfx-bar');
        const timEl = host.querySelector('#m1-rfx-timer');
        if (barEl) {
          const pctNow = Math.round((remainingMs / (limitSec * 1000)) * 100);
          barEl.style.width = `${pctNow}%`;
          if (pctNow < 35) barEl.style.background = '#dc2626';
        }
        if (timEl) timEl.textContent = `🔴 รีบพูดเลย! เหลือเวลา ${(remainingMs / 1000).toFixed(1)}s`;
        if (remainingMs <= 0) {
          cleanup();
          combo = 0;
          core.playChime('err', true);
          roundResult = { ok: false, msg: `⏰ หมดเวลา ${limitSec} วินาที! ต้องพูดออกให้ไวขึ้น ลองใหม่ได้เลย` };
          render();
        }
      }, 100);

      if (sr) {
        activeMic = startSpeechRecognition({
          lang: 'zh-CN',
          onResult(txt) {
            if (!roundActive) return;
            const usedSec = ((Date.now() - roundStartMs) / 1000).toFixed(1);
            cleanup();
            const g = gradeSpeakingExamItem({ targetHz: p.hz, targetPy: p.py, heardText: txt, charPinyinMap: charPyMap });
            if (g.points >= 1.5) {
              hits++;
              combo++;
              if (combo > bestCombo) bestCombo = combo;
              core.playChime('ok', true);
              roundResult = { ok: true, msg: `⚡ ทันเวลาใน ${usedSec}s! ความชัด ${g.pronScore}% (ได้ยิน: ${txt})` };
            } else {
              combo = 0;
              core.playChime('err', true);
              roundResult = { ok: false, msg: `ออกเสียงยังไม่ชัดพอ (${g.pronScore}% · ได้ยิน: ${txt || '—'})` };
            }
            render();
          },
          onError(err) {
            if (!roundActive) return;
            cleanup();
            combo = 0;
            roundResult = { ok: false, msg: err };
            render();
          }
        });
      } else {
        host.querySelector('#m1-rfx-sub')?.addEventListener('click', () => {
          const val = host.querySelector('#m1-rfx-in')?.value || '';
          const usedSec = ((Date.now() - roundStartMs) / 1000).toFixed(1);
          cleanup();
          const g = gradeSpeakingExamItem({ targetHz: p.hz, targetPy: p.py, typedPinyinFallback: val });
          if (g.points >= 1.5) {
            hits++; combo++; if (combo > bestCombo) bestCombo = combo;
            core.playChime('ok', true);
            roundResult = { ok: true, msg: `⚡ พิมพ์ทันใน ${usedSec}s!` };
          } else {
            combo = 0;
            core.playChime('err', true);
            roundResult = { ok: false, msg: g.gradeLabel };
          }
          render();
        });
      }
    });
  };

  render();
}

/**
 * 4) Endless Adaptive Weakness Grinder (`renderWeaknessGrinder`).
 * Interleaves 4 modes (Speed Ear, Pinyin+Tone Typing, Speaking, Meaning) across the user's weakest items!
 */
export function renderWeaknessGrinder(core, host, onDone) {
  let batchSeed = Date.now();
  let totalCleared = 0;
  let activeMic = null;
  let charPyMap = null;
  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  const stopMic = () => {
    if (activeMic) { try { activeMic.stop(); } catch { /* ignore */ } activeMic = null; }
  };

  const startBatch = () => {
    const ext = core.getExt('month1') || {};
    const maxDay = getTodayBlueprintDay(core.state.progress, ext);
    const queue = buildWeaknessQueue({
      mistakes: core.state.progress.mistakes || [],
      fsrsDeck: ext.fsrsDeck || {},
      maxDay,
      count: 8,
      seed: batchSeed++
    });
    let idx = 0;
    let fb = null;

    const markConquered = (hz) => {
      totalCleared++;
      const list = Array.isArray(core.state.progress.mistakes) ? core.state.progress.mistakes : [];
      const pos = list.findIndex(m => m && (m.hanzi === hz || m.hz === hz));
      if (pos !== -1) {
        list[pos].streakOk = (list[pos].streakOk || 0) + 1;
        if (list[pos].streakOk >= 3) list.splice(pos, 1);
      }
    };

    const renderItem = () => {
      if (idx >= queue.length) {
        core.addXp(20, '💪 ขยี้จุดอ่อนครบ 1 ยก (+20 XP)!');
        core.playChime('levelup', true);
        host.innerHTML = `
          <div class="card-panel m1-runner" style="text-align:center;padding:28px 18px">
            <div style="font-size:48px">💪🔥</div>
            <h2 style="margin:8px 0">จบยกซ้อมขยี้จุดอ่อน! ซ่อมผ่านสะสม ${totalCleared} ข้อ (+20 XP)</h2>
            <p class="m1-muted">ยิ่งซ้อมต่อเนื่อง ระบบยิ่งคัดเฉพาะคำที่คุณยังสะดุดมาขยี้ซ้ำจนแม่น 100%</p>
            <div style="display:flex;justify-content:center;gap:10px;margin-top:16px;flex-wrap:wrap">
              <button type="button" class="btn-primary" id="m1-wk-more">🔥 ลุยยกถัดไปต่อทันที (ไม่จำกัดรอบ!)</button>
              <button type="button" class="btn-secondary" id="m1-wk-done">กลับหน้าหลัก</button>
            </div>
          </div>
        `;
        host.querySelector('#m1-wk-more')?.addEventListener('click', () => startBatch());
        host.querySelector('#m1-wk-done')?.addEventListener('click', () => onDone?.());
        return;
      }

      const item = queue[idx];
      const sr = hasSpeechRecognition();
      const modeLabels = {
        ear: '🎧 ท่าที่ 1: ฟังเสียงล้วนจับความหมาย',
        pinyin: '⌨️ ท่าที่ 2: พิมพ์พินอิน + เลขวรรณยุกต์ (เช่น ni3 hao3)',
        speak: '🎙️ ท่าที่ 3: ออกเสียงพูดขยี้คำยาก',
        meaning: '🧠 ท่าที่ 4: แปลความหมายฉับไว'
      };

      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">💪 สนามซ้อมขยี้จุดอ่อน · ข้อ ${idx + 1}/${queue.length} · ${core.escapeHtml(item.tag)}</span>
              <h3 style="margin:6px 0 2px">${modeLabels[item.drillMode] || modeLabels.meaning}</h3>
            </div>
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-wk-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.round((idx / queue.length) * 100)}%"></div></div>

          <div class="m1-speak-exam-box" style="margin-bottom:14px">
            ${item.drillMode === 'ear'
              ? `<button type="button" class="btn-primary" id="m1-wk-say">🔊 กดฟังเสียงโจทย์</button>`
              : `<div class="hanzi-font" style="font-size:32px;font-weight:700">${core.escapeHtml(item.hz)}</div>`}
            ${item.drillMode === 'speak' ? `<div class="m1-py" style="font-size:17px;margin-top:4px">${core.escapeHtml(item.py)}</div><div class="m1-muted">"${core.escapeHtml(item.th)}"</div>` : ''}
            ${item.drillMode === 'pinyin' ? `<div class="m1-muted" style="margin-top:4px">ความหมาย: "${core.escapeHtml(item.th)}"</div>` : ''}
          </div>

          ${fb ? `
            <div class="m1-speak-grade-card ${fb.ok ? 'ok' : 'err'}" style="text-align:center">
              <div style="font-weight:700">${core.escapeHtml(fb.msg)}</div>
              <div class="m1-muted" style="margin-top:4px">${core.escapeHtml(item.hz)} (${core.escapeHtml(item.py)}) = <b>${core.escapeHtml(item.th)}</b></div>
            </div>
            <div class="m1-runner-foot">
              <button type="button" class="btn-primary" id="m1-wk-next">ข้อต่อไป →</button>
            </div>
          ` : (() => {
            if (item.drillMode === 'pinyin' || (item.drillMode === 'speak' && !sr)) {
              const exSyl = splitPinyinSyllables(item.py).map(s => {
                const st = stripToneAndNumber(s);
                return `${st.base}${st.tone === 5 ? '' : st.tone}`;
              }).join(' ');
              return `
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                  <input type="text" id="m1-wk-in" class="vb-search" style="max-width:300px" placeholder="พิมพ์พินอิน + เลขวรรณยุกต์ (จำนวน ${exSyl.split(' ').length} พยางค์)...">
                  <button type="button" class="btn-primary" id="m1-wk-subpy">ตรวจคำตอบ</button>
                </div>
              `;
            }
            if (item.drillMode === 'speak' && sr) {
              return `
                <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
                  <button type="button" class="btn-secondary" id="m1-wk-say">🔊 ฟังต้นฉบับ</button>
                  <button type="button" class="btn-primary" id="m1-wk-mic">🎙️ กดพูดออกไมค์</button>
                </div>
              `;
            }
            return `
              <div class="m1-exam-choices">
                ${item.options.map((o, oi) => `<button type="button" class="m1-exam-opt" data-wk-opt="${oi}"><span class="m1-opt-num">${oi + 1}</span><span>${core.escapeHtml(o)}</span></button>`).join('')}
              </div>
            `;
          })()}
        </div>
      `;

      if (item.drillMode === 'ear' && !fb) setTimeout(() => core.speak(item.hz), 60);
      host.querySelector('#m1-wk-exit')?.addEventListener('click', () => { stopMic(); onDone?.(); });
      host.querySelector('#m1-wk-say')?.addEventListener('click', () => core.speak(item.hz));
      host.querySelector('#m1-wk-next')?.addEventListener('click', () => { fb = null; idx++; renderItem(); });

      host.querySelectorAll('[data-wk-opt]').forEach(b => b.addEventListener('click', () => {
        const picked = item.options[Number(b.dataset.wkOpt)];
        const ok = picked === item.th;
        core.speak(item.hz);
        if (ok) { markConquered(item.hz); core.playChime('ok', true); fb = { ok: true, msg: '✓ แม่นมาก!' }; }
        else { queue.push({ ...item, drillMode: 'meaning' }); core.playChime('err', true); fb = { ok: false, msg: '✗ ยังพลาดอยู่ — เดี๋ยววนมาถามซ้ำท้ายยกนี้!' }; }
        renderItem();
      }));

      host.querySelector('#m1-wk-subpy')?.addEventListener('click', () => {
        const val = host.querySelector('#m1-wk-in')?.value || '';
        const g = gradeSpeakingExamItem({ targetHz: item.hz, targetPy: item.py, typedPinyinFallback: val });
        core.speak(item.hz);
        if (g.points >= 1.5) { markConquered(item.hz); core.playChime('ok', true); fb = { ok: true, msg: `✓ ${g.gradeLabel}` }; }
        else { queue.push(item); core.playChime('err', true); fb = { ok: false, msg: `✗ ${g.gradeLabel} (เฉลย: ${item.py})` }; }
        renderItem();
      });

      host.querySelector('#m1-wk-mic')?.addEventListener('click', (e) => {
        e.currentTarget.textContent = '🔴 กำลังฟังเสียง... พูดเลย!';
        activeMic = startSpeechRecognition({
          lang: 'zh-CN',
          onResult(txt) {
            const g = gradeSpeakingExamItem({ targetHz: item.hz, targetPy: item.py, heardText: txt, charPinyinMap: charPyMap });
            if (g.points >= 1.5) { markConquered(item.hz); core.playChime('ok', true); fb = { ok: true, msg: `✓ ชัดเจน ${g.pronScore}% (ได้ยิน: ${txt})` }; }
            else { queue.push(item); core.playChime('err', true); fb = { ok: false, msg: `✗ ความชัด ${g.pronScore}% (ได้ยิน: ${txt || '—'}) — เดี๋ยวซ้อมซ้ำท้ายยก!` }; }
            renderItem();
          },
          onError(err) { fb = { ok: false, msg: err }; renderItem(); }
        });
      });
    };

    renderItem();
  };

  startBatch();
}

/**
 * 5) Weekly Cumulative Boss Exam (Day 7 · Day 14 · Day 21 · Day 30 · >= 95% Gate!).
 * Spans ALL days 1..checkpointDay and diagnoses exact weak days if < 95%!
 */
export function renderWeeklyBossRunner(core, host, checkpointDay, { onPass, onRepairDay, onExit } = {}) {
  const planArray = Array.isArray(window.DAILY_PLAN_DATA) ? window.DAILY_PLAN_DATA : [];
  const boss = buildWeeklyBossExam(checkpointDay, {
    planArray,
    mistakes: core.state.progress.mistakes || [],
    seed: Date.now()
  });

  let qIdx = 0;
  let quizCorrect = 0;
  let selectedOrder = [];
  const missedItems = [];

  let sIdx = 0;
  const speakResults = new Array(boss.speakingPrompts.length).fill(null);
  const speakTries = new Array(boss.speakingPrompts.length).fill(0);
  const modelUsed = new Array(boss.speakingPrompts.length).fill(false);
  let micListening = false;
  let activeMic = null;
  let charPyMap = null;
  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  const stopMic = () => {
    if (activeMic) { try { activeMic.stop(); } catch { /* ignore */ } activeMic = null; }
  };

  const renderBossResult = () => {
    const speakPts = speakResults.reduce((s, r) => s + (r ? r.points : 0), 0);
    boss.speakingPrompts.forEach((sp, i) => {
      const r = speakResults[i];
      if (!r || r.points < 2) {
        missedItems.push({ hz: sp.hz, py: sp.py, th: sp.th, sourceDay: sp.sourceDay, reason: r ? r.gradeLabel : 'ไม่ได้พูด' });
      }
    });

    const evalRes = evaluateDailyMasteryAttempt({
      quizCorrect,
      quizTotal: boss.questions.length,
      speakingPoints: speakPts,
      speakingMax: boss.speakingPrompts.length * 2
    });
    const weakDays = diagnoseWeakDaysFromBoss(missedItems);
    const tk = core.todayKey();

    core.setExt('month1', (cur) => {
      const wb = { ...(cur.weeklyBoss || {}) };
      const prev = wb[boss.checkpointDay] || {};
      const bestPct = Math.max(Number(prev.bestPct) || 0, evalRes.pct);
      const passed = Boolean(prev.passed) || evalRes.passed;
      wb[boss.checkpointDay] = {
        bestPct,
        lastPct: evalRes.pct,
        attempts: (Number(prev.attempts) || 0) + 1,
        passed,
        passedAt: passed ? (prev.passedAt || tk) : null,
        updatedAt: Date.now()
      };
      return { ...cur, weeklyBoss: wb };
    }, { save: true, reason: `สอบบอสสะสมสัปดาห์ที่ ${boss.weekNumber} (${evalRes.pct}%)` });

    if (evalRes.passed) {
      core.addXp(120, `🐉 พิชิตบอสสอบสะสมสัปดาห์ที่ ${boss.weekNumber} (Day 1–${boss.checkpointDay}) ด้วยคะแนน ${evalRes.pct}%!`);
      core.spawnConfetti(55);
      core.playChime('levelup', true);
    } else {
      core.playChime('err', true);
    }

    host.innerHTML = `
      <div class="card-panel m1-runner" style="text-align:center;padding:24px 16px">
        <div style="font-size:52px">${evalRes.passed ? '🐉👑' : '🛡️⚠️'}</div>
        <span class="m1-status-pill ${evalRes.passed ? 'pass' : 'fail'}">
          ${evalRes.passed
            ? `✅ พิชิตด่านบอสสัปดาห์ที่ ${boss.weekNumber} สำเร็จ! (${evalRes.pct}% ≥ ${DAILY_MASTERY_PASS_PCT}%)`
            : `❌ ได้ ${evalRes.pct}% — ยังไม่ผ่านด่านบอสสะสม Day 1–${boss.checkpointDay} (ต้องถึง ${DAILY_MASTERY_PASS_PCT}%)`}
        </span>
        <h2 style="margin:10px 0 6px" class="tabular-nums">${evalRes.earnedPoints} / ${evalRes.totalPoints} คะแนน (${evalRes.pct}%)</h2>
        <p class="m1-muted" style="max-width:540px;margin:0 auto">
          ${evalRes.passed
            ? `การันตีแล้วว่าคุณจำเนื้อหาสะสมตั้งแต่ Day 1 ถึง Day ${boss.checkpointDay} ได้แม่นยำทั้งฟัง อ่าน เรียงประโยค และพูดจริง! ปลดล็อกสัปดาห์ถัดไปเรียบร้อย`
            : `ยังไม่สามารถข้ามไปสัปดาห์ถัดไปได้จนกว่าจะสอบสะสมผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}% ระบบสแกนพบวันที่คุณเริ่มลืมด้านล่างแล้ว กดไปซ่อมตรงจุดได้เลย!`}
        </p>

        ${!evalRes.passed && weakDays.length > 0 ? `
          <div class="m1-missed-panel" style="text-align:left">
            <h4 style="margin:0 0 8px">🔍 ชี้เป้าวันที่ความจำรั่ว (กดไปทวนซ่อมเฉพาะวันได้ทันที):</h4>
            <div class="m1-chip-row">
              ${weakDays.map(w => `
                <button type="button" class="btn-secondary" data-repair-day="${w.day}">
                  🔧 ไปซ่อม Day ${w.day} (พลาด ${w.misses} จุด) →
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="m1-runner-foot" style="justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px">
          ${evalRes.passed
            ? `<button type="button" class="btn-primary" id="m1-boss-next">🚀 ลุยสัปดาห์ถัดไปต่อเลย →</button>`
            : `<button type="button" class="btn-primary" id="m1-boss-retake">🐉 สุ่มข้อสอบบอสชุดใหม่ท้าดวลอีกครั้ง</button>`}
          <button type="button" class="btn-secondary" id="m1-boss-exit">กลับหน้าหลัก</button>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-repair-day]').forEach(b => b.addEventListener('click', () => {
      onRepairDay?.(Number(b.dataset.repairDay));
    }));
    host.querySelector('#m1-boss-next')?.addEventListener('click', () => onPass?.());
    host.querySelector('#m1-boss-retake')?.addEventListener('click', () => {
      renderWeeklyBossRunner(core, host, checkpointDay, { onPass, onRepairDay, onExit });
    });
    host.querySelector('#m1-boss-exit')?.addEventListener('click', () => onExit?.());
  };

  const renderStep = () => {
    const totalSteps = boss.questions.length + boss.speakingPrompts.length;
    if (qIdx < boss.questions.length) {
      const q = boss.questions[qIdx];
      const pctBar = Math.round((qIdx / totalSteps) * 100);

      if (q.kind === 'order') {
        const built = selectedOrder.map(i => q.tiles[i]).join('');
        host.innerHTML = `
          <div class="card-panel m1-runner">
            <div class="m1-runner-head">
              <div>
                <span class="m1-tag">🐉 สอบบอสสะสม สัปดาห์ที่ ${boss.weekNumber} (Day 1–${boss.checkpointDay}) · ข้อ ${qIdx + 1}/${boss.questions.length} · ${core.escapeHtml(q.category)}</span>
                <h3 style="margin:6px 0 2px">${core.escapeHtml(q.prompt)}</h3>
              </div>
              <button type="button" class="btn-secondary m1-mini-btn" id="m1-boss-quit">ออก</button>
            </div>
            <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.max(5, pctBar)}%"></div></div>
            <div class="m1-order-answer">
              ${selectedOrder.length
                ? selectedOrder.map((ti, pos) => `<button type="button" class="m1-order-chip chosen" data-unpick="${pos}"><span class="hanzi-font">${core.escapeHtml(q.tiles[ti])}</span></button>`).join('')
                : '<span class="m1-muted">แตะแผ่นคำด้านล่างเพื่อเรียงประโยค...</span>'}
            </div>
            <div class="m1-order-bank">
              ${q.tiles.map((t, ti) => `<button type="button" class="m1-order-chip" data-pick="${ti}" ${selectedOrder.includes(ti) ? 'disabled' : ''}><span class="hanzi-font">${core.escapeHtml(t)}</span>${q.tilePinyins?.[ti] ? `<small class="m1-tile-py">${core.escapeHtml(q.tilePinyins[ti])}</small>` : ''}</button>`).join('')}
            </div>
            <div class="m1-runner-foot">
              <button type="button" class="btn-primary" id="m1-boss-osub" ${selectedOrder.length === q.tiles.length ? '' : 'disabled'}>ส่งคำตอบ →</button>
            </div>
          </div>
        `;
        host.querySelector('#m1-boss-quit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
        host.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { selectedOrder.push(Number(b.dataset.pick)); renderStep(); }));
        host.querySelectorAll('[data-unpick]').forEach(b => b.addEventListener('click', () => { selectedOrder.splice(Number(b.dataset.unpick), 1); renderStep(); }));
        host.querySelector('#m1-boss-osub')?.addEventListener('click', () => {
          if (built === q.expectedHz) { quizCorrect++; core.playChime('ok', true); }
          else { core.playChime('err', true); missedItems.push({ ...(q.refItem || {}), sourceDay: q.sourceDay, reason: q.explain }); }
          selectedOrder = []; qIdx++; renderStep();
        });
        return;
      }

      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">🐉 สอบบอสสะสม สัปดาห์ที่ ${boss.weekNumber} (Day 1–${boss.checkpointDay}) · ข้อ ${qIdx + 1}/${boss.questions.length} · ${core.escapeHtml(q.category)}</span>
              <h3 style="margin:6px 0 4px">${core.escapeHtml(q.prompt)}</h3>
            </div>
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-boss-quit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.max(5, pctBar)}%"></div></div>
          ${q.audioHz ? `<div style="margin-bottom:12px"><button type="button" class="btn-primary m1-mini-btn" id="m1-boss-aud">🔊 ฟังเสียงโจทย์</button></div>` : ''}
          <div class="m1-exam-choices">
            ${q.options.map((o, oi) => `<button type="button" class="m1-exam-opt" data-opt="${oi}"><span class="m1-opt-num">${oi + 1}</span><span>${core.escapeHtml(o)}</span></button>`).join('')}
          </div>
        </div>
      `;
      if (q.audioHz) {
        setTimeout(() => core.speak(q.audioHz), 60);
        host.querySelector('#m1-boss-aud')?.addEventListener('click', () => core.speak(q.audioHz));
      }
      host.querySelector('#m1-boss-quit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
      host.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => {
        if (Number(b.dataset.opt) === q.answer) { quizCorrect++; core.playChime('ok', true); }
        else { core.playChime('err', true); missedItems.push({ ...(q.refItem || {}), sourceDay: q.sourceDay, reason: q.explain }); }
        qIdx++; renderStep();
      }));
      return;
    }

    // Cumulative Speaking Prompts
    const sp = boss.speakingPrompts[sIdx];
    const curRes = speakResults[sIdx];
    const tries = speakTries[sIdx];
    const sr = hasSpeechRecognition();
    const pctBar = Math.round(((boss.questions.length + sIdx) / totalSteps) * 100);

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🐉 สอบพูดบอสสะสม (จาก Day ${sp.sourceDay}) · ประโยค ${sIdx + 1}/${boss.speakingPrompts.length}</span>
            <h3 style="margin:6px 0 2px">ออกเสียงประโยคสะสมนี้ให้ชัดเจน (2 คะแนน)</h3>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="m1-boss-quit">ออก</button>
        </div>
        <div class="m1-prog"><div class="m1-prog-fill" style="width:${pctBar}%"></div></div>
        <div class="m1-speak-exam-box">
          <div class="m1-muted">"${core.escapeHtml(sp.th)}"</div>
          <div class="hanzi-font" style="font-size:32px;font-weight:700;margin:4px 0">${core.escapeHtml(sp.hz)}</div>
          <div class="m1-py" style="font-size:18px;margin-bottom:12px">${core.escapeHtml(sp.py)}</div>
          <div style="margin-bottom:10px">
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-boss-model" ${modelUsed[sIdx] ? 'disabled' : ''}>
              ${modelUsed[sIdx] ? '✓ ฟังเสียงต้นฉบับแล้ว (1/1)' : '🔊 ฟังเสียงต้นฉบับนำ (1/1 ครั้ง)'}
            </button>
          </div>
          ${sr
            ? `<button type="button" class="btn-primary m1-mic-exam-btn ${micListening ? 'is-listening' : ''}" id="m1-boss-mic" ${tries >= 2 && !micListening ? 'disabled' : ''}>${micListening ? '🔴 กำลังฟังเสียง...' : `🎙️ กดพูดออกไมค์ (${tries}/2)`}</button>`
            : `<div style="display:flex;gap:8px;justify-content:center"><input type="text" id="m1-boss-pyin" class="vb-search" placeholder="พิมพ์พินอิน + เลขวรรณยุกต์..."><button type="button" class="btn-primary" id="m1-boss-pysub">ตรวจ</button></div>`}
          ${curRes ? `<div class="m1-speak-grade-card ${curRes.points >= 1.5 ? 'ok' : 'err'}"><b>${core.escapeHtml(curRes.gradeLabel)} · ${curRes.pronScore}%</b></div>` : ''}
        </div>
        <div class="m1-runner-foot">
          <button type="button" class="btn-primary" id="m1-boss-snext" ${curRes ? '' : 'disabled'}>
            ${sIdx + 1 < boss.speakingPrompts.length ? 'ประโยคถัดไป →' : '🐉 ส่งกระดาษคำตอบบอสสะสม (เกณฑ์ ≥95%) →'}
          </button>
        </div>
      </div>
    `;
    host.querySelector('#m1-boss-quit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
    host.querySelector('#m1-boss-model')?.addEventListener('click', () => { modelUsed[sIdx] = true; core.speak(sp.hz); renderStep(); });
    host.querySelector('#m1-boss-mic')?.addEventListener('click', () => {
      if (micListening) { stopMic(); micListening = false; renderStep(); return; }
      micListening = true; renderStep();
      activeMic = startSpeechRecognition({
        lang: 'zh-CN',
        onResult(txt) {
          micListening = false; speakTries[sIdx]++;
          const g = gradeSpeakingExamItem({ targetHz: sp.hz, targetPy: sp.py, heardText: txt, charPinyinMap: charPyMap });
          if (!speakResults[sIdx] || g.points >= speakResults[sIdx].points) speakResults[sIdx] = g;
          core.playChime(g.points >= 1.5 ? 'ok' : 'err', true);
          renderStep();
        },
        onError() { micListening = false; renderStep(); },
        onEnd() { if (micListening) { micListening = false; renderStep(); } }
      });
    });
    host.querySelector('#m1-boss-pysub')?.addEventListener('click', () => {
      const val = host.querySelector('#m1-boss-pyin')?.value || '';
      speakTries[sIdx]++;
      speakResults[sIdx] = gradeSpeakingExamItem({ targetHz: sp.hz, targetPy: sp.py, typedPinyinFallback: val });
      renderStep();
    });
    host.querySelector('#m1-boss-snext')?.addEventListener('click', () => {
      stopMic();
      sIdx++;
      if (sIdx >= boss.speakingPrompts.length) renderBossResult();
      else renderStep();
    });
  };

  renderStep();
}
