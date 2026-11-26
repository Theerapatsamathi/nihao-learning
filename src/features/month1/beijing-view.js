// Beijing 60-Day Hardcore Survival Quest Hub (`beijing` tab)
import {
  BEIJING_QUESTS,
  BEIJING_TRIP_DATE,
  getDaysUntilBeijing,
  calcBeijingReadiness,
  buildBeijingQuestExam,
  buildPreFlightBoardingExam
} from './beijing-data.js';
import { DAILY_MASTERY_PASS_PCT } from './logic.js';
import { colorizePinyin, renderLiveScoreHud, renderMicWaveHtml } from './ux-utils.js';
import { renderLiveVoiceCallRunner } from './live-voice-call.js';
import { hasSpeechRecognition, startSpeechRecognition } from '../speak-studio/speech.js';
import { scorePronunciation } from '../speak-studio/scoring.js';

function runBeijingExam(core, host, exam, { title, onComplete, onExit }) {
  let phase = 'quiz'; // 'quiz' | 'speak' | 'result'
  let qIdx = 0;
  let correct = 0;
  let sIdx = 0;
  let speakPts = 0;
  let listening = false;
  let lastHeard = '';
  let lastScore = null;
  let activeMic = null;
  const totalPts = exam.questions.length + exam.speaking.length * 2;

  const stopMic = () => {
    listening = false;
    if (activeMic) { try { activeMic.stop(); } catch { /* ignore */ } activeMic = null; }
  };

  const speakAt = (hz, rate = 1.0) => {
    const prev = core.state.rate;
    core.state.rate = rate;
    core.speak(hz, () => { core.state.rate = prev; });
  };

  const render = () => {
    const earned = correct + speakPts;
    const hud = renderLiveScoreHud({ earned, total: totalPts, passPct: DAILY_MASTERY_PASS_PCT, label: title });

    if (phase === 'quiz') {
      const q = exam.questions[qIdx];
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">✈️ ${core.escapeHtml(title)} · ข้อ ${qIdx + 1}/${exam.questions.length}</span>
              <h3 style="margin:6px 0 4px">${core.escapeHtml(q.prompt)}</h3>
            </div>
            <button type="button" class="btn-secondary m1-mini-btn" id="bj-ex-exit">ออก</button>
          </div>
          ${hud}
          <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-primary" id="bj-ex-audio">🔊 ฟังเสียง (${q.rate}x)</button>
            <button type="button" class="btn-secondary" id="bj-ex-slow">🐢 ฟังช้า 0.75x</button>
          </div>
          <div class="m1-exam-choices">
            ${q.options.map((opt, i) => `
              <button type="button" class="m1-exam-opt" data-bj-opt="${i}">
                <span class="m1-opt-num">${i + 1}</span>
                <span>${core.escapeHtml(opt)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      setTimeout(() => speakAt(q.audioHz, q.rate), 100);
      host.querySelector('#bj-ex-exit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
      host.querySelector('#bj-ex-audio')?.addEventListener('click', () => speakAt(q.audioHz, q.rate));
      host.querySelector('#bj-ex-slow')?.addEventListener('click', () => speakAt(q.audioHz, 0.75));
      host.querySelectorAll('[data-bj-opt]').forEach(b => b.addEventListener('click', () => {
        const chosen = Number(b.dataset.bjOpt);
        if (chosen === q.answer) {
          correct += 1;
          core.playChime('ok', true);
        } else {
          core.playChime('err', true);
          core.showToast(`เฉลย: ${q.ref.hz} = ${q.ref.th}`);
        }
        qIdx += 1;
        if (qIdx >= exam.questions.length) {
          phase = 'speak';
          sIdx = 0;
        }
        render();
      }));
      return;
    }

    if (phase === 'speak') {
      const sp = exam.speaking[sIdx];
      host.innerHTML = `
        <div class="card-panel m1-runner">
          <div class="m1-runner-head">
            <div>
              <span class="m1-tag">🎙️ พาร์ทพูดสดปักกิ่ง · ประโยค ${sIdx + 1}/${exam.speaking.length} (2 คะแนน)</span>
              <h3 style="margin:6px 0 2px">พูดประโยคนี้ให้คนปักกิ่งฟังออก!</h3>
            </div>
            <button type="button" class="btn-secondary m1-mini-btn" id="bj-ex-exit">ออก</button>
          </div>
          ${hud}
          <div class="m1-speak-exam-box" style="margin:12px 0">
            <div class="m1-muted" style="font-size:13.5px;margin-bottom:4px">สถานการณ์: "${core.escapeHtml(sp.th)}"</div>
            <div class="hanzi-font" style="font-size:28px;font-weight:700;margin:4px 0">${core.escapeHtml(sp.hz)}</div>
            <div class="m1-py" style="font-size:16px;margin-bottom:12px">${colorizePinyin(sp.py)}</div>
            <div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn-secondary" id="bj-sp-listen">🔊 ฟังต้นฉบับ</button>
              <button type="button" class="btn-primary ${listening ? 'is-listening' : ''}" id="bj-sp-mic">
                ${listening ? '🔴 กำลังฟัง... พูดเลย!' : '🎙️ กดพูดออกไมค์'}
              </button>
              ${renderMicWaveHtml(listening)}
            </div>
            ${lastScore !== null ? `
              <div class="m1-status-pill ${lastScore >= 75 ? 'pass' : 'fail'}" style="margin-top:12px">
                ความแม่นยำ ${lastScore}% ${lastHeard ? `(ได้ยิน: ${core.escapeHtml(lastHeard)})` : ''}
              </div>
            ` : ''}
          </div>
          <div class="ux-sticky-bar">
            <span class="m1-muted" style="font-size:12.5px">ต้องพูดได้ ≥75% เพื่อรับเต็ม 2 คะแนน</span>
            <button type="button" class="btn-primary" id="bj-sp-next">${sIdx + 1 < exam.speaking.length ? 'ประโยคถัดไป →' : 'ดูผลสอบ →'}</button>
          </div>
        </div>
      `;
      host.querySelector('#bj-ex-exit')?.addEventListener('click', () => { stopMic(); onExit?.(); });
      host.querySelector('#bj-sp-listen')?.addEventListener('click', () => core.speak(sp.hz));
      host.querySelector('#bj-sp-mic')?.addEventListener('click', () => {
        if (listening) { stopMic(); render(); return; }
        if (!hasSpeechRecognition()) {
          lastScore = 85;
          core.showToast('เบราว์เซอร์ไม่รองรับไมค์ — ผ่านพาร์ทพูดอัตโนมัติ');
          render();
          return;
        }
        listening = true;
        lastHeard = '';
        render();
        activeMic = startSpeechRecognition({
          lang: 'zh-CN',
          onResult: (txt) => {
            lastHeard = txt || '';
            lastScore = scorePronunciation(sp.hz, sp.py, lastHeard).score;
            stopMic();
            if (lastScore >= 75) core.playChime('ok', true);
            render();
          },
          onError: () => { stopMic(); render(); },
          onEnd: () => { if (listening) { stopMic(); render(); } }
        });
      });
      host.querySelector('#bj-sp-next')?.addEventListener('click', () => {
        stopMic();
        if (lastScore !== null) {
          speakPts += lastScore >= 75 ? 2 : (lastScore >= 45 ? 1 : 0);
        }
        lastScore = null;
        lastHeard = '';
        sIdx += 1;
        if (sIdx >= exam.speaking.length) {
          phase = 'result';
          const pct = Math.round(((correct + speakPts) / totalPts) * 100);
          onComplete?.({ pct, passed: pct >= DAILY_MASTERY_PASS_PCT });
        }
        render();
      });
      return;
    }

    const pct = Math.round(((correct + speakPts) / totalPts) * 100);
    const passed = pct >= DAILY_MASTERY_PASS_PCT;
    host.innerHTML = `
      <div class="card-panel m1-runner" style="text-align:center;padding:24px 16px">
        <div style="font-size:52px">${passed ? '🎫' : '🔥'}</div>
        <h2 style="margin:8px 0 4px">${passed ? `ผ่านด่าน ${core.escapeHtml(title)} (${pct}%)!` : `ยังไม่ถึง ${DAILY_MASTERY_PASS_PCT}% (ได้ ${pct}%)`}</h2>
        <p class="m1-muted">${passed ? 'ยอดเยี่ยมมาก! พร้อมเอาตัวรอดในปักกิ่งจริงแล้ว!' : 'ลากเลือดอีกนิด! กลับไปทวนประโยคแล้วสอบใหม่จนกว่าจะผ่าน ≥95%'}</p>
        <div style="display:flex;justify-content:center;gap:10px;margin-top:14px">
          <button type="button" class="btn-primary" id="bj-res-back">กลับหน้าภารกิจปักกิ่ง</button>
        </div>
      </div>
    `;
    host.querySelector('#bj-res-back')?.addEventListener('click', () => onExit?.());
  };

  render();
}

export function renderBeijingTab(core, host) {
  if (!host) return;
  const ext = core.getExt('month1') || {};
  const bj = ext.beijing || {};
  const daysLeft = getDaysUntilBeijing(core.todayKey(), BEIJING_TRIP_DATE);
  const ready = calcBeijingReadiness(bj);

  host.innerHTML = `
    <div class="card-panel m1-hero ux-focus-hero" style="background:linear-gradient(135deg, rgba(220,38,38,0.12), rgba(245,158,11,0.10));border-color:rgba(220,38,38,0.35)">
      <div class="m1-hero-left">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="m1-tag" style="background:rgba(220,38,38,0.15);color:#dc2626">✈️ BEIJING 2027 · นับถอยหลังวันบิน 25 ม.ค.</span>
          <span class="m1-status-pill ${ready.boardingPassed ? 'pass' : 'pending'}">
            ${ready.boardingPassed ? '🎫 Boarding Pass ปลดล็อกแล้ว!' : `ความพร้อมก่อนบิน ${ready.pct}%`}
          </span>
        </div>
        <h2 style="margin:8px 0 6px">ภารกิจพิชิตปักกิ่ง: เหลืออีก ${daysLeft} วันก่อนขึ้นเครื่อง!</h2>
        <p class="m1-muted" style="margin:0 0 12px">เคลียร์ครบ 6 เควสเอาตัวรอด (48 ประโยคเด็ดปักกิ่ง · สอบผ่าน ≥95% ทุกเควส) แล้วพิชิต <b>Pre-Flight Boarding Exam</b> รับตั๋วพร้อมบิน 100%</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn-primary ux-primary-cta" id="bj-boarding-exam">🎫 สอบใหญ่ก่อนขึ้นเครื่อง (20 ข้อ · ≥95%)</button>
          <button type="button" class="btn-secondary m1-ai-btn" id="bj-live-call">📞 โทรซ้อมกับคนปักกิ่ง AI</button>
        </div>
      </div>
      <div class="m1-kpi-mini">
        <div><strong>⏳ ${daysLeft}</strong><span>วันก่อนบิน</span></div>
        <div><strong>${ready.questsDone}/${ready.questsTotal}</strong><span>เควสผ่าน ≥95%</span></div>
        <div><strong>${ready.pct}%</strong><span>ความพร้อม</span></div>
      </div>
    </div>

    <div style="margin-top:14px">
      ${BEIJING_QUESTS.map(q => {
        const rec = bj.quests?.[q.id] || {};
        const passed = Boolean(rec.passed);
        return `
          <details class="ux-week-group ${passed ? '' : 'is-current'}" ${passed ? '' : 'open'}>
            <summary class="ux-week-summary">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <strong>${q.icon} ${core.escapeHtml(q.title)}</strong>
                <span class="m1-status-pill ${passed ? 'pass' : 'pending'}">
                  ${passed ? `✅ ผ่านแล้ว ${rec.bestPct || 95}%` : '🔥 ต้องสอบผ่าน ≥95%'}
                </span>
              </div>
              <button type="button" class="btn-primary m1-mini-btn" data-bj-exam="${q.id}">🎯 สอบเควสนี้ (≥95%)</button>
            </summary>
            <div class="ux-week-body">
              <div class="m1-muted" style="font-size:12.5px;margin-bottom:10px">${core.escapeHtml(q.focus)}</div>
              <div class="m1-list">
                ${q.phrases.map(p => `
                  <div class="m1-item">
                    <div>
                      <div class="hanzi-font" style="font-size:18px;font-weight:700">${core.escapeHtml(p.hz)}</div>
                      <div class="m1-py" style="font-size:13.5px">${colorizePinyin(p.py)}</div>
                      <div style="font-size:13px">${core.escapeHtml(p.th)}</div>
                      <div class="m1-tip">💡 ${core.escapeHtml(p.tip)}</div>
                    </div>
                    <div class="m1-row-btns">
                      <button type="button" class="btn-secondary m1-mini-btn" data-bj-say="${core.escapeHtml(p.hz)}" data-rate="0.95">🔊 ปกติ</button>
                      <button type="button" class="btn-secondary m1-mini-btn" data-bj-say="${core.escapeHtml(p.hz)}" data-rate="1.2">⚡ 1.2x</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </details>
        `;
      }).join('')}
    </div>
  `;

  const redraw = () => renderBeijingTab(core, host);

  host.querySelectorAll('[data-bj-say]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const prev = core.state.rate;
    core.state.rate = Number(b.dataset.rate) || 0.95;
    core.speak(b.dataset.bjSay, () => { core.state.rate = prev; });
  }));

  host.querySelectorAll('[data-bj-exam]').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const qid = b.dataset.bjExam;
    const exam = buildBeijingQuestExam(qid, Date.now());
    runBeijingExam(core, host, exam, {
      title: exam.quest.title,
      onComplete: ({ pct, passed }) => {
        core.setExt('month1', (cur) => {
          const prevBj = cur.beijing || {};
          const prevQ = prevBj.quests?.[qid] || {};
          return {
            ...cur,
            beijing: {
              ...prevBj,
              quests: {
                ...(prevBj.quests || {}),
                [qid]: {
                  passed: Boolean(prevQ.passed || passed),
                  bestPct: Math.max(Number(prevQ.bestPct) || 0, pct),
                  updatedAt: Date.now()
                }
              }
            }
          };
        }, { save: true });
        if (passed) {
          core.addXp(40, `✈️ ผ่านเควสปักกิ่ง ${exam.quest.title} (${pct}%)!`);
          core.spawnConfetti?.(30);
        }
      },
      onExit: redraw
    });
  }));

  host.querySelector('#bj-boarding-exam')?.addEventListener('click', () => {
    const exam = buildPreFlightBoardingExam(Date.now());
    runBeijingExam(core, host, exam, {
      title: 'Pre-Flight Beijing Boarding Exam',
      onComplete: ({ pct, passed }) => {
        core.setExt('month1', (cur) => {
          const prevBj = cur.beijing || {};
          const prevB = prevBj.boardingExam || {};
          return {
            ...cur,
            beijing: {
              ...prevBj,
              boardingExam: {
                passed: Boolean(prevB.passed || passed),
                bestPct: Math.max(Number(prevB.bestPct) || 0, pct),
                updatedAt: Date.now()
              }
            }
          };
        }, { save: true });
        if (passed) {
          core.addXp(100, `🎫 ปลดล็อก Boarding Pass ปักกิ่ง (${pct}%)!`);
          core.spawnConfetti?.(50);
        }
      },
      onExit: redraw
    });
  });

  host.querySelector('#bj-live-call')?.addEventListener('click', () => {
    renderLiveVoiceCallRunner(core, host, redraw);
  });
}
