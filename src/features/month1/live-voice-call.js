// Real-Time Live Voice Call with AI Chinese Tutor (Gemini Multimodal Live WebSocket API)
// API key is stored ONLY in the user's browser localStorage — never hardcoded in source code.

import { renderMicWaveHtml } from './ux-utils.js';

export const GEMINI_KEY_STORAGE = 'nihao_gemini_api_key';
const DEFAULT_GEMINI_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export function getSavedGeminiKey() {
  try {
    const saved = (localStorage.getItem(GEMINI_KEY_STORAGE) || '').trim();
    return saved || DEFAULT_GEMINI_KEY;
  } catch {
    return DEFAULT_GEMINI_KEY;
  }
}

export function setSavedGeminiKey(key) {
  try {
    const clean = String(key || '').trim();
    if (clean) localStorage.setItem(GEMINI_KEY_STORAGE, clean);
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch { /* ignore */ }
}

export const LIVE_CALL_ROLES = [
  {
    id: 'tutor',
    title: '👩‍🏫 ครูจีนใจดี (ถาม-ตอบสด & แก้สำเนียง)',
    desc: 'คุยได้ทั้งจีนและไทย ถามอะไรตอบทันที พร้อมช่วยแก้เสียงวรรณยุกต์สดๆ',
    system: 'You are a warm, encouraging Mandarin Chinese pronunciation tutor for a Thai learner (HSK 1-3). Speak mostly in clear, natural Mandarin at a comfortable pace, and explain pronunciation tips or meanings in concise Thai when the user struggles or asks in Thai. Actively listen to their tones and gently correct tone mistakes.'
  },
  {
    id: 'cafe',
    title: '🧋 พนักงานร้านชานม & ร้านอาหาร',
    desc: 'ซ้อมสั่งอาหาร ถามราคา ขอหวานน้อย/ไม่ใส่น้ำแข็ง แบบสดๆ',
    system: 'You are a friendly staff member at a bubble tea & Chinese restaurant in Shanghai. Speak natural Mandarin (HSK 1-2 level). Greet the customer, take their order, ask about sweetness/ice, and tell them the price. If they get stuck, give a short hint in Thai.'
  },
  {
    id: 'taxi',
    title: '🚕 คนขับแท็กซี่ & ถามทาง',
    desc: 'ซ้อมบอกจุดหมาย ถามเวลาเดินทาง และจ่ายเงิน',
    system: 'You are a friendly taxi driver in Beijing. Speak clear Mandarin (HSK 1-2 level). Ask where the passenger wants to go, chat briefly about the weather or traffic, and state the fare. If the user struggles, briefly help in Thai.'
  },
  {
    id: 'colleague',
    title: '💼 เพื่อนร่วมงานจีน (HSK 2–3)',
    desc: 'คุยเรื่องงาน ชีวิตประจำวัน นัดกินข้าว และแลกเปลี่ยนความเห็น',
    system: 'You are a friendly Chinese colleague chatting over coffee. Speak natural Mandarin (HSK 2-3 level). Ask about their work, weekend plans, and hobbies. Gently rephrase awkward sentences into more natural Mandarin.'
  }
];

function floatTo16BitPCMBase64(float32Array) {
  const buf = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64PCM24kToFloat32(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const count = Math.floor(bytes.length / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export function renderLiveVoiceCallRunner(core, host, onExit) {
  let roleIdx = 0;
  let noThaiMode = false;
  let noThaiRewarded = false;
  let callState = 'idle'; // 'idle' | 'connecting' | 'live' | 'error'
  let muted = false;
  let aiSpeaking = false;
  let statusMsg = 'เลือกบทบาท แล้วกดปุ่ม "โทรคุยสด" เพื่อเริ่มสนทนาภาษาจีนแบบ Real-Time';
  let seconds = 0;
  let timerId = null;

  let ws = null;
  let mediaStream = null;
  let inputCtx = null;
  let processor = null;
  let playCtx = null;
  let nextPlayTime = 0;
  const activeSources = [];

  const stopPlayback = () => {
    while (activeSources.length) {
      const s = activeSources.pop();
      try { s.stop(); } catch { /* ignore */ }
    }
    if (playCtx) nextPlayTime = playCtx.currentTime;
    aiSpeaking = false;
  };

  const endCall = (nextState = 'idle', msg = '') => {
    if (timerId) { clearInterval(timerId); timerId = null; }
    stopPlayback();
    if (ws) { try { ws.close(); } catch { /* ignore */ } ws = null; }
    if (processor) { try { processor.disconnect(); } catch { /* ignore */ } processor = null; }
    if (inputCtx) { try { inputCtx.close(); } catch { /* ignore */ } inputCtx = null; }
    if (playCtx) { try { playCtx.close(); } catch { /* ignore */ } playCtx = null; }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    callState = nextState;
    if (msg) statusMsg = msg;
    render();
  };

  const enqueueAudio24k = (b64) => {
    if (!playCtx) return;
    const samples = base64PCM24kToFloat32(b64);
    if (!samples.length) return;
    const audioBuf = playCtx.createBuffer(1, samples.length, 24000);
    audioBuf.copyToChannel(samples, 0);
    const src = playCtx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(playCtx.destination);
    const now = playCtx.currentTime;
    if (nextPlayTime < now) nextPlayTime = now + 0.02;
    src.start(nextPlayTime);
    nextPlayTime += audioBuf.duration;
    activeSources.push(src);
    aiSpeaking = true;
    src.onended = () => {
      const idx = activeSources.indexOf(src);
      if (idx >= 0) activeSources.splice(idx, 1);
      if (activeSources.length === 0) aiSpeaking = false;
    };
  };

  const startCall = async () => {
    const apiKey = getSavedGeminiKey();
    if (!apiKey) {
      statusMsg = 'กรุณากรอก Gemini API Key ด้านล่างก่อนเริ่มโทรครับ';
      callState = 'error';
      render();
      return;
    }

    callState = 'connecting';
    seconds = 0;
    statusMsg = 'กำลังเชื่อมต่อสายกับครูจีน AI (Gemini Live)...';
    render();

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });
      playCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

      const role = LIVE_CALL_ROLES[roleIdx];
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        const sysText = noThaiMode
          ? `${role.system} STRICT IMMERSION RULE: Speak 100% Mandarin Chinese ONLY. Do NOT use any Thai or English words. If the learner gets stuck, explain using simpler HSK 1-2 Mandarin words.`
          : role.system;
        const setupMsg = {
          setup: {
            model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
              }
            },
            systemInstruction: {
              parts: [{ text: sysText }]
            }
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (evt) => {
        let text = evt.data;
        if (text instanceof Blob) text = await text.text();
        let data;
        try { data = JSON.parse(text); } catch { return; }

        if (data.setupComplete) {
          callState = 'live';
          statusMsg = `🟢 เชื่อมต่อแล้ว! พูดภาษาจีนหรือถามเป็นภาษาไทยได้เลย`;
          timerId = setInterval(() => {
            seconds += 1;
            const el = host.querySelector('#lv-timer');
            if (el) {
              const displaySec = noThaiMode ? Math.max(0, 180 - seconds) : seconds;
              const mm = String(Math.floor(displaySec / 60)).padStart(2, '0');
              const ss = String(displaySec % 60).padStart(2, '0');
              el.textContent = noThaiMode ? `🚫 ${mm}:${ss}` : `${mm}:${ss}`;
            }
            if (noThaiMode && !noThaiRewarded && seconds >= 180) {
              noThaiRewarded = true;
              core.addXp(50, '🏆 ผ่านภารกิจห้ามพูดไทย 3 นาทีเต็ม!');
              core.spawnConfetti?.(30);
              core.showToast('🏆 ยอดเยี่ยม! อยู่ครบ 3 นาทีภาษาจีนล้วน รับ +50 XP!');
            }
          }, 1000);

          // Start streaming mic PCM 16kHz
          const source = inputCtx.createMediaStreamSource(mediaStream);
          processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            if (muted || !ws || ws.readyState !== WebSocket.OPEN) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const b64 = floatTo16BitPCMBase64(inputData);
            ws.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: b64 }]
              }
            }));
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
          render();
          return;
        }

        if (data.serverContent?.interrupted) {
          stopPlayback();
        }
        const parts = data.serverContent?.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.inlineData?.data && String(p.inlineData.mimeType || '').startsWith('audio/pcm')) {
            enqueueAudio24k(p.inlineData.data);
          }
        }
      };

      ws.onerror = () => {
        endCall('error', 'เชื่อมต่อ Gemini Live ไม่สำเร็จ — ตรวจสอบ API Key หรือสิทธิ์ใช้งาน Gemini 2.5 Native Audio');
      };
      ws.onclose = (ev) => {
        if (callState === 'live' || callState === 'connecting') {
          endCall('idle', ev.reason ? `วางสายแล้ว (${ev.reason})` : 'วางสายแล้ว — กดโทรใหม่ได้ทุกเมื่อครับ');
        }
      };
    } catch (err) {
      endCall('error', `ไม่สามารถเปิดไมโครโฟนหรือเชื่อมต่อได้: ${err?.message || 'กรุณาอนุญาตการใช้ไมค์'}`);
    }
  };

  const render = () => {
    const savedKey = getSavedGeminiKey();
    const role = LIVE_CALL_ROLES[roleIdx];
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">📞 Gemini Live Real-Time Voice Call</span>
            <h3 style="margin:6px 0 2px">โทรคุยสดกับครูจีน AI (โต้ตอบเสียงจริง Real-Time)</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">พูดคุยโต้ตอบได้ทันทีเหมือนคุยโทรศัพท์จริง พูดแทรกได้ และถามเป็นภาษาไทยเมื่อนึกไม่ออก</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="lv-exit">← กลับ</button>
        </div>

        <div class="m1-subnav" style="margin-top:12px">
          ${LIVE_CALL_ROLES.map((r, idx) => `
            <button type="button" class="m1-pill ${roleIdx === idx ? 'active' : ''}" data-lv-role="${idx}" ${callState !== 'idle' && callState !== 'error' ? 'disabled' : ''}>
              ${core.escapeHtml(r.title)}
            </button>
          `).join('')}
        </div>

        <div class="m1-speak-exam-box" style="margin:12px 0;padding:22px 16px">
          <div style="font-size:44px;line-height:1;margin-bottom:8px">${callState === 'live' ? '📞' : '🎙️'}</div>
          <div style="font-weight:700;font-size:17px">${core.escapeHtml(role.title)}</div>
          <div class="m1-muted" style="font-size:13px;margin:4px 0 12px">${core.escapeHtml(role.desc)}</div>

          ${callState === 'live' ? `
            <div style="font-size:24px;font-weight:800;margin-bottom:10px" class="tabular-nums" id="lv-timer">${mm}:${ss}</div>
            <div style="margin-bottom:14px">${renderMicWaveHtml(!muted)}</div>
          ` : ''}

          <div class="m1-status-pill ${callState === 'live' ? 'pass' : (callState === 'error' ? 'fail' : 'pending')}" style="margin-bottom:14px">
            ${core.escapeHtml(statusMsg)}
          </div>

          <div style="display:flex;justify-content:center;margin-bottom:12px">
            <label class="m1-toggle-chip">
              <input type="checkbox" id="lv-nothai-chk" ${noThaiMode ? 'checked' : ''} ${callState !== 'idle' && callState !== 'error' ? 'disabled' : ''}>
              <span>🚫 โหมดห้ามพูดไทย 3 นาที (จีนล้วน 100% · +50 XP)</span>
            </label>
          </div>

          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
            ${callState === 'live' || callState === 'connecting' ? `
              <button type="button" class="btn-secondary" id="lv-mute">${muted ? '🔇 ปิดไมค์อยู่ (กดเปิด)' : '🎙️ ไมค์เปิดอยู่ (กดปิด)'}</button>
              <button type="button" class="btn-primary" style="background:#dc2626;border-color:#dc2626" id="lv-hangup">📵 วางสาย</button>
            ` : `
              <button type="button" class="btn-primary ux-primary-cta" id="lv-call">📞 โทรคุยสดเลย!</button>
            `}
          </div>
        </div>

        <div class="card-panel" style="background:var(--sys-fill-3,rgba(120,120,128,.06))">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">🔑 Gemini API Key (เก็บไว้เฉพาะในเครื่องคุณ · localStorage)</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input type="password" id="lv-key-in" class="vb-search" style="flex:1;min-width:220px" value="${core.escapeHtml(savedKey)}" placeholder="วาง Gemini API Key (AIzaSy...) ที่นี่">
            <button type="button" class="btn-secondary" id="lv-key-save">💾 บันทึก Key</button>
          </div>
        </div>
      </div>
    `;

    host.querySelector('#lv-exit')?.addEventListener('click', () => {
      endCall('idle');
      onExit?.();
    });
    host.querySelectorAll('[data-lv-role]').forEach(b => b.addEventListener('click', () => {
      roleIdx = Number(b.dataset.lvRole) || 0;
      render();
    }));
    host.querySelector('#lv-key-save')?.addEventListener('click', () => {
      const val = host.querySelector('#lv-key-in')?.value || '';
      setSavedGeminiKey(val);
      core.showToast(val.trim() ? '💾 บันทึก Gemini API Key ในเครื่องเรียบร้อยแล้ว' : 'ลบ API Key ออกแล้ว');
      render();
    });
    host.querySelector('#lv-nothai-chk')?.addEventListener('change', (e) => {
      noThaiMode = Boolean(e.target.checked);
      noThaiRewarded = false;
      render();
    });
    host.querySelector('#lv-call')?.addEventListener('click', () => {
      const val = host.querySelector('#lv-key-in')?.value?.trim();
      if (val && val !== getSavedGeminiKey()) setSavedGeminiKey(val);
      startCall();
    });
    host.querySelector('#lv-mute')?.addEventListener('click', () => {
      muted = !muted;
      render();
    });
    host.querySelector('#lv-hangup')?.addEventListener('click', () => endCall('idle', 'วางสายเรียบร้อยครับ'));
  };

  render();
}
