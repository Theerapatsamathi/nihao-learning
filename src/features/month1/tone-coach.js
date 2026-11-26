// Interactive Visual Tone Pitch Coach & Deep Pronunciation Diagnostic UI
import { detectPitchYIN, splitPinyinSyllables, stripToneAndNumber, idealToneContour } from '../speak-studio/scoring.js';
import { hasSpeechRecognition, startSpeechRecognition, getCharPinyinMap } from '../speak-studio/speech.js';
import { TONE_COACH_PACKS, buildDetailedPronunciationReport } from './tone-coach-logic.js';
import { colorizePinyin, renderMicWaveHtml } from './ux-utils.js';
import { getSavedGeminiKey } from './live-voice-call.js';

function drawContourCanvas(canvas, idealCurve = [], userCurve = [], livePitchNorm = []) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const isDark = document.documentElement.classList.contains('theme-dark');
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 20;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const yFor = (val) => padT + ((5 - Math.max(1, Math.min(5, val))) / 4) * plotH;

  // 5-level Chao tone grid
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let lv = 1; lv <= 5; lv++) {
    const y = yFor(lv);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
    ctx.fillText(String(lv), padL - 8, y);
  }

  // Draw ideal reference curve (dashed blue/green)
  if (idealCurve.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    idealCurve.forEach((v, i) => {
      const x = padL + (i / (idealCurve.length - 1)) * plotW;
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Draw user's recorded or live curve (solid orange/red)
  const curve = userCurve.length > 1 ? userCurve : livePitchNorm;
  if (curve.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    curve.forEach((v, i) => {
      const x = padL + (i / (curve.length - 1)) * plotW;
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
}

export function renderToneCoachRunner(core, host, onExit) {
  let packIdx = 0;
  let itemIdx = 0;
  let customItem = null;
  let recording = false;
  let lastReport = null;
  let lastHeard = '';
  let lastAudioUrl = null;
  let lastAudioBlob = null;
  let aiCoachLoading = false;
  let aiCoachText = '';
  let liveRawHz = [];
  let activeMic = null;
  let audioCtx = null;
  let mediaStream = null;
  let mediaRecorder = null;
  let rafId = null;
  let charPyMap = null;

  getCharPinyinMap(core).then(m => { charPyMap = m; }).catch(() => {});

  const getCurrentItem = () => customItem || TONE_COACH_PACKS[packIdx].items[itemIdx];

  const stopAllAudio = () => {
    recording = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (activeMic) { try { activeMic.stop(); } catch { /* ignore */ } activeMic = null; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch { /* ignore */ }
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch { /* ignore */ }
      audioCtx = null;
    }
  };

  const render = () => {
    const item = getCurrentItem();
    const tones = splitPinyinSyllables(item.py).map(s => stripToneAndNumber(s).tone);
    const rawIdeal = idealToneContour(tones.length ? tones : [1], 20);
    const ideal = Math.max(...rawIdeal, 0) <= 1.1 ? rawIdeal.map(v => 1 + v * 4) : rawIdeal;

    host.innerHTML = `
      <div class="card-panel m1-runner">
        <div class="m1-runner-head">
          <div>
            <span class="m1-tag">📈 Visual Tone Pitch Coach · ตรวจการออกเสียง & แนะนำละเอียด</span>
            <h3 style="margin:6px 0 2px">กราฟเทียบเสียงวรรณยุกต์สด + โค้ชแก้สำเนียงคนไทย</h3>
            <p class="m1-muted" style="margin:0;font-size:12.5px">เส้นประสีน้ำเงิน = มาตรฐานเจ้าของภาษา · เส้นทึบสีส้ม = เสียงของคุณแบบเรียลไทม์</p>
          </div>
          <button type="button" class="btn-secondary m1-mini-btn" id="tc-exit">← กลับ</button>
        </div>

        <div class="m1-subnav" style="margin-top:12px">
          ${TONE_COACH_PACKS.map((p, i) => `
            <button type="button" class="m1-pill ${!customItem && packIdx === i ? 'active' : ''}" data-tc-pack="${i}">${core.escapeHtml(p.title)}</button>
          `).join('')}
        </div>

        <div class="m1-chip-row" style="margin-bottom:12px">
          ${TONE_COACH_PACKS[packIdx].items.map((it, idx) => `
            <button type="button" class="m1-chip hanzi-font ${!customItem && itemIdx === idx ? 'active' : ''}" data-tc-item="${idx}">
              ${core.escapeHtml(it.hz)}
            </button>
          `).join('')}
        </div>

        <div class="m1-speak-exam-box" style="margin-bottom:14px">
          <div class="hanzi-font" style="font-size:34px;font-weight:700;letter-spacing:2px">${core.escapeHtml(item.hz)}</div>
          <div class="m1-py" style="font-size:19px;margin:4px 0">${colorizePinyin(item.py)}</div>
          <div class="m1-muted" style="font-size:13px;margin-bottom:12px">${core.escapeHtml(item.th)}</div>

          <canvas id="tc-canvas" width="600" height="170" style="width:100%;max-width:600px;height:170px;border-radius:12px;background:var(--sys-fill-3,rgba(120,120,128,.08));border:1px solid var(--sys-sep,rgba(0,0,0,.1));display:block;margin:0 auto 12px"></canvas>

          <div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-secondary" id="tc-listen">🔊 ฟังต้นฉบับ</button>
            <button type="button" class="btn-secondary" id="tc-listen-slow">🐢 ฟังช้า 0.65x</button>
            <button type="button" class="btn-primary ${recording ? 'is-listening' : ''}" id="tc-record">
              ${recording ? '⏹ หยุด & วิเคราะห์เสียง' : '🎙️ กดพูดเพื่อวิเคราะห์กราฟ'}
            </button>
            ${renderMicWaveHtml(recording)}
            ${lastAudioUrl ? `<button type="button" class="btn-secondary" id="tc-play-me">▶️ ฟังเสียงตัวเอง</button>` : ''}
            ${lastAudioBlob ? `<button type="button" class="btn-primary m1-ai-btn" id="tc-ai-coach" ${aiCoachLoading ? 'disabled' : ''}>${aiCoachLoading ? '⏳ ครู Gemini กำลังฟัง...' : '🤖 ให้ครู Gemini ฟังเสียงจริง'}</button>` : ''}
          </div>
        </div>

        ${aiCoachText ? `
          <div class="card-panel m1-ai-grade-panel">
            <div style="font-weight:700;margin-bottom:6px">🤖 คอมเมนต์จากครู Gemini (ฟังจากเสียงจริงของคุณ)</div>
            <div style="white-space:pre-line;font-size:13.5px;line-height:1.6">${core.escapeHtml(aiCoachText)}</div>
          </div>
        ` : ''}

        ${lastReport ? `
          <div class="card-panel" style="background:var(--sys-fill-3,rgba(120,120,128,.06));margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
              <div>
                <span class="m1-status-pill ${lastReport.overallScore >= 80 ? 'pass' : 'fail'}">
                  เกรด ${lastReport.grade} · คะแนนรวม ${lastReport.overallScore}%
                </span>
                ${lastHeard ? `<div class="m1-muted" style="font-size:12.5px;margin-top:4px">เสียงที่ระบบจับได้: <b class="hanzi-font">${core.escapeHtml(lastHeard)}</b></div>` : ''}
              </div>
              <div class="m1-kpi-mini">
                <div><strong>${lastReport.contourScore}%</strong><span>กราฟวรรณยุกต์</span></div>
                <div><strong>${lastReport.speechScore || '—'}%</strong><span>ความชัดพยางค์</span></div>
              </div>
            </div>

            <div style="font-weight:700;margin-bottom:8px">💡 คำแนะนำจากโค้ชการออกเสียง (${lastReport.tips.length} ข้อ)</div>
            <div class="m1-list">
              ${lastReport.tips.map(t => `
                <div class="m1-item" style="align-items:flex-start">
                  <div>
                    <div style="font-weight:700;font-size:13.5px">${core.escapeHtml(t.title)}</div>
                    <div class="m1-muted" style="font-size:12.5px;margin-top:2px">${core.escapeHtml(t.detail)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <details style="margin-top:8px">
          <summary class="m1-muted" style="cursor:pointer;font-size:13px;font-weight:600">✍️ พิมพ์ประโยคจีนที่อยากให้โค้ชตรวจเอง ▾</summary>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <input type="text" id="tc-custom-hz" class="vb-search" style="flex:1;min-width:160px" placeholder="ตัวจีน เช่น 我想学中文">
            <input type="text" id="tc-custom-py" class="vb-search" style="flex:1;min-width:160px" placeholder="พินอิน เช่น wǒ xiǎng xué zhōng wén">
            <button type="button" class="btn-secondary" id="tc-custom-go">ตั้งเป็นโจทย์</button>
          </div>
        </details>
      </div>
    `;

    const canvas = host.querySelector('#tc-canvas');
    drawContourCanvas(canvas, lastReport?.idealCurve || ideal, lastReport?.userCurve || []);

    host.querySelector('#tc-exit')?.addEventListener('click', () => {
      stopAllAudio();
      onExit?.();
    });
    host.querySelectorAll('[data-tc-pack]').forEach(b => b.addEventListener('click', () => {
      stopAllAudio();
      customItem = null;
      packIdx = Number(b.dataset.tcPack) || 0;
      itemIdx = 0;
      lastReport = null;
      lastHeard = '';
      render();
    }));
    host.querySelectorAll('[data-tc-item]').forEach(b => b.addEventListener('click', () => {
      stopAllAudio();
      customItem = null;
      itemIdx = Number(b.dataset.tcItem) || 0;
      lastReport = null;
      lastHeard = '';
      render();
    }));
    host.querySelector('#tc-listen')?.addEventListener('click', () => core.speak(item.hz));
    host.querySelector('#tc-listen-slow')?.addEventListener('click', () => {
      const prev = core.state.rate;
      core.state.rate = 0.65;
      core.speak(item.hz, () => { core.state.rate = prev; });
    });
    host.querySelector('#tc-play-me')?.addEventListener('click', () => {
      if (lastAudioUrl) new Audio(lastAudioUrl).play().catch(() => {});
    });
    host.querySelector('#tc-ai-coach')?.addEventListener('click', async () => {
      const apiKey = getSavedGeminiKey();
      if (!apiKey) {
        core.showToast('กรุณากรอก Gemini API Key ในหน้า "📞 โทรคุยสดครูจีน AI" ก่อนครับ');
        return;
      }
      if (!lastAudioBlob) return;
      aiCoachLoading = true;
      aiCoachText = '';
      render();
      try {
        const b64 = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result || '').split(',')[1] || '');
          fr.onerror = reject;
          fr.readAsDataURL(lastAudioBlob);
        });
        const prompt = `คุณคือครูสอนออกเสียงภาษาจีนกลางสำหรับคนไทย ผู้เรียนเพิ่งพูดประโยค: "${item.hz}" (${item.py} - ${item.th})
ช่วยฟังเสียงจริงที่แนบมา แล้ววิเคราะห์เป็นภาษาไทยแบบละเอียดแต่กระชับ:
1. คะแนนความเหมือนเจ้าของภาษา (0-100%)
2. จุดที่ออกเสียงดีแล้ว
3. จุดที่ต้องแก้แยกทีละพยางค์ (วรรณยุกต์ / พยัญชนะ / สระ / จังหวะ)
4. ทริคฝึกให้เป๊ะทันทีใน 1 นาที`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: lastAudioBlob.type || 'audio/webm', data: b64 } }
              ]
            }]
          })
        });
        const data = await res.json();
        aiCoachText = data?.candidates?.[0]?.content?.parts?.[0]?.text || (data?.error?.message ? `⚠️ ${data.error.message}` : 'ไม่สามารถวิเคราะห์เสียงได้ ลองใหม่อีกครั้งครับ');
      } catch (e) {
        aiCoachText = `⚠️ เกิดข้อผิดพลาด: ${e?.message || 'เชื่อมต่อ Gemini ไม่สำเร็จ'}`;
      } finally {
        aiCoachLoading = false;
        render();
      }
    });
    host.querySelector('#tc-custom-go')?.addEventListener('click', () => {
      const hz = host.querySelector('#tc-custom-hz')?.value?.trim();
      const py = host.querySelector('#tc-custom-py')?.value?.trim();
      if (!hz || !py) return core.showToast('กรุณากรอกทั้งตัวจีนและพินอินครับ');
      customItem = { hz, py, th: 'ประโยคฝึกเอง' };
      lastReport = null;
      lastHeard = '';
      render();
    });

    host.querySelector('#tc-record')?.addEventListener('click', async () => {
      if (recording) {
        stopAllAudio();
        lastReport = buildDetailedPronunciationReport({
          targetHz: item.hz,
          targetPy: item.py,
          heardHz: lastHeard,
          rawHzList: liveRawHz,
          charPinyinMap: charPyMap
        });
        if (lastReport.overallScore >= 80) core.playChime('ok', true);
        render();
        return;
      }

      liveRawHz = [];
      lastHeard = '';
      lastReport = null;
      recording = true;
      render();

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(mediaStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);

        // Record audio for playback
        const chunks = [];
        try {
          mediaRecorder = new MediaRecorder(mediaStream);
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          mediaRecorder.onstop = () => {
            if (chunks.length) {
              if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
              lastAudioBlob = new Blob(chunks, { type: 'audio/webm' });
              lastAudioUrl = URL.createObjectURL(lastAudioBlob);
            }
          };
          mediaRecorder.start();
        } catch { /* MediaRecorder optional */ }

        const buf = new Float32Array(analyser.fftSize);
        const liveCanvas = host.querySelector('#tc-canvas');
        const loop = () => {
          if (!recording) return;
          analyser.getFloatTimeDomainData(buf);
          const hz = detectPitchYIN(buf, audioCtx.sampleRate);
          if (hz && hz >= 70 && hz <= 550) {
            liveRawHz.push(hz);
            const normPreview = liveRawHz.slice(-60).map(v => {
              const t = (Math.log2(v) - Math.log2(100)) / (Math.log2(360) - Math.log2(100));
              return Math.max(1, Math.min(5, 1 + t * 4));
            });
            drawContourCanvas(liveCanvas, ideal, [], normPreview);
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        if (hasSpeechRecognition()) {
          activeMic = startSpeechRecognition({
            lang: 'zh-CN',
            onResult: (txt) => { lastHeard = txt || lastHeard; },
            onError: () => {},
            onEnd: () => {}
          });
        }
      } catch {
        stopAllAudio();
        core.showToast('ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้ไมค์ในเบราว์เซอร์');
        render();
      }
    });
  };

  render();
}
