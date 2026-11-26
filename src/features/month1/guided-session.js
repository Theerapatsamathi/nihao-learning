// Guided Daily Session (4-Step Study + Strict >=95% Daily Mastery Gate) & Beginner Mode Filter
import {
  DAILY_MASTERY_PASS_PCT,
  buildGuidedSession,
  buildDailyMasteryExam,
  gradeSpeakingExamItem,
  evaluateDailyMasteryAttempt,
  getTodayBlueprintDay,
  getDayMasteryRecord,
  getProgressivePinyin,
  getDueMonth1FsrsCards,
  getPendingWeeklyBoss
} from './logic.js';
import { SURVIVAL_50 } from './data-month1.js';
import { enrollDayInFsrs, renderFsrsQuizGate, renderWeeklyBossRunner } from './mastery-drills.js';
import { hasSpeechRecognition, startSpeechRecognition, getCharPinyinMap, addToReviewQueue } from '../speak-studio/speech.js';
import { scorePronunciation } from '../speak-studio/scoring.js';
import { colorizePinyin, renderLiveScoreHud, renderMicWaveHtml } from './ux-utils.js';

const BEGINNER_TABS = new Set([
  'today', 'month1', 'analytics', 'copybook', 'arena', 'plan', 'lesson-path', 'writing', 'vocab', 'games-reading', 'speak-studio', 'settings-plus'
]);

export function applyBeginnerMode(core) {
  const ext = core.getExt('month1');
  const enabled = Boolean(ext.beginnerMode);
  document.documentElement.classList.toggle('m1-beginner-mode', enabled);
  document.querySelectorAll('.nav-panel .nav-link').forEach(btn => {
    const id = btn.dataset.tab;
    if (!id) return;
    btn.classList.toggle('m1-nav-hidden', enabled && !BEGINNER_TABS.has(id));
  });
}

export function toggleBeginnerMode(core, nextVal) {
  core.setExt('month1', { beginnerMode: Boolean(nextVal) }, { save: true });
  applyBeginnerMode(core);
  core.showToast(nextVal ? 'เปิดโหมดเดือนแรก (ซ่อนเมนูขั้นสูงแล้ว)' : 'แสดงเมนูทั้งหมดแล้ว');
}

function getPlanDayObj(dayNum) {
  const planArr = Array.isArray(window.DAILY_PLAN_DATA) ? window.DAILY_PLAN_DATA : [];
  return planArr.find(d => Number(d.day) === Number(dayNum)) || null;
}

function pushMissedItemToReview(core, item) {
  if (!item || !item.hz) return;
  try {
    addToReviewQueue(core, {
      hz: item.hz,
      py: item.py || '',
      th: item.th || '',
      source: 'Daily Mastery Exam'
    }, { immediate: true });
  } catch { /* ignore */ }

  const list = Array.isArray(core.state.progress.mistakes) ? core.state.progress.mistakes : [];
  const id = `m1-${item.hz}`;
  const existing = list.find(x => x && (x.id === id || x.hanzi === item.hz));
  if (existing) {
    existing.misses = (existing.misses || 1) + 1;
    existing.streakOk = 0;
  } else {
    list.unshift({
      id,
      hanzi: item.hz,
      pinyin: item.py || '',
      meaning: item.th || 'ทบทวนจากสอบประจำวัน',
      answer: item.th || item.hz,
      misses: 1,
      streakOk: 0
    });
    if (list.length > 40) list.length = 40;
  }
  core.state.progress.mistakes = list;
}

function renderSyllableBadges(syllables = []) {
  if (!Array.isArray(syllables) || !syllables.length) return '';
  return `<div class="m1-syl-row">${syllables.map(s => `
    <span class="m1-syl-chip is-${s.status}" title="${s.reason || ''}">
      <b class="hanzi-font">${s.char}</b>
      <small>${s.expectedPy || ''}</small>
    </span>
  `).join('')}</div>`;
}

/**
 * Shared Exam Stage Engine (14 closed-book questions + 3 real speaking items = 20 pts, >= 95% required).
 */
function mountExamStage(core, host, { dayNum, onPassContinue, onRestudy, onExit, standalone = false }) {
  let activeMic = null;
  const stopMic = () => {
    if (activeMic) {
      try { activeMic.stop(); } catch { /* ignore */ }
      activeMic = null;
    }
  };

  const intensityLv = Number(core.getExt('month1')?.intensity) || 1;
  const exam = buildDailyMasteryExam(dayNum, {
    planDayObj: getPlanDayObj(dayNum),
    mistakes: core.state.progress.mistakes || [],
    seed: Date.now(),
    intensity: intensityLv
  });

  let phase = 'quiz'; // 'quiz' | 'speak' | 'result'
  let qIdx = 0;
  let quizCorrect = 0;
  let selectedOrderIndices = [];
  const missedItems = [];

  let sIdx = 0;
  const speakResults = new Array(exam.speakingPrompts.length).fill(null);
  const speakTriesUsed = new Array(exam.speakingPrompts.length).fill(0);
  const speakModelUsed = new Array(exam.speakingPrompts.length).fill(false);
  let micListening = false;
  let liveHeardText = '';
  let liveErrorMsg = '';
  let charPyMap = null;
  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  const speakSlow = (hz) => {
    const prev = core.state.rate;
    core.state.rate = 0.6;
    core.speak(hz, () => { core.state.rate = prev; });
  };

  const finishAndSaveResult = () => {
    phase = 'result';
    const speakingPoints = speakResults.reduce((sum, r) => sum + (r ? r.points : 0), 0);
    const evalRes = evaluateDailyMasteryAttempt({
      quizCorrect,
      quizTotal: exam.questions.length,
      speakingPoints,
      speakingMax: exam.speakingPrompts.length * 2
    });

    // Collect any failed speaking prompts into missedItems
    exam.speakingPrompts.forEach((sp, idx) => {
      const r = speakResults[idx];
      if (!r || r.points < 2) {
        missedItems.push({
          hz: sp.hz,
          py: sp.py,
          th: sp.th,
          reason: r ? `พาร์ทพูดได้ ${r.points}/2 คะแนน (${r.gradeLabel})` : 'ยังไม่ได้ออกเสียง'
        });
      }
    });

    const prevExt = core.getExt('month1') || {};
    const prevRec = getDayMasteryRecord(dayNum, prevExt);
    const wasAlreadyPassed = prevRec.passed;
    const nextBest = Math.max(prevRec.bestPct || 0, evalRes.pct);
    const nowPassed = wasAlreadyPassed || evalRes.passed;
    const todayKey = core.todayKey();

    // Update mistakes queue for failed items so restudy targets them
    if (!evalRes.passed) {
      missedItems.forEach(item => pushMissedItemToReview(core, item));
    }

    // Sync legacy dayScores (for Day 1-14) so World Map, Radar, Badges & Plan tab stay aligned with >=95% rule
    if (dayNum >= 1 && dayNum <= 14) {
      if (evalRes.passed) {
        core.state.progress.dayScores[dayNum] = 10;
      } else {
        const cappedScore = Math.min(9, Math.floor(evalRes.pct / 10));
        const curScore = core.state.progress.dayScores[dayNum] || 0;
        if (!wasAlreadyPassed) {
          core.state.progress.dayScores[dayNum] = Math.min(9, Math.max(curScore >= 10 ? 9 : curScore, cappedScore));
        }
      }
    }

    core.setExt('month1', (cur) => {
      const dm = { ...(cur.dayMastery || {}) };
      dm[dayNum] = {
        bestPct: nextBest,
        lastPct: evalRes.pct,
        attempts: (prevRec.attempts || 0) + 1,
        passed: nowPassed,
        quizScore: `${evalRes.quizCorrect}/${evalRes.quizTotal}`,
        speakScore: `${evalRes.speakingPoints}/${evalRes.speakingMax}`,
        passedAt: evalRes.passed ? (prevRec.passedAt || todayKey) : (prevRec.passedAt || null),
        updatedAt: Date.now()
      };
      const done = new Set(Array.isArray(cur.doneDays) ? cur.doneDays : []);
      if (dayNum >= 15) {
        if (nowPassed) done.add(dayNum);
        else done.delete(dayNum);
      }
      return {
        ...cur,
        dayMastery: dm,
        doneDays: [...done],
        lastGuidedDate: evalRes.passed ? todayKey : cur.lastGuidedDate
      };
    }, { save: true, reason: evalRes.passed ? `สอบผ่าน Day ${dayNum} (${evalRes.pct}%)` : `บันทึกผลสอบ Day ${dayNum} (${evalRes.pct}%)` });

    if (evalRes.passed) {
      // Auto-enroll all learned phrases, tone pairs & mnemonics of this day into FSRS!
      enrollDayInFsrs(core, dayNum);
      if (!wasAlreadyPassed) {
        core.addXp(50, `🏆 สอบผ่าน Day ${dayNum} ด้วยคะแนน ${evalRes.pct}% (≥95%) + บันทึกคำเข้า FSRS อัตโนมัติ!`);
      } else {
        core.addXp(10, `ทบทวนสอบผ่าน Day ${dayNum} ซ้ำ (${evalRes.pct}%)`);
      }
      core.spawnConfetti(42);
      core.playChime('levelup', true);
      core.pandaSay(`太厉害了! สอบผ่าน Day ${dayNum} ได้ ${evalRes.pct}% รู้จริงพูดได้จริง!`);
    } else {
      core.playChime('err', true);
      core.pandaSay(`อีกนิดเดียว! ได้ ${evalRes.pct}% (เกณฑ์ 95%) มาทวนจุดที่พลาดแล้วสอบใหม่กัน!`);
    }

    renderResultScreen(evalRes);
  };

  const renderResultScreen = (evalRes) => {
    const uniqueMissed = [];
    const seenM = new Set();
    for (const m of missedItems) {
      const k = `${m.hz}|${m.th}`;
      if (!seenM.has(k)) {
        seenM.add(k);
        uniqueMissed.push(m);
      }
    }

    host.innerHTML = `
      <div class="card-panel m1-runner m1-exam-result ${evalRes.passed ? 'is-pass' : 'is-fail'}">
        <div style="text-align:center;padding:12px 8px 18px">
          <div style="font-size:52px;line-height:1">${evalRes.passed ? '🏆' : '🔄'}</div>
          <span class="m1-status-pill ${evalRes.passed ? 'pass' : 'fail'}" style="margin-top:10px">
            ${evalRes.passed
              ? `✅ ผ่านเกณฑ์มาตรฐาน ≥ ${DAILY_MASTERY_PASS_PCT}% — จบ Day ${dayNum} สมบูรณ์!`
              : `❌ ยังไม่ผ่านเกณฑ์ ${DAILY_MASTERY_PASS_PCT}% — ถือว่ายังไม่จบ Day ${dayNum}`}
          </span>
          <h2 style="margin:10px 0 4px;font-size:26px" class="tabular-nums">
            คะแนนรวม ${evalRes.pct}% (${evalRes.earnedPoints} / ${evalRes.totalPoints} คะแนน)
          </h2>
          <p class="m1-muted" style="margin:0 auto;max-width:540px">
            ${evalRes.passed
              ? `ยอดเยี่ยมมาก! คุณพิสูจน์แล้วว่าจำแม่น ฟังออก เรียงประโยคได้ และออกเสียงพูดได้จริง ปลดล็อกบทเรียนถัดไปเรียบร้อย`
              : `ขาดอีกเพียง <b>${evalRes.neededPoints} คะแนน</b> เพื่อถึงเกณฑ์ ${DAILY_MASTERY_PASS_PCT}% ระบบบันทึกคำที่พลาดเข้าชุดทบทวนแล้ว กรุณากลับไปทบทวนเนื้อหาแล้วสอบใหม่จนกว่าจะผ่าน`}
          </p>

          <div class="m1-score-breakdown">
            <div class="m1-score-box">
              <span>🧠 ฟัง · ความจำ · เรียงประโยค</span>
              <strong class="tabular-nums">${evalRes.quizCorrect} / ${evalRes.quizTotal} (${evalRes.quizPct}%)</strong>
            </div>
            <div class="m1-score-box">
              <span>🎙️ สอบพูดออกเสียงตามพินอิน</span>
              <strong class="tabular-nums">${evalRes.speakingPoints} / ${evalRes.speakingMax} (${evalRes.speakPct}%)</strong>
            </div>
          </div>
        </div>

        ${uniqueMissed.length > 0 ? `
          <div class="m1-missed-panel">
            <h4 style="margin:0 0 8px">📌 จุดที่ต้องทบทวนซ่อมก่อนสอบรอบถัดไป (${uniqueMissed.length} รายการ)</h4>
            <div class="m1-list">
              ${uniqueMissed.map((m, idx) => `
                <div class="m1-item">
                  <div>
                    <div class="m1-hz hanzi-font">${core.escapeHtml(m.hz || '—')} ${m.py ? `<span class="m1-py">${core.escapeHtml(m.py)}</span>` : ''}</div>
                    <div style="font-size:13.5px;font-weight:600">${core.escapeHtml(m.th || '')}</div>
                    <div class="m1-muted" style="font-size:12px">${core.escapeHtml(m.reason || '')}</div>
                  </div>
                  ${m.hz ? `
                    <div class="m1-row-btns">
                      <button type="button" class="btn-secondary m1-mini-btn" data-miss-slow="${idx}">🐢 0.6x</button>
                      <button type="button" class="btn-secondary m1-mini-btn" data-miss-say="${idx}">🔊 ฟัง</button>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="m1-runner-foot" style="justify-content:center;gap:10px;flex-wrap:wrap;margin-top:20px">
          ${evalRes.passed ? `
            ${dayNum < 30 && onPassContinue ? `<button type="button" class="btn-primary" id="m1-res-next-day">🚀 ไปลุย Day ${dayNum + 1} ต่อเลย →</button>` : ''}
            <button type="button" class="btn-secondary" id="m1-res-done">กลับหน้าหลัก</button>
          ` : `
            <button type="button" class="btn-primary" id="m1-res-restudy">📖 กลับไปเรียนทบทวนใหม่ แล้วสอบรอบถัดไป ↻</button>
            ${standalone ? `<button type="button" class="btn-secondary" id="m1-res-retake-now">📝 สุ่มข้อสอบชุดใหม่สอบอีกครั้ง</button>` : ''}
            <button type="button" class="btn-secondary" id="m1-res-done">พักก่อน (ยังไม่จบ Day ${dayNum})</button>
          `}
        </div>
      </div>
    `;

    host.querySelectorAll('[data-miss-say]').forEach(b => {
      b.addEventListener('click', () => {
        const m = uniqueMissed[Number(b.dataset.missSay)];
        if (m?.hz) core.speak(m.hz);
      });
    });
    host.querySelectorAll('[data-miss-slow]').forEach(b => {
      b.addEventListener('click', () => {
        const m = uniqueMissed[Number(b.dataset.missSlow)];
        if (m?.hz) speakSlow(m.hz);
      });
    });
    host.querySelector('#m1-res-next-day')?.addEventListener('click', () => onPassContinue?.(dayNum + 1));
    host.querySelector('#m1-res-restudy')?.addEventListener('click', () => {
      if (onRestudy) onRestudy();
      else mountExamStage(core, host, { dayNum, onPassContinue, onRestudy, onExit, standalone });
    });
    host.querySelector('#m1-res-retake-now')?.addEventListener('click', () => {
      mountExamStage(core, host, { dayNum, onPassContinue, onRestudy, onExit, standalone });
    });
    host.querySelector('#m1-res-done')?.addEventListener('click', () => onExit?.());
  };

  const renderQuizStep = () => {
    const q = exam.questions[qIdx];
    const totalDoneSteps = qIdx;
    const totalSteps = exam.questions.length + exam.speakingPrompts.length;
    const pctBar = Math.round((totalDoneSteps / totalSteps) * 100);

    const totalExamPts = exam.questions.length + exam.speakingPrompts.length * 2;
    const earnedSoFar = quizCorrect + speakResults.reduce((s, r) => s + (r ? r.points : 0), 0);
    const liveHudHtml = renderLiveScoreHud({
      earned: earnedSoFar,
      total: totalExamPts,
      passPct: DAILY_MASTERY_PASS_PCT,
      label: `คะแนนสอบ Day ${dayNum}`
    });

    if (q.kind === 'order') {
      const builtText = selectedOrderIndices.map(i => q.tiles[i]).join('');
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">🎯 สอบวัดผล Day ${dayNum} · พาร์ท 1 ข้อ ${qIdx + 1}/${exam.questions.length} · ${core.escapeHtml(q.category)}</span>
              <h3 style="margin:6px 0 2px">${core.escapeHtml(q.prompt)}</h3>
              <p class="m1-muted" style="margin:0;font-size:12.5px">เกณฑ์ผ่านประจำวัน ≥ ${DAILY_MASTERY_PASS_PCT}% · แตะแผ่นคำด้านล่างเพื่อเรียงเป็นประโยค</p>
            </div>
            <button type="button" class="btn-secondary m1-mini-btn" id="m1-exam-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.max(6, pctBar)}%"></div></div>
          ${liveHudHtml}

          <div class="m1-order-answer" id="m1-order-slot">
            ${selectedOrderIndices.length
              ? selectedOrderIndices.map((tileIdx, pos) => {
                const tPy = q.tilePinyins?.[tileIdx] || '';
                return `<button type="button" class="m1-order-chip chosen" data-unpick="${pos}">
                  <span class="hanzi-font">${core.escapeHtml(q.tiles[tileIdx])}</span>
                  ${tPy ? `<small class="m1-tile-py">${colorizePinyin(tPy)}</small>` : ''}
                </button>`;
              }).join('')
              : '<span class="m1-muted" style="font-size:14px">แตะคำด้านล่างมาวางเรียงตรงนี้...</span>'}
          </div>

          <div class="m1-order-bank">
            ${q.tiles.map((t, idx) => {
              const used = selectedOrderIndices.includes(idx);
              const tPy = q.tilePinyins?.[idx] || '';
              return `<button type="button" class="m1-order-chip" data-pick-tile="${idx}" ${used ? 'disabled' : ''}>
                <span class="hanzi-font">${core.escapeHtml(t)}</span>
                ${tPy ? `<small class="m1-tile-py">${colorizePinyin(tPy)}</small>` : ''}
              </button>`;
            }).join('')}
          </div>

          <div class="ux-sticky-bar">
            <button type="button" class="btn-secondary" id="m1-order-clear" ${selectedOrderIndices.length ? '' : 'disabled'}>ล้างเรียงใหม่</button>
            <button type="button" class="btn-primary" id="m1-order-submit" ${selectedOrderIndices.length === q.tiles.length ? '' : 'disabled'}>ส่งคำตอบข้อนี้ →</button>
          </div>
        </div>
      `;

      host.querySelector('#m1-exam-exit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
      host.querySelectorAll('[data-pick-tile]').forEach(b => {
        b.addEventListener('click', () => {
          const idx = Number(b.dataset.pickTile);
          if (!selectedOrderIndices.includes(idx)) {
            selectedOrderIndices.push(idx);
            renderQuizStep();
          }
        });
      });
      host.querySelectorAll('[data-unpick]').forEach(b => {
        b.addEventListener('click', () => {
          selectedOrderIndices.splice(Number(b.dataset.unpick), 1);
          renderQuizStep();
        });
      });
      host.querySelector('#m1-order-clear')?.addEventListener('click', () => {
        selectedOrderIndices = [];
        renderQuizStep();
      });
      host.querySelector('#m1-order-submit')?.addEventListener('click', () => {
        const isOk = builtText === q.expectedHz;
        if (isOk) {
          quizCorrect += 1;
          core.playChime('ok', true);
        } else {
          core.playChime('err', true);
          missedItems.push({
            hz: q.refItem?.hz || q.expectedHz,
            py: q.refItem?.py || '',
            th: q.refItem?.th || '',
            reason: `เรียงประโยคเป็น "${builtText}" (ที่ถูกคือ ${q.expectedHz})`
          });
        }
        selectedOrderIndices = [];
        qIdx += 1;
        if (qIdx >= exam.questions.length) {
          phase = 'speak';
          renderSpeakStep();
        } else {
          renderQuizStep();
        }
      });
      return;
    }

    // Choice question
    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🎯 สอบวัดผล Day ${dayNum} · พาร์ท 1 ข้อ ${qIdx + 1}/${exam.questions.length} · ${core.escapeHtml(q.category)}</span>
            <h3 style="margin:6px 0 4px">${core.escapeHtml(q.prompt)}</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">เกณฑ์ผ่านประจำวัน ≥ ${DAILY_MASTERY_PASS_PCT}% (ห้ามผิดเกิน 1 คะแนนรวมทั้งชุด)</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="m1-exam-exit">ออก</button>
        </div>
        <div class="m1-prog"><div class="m1-prog-fill" style="width:${Math.max(6, pctBar)}%"></div></div>
        ${liveHudHtml}

        ${q.audioHz ? `
          <div style="margin-bottom:14px;display:flex;gap:8px;align-items:center">
            <button type="button" class="btn-primary" id="m1-exam-audio">🔊 กดฟังเสียงโจทย์</button>
            <button type="button" class="btn-secondary" id="m1-exam-audio-slow">🐢 ฟังช้า 0.6x</button>
            ${q.hidePromptHz ? '<span class="m1-muted" style="font-size:12.5px">🎧 ข้อนี้วัดทักษะการฟังล้วน</span>' : ''}
          </div>
        ` : ''}

        <div class="m1-exam-choices">
          ${q.options.map((opt, idx) => `
            <button type="button" class="m1-exam-opt" data-opt="${idx}">
              <span class="m1-opt-num">${idx + 1}</span>
              <span>${core.escapeHtml(opt)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    if (q.audioHz) {
      setTimeout(() => core.speak(q.audioHz), 80);
      host.querySelector('#m1-exam-audio')?.addEventListener('click', () => core.speak(q.audioHz));
      host.querySelector('#m1-exam-audio-slow')?.addEventListener('click', () => speakSlow(q.audioHz));
    }
    host.querySelector('#m1-exam-exit')?.addEventListener('click', () => { stopMic(); onExit?.(); });

    host.querySelectorAll('[data-opt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = Number(btn.dataset.opt);
        const isOk = chosen === q.answer;
        if (isOk) {
          quizCorrect += 1;
          core.playChime('ok', true);
        } else {
          core.playChime('err', true);
          missedItems.push({
            hz: q.refItem?.hz || '',
            py: q.refItem?.py || '',
            th: q.refItem?.th || q.options[q.answer],
            reason: `${q.explain} (คุณเลือก: ${q.options[chosen]})`
          });
        }
        qIdx += 1;
        if (qIdx >= exam.questions.length) {
          phase = 'speak';
          renderSpeakStep();
        } else {
          renderQuizStep();
        }
      });
    });
  };

  const renderSpeakStep = () => {
    const sp = exam.speakingPrompts[sIdx];
    const curRes = speakResults[sIdx];
    const tries = speakTriesUsed[sIdx];
    const modelPlayed = speakModelUsed[sIdx];
    const maxTries = 2;
    const srSupported = hasSpeechRecognition();
    const totalSteps = exam.questions.length + exam.speakingPrompts.length;
    const pctBar = Math.round(((exam.questions.length + sIdx) / totalSteps) * 100);

    const totalExamPts = exam.questions.length + exam.speakingPrompts.length * 2;
    const earnedSoFar = quizCorrect + speakResults.reduce((s, r) => s + (r ? r.points : 0), 0);
    const liveHudHtml = renderLiveScoreHud({
      earned: earnedSoFar,
      total: totalExamPts,
      passPct: DAILY_MASTERY_PASS_PCT,
      label: `คะแนนสอบ Day ${dayNum}`
    });

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">🎙️ สอบพูดออกไมค์จริง Day ${dayNum} · ประโยคที่ ${sIdx + 1}/${exam.speakingPrompts.length} (มีพินอิน + ฟังตัวอย่างได้ 1 ครั้ง)</span>
            <h3 style="margin:6px 0 2px">อ่านออกเสียงประโยคภาษาจีนนี้ให้ชัดเจน (2 คะแนน)</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">ดูพินอินและฟังต้นฉบับนำได้ 1 ครั้ง จากนั้นกดอัดเสียงพูดให้ชัดและถูกวรรณยุกต์ (อัดได้สูงสุด ${maxTries} ครั้ง เก็บรอบที่ดีที่สุด)</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="m1-exam-exit">ออก</button>
        </div>
        <div class="m1-prog"><div class="m1-prog-fill" style="width:${pctBar}%"></div></div>
        ${liveHudHtml}

        <div class="m1-speak-exam-box">
          <div class="m1-muted" style="font-size:13px;margin-bottom:4px">ความหมาย: "${core.escapeHtml(sp.th)}"</div>
          <div class="hanzi-font" style="font-size:32px;font-weight:700;letter-spacing:2px;margin-bottom:4px">${core.escapeHtml(sp.hz)}</div>
          <div class="m1-py" style="font-size:18px;margin-bottom:14px">${colorizePinyin(sp.py)}</div>

          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <button type="button" class="btn-secondary" id="m1-exam-model-once" ${modelPlayed || micListening ? 'disabled' : ''}>
              ${modelPlayed ? '✓ ฟังเสียงต้นฉบับครบ 1/1 ครั้งแล้ว' : '🔊 ฟังเสียงต้นฉบับนำ (1/1 ครั้ง)'}
            </button>
          </div>

          ${srSupported ? `
            <div style="display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap">
              <button type="button" class="btn-primary m1-mic-exam-btn ${micListening ? 'is-listening' : ''}" id="m1-exam-mic" ${tries >= maxTries && !micListening ? 'disabled' : ''}>
                ${micListening
                  ? '🔴 กำลังฟังเสียงภาษาจีน... พูดเลย! (แตะเพื่อหยุด)'
                  : `🎙️ กดพูดออกไมค์ (${tries}/${maxTries} ครั้ง)`}
              </button>
              ${renderMicWaveHtml(micListening)}
            </div>
          ` : `
            <div class="m1-fallback-dictation">
              <div class="m1-muted" style="font-size:12.5px;margin-bottom:6px">
                ⚠️ เบราว์เซอร์นี้ไม่รองรับไมค์ Web Speech — กรุณาพิมพ์พินอินพร้อมเลขวรรณยุกต์ทุกพยางค์เพื่อยืนยันการออกเสียง (เช่น <code>wo3 shi4 tai4 guo2 ren2</code>)
              </div>
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                <input type="text" id="m1-py-fallback-in" class="vb-search" style="max-width:300px" placeholder="พิมพ์พินอิน + เลขวรรณยุกต์ 1-4...">
                <button type="button" class="btn-primary" id="m1-py-fallback-btn" ${tries >= maxTries ? 'disabled' : ''}>ตรวจวรรณยุกต์ (${tries}/${maxTries})</button>
              </div>
            </div>
          `}

          ${liveErrorMsg ? `<div style="color:var(--sys-red-text,#dc2626);font-size:13px;margin-top:10px">${core.escapeHtml(liveErrorMsg)}</div>` : ''}

          ${curRes ? `
            <div class="m1-speak-grade-card ${curRes.points >= 1.5 ? 'ok' : 'err'}">
              <div style="font-weight:700">${core.escapeHtml(curRes.gradeLabel)} · ความแม่นยำ ${curRes.pronScore}%</div>
              ${liveHeardText ? `<div class="m1-muted" style="font-size:12.5px;margin-top:2px">เสียงที่ระบบได้ยิน: <b class="hanzi-font">${core.escapeHtml(liveHeardText)}</b></div>` : ''}
              ${renderSyllableBadges(curRes.syllables)}
            </div>
          ` : ''}
        </div>

        <div class="m1-runner-foot" style="justify-content:flex-end">
          <button type="button" class="btn-primary" id="m1-speak-next" ${curRes ? '' : 'disabled'}>
            ${sIdx + 1 < exam.speakingPrompts.length ? 'ประโยคถัดไป →' : '📊 ส่งกระดาษคำตอบ & ดูผลสอบ 95% →'}
          </button>
        </div>
      </div>
    `;

    host.querySelector('#m1-exam-exit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
    host.querySelector('#m1-exam-model-once')?.addEventListener('click', () => {
      if (speakModelUsed[sIdx]) return;
      speakModelUsed[sIdx] = true;
      core.speak(sp.hz);
      renderSpeakStep();
    });

    host.querySelector('#m1-exam-mic')?.addEventListener('click', () => {
      if (micListening) {
        stopMic();
        micListening = false;
        renderSpeakStep();
        return;
      }
      if (speakTriesUsed[sIdx] >= maxTries) return;
      liveErrorMsg = '';
      micListening = true;
      renderSpeakStep();

      activeMic = startSpeechRecognition({
        lang: 'zh-CN',
        onResult(transcript) {
          micListening = false;
          liveHeardText = transcript;
          speakTriesUsed[sIdx] += 1;
          const graded = gradeSpeakingExamItem({
            targetHz: sp.hz,
            targetPy: sp.py,
            heardText: transcript,
            charPinyinMap: charPyMap
          });
          const prev = speakResults[sIdx];
          if (!prev || graded.points >= prev.points) {
            speakResults[sIdx] = graded;
          }
          core.playChime(graded.points >= 1.5 ? 'ok' : 'err', true);
          renderSpeakStep();
        },
        onError(msg) {
          micListening = false;
          liveErrorMsg = msg;
          renderSpeakStep();
        },
        onEnd() {
          if (micListening) {
            micListening = false;
            renderSpeakStep();
          }
        }
      });
    });

    host.querySelector('#m1-py-fallback-btn')?.addEventListener('click', () => {
      const inp = host.querySelector('#m1-py-fallback-in');
      const val = inp ? inp.value.trim() : '';
      if (!val || speakTriesUsed[sIdx] >= maxTries) return;
      speakTriesUsed[sIdx] += 1;
      const graded = gradeSpeakingExamItem({
        targetHz: sp.hz,
        targetPy: sp.py,
        typedPinyinFallback: val
      });
      const prev = speakResults[sIdx];
      if (!prev || graded.points >= prev.points) {
        speakResults[sIdx] = graded;
      }
      core.playChime(graded.points >= 1.5 ? 'ok' : 'err', true);
      renderSpeakStep();
    });

    host.querySelector('#m1-speak-next')?.addEventListener('click', () => {
      stopMic();
      liveHeardText = '';
      liveErrorMsg = '';
      sIdx += 1;
      if (sIdx >= exam.speakingPrompts.length) {
        finishAndSaveResult();
      } else {
        renderSpeakStep();
      }
    });
  };

  renderQuizStep();
}

/**
 * Standalone Exam launcher (used by 14-Day Intensive Plan `#daily-quiz-card` as well).
 */
export function renderExamOnlyRunner(core, host, dayNum, onDone) {
  mountExamStage(core, host, {
    dayNum,
    standalone: true,
    onPassContinue: (nextDay) => {
      if (onDone) onDone({ passed: true, nextDay });
    },
    onRestudy: () => {
      renderGuidedRunner(core, host, () => onDone?.({ passed: false }), { targetDay: dayNum });
    },
    onExit: () => onDone?.({ exited: true })
  });
}

/**
 * Full 4-Step Guided Daily Study + Mandatory >=95% Daily Mastery Exam.
 * Cannot skip study steps, and Day is NOT completed until exam score >= 95%.
 */
export function renderGuidedRunner(core, host, onDone, opts = {}) {
  const extNow = core.getExt('month1') || {};
  const day = Number(opts.targetDay) || getTodayBlueprintDay(core.state.progress, extNow);

  // 1) Weekly Cumulative Boss Gate: if learner completed Week 1/2/3/4 days (e.g. Day 1..7) and tries to advance past checkpoint without passing the Boss Exam >=95%, enforce Weekly Boss first!
  const pendingBoss = getPendingWeeklyBoss(core.state.progress, extNow);
  if (pendingBoss && day > pendingBoss && !opts.bypassBossGate) {
    renderWeeklyBossRunner(core, host, pendingBoss, {
      onPass: () => renderGuidedRunner(core, host, onDone, { ...opts, bypassBossGate: true }),
      onRepairDay: (repairDayNum) => renderGuidedRunner(core, host, onDone, { targetDay: repairDayNum, bypassBossGate: true, skipFsrsGate: true }),
      onExit: onDone
    });
    return;
  }

  // 2) Morning Quiz-FSRS Gate: if there are due FSRS cards waiting today, require clearing them to 0 before starting a new unpassed day!
  const dayRecNow = getDayMasteryRecord(day, extNow);
  const dueFsrsCards = getDueMonth1FsrsCards(extNow.fsrsDeck || {}, core.todayKey());
  if (!opts.skipFsrsGate && !dayRecNow.passed && dueFsrsCards.length > 0) {
    renderFsrsQuizGate(core, host, {
      gateForDay: day,
      onCleared: () => renderGuidedRunner(core, host, onDone, { ...opts, skipFsrsGate: true }),
      onExit: onDone
    });
    return;
  }

  const intensityLv = Number(core.getExt('month1')?.intensity) || 1;
  const session = buildGuidedSession(day, core.state.progress.mistakes || [], { intensity: intensityLv });
  let step = 0; // 0: closed-book warmup recall, 1: tone pairs, 2: speak 5 + mic practice, 3: 95% mastery exam
  const checkedWarmup = new Set();
  const listenedTones = new Set();
  const checkedTones = new Set();
  const checkedSpeak = new Set();
  const speakPracticeFeedback = {};
  let activePracticeMic = null;
  let charPyMap = null;
  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  // Build 4-option choices for Step 1 Active Recall Warm-up
  const warmupChoices = session.warmup.map((w) => {
    const others = SURVIVAL_50.filter(s => s.th !== w.th).slice(0, 12);
    const distractors = core.shuffleArray(others).slice(0, 3).map(d => d.th);
    return core.shuffleArray([w.th, ...distractors]);
  });
  const warmupFeedback = {};

  const stopMic = () => {
    if (activePracticeMic) {
      try { activePracticeMic.stop(); } catch { /* ignore */ }
      activePracticeMic = null;
    }
  };

  const speakSlow = (hz) => {
    const prev = core.state.rate;
    core.state.rate = 0.6;
    core.speak(hz, () => { core.state.rate = prev; });
  };

  const draw = () => {
    if (step === 0) {
      const allDone = checkedWarmup.size >= session.warmup.length;
      const pyNote = session.day <= 14
        ? 'มีพินอินกำกับให้ครบเหมือน HSK 1 — กดฟังเสียงแล้วเลือกความหมายภาษาไทยให้ถูกทุกข้อ'
        : 'โหมดครึ่งเดือนหลัง: ค่อยๆ ซ่อนพินอินเฉพาะคำพื้นฐานที่คุ้นแล้ว กดฟังเสียงช่วยได้';
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">Day ${session.day} · ขั้นที่ 1/4 (ทวนความจำคำเดิม)</span>
              <h2 style="margin:6px 0 2px">🔄 ทดสอบทวนคำเดิมก่อนเริ่มบทใหม่ (${checkedWarmup.size}/${session.warmup.length})</h2>
              <p class="m1-muted" style="margin:0">${pyNote}</p>
            </div>
            <button type="button" class="btn-secondary" id="m1-run-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:15%"></div></div>
          <div class="m1-list">
            ${session.warmup.map((w, i) => {
              const isOk = checkedWarmup.has(i);
              const fb = warmupFeedback[i] || '';
              const pyHint = getProgressivePinyin(w.hz, w.py, session.day);
              return `
                <div class="m1-item ${isOk ? 'done' : ''}" style="flex-direction:column;align-items:stretch">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                    <div class="m1-hz hanzi-font">
                      ${core.escapeHtml(w.hz)}
                      ${isOk
                        ? `<span class="m1-py">${core.escapeHtml(w.py)} · ${core.escapeHtml(w.th)}</span>`
                        : (pyHint ? `<span class="m1-py">${core.escapeHtml(pyHint)}</span>` : '')}
                    </div>
                    <button type="button" class="btn-secondary m1-mini-btn" data-play="${i}">🔊 ฟังเสียง</button>
                  </div>
                  ${isOk ? `<div style="color:var(--sys-green-text,#16a34a);font-size:13px;font-weight:700">✓ ตอบถูกต้อง จำแม่นแล้ว!</div>` : `
                    <div class="m1-chip-row" style="margin-top:6px">
                      ${warmupChoices[i].map(opt => `
                        <button type="button" class="btn-secondary m1-mini-btn" data-w-ans="${i}" data-w-val="${core.escapeHtml(opt)}">${core.escapeHtml(opt)}</button>
                      `).join('')}
                    </div>
                    ${fb ? `<div style="color:var(--sys-red-text,#dc2626);font-size:12.5px;margin-top:4px">${core.escapeHtml(fb)}</div>` : ''}
                  `}
                </div>
              `;
            }).join('')}
          </div>
          <div class="m1-runner-foot">
            <button type="button" class="btn-primary" id="m1-next-step" ${allDone ? '' : 'disabled'}>
              ${allDone ? 'ไปขั้นที่ 2: ฝึกคู่วรรณยุกต์ →' : `ตอบทวนให้ครบทั้ง ${session.warmup.length} ข้อก่อนไปต่อ`}
            </button>
          </div>
        </div>`;

      host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => core.speak(session.warmup[Number(b.dataset.play)].hz)));
      host.querySelectorAll('[data-w-ans]').forEach(b => b.addEventListener('click', () => {
        const idx = Number(b.dataset.wAns);
        const val = b.dataset.wVal;
        const target = session.warmup[idx];
        if (val === target.th) {
          checkedWarmup.add(idx);
          delete warmupFeedback[idx];
          core.playChime('ok', true);
        } else {
          warmupFeedback[idx] = `ยังไม่ถูก! กดฟังเสียง "${target.hz}" อีกครั้งแล้วเลือกความหมายใหม่นะ`;
          core.playChime('err', true);
        }
        draw();
      }));
    } else if (step === 1) {
      const allDone = checkedTones.size >= session.toneFocus.length;
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">Day ${session.day} · ขั้นที่ 2/4 (ฝึกหูและวรรณยุกต์)</span>
              <h2 style="margin:6px 0 2px">🎵 ฝึก 4 คู่วรรณยุกต์ประจำวัน (${checkedTones.size}/${session.toneFocus.length})</h2>
              <p class="m1-muted" style="margin:0">${core.escapeHtml(session.meta.title)} — กดฟังเสียงแล้วออกเสียงตามให้ครบทุกคู่เพื่อเตรียมสอบฟังท้ายบท</p>
            </div>
            <button type="button" class="btn-secondary" id="m1-run-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:40%"></div></div>
          <div class="m1-list">
            ${session.toneFocus.map((t, i) => {
              const hasListened = listenedTones.has(i);
              const isDone = checkedTones.has(i);
              return `
                <div class="m1-item ${isDone ? 'done' : ''}">
                  <div>
                    <span class="m1-tag">${core.escapeHtml(t.label)}</span>
                    <div class="m1-hz hanzi-font" style="margin-top:4px">${core.escapeHtml(t.hz)} <span class="m1-py">${core.escapeHtml(t.py)}</span></div>
                    <div class="m1-muted">${core.escapeHtml(t.th)} · 💡 ${core.escapeHtml(t.tip)}</div>
                  </div>
                  <div class="m1-row-btns">
                    <button type="button" class="btn-secondary m1-mini-btn" data-slow="${i}">🐢 0.6x</button>
                    <button type="button" class="btn-secondary m1-mini-btn" data-play="${i}">🔊 ฟัง</button>
                    <button type="button" class="btn-primary m1-mini-btn" data-ok="${i}" ${(!hasListened || isDone) ? 'disabled' : ''}>
                      ${isDone ? '✓ ฝึกแล้ว' : (hasListened ? 'ออกเสียงตามแล้ว' : 'กดฟังก่อน')}
                    </button>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <div class="m1-quiz-inline" style="margin-top:12px;margin-bottom:0">
            <div style="font-weight:700;font-size:13.5px;margin-bottom:6px">🧠 ภาพจำตัวอักษรประจำวันนี้ (ออกสอบ 1 ข้อ):</div>
            <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">
              ${session.mnemFocus.map((m, mi) => `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:var(--sys-bg-elevated,#fff)">
                  <div>
                    <span class="hanzi-font" style="font-size:22px;font-weight:700">${core.escapeHtml(m.hz)}</span>
                    <span class="m1-py">${core.escapeHtml(m.py)} · ${core.escapeHtml(m.th)}</span>
                    <div class="m1-muted" style="font-size:11.5px">${core.escapeHtml(m.story)}</div>
                  </div>
                  <button type="button" class="btn-secondary m1-mini-btn" data-mnem-say="${mi}">🔊</button>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="m1-runner-foot" style="justify-content:space-between">
            <button type="button" class="btn-secondary" id="m1-prev-step">← ย้อนกลับ</button>
            <button type="button" class="btn-primary" id="m1-next-step" ${allDone ? '' : 'disabled'}>
              ${allDone ? 'ไปขั้นที่ 3: ฝึกพูด 5 ประโยค →' : `กดฟังและฝึกให้ครบ ${session.toneFocus.length} คู่ก่อน`}
            </button>
          </div>
        </div>`;

      host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
        const idx = Number(b.dataset.play);
        listenedTones.add(idx);
        core.speak(session.toneFocus[idx].hz);
        draw();
      }));
      host.querySelectorAll('[data-slow]').forEach(b => b.addEventListener('click', () => {
        const idx = Number(b.dataset.slow);
        listenedTones.add(idx);
        speakSlow(session.toneFocus[idx].hz);
        draw();
      }));
      host.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => {
        const idx = Number(b.dataset.ok);
        if (!listenedTones.has(idx) || checkedTones.has(idx)) return;
        checkedTones.add(idx);
        core.playChime('ok', true);
        draw();
      }));
      host.querySelectorAll('[data-mnem-say]').forEach(b => b.addEventListener('click', () => {
        const m = session.mnemFocus[Number(b.dataset.mnemSay)];
        if (m) core.speak(m.hz);
      }));
      host.querySelector('#m1-prev-step')?.addEventListener('click', () => { step = 0; draw(); });
    } else if (step === 2) {
      const allDone = checkedSpeak.size >= session.speakItems.length;
      const srAvail = hasSpeechRecognition();
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">Day ${session.day} · ขั้นที่ 3/4 (ซ้อมพูดก่อนเข้าห้องสอบ)</span>
              <h2 style="margin:6px 0 2px">🗣️ ซ้อมพูด 5 ประโยคประจำวัน (${checkedSpeak.size}/${session.speakItems.length})</h2>
              <p class="m1-muted" style="margin:0">ฝึกออกเสียงตามพินอินให้คล่อง! ในขั้นสอบพูดจะมีพินอินให้ดู + กดฟังต้นฉบับนำได้ 1 ครั้งก่อนอัดไมค์ (เกณฑ์รวม ≥ ${DAILY_MASTERY_PASS_PCT}%)</p>
            </div>
            <button type="button" class="btn-secondary" id="m1-run-exit">ออก</button>
          </div>
          <div class="m1-prog"><div class="m1-prog-fill" style="width:68%"></div></div>
          <div class="m1-list">
            ${session.speakItems.map((s, i) => {
              const isDone = checkedSpeak.has(i);
              const pracFb = speakPracticeFeedback[i];
              return `
                <div class="m1-item ${isDone ? 'done' : ''}" style="flex-direction:column;align-items:stretch">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                    <div>
                      <div class="m1-hz hanzi-font">${core.escapeHtml(s.hz)}</div>
                      <div class="m1-py">${core.escapeHtml(s.py)}</div>
                      <div class="m1-muted">${core.escapeHtml(s.th)} · 💡 ${core.escapeHtml(s.tip)}</div>
                    </div>
                    <div class="m1-row-btns">
                      <button type="button" class="btn-secondary m1-mini-btn" data-slow="${i}">🐢 0.6x</button>
                      <button type="button" class="btn-secondary m1-mini-btn" data-play="${i}">🔊 ปกติ</button>
                      ${srAvail ? `<button type="button" class="btn-secondary m1-mini-btn" data-prac-mic="${i}">🎙️ ซ้อมไมค์</button>` : ''}
                      <button type="button" class="btn-primary m1-mini-btn" data-ok="${i}" ${isDone ? 'disabled' : ''}>${isDone ? '✓ พร้อมสอบ' : 'จำได้แล้ว'}</button>
                    </div>
                  </div>
                  ${pracFb ? `<div style="margin-top:6px;font-size:12.5px">${pracFb}</div>` : ''}
                </div>`;
            }).join('')}
          </div>
          <div class="m1-runner-foot" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-secondary" id="m1-prev-step">← ย้อนกลับ</button>
            <button type="button" class="btn-primary" id="m1-next-step" ${allDone ? '' : 'disabled'}>
              ${allDone ? `📝 เข้าห้องสอบประจำวัน Day ${session.day} (เกณฑ์ผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}%) →` : `ซ้อมให้ครบทั้ง ${session.speakItems.length} ประโยคก่อนเข้าสอบ`}
            </button>
          </div>
        </div>`;

      host.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => core.speak(session.speakItems[Number(b.dataset.play)].hz)));
      host.querySelectorAll('[data-slow]').forEach(b => b.addEventListener('click', () => speakSlow(session.speakItems[Number(b.dataset.slow)].hz)));
      host.querySelectorAll('[data-prac-mic]').forEach(b => b.addEventListener('click', () => {
        stopMic();
        const idx = Number(b.dataset.pracMic);
        const s = session.speakItems[idx];
        const cleanHz = s.hz.replace(/…/g, '').replace(/\s*\/\s*.*/, '').trim();
        speakPracticeFeedback[idx] = '<span style="color:var(--sys-accent,#007aff);font-weight:600">🔴 กำลังฟังเสียงซ้อม... พูดเลย!</span>';
        draw();
        activePracticeMic = startSpeechRecognition({
          lang: 'zh-CN',
          onResult(heard) {
            const res = scorePronunciation(cleanHz, s.py, heard, charPyMap);
            if (res.score >= 75) checkedSpeak.add(idx);
            speakPracticeFeedback[idx] = `<b>ซ้อมออกเสียง: ${res.score}%</b> (ได้ยิน: <span class="hanzi-font">${core.escapeHtml(heard)}</span>) ${renderSyllableBadges(res.syllables)}`;
            core.playChime(res.score >= 75 ? 'ok' : 'err', true);
            draw();
          },
          onError(err) {
            speakPracticeFeedback[idx] = `<span style="color:var(--sys-red-text,#dc2626)">${core.escapeHtml(err)}</span>`;
            draw();
          }
        });
      }));
      host.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => {
        const idx = Number(b.dataset.ok);
        checkedSpeak.add(idx);
        core.playChime('ok', true);
        draw();
      }));
      host.querySelector('#m1-prev-step')?.addEventListener('click', () => { stopMic(); step = 1; draw(); });
    } else {
      // Step 3 -> Enter Strict >=95% Daily Mastery Exam!
      stopMic();
      mountExamStage(core, host, {
        dayNum: session.day,
        standalone: false,
        onPassContinue: (nextDay) => {
          renderGuidedRunner(core, host, onDone, { targetDay: nextDay });
        },
        onRestudy: () => {
          // Send learner back to study phase with refreshed mistakes in Step 1!
          renderGuidedRunner(core, host, onDone, { targetDay: session.day });
        },
        onExit: onDone
      });
      return;
    }

    host.querySelector('#m1-run-exit')?.addEventListener('click', () => { stopMic(); onDone?.(); });
    host.querySelector('#m1-next-step')?.addEventListener('click', () => { stopMic(); step++; draw(); });
  };

  draw();
}
