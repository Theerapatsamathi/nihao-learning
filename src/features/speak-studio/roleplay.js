// Roleplay (#1), 3-Level Hints (#6), and Post-Conversation Feedback Report (#3)
import { ROLEPLAY_SCENARIOS } from './data.js';
import { matchOfflineRoleplay, buildOfflineFeedback } from './scoring.js';
import { startSpeechRecognition, hasSpeechRecognition, addToReviewQueue, handleAiError } from './speech.js';

/**
 * Reusable Feedback Report Renderer (#3) — used by both Roleplay and Free Talk.
 */
export async function renderFeedbackReport(core, host, { scenario, transcript, completedGoals = [], onBack }) {
  const esc = core.escapeHtml;
  host.innerHTML = `
    <div class="ss-card">
      <div class="ss-card-top">
        <h3 class="ss-title">📊 กำลังวิเคราะห์บทสนทนา...</h3>
        <button type="button" class="btn-secondary" id="ss-fb-back">← กลับ</button>
      </div>
      <p class="ss-muted">ระบบกำลังประเมินความคล่องแคล่ว ความถูกต้อง และคำศัพท์จากประโยคที่คุณพูด</p>
    </div>
  `;
  host.querySelector('#ss-fb-back')?.addEventListener('click', () => onBack?.());

  let report = null;
  let usedAi = false;

  if (core.aiStatus?.configured && core.isSignedIn?.()) {
    const res = await core.api('/api/ai/speak', {
      mode: 'feedback',
      scenarioTitle: scenario?.title || 'Free Talk',
      transcript: transcript.map((t) => ({ role: t.role, text: t.text }))
    });
    if (res.ok && res.data?.report) {
      report = res.data.report;
      usedAi = true;
    } else if (res.status === 401 || res.status === 429) {
      handleAiError(core, res);
    }
  }

  if (!report) {
    report = buildOfflineFeedback(scenario, transcript, completedGoals);
  }

  const itemsHtml = (report.items || []).map((it, idx) => `
    <div class="ss-card" style="padding:12px">
      <div class="ss-muted"><strong>คุณพูดว่า:</strong> ${esc(it.said)}</div>
      <div class="ss-hz hanzi-font" style="margin-top:4px">${esc(it.corrected)}</div>
      ${it.py ? `<div class="ss-py">${esc(it.py)}</div>` : ''}
      ${it.th ? `<div class="ss-th">${esc(it.th)}</div>` : ''}
      ${it.betterChoice ? `<div class="ss-muted" style="margin-top:4px">💡 พูดให้เป็นธรรมชาติขึ้น: <strong>${esc(it.betterChoice)}</strong></div>` : ''}
      ${it.note ? `<div class="ss-muted" style="margin-top:2px">📝 ${esc(it.note)}</div>` : ''}
      <div class="ss-actions" style="margin-top:8px">
        <button type="button" class="btn-secondary ss-fb-speak" data-idx="${idx}">🔊 ฟัง</button>
        <button type="button" class="btn-primary ss-fb-add" data-idx="${idx}">➕ เพิ่มเข้าทบทวน</button>
      </div>
    </div>
  `).join('');

  host.innerHTML = `
    <div class="ss-card">
      <div class="ss-card-top">
        <div>
          <h3 class="ss-title">📊 รายงานสรุปการพูด (${usedAi ? 'AI Coach' : 'โหมดออฟไลน์'})</h3>
          <p class="ss-muted">${esc(report.summary)}</p>
        </div>
        <button type="button" class="btn-secondary" id="ss-fb-back">← กลับ</button>
      </div>

      <div class="ss-metrics">
        <div class="ss-metric">
          <div class="ss-metric-val">${Number(report.fluency) || 0}</div>
          <div class="ss-metric-lbl">ความคล่องแคล่ว (Fluency)</div>
        </div>
        <div class="ss-metric">
          <div class="ss-metric-val">${Number(report.accuracy) || 0}</div>
          <div class="ss-metric-lbl">ความถูกต้อง (Accuracy)</div>
        </div>
        <div class="ss-metric">
          <div class="ss-metric-val">${Number(report.vocab) || 0}</div>
          <div class="ss-metric-lbl">การใช้คำศัพท์ (Vocab)</div>
        </div>
      </div>

      ${itemsHtml || '<p class="ss-muted">ยังไม่มีประโยคของผู้เรียนในรอบนี้ ลองสนทนาอย่างน้อย 1-2 รอบแล้วกดสรุปผลอีกครั้งนะ</p>'}
    </div>
  `;

  host.querySelector('#ss-fb-back')?.addEventListener('click', () => onBack?.());
  host.querySelectorAll('.ss-fb-speak').forEach((btn) => {
    btn.addEventListener('click', () => {
      const it = report.items[Number(btn.dataset.idx)];
      if (it?.corrected) core.speak(it.corrected);
    });
  });
  host.querySelectorAll('.ss-fb-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const it = report.items[Number(btn.dataset.idx)];
      if (!it?.corrected) return;
      addToReviewQueue(core, {
        hz: it.corrected,
        py: it.py || '',
        th: it.th || '',
        source: `Feedback: ${scenario?.title || 'Speak Studio'}`
      });
      btn.disabled = true;
      btn.textContent = '✓ เพิ่มแล้ว (ทบทวนพรุ่งนี้)';
      core.showToast('เพิ่มประโยคลงในคิวทบทวนแล้ว', '+5 XP');
      core.addXp(5, 'speak-review-save');
    });
  });
}

export function createRoleplayController(core) {
  const state = {
    activeScenario: null,
    messages: [],
    goalsCompleted: [],
    turnIdx: 0,
    hintsUsed: 0,
    currentHintLevel: 0,
    latestHint: null,
    handsFree: false,
    aiSpeed: 1.0,
    busy: false,
    listening: false,
    recCtrl: null,
    xpAwarded: false,
    showFeedback: false
  };

  function getCompletedIds() {
    const ext = core.getExt('speak-studio') || {};
    return Array.isArray(ext.completedScenarios) ? ext.completedScenarios : [];
  }

  function markScenarioCompleted(id) {
    const prev = getCompletedIds();
    if (!prev.includes(id)) {
      core.setExt('speak-studio', { completedScenarios: [...prev, id] }, { save: true, reason: 'speak-roleplay-done' });
    }
  }

  function startScenario(sc, host) {
    state.activeScenario = sc;
    state.messages = [
      { role: 'model', text: sc.opening.hz, hz: sc.opening.hz, py: sc.opening.py, th: sc.opening.th, correction: '' }
    ];
    state.goalsCompleted = [];
    state.turnIdx = 0;
    state.hintsUsed = 0;
    state.currentHintLevel = 0;
    state.latestHint = sc.offlineTurns?.[0]?.hint || {
      keywords: sc.keyPhrases?.[0]?.hz || '你好',
      py: sc.keyPhrases?.[0]?.py || 'Nǐ hǎo!',
      hz: sc.keyPhrases?.[0]?.hz || '你好！'
    };
    state.busy = false;
    state.xpAwarded = false;
    state.showFeedback = false;
    render(host);
    core.speak(sc.opening.hz);
  }

  async function sendUserMessage(text, host) {
    const clean = String(text || '').trim();
    if (!clean || state.busy || !state.activeScenario) return;
    const sc = state.activeScenario;

    state.messages.push({ role: 'user', text: clean });
    state.busy = true;
    state.currentHintLevel = 0;
    render(host);

    let reply = null;
    if (core.aiStatus?.configured && core.isSignedIn?.()) {
      const history = state.messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
      const res = await core.api('/api/ai/speak', {
        mode: 'roleplay',
        scenario: { title: sc.title, aiRole: sc.aiRole, brief: sc.brief, goals: sc.goals.map((g) => g.text) },
        history,
        message: clean
      });
      if (res.ok && res.data?.reply) {
        reply = res.data.reply;
      } else if (res.status === 401 || res.status === 429) {
        handleAiError(core, res);
      }
    }

    if (!reply) {
      reply = matchOfflineRoleplay(sc, clean, state.goalsCompleted, state.turnIdx);
    }

    state.turnIdx += 1;
    const mergedGoals = new Set([...state.goalsCompleted, ...(reply.goalsCompleted || [])]);
    state.goalsCompleted = [...mergedGoals].sort((a, b) => a - b);
    if (reply.hint) state.latestHint = reply.hint;

    state.messages.push({
      role: 'model',
      text: reply.hz,
      hz: reply.hz,
      py: reply.py,
      th: reply.th,
      correction: reply.correction || ''
    });

    state.busy = false;

    // Award XP when all 3 goals completed (reduced by hintsUsed, min 10 XP)
    if (!state.xpAwarded && state.goalsCompleted.length >= sc.goals.length) {
      state.xpAwarded = true;
      markScenarioCompleted(sc.id);
      const xp = Math.max(10, 35 - state.hintsUsed * 5);
      core.addXp(xp, `speak-roleplay:${sc.id}`);
      core.logActivity?.(1);
      core.playChime?.('ok');
      core.showToast(`ทำภารกิจ "${sc.title}" ครบแล้ว!`, `+${xp} XP`);
    }

    render(host);
    core.speak(reply.hz);
  }

  function render(host) {
    const esc = core.escapeHtml;

    if (state.showFeedback && state.activeScenario) {
      renderFeedbackReport(core, host, {
        scenario: state.activeScenario,
        transcript: state.messages,
        completedGoals: state.goalsCompleted,
        onBack: () => {
          state.showFeedback = false;
          render(host);
        }
      });
      return;
    }

    // List of >=10 Scenario Mission Cards (#1)
    if (!state.activeScenario) {
      const doneIds = getCompletedIds();
      host.innerHTML = `
        <div class="ss-card" style="padding:14px 16px">
          <h3 class="ss-title">🎭 เลือกภารกิจ Roleplay (${ROLEPLAY_SCENARIOS.length} สถานการณ์)</h3>
          <p class="ss-muted">ฝึกพูดภาษาจีนในสถานการณ์จริง ทำภารกิจให้ครบ 3 ข้อเพื่อรับ XP (รองรับทั้ง AI และโหมดออฟไลน์)</p>
        </div>
        <div class="ss-grid">
          ${ROLEPLAY_SCENARIOS.map((sc) => {
            const isDone = doneIds.includes(sc.id);
            return `
              <button type="button" class="ss-card ss-scenario-card" data-sc="${esc(sc.id)}" style="text-align:left">
                <div class="ss-card-top">
                  <span class="ss-emoji">${sc.emoji}</span>
                  <div style="display:flex;gap:6px">
                    <span class="ss-pill">${esc(sc.difficulty)}</span>
                    ${isDone ? '<span class="ss-pill done">✓ ผ่านแล้ว</span>' : ''}
                  </div>
                </div>
                <h4 class="ss-title">${esc(sc.title)}</h4>
                <p class="ss-muted">${esc(sc.brief)}</p>
                <div class="ss-muted" style="font-size:12px">👤 คู่สนทนา: ${esc(sc.aiRole)}</div>
              </button>
            `;
          }).join('')}
        </div>
      `;
      host.querySelectorAll('.ss-scenario-card').forEach((card) => {
        card.addEventListener('click', () => {
          const sc = ROLEPLAY_SCENARIOS.find((s) => s.id === card.dataset.sc);
          if (sc) startScenario(sc, host);
        });
      });
      return;
    }

    // Active Roleplay Chat
    const sc = state.activeScenario;
    const potentialXp = Math.max(10, 35 - state.hintsUsed * 5);

    const hintHtml = state.currentHintLevel > 0 && state.latestHint ? `
      <div class="ss-hint-box">
        <div><strong>💡 คำใบ้ระดับ ${state.currentHintLevel}/3</strong> (ใช้คำใบ้ไปแล้ว ${state.hintsUsed} ครั้ง · รางวัลปัจจุบัน +${potentialXp} XP)</div>
        ${state.currentHintLevel >= 1 ? `<div style="margin-top:4px">1) คำสำคัญ: ${esc(state.latestHint.keywords)}</div>` : ''}
        ${state.currentHintLevel >= 2 ? `<div style="margin-top:4px">2) พินอินแนะนำ: <strong>${esc(state.latestHint.py)}</strong></div>` : ''}
        ${state.currentHintLevel >= 3 ? `<div style="margin-top:4px">3) ประโยคเต็ม: <strong class="hanzi-font">${esc(state.latestHint.hz)}</strong></div>` : ''}
      </div>
    ` : '';

    host.innerHTML = `
      <div class="ss-card">
        <div class="ss-card-top">
          <div>
            <h3 class="ss-title">${sc.emoji} ${esc(sc.title)} <span class="ss-pill">${esc(sc.difficulty)}</span></h3>
            <p class="ss-muted">คู่สนทนา: ${esc(sc.aiRole)}</p>
          </div>
          <div class="ss-actions">
            <button type="button" class="btn-secondary" id="ss-rp-report">📊 สรุปผล</button>
            <button type="button" class="btn-secondary" id="ss-rp-exit">← เปลี่ยนด่าน</button>
          </div>
        </div>

        <ul class="ss-goals">
          ${sc.goals.map((g, idx) => {
            const done = state.goalsCompleted.includes(idx);
            return `<li class="ss-goal ${done ? 'done' : ''}">${done ? '✅' : '⬜'} <span>${esc(g.text)}</span></li>`;
          }).join('')}
        </ul>

        <div class="ss-chat-log" id="ss-rp-log">
          ${state.messages.map((m, i) => m.role === 'user' ? `
            <div class="ss-bubble ss-bubble-user">${esc(m.text)}</div>
          ` : `
            <div class="ss-bubble ss-bubble-ai">
              <div class="ss-hz hanzi-font">${esc(m.hz)}</div>
              <div class="ss-py">${esc(m.py)}</div>
              <div class="ss-th">${esc(m.th)}</div>
              ${m.correction ? `<div class="ss-correction">✏️ ${esc(m.correction)}</div>` : ''}
              <button type="button" class="btn-secondary ss-rp-play" data-idx="${i}" style="margin-top:6px;padding:4px 8px;font-size:12px">🔊 ฟัง</button>
            </div>
          `).join('')}
          ${state.busy ? '<div class="ss-muted">กำลังตอบกลับ...</div>' : ''}
        </div>

        ${hintHtml}

        <div class="ss-actions">
          <button type="button" class="btn-secondary" id="ss-rp-hint" ${state.currentHintLevel >= 3 ? 'disabled' : ''}>
            💡 ขอคำใบ้ (${state.currentHintLevel}/3)
          </button>
          <button type="button" class="btn-secondary" id="ss-rp-speed" title="ปรับความเร็วเสียงครู AI">
            ⚡ ${state.aiSpeed === 0.75 ? 'ช้า 0.75x' : state.aiSpeed === 1.15 ? 'เจ้าของภาษา 1.15x' : 'ปกติ 1.0x'}
          </button>
          ${hasSpeechRecognition() ? `
            <button type="button" class="btn-secondary ${state.handsFree ? 'is-active' : ''}" id="ss-rp-hf" title="เปิดไมค์อัตโนมัติหลัง AI ตอบ">
              🎧 แฮนด์ฟรี: ${state.handsFree ? 'เปิด' : 'ปิด'}
            </button>
            <button type="button" class="btn-primary" id="ss-rp-mic">
              ${state.listening ? '⏹️ กำลังฟัง...' : '🎙️ พูดภาษาจีน'}
            </button>
          ` : ''}
        </div>

        <form class="ss-input-row" id="ss-rp-form">
          <input type="text" class="ss-input" id="ss-rp-input" placeholder="พิมพ์ภาษาจีนหรือพินอินที่นี่..." autocomplete="off" ${state.busy ? 'disabled' : ''} />
          <button type="submit" class="btn-primary" ${state.busy ? 'disabled' : ''}>ส่ง</button>
        </form>
      </div>
    `;

    const logEl = host.querySelector('#ss-rp-log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;

    host.querySelector('#ss-rp-exit')?.addEventListener('click', () => {
      state.recCtrl?.stop();
      state.activeScenario = null;
      render(host);
    });

    host.querySelector('#ss-rp-report')?.addEventListener('click', () => {
      state.showFeedback = true;
      render(host);
    });

    host.querySelectorAll('.ss-rp-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = state.messages[Number(btn.dataset.idx)];
        if (msg?.hz) core.speak(msg.hz);
      });
    });

    host.querySelector('#ss-rp-hint')?.addEventListener('click', () => {
      if (state.currentHintLevel < 3) {
        state.currentHintLevel += 1;
        state.hintsUsed += 1;
        render(host);
      }
    });

    host.querySelector('#ss-rp-speed')?.addEventListener('click', () => {
      const speeds = [0.75, 1.0, 1.15];
      const next = speeds[(speeds.indexOf(state.aiSpeed) + 1) % speeds.length];
      state.aiSpeed = next;
      if (core?.state) core.state.rate = next;
      render(host);
    });

    host.querySelector('#ss-rp-hf')?.addEventListener('click', () => {
      state.handsFree = !state.handsFree;
      core.showToast(state.handsFree ? 'เปิดโหมดคุยแฮนด์ฟรีแล้ว' : 'ปิดโหมดคุยแฮนด์ฟรี', 'VOICE');
      render(host);
    });

    const triggerMic = () => {
      if (state.listening) {
        state.recCtrl?.stop();
        return;
      }
      state.recCtrl = startSpeechRecognition({
        lang: 'zh-CN',
        onStart: () => { state.listening = true; render(host); },
        onResult: (txt) => { state.listening = false; sendUserMessage(txt, host); },
        onError: (msg) => { state.listening = false; core.showToast(msg, 'MIC'); render(host); },
        onEnd: () => { if (state.listening) { state.listening = false; render(host); } }
      });
    };

    host.querySelector('#ss-rp-mic')?.addEventListener('click', triggerMic);
    if (state.handsFree && !state.busy && !state.listening && state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'ai') {
      setTimeout(() => {
        if (state.handsFree && !state.busy && !state.listening && state.activeScenario) triggerMic();
      }, 1200);
    }

    host.querySelector('#ss-rp-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = host.querySelector('#ss-rp-input');
      if (inp?.value.trim()) sendUserMessage(inp.value, host);
    });
  }

  return { render };
}
