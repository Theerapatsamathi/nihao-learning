// Free Talk Voice Mode (#2) and "Ask the Teacher" (#5)
import { SHADOWING_SETS } from './data.js';
import { scorePronunciation, searchOfflineTranslate } from './scoring.js';
import {
  startSpeechRecognition,
  hasSpeechRecognition,
  getCharPinyinMap,
  addToReviewQueue,
  handleAiError,
  renderPronunciationBreakdownHtml,
  speakSlow
} from './speech.js';
import { renderFeedbackReport } from './roleplay.js';

const OFFLINE_FREETALK_REPLIES = [
  { hz: '你好！今天过得怎么样？你喜欢吃什么中国菜？', py: 'Nǐ hǎo! Jīntiān guò de zěnmeyàng? Nǐ xǐhuan chī shénme Zhōngguó cài?', th: 'สวัสดี! วันนี้เป็นไงบ้าง? คุณชอบกินอาหารจีนอะไร?' },
  { hz: '听起来真不错！你平时怎么练习说中文？', py: 'Tīng qǐlái zhēn bùcuò! Nǐ píngshí zěnme liànxí shuō Zhōngwén?', th: 'ฟังดูดีมากเลย! ปกติคุณฝึกพูดภาษาจีนยังไง?' },
  { hz: '太棒了！每天多开口说，中文一定会越来越流利！', py: 'Tài bàng le! Měitiān duō kāikǒu shuō, Zhōngwén yīdìng huì yuèláiyuè liúlì!', th: 'ยอดเยี่ยมมาก! ฝึกพูดทุกวัน ภาษาจีนจะต้องคล่องขึ้นเรื่อยๆ แน่นอน!' },
  { hz: '你去过中国吗？最想去哪个城市旅游？', py: 'Nǐ qùguo Zhōngguó ma? Zuì xiǎng qù nǎge chéngshì lǚyóu?', th: 'คุณเคยไปจีนไหม? อยากไปเที่ยวเมืองไหนมากที่สุด?' }
];

export function createFreeTalkController(core) {
  const state = {
    messages: [
      {
        role: 'model',
        text: '你好！我是你的中文聊天伙伴。按住麦克风，随便聊聊吧！',
        hz: '你好！我是你的中文聊天伙伴。按住麦克风，随便聊聊吧！',
        py: 'Nǐ hǎo! Wǒ shì nǐ de Zhōngwén liáotiān huǒbàn. Ànzhù màikèfēng, suíbiàn liáoliao ba!',
        th: 'สวัสดี! ฉันคือคู่คุยภาษาจีนของคุณ กดปุ่มไมค์ค้างไว้ (หรือแตะพูด) แล้วคุยกันได้เลย!'
      }
    ],
    busy: false,
    listening: false,
    recCtrl: null,
    offlineIdx: 0,
    showFeedback: false
  };

  async function sendText(text, host) {
    const clean = String(text || '').trim();
    if (!clean || state.busy) return;
    state.messages.push({ role: 'user', text: clean });
    state.busy = true;
    render(host);

    let reply = null;
    if (core.aiStatus?.configured && core.isSignedIn?.()) {
      const history = state.messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
      const res = await core.api('/api/ai/speak', {
        mode: 'roleplay',
        scenario: {
          title: 'Free Talk สนทนาอิสระ',
          aiRole: 'เพื่อนชาวจีนที่เป็นมิตร ชวนคุยเรื่องชีวิตประจำวัน',
          brief: 'คุยภาษาจีนอิสระระดับ HSK 1-2 ตอบสั้นๆ เป็นธรรมชาติและถามกลับให้ผู้เรียนได้พูดต่อ',
          goals: []
        },
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
      const fb = OFFLINE_FREETALK_REPLIES[state.offlineIdx % OFFLINE_FREETALK_REPLIES.length];
      state.offlineIdx += 1;
      reply = { ...fb, correction: '' };
    }

    state.messages.push({
      role: 'model',
      text: reply.hz,
      hz: reply.hz,
      py: reply.py,
      th: reply.th,
      correction: reply.correction || ''
    });
    state.busy = false;
    core.addXp(5, 'speak-freetalk-turn');
    render(host);
    core.speak(reply.hz);
  }

  function render(host) {
    const esc = core.escapeHtml;
    if (state.showFeedback) {
      renderFeedbackReport(core, host, {
        scenario: { title: 'Free Talk สนทนาอิสระ', goals: [], keyPhrases: SHADOWING_SETS.slice(0, 5) },
        transcript: state.messages,
        completedGoals: [],
        onBack: () => { state.showFeedback = false; render(host); }
      });
      return;
    }

    const canMic = hasSpeechRecognition();
    host.innerHTML = `
      <div class="ss-card">
        <div class="ss-card-top">
          <div>
            <h3 class="ss-title">🗣️ Free Talk — คุยอิสระด้วยเสียง</h3>
            <p class="ss-muted">กดปุ่มไมค์ค้างไว้ (หรือแตะเพื่อเริ่ม/หยุด) พูดภาษาจีน แล้วฟังเสียงตอบกลับอัตโนมัติ</p>
          </div>
          <div class="ss-actions">
            <button type="button" class="btn-secondary" id="ss-ft-report">📊 สรุปผล</button>
            <button type="button" class="btn-secondary" id="ss-ft-clear">🔄 เริ่มใหม่</button>
          </div>
        </div>

        <div class="ss-chat-log" id="ss-ft-log">
          ${state.messages.map((m, i) => m.role === 'user' ? `
            <div class="ss-bubble ss-bubble-user">${esc(m.text)}</div>
          ` : `
            <div class="ss-bubble ss-bubble-ai">
              <div class="ss-hz hanzi-font">${esc(m.hz)}</div>
              <div class="ss-py">${esc(m.py)}</div>
              <div class="ss-th">${esc(m.th)}</div>
              ${m.correction ? `<div class="ss-correction">✏️ ${esc(m.correction)}</div>` : ''}
              <button type="button" class="btn-secondary ss-ft-play" data-idx="${i}" style="margin-top:6px;padding:4px 8px;font-size:12px">🔊 ฟังซ้ำ</button>
            </div>
          `).join('')}
          ${state.busy ? '<div class="ss-muted">กำลังคิดคำตอบ...</div>' : ''}
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 0">
          ${canMic ? `
            <button type="button" class="ss-mic-big ${state.listening ? 'listening' : ''}" id="ss-ft-mic" aria-label="กดค้างเพื่อพูดภาษาจีน">
              ${state.listening ? '⏹️' : '🎙️'}
            </button>
            <span class="ss-muted">${state.listening ? 'กำลังฟังเสียงภาษาจีน... ปล่อยหรือแตะเพื่อส่ง' : 'กดค้างเพื่อพูด (หรือแตะ 1 ครั้ง)'}</span>
          ` : `
            <span class="ss-muted">เบราว์เซอร์นี้ไม่รองรับไมโครโฟน SpeechRecognition — ใช้ช่องพิมพ์ด้านล่างแทนได้ทันที</span>
          `}
        </div>

        <form class="ss-input-row" id="ss-ft-form">
          <input type="text" class="ss-input" id="ss-ft-input" placeholder="หรือพิมพ์ภาษาจีนที่นี่..." autocomplete="off" ${state.busy ? 'disabled' : ''} />
          <button type="submit" class="btn-primary" ${state.busy ? 'disabled' : ''}>ส่ง</button>
        </form>
      </div>
    `;

    const logEl = host.querySelector('#ss-ft-log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;

    host.querySelector('#ss-ft-report')?.addEventListener('click', () => {
      state.showFeedback = true;
      render(host);
    });

    host.querySelector('#ss-ft-clear')?.addEventListener('click', () => {
      state.recCtrl?.stop();
      state.messages = [state.messages[0]];
      state.busy = false;
      render(host);
    });

    host.querySelectorAll('.ss-ft-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = state.messages[Number(btn.dataset.idx)];
        if (m?.hz) core.speak(m.hz);
      });
    });

    const micBtn = host.querySelector('#ss-ft-mic');
    if (micBtn) {
      const startMic = () => {
        if (state.listening || state.busy) return;
        state.recCtrl = startSpeechRecognition({
          lang: 'zh-CN',
          onStart: () => { state.listening = true; render(host); },
          onResult: (txt) => { state.listening = false; sendText(txt, host); },
          onError: (msg) => { state.listening = false; core.showToast(msg, 'MIC'); render(host); },
          onEnd: () => { if (state.listening) { state.listening = false; render(host); } }
        });
      };
      micBtn.addEventListener('click', () => {
        if (state.listening) state.recCtrl?.stop();
        else startMic();
      });
    }

    host.querySelector('#ss-ft-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = host.querySelector('#ss-ft-input');
      if (inp?.value.trim()) sendText(inp.value, host);
    });
  }

  return { render };
}

/**
 * "Ask the teacher" 🙋 (#5)
 */
export function createAskTeacherController(core) {
  const state = {
    query: '',
    busy: false,
    result: null,
    pronResult: null,
    listeningThai: false,
    listeningZh: false,
    recCtrl: null
  };

  async function askTeacher(thaiText, host) {
    const clean = String(thaiText || '').trim();
    if (!clean || state.busy) return;
    state.query = clean;
    state.busy = true;
    state.pronResult = null;
    render(host);

    let resObj = null;
    if (core.aiStatus?.configured && core.isSignedIn?.()) {
      const res = await core.api('/api/ai/speak', { mode: 'translate', text: clean });
      if (res.ok && res.data?.result) {
        resObj = res.data.result;
      } else if (res.status === 401 || res.status === 429) {
        handleAiError(core, res);
      }
    }

    if (!resObj) {
      const lex = (await core.ensureLexiconLoaded?.().catch(() => null)) || core.lexicon || [];
      resObj = searchOfflineTranslate(clean, lex, SHADOWING_SETS) || {
        hz: '请问，这个用中文怎么说？',
        py: 'Qǐngwèn, zhège yòng Zhōngwén zěnme shuō?',
        th: 'ขอโทษนะ อันนี้ภาษาจีนพูดว่าอย่างไร?',
        note: 'ไม่พบคำตรงกันในคลังออฟไลน์ — เข้าสู่ระบบเพื่อใช้ครู AI แปลประโยคภาษาไทยแบบเฉพาะเจาะจงได้ทันที'
      };
    }

    state.result = resObj;
    state.busy = false;
    render(host);
    core.speak(resObj.hz);
  }

  function render(host) {
    const esc = core.escapeHtml;
    const canMic = hasSpeechRecognition();

    host.innerHTML = `
      <div class="ss-card">
        <h3 class="ss-title">🙋 ถามครู — "คำนี้ภาษาจีนพูดว่ายังไง?"</h3>
        <p class="ss-muted">พิมพ์หรือพูดภาษาไทยที่อยากสื่อสาร ครูจะแปลเป็นภาษาจีนธรรมชาติพร้อมพินอิน แล้วให้คุณฝึกพูดตามทันที</p>

        <form class="ss-input-row" id="ss-at-form">
          <input type="text" class="ss-input" id="ss-at-input" value="${esc(state.query)}" placeholder="เช่น ขอน้ำเปล่าไม่ใส่น้ำแข็ง / ลดราคาหน่อยได้ไหม" />
          ${canMic ? `<button type="button" class="btn-secondary" id="ss-at-mic-th">${state.listeningThai ? '⏹️ ฟังอยู่...' : '🎙️ พูดไทย'}</button>` : ''}
          <button type="submit" class="btn-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? 'กำลังแปล...' : 'ถามครู'}</button>
        </form>

        <div class="ss-chip-row">
          ${['ไม่กินเผ็ด', 'ห้องน้ำอยู่ที่ไหน', 'ลดราคาหน่อยได้ไหม', 'ขอเช็คบิลด้วย'].map((ex) => `
            <button type="button" class="ss-chip ss-at-ex" data-q="${esc(ex)}">${esc(ex)}</button>
          `).join('')}
        </div>

        ${state.result ? `
          <div class="ss-card" style="background:var(--sys-surface-2)">
            <div class="ss-hz hanzi-font" style="font-size:24px">${esc(state.result.hz)}</div>
            <div class="ss-py" style="font-size:15px">${esc(state.result.py)}</div>
            <div class="ss-th">${esc(state.result.th)}</div>
            ${state.result.note ? `<div class="ss-muted" style="margin-top:4px">💡 ${esc(state.result.note)}</div>` : ''}

            <div class="ss-actions" style="margin-top:8px">
              <button type="button" class="btn-secondary" id="ss-at-play">🔊 ฟังปกติ</button>
              <button type="button" class="btn-secondary" id="ss-at-slow">🐢 ฟังช้า 0.6x</button>
              ${canMic ? `<button type="button" class="btn-primary" id="ss-at-practice">${state.listeningZh ? '⏹️ กำลังฟัง...' : '🎙️ ฝึกพูดประโยคนี้'}</button>` : ''}
              <button type="button" class="btn-secondary" id="ss-at-save">➕ เพิ่มเข้าทบทวน</button>
            </div>

            ${renderPronunciationBreakdownHtml(core, state.pronResult)}
          </div>
        ` : ''}
      </div>
    `;

    host.querySelector('#ss-at-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = host.querySelector('#ss-at-input')?.value;
      if (val?.trim()) askTeacher(val, host);
    });

    host.querySelectorAll('.ss-at-ex').forEach((btn) => {
      btn.addEventListener('click', () => askTeacher(btn.dataset.q, host));
    });

    host.querySelector('#ss-at-mic-th')?.addEventListener('click', () => {
      if (state.listeningThai) { state.recCtrl?.stop(); return; }
      state.recCtrl = startSpeechRecognition({
        lang: 'th-TH',
        onStart: () => { state.listeningThai = true; render(host); },
        onResult: (txt) => { state.listeningThai = false; askTeacher(txt, host); },
        onError: (msg) => { state.listeningThai = false; core.showToast(msg, 'MIC'); render(host); },
        onEnd: () => { if (state.listeningThai) { state.listeningThai = false; render(host); } }
      });
    });

    host.querySelector('#ss-at-play')?.addEventListener('click', () => core.speak(state.result.hz));
    host.querySelector('#ss-at-slow')?.addEventListener('click', () => speakSlow(core, state.result.hz, 0.6));
    host.querySelector('#ss-at-save')?.addEventListener('click', (e) => {
      addToReviewQueue(core, { hz: state.result.hz, py: state.result.py, th: state.result.th, source: 'Ask Teacher' });
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = '✓ เพิ่มแล้ว';
      core.showToast('บันทึกเข้าคิวทบทวนแล้ว', '+5 XP');
      core.addXp(5, 'speak-ask-save');
    });

    host.querySelector('#ss-at-practice')?.addEventListener('click', () => {
      if (state.listeningZh) { state.recCtrl?.stop(); return; }
      state.recCtrl = startSpeechRecognition({
        lang: 'zh-CN',
        onStart: () => { state.listeningZh = true; render(host); },
        onResult: async (heard) => {
          state.listeningZh = false;
          const map = await getCharPinyinMap(core);
          state.pronResult = scorePronunciation(state.result.hz, state.result.py, heard, map);
          if (state.pronResult.score >= 75) {
            core.playChime?.('ok');
            core.addXp(10, 'speak-ask-practice');
          } else {
            core.playChime?.('err');
          }
          render(host);
        },
        onError: (msg) => { state.listeningZh = false; core.showToast(msg, 'MIC'); render(host); },
        onEnd: () => { if (state.listeningZh) { state.listeningZh = false; render(host); } }
      });
    });
  }

  return { render };
}
