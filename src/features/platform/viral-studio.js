// Viral & Fun Chinese Lab:
// 1) Chinese Name Generator + Traditional Red Seal (印章) PNG
// 2) WeChat Chat Simulator (3 AI Personas)
// 3) Chinese Lyrics & Drama Breakdown
// 4) Personal HSK Certificate Generator (1400x990 PNG)

function buildRedSealPng(hz = '你好') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fef2f2';
  ctx.fillRect(0, 0, 512, 512);

  // Outer carved crimson square
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.roundRect(36, 36, 440, 440, 28);
  ctx.fill();

  ctx.strokeStyle = '#fef2f2';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(58, 58, 396, 396, 18);
  ctx.stroke();

  const chars = [...String(hz || '你好').replace(/\s+/g, '')].slice(0, 4);
  if (chars.length === 2) chars.push('之', '印');
  else if (chars.length === 3) chars.push('印');
  else if (chars.length === 1) chars.push('氏', '之', '印');

  ctx.fillStyle = '#fef2f2';
  ctx.font = 'bold 140px "Noto Serif SC", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Traditional seal order: top-right, bottom-right, top-left, bottom-left
  const pos = [[345, 170], [345, 345], [168, 170], [168, 345]];
  chars.slice(0, 4).forEach((ch, i) => ctx.fillText(ch, pos[i][0], pos[i][1]));

  return canvas.toDataURL('image/png');
}

function buildHskCertificatePng({ name = 'ผู้เรียนภาษาจีน', level = 'HSK 1–2', score = 95 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 990;
  const ctx = canvas.getContext('2d');

  // Ivory parchment background
  ctx.fillStyle = '#fffbeb';
  ctx.fillRect(0, 0, 1400, 990);

  // Double gold & jade borders
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 14;
  ctx.strokeRect(36, 36, 1328, 918);
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 60, 1280, 870);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('你好 NIHAO CHINESE LEARNING PLATFORM', 700, 150);

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 68px Georgia, serif';
  ctx.fillText('CERTIFICATE OF ACHIEVEMENT', 700, 240);

  ctx.fillStyle = '#475569';
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText('ใบประกาศนียบัตรรับรองความสามารถภาษาจีน มอบให้แก่', 700, 325);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.fillText(String(name).slice(0, 28), 700, 445);

  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText(`ระดับความสำเร็จ: ${level} · คะแนน ${score}/100`, 700, 545);

  const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillStyle = '#64748b';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(`ออกให้ ณ วันที่ ${dateStr}`, 700, 635);

  // Draw red stamp on bottom-right
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.roundRect(1080, 700, 150, 150, 14);
  ctx.fill();
  ctx.fillStyle = '#fef2f2';
  ctx.font = 'bold 46px serif';
  ctx.fillText('你好', 1155, 765);
  ctx.fillText('认证', 1155, 818);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillText('Nihao AI Chinese Academy', 140, 810);

  return canvas.toDataURL('image/png');
}

export function renderViralChineseLab(core, host) {
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  let tab = 'name';
  let busy = false;
  let nameOpts = null;
  let sealUrl = null;
  let wechatPersona = '🍜 เพื่อนจีนสายกิน (เสี่ยวเหม่ย)';
  let wechatMsgs = [{ role: 'ai', hz: '嗨！今天想吃什么呀？', py: 'Hāi! Jīntiān xiǎng chī shénme ya?', th: 'เฮ้! วันนี้อยากกินอะไรดี?' }];
  let lyricsRes = null;
  let certUrl = null;

  function render() {
    host.innerHTML = `
      <div class="ss-card" style="padding:16px">
        <h3 class="ss-title">🏮 Fun & Viral Chinese Lab</h3>
        <p class="ss-muted">ตั้งชื่อจีนมงคล + ตราประทับแดง · แชท WeChat · แกะเพลง/ซีรีส์จีน · ใบเกียรติบัตร HSK</p>
        <div class="ss-actions" style="margin:10px 0 14px;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn-secondary ${tab === 'name' ? 'is-active' : ''}" data-vtab="name">🏮 ชื่อจีน & ตราประทับ</button>
          <button type="button" class="btn-secondary ${tab === 'wechat' ? 'is-active' : ''}" data-vtab="wechat">💬 แชท WeChat</button>
          <button type="button" class="btn-secondary ${tab === 'lyrics' ? 'is-active' : ''}" data-vtab="lyrics">🎤 แกะเพลง/ซีรีส์</button>
          <button type="button" class="btn-secondary ${tab === 'cert' ? 'is-active' : ''}" data-vtab="cert">📜 ใบเกียรติบัตร</button>
        </div>
        <div id="viral-body"></div>
      </div>
    `;

    host.querySelectorAll('[data-vtab]').forEach((b) => {
      b.addEventListener('click', () => { tab = b.dataset.vtab; render(); });
    });

    const body = host.querySelector('#viral-body');

    if (tab === 'name') {
      body.innerHTML = `
        <div class="ss-input-row" style="margin-bottom:10px">
          <input id="vn-thai" class="ss-input" placeholder="พิมพ์ชื่อเล่นหรือชื่อจริงภาษาไทย..." value="${esc(core?.state?.profileName || '')}" />
          <button type="button" class="btn-primary" id="vn-gen" ${busy ? 'disabled' : ''}>${busy ? 'กำลังตั้งชื่อ...' : '🏮 ตั้งชื่อจีนมงคล'}</button>
        </div>
        ${sealUrl ? `
          <div style="text-align:center;margin:12px 0">
            <img src="${sealUrl}" alt="Red Seal" style="width:150px;height:150px;border-radius:14px;box-shadow:0 8px 20px rgba(185,28,28,0.25)" />
            <div style="margin-top:6px"><a href="${sealUrl}" download="nihao-chinese-seal.png" class="btn-secondary" style="text-decoration:none">⬇️ เซฟตราประทับแดง (PNG)</a></div>
          </div>
        ` : ''}
        ${(nameOpts || []).map((o) => `
          <div class="ss-card" style="padding:12px;margin-top:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong class="hanzi-font" style="font-size:1.5rem">${esc(o.hz)} <small style="font-size:0.9rem">(${esc(o.py)})</small></strong>
              <span class="ss-pill">${esc(o.style)}</span>
            </div>
            <p style="margin:4px 0">${esc(o.meaning)}</p>
            <p class="ss-muted" style="font-size:0.85rem">✨ ${esc(o.luckyNote)}</p>
            <div class="ss-actions" style="margin-top:6px">
              <button type="button" class="btn-secondary vn-speak" data-hz="${esc(o.hz)}">🔊 ฟังเสียง</button>
              <button type="button" class="btn-primary vn-seal" data-hz="${esc(o.hz)}">🔴 วาดตราประทับชื่อนี้</button>
            </div>
          </div>
        `).join('')}
      `;
      body.querySelector('#vn-gen')?.addEventListener('click', async () => {
        const thaiName = host.querySelector('#vn-thai')?.value?.trim() || 'นักเรียนจีน';
        busy = true;
        render();
        try {
          const r = await fetch('/api/ai/chinese-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thaiName })
          });
          const d = await r.json();
          if (d.ok && d.result?.options) {
            nameOpts = d.result.options;
            sealUrl = buildRedSealPng(nameOpts[0]?.hz || '你好');
          }
        } catch {
          core?.showToast?.('ตั้งชื่อจีนไม่สำเร็จ', 'AI');
        } finally {
          busy = false;
          render();
        }
      });
      body.querySelectorAll('.vn-speak').forEach((b) => b.addEventListener('click', () => core?.speak?.(b.dataset.hz)));
      body.querySelectorAll('.vn-seal').forEach((b) => b.addEventListener('click', () => { sealUrl = buildRedSealPng(b.dataset.hz); render(); }));
    }

    if (tab === 'wechat') {
      body.innerHTML = `
        <div class="ss-actions" style="margin-bottom:8px;flex-wrap:wrap;gap:6px">
          ${['🍜 เพื่อนจีนสายกิน (เสี่ยวเหม่ย)', '✈️ เพื่อนสายเที่ยว (ต้าหมิง)', '💼 บอสจีนใจดี (หวังจ่ง)'].map((p) =>
            `<button type="button" class="btn-secondary vw-p ${wechatPersona === p ? 'is-active' : ''}" data-p="${esc(p)}">${esc(p)}</button>`
          ).join('')}
        </div>
        <div style="background:#ededed;color:#111;border-radius:14px;padding:12px;max-height:300px;overflow-y:auto;margin-bottom:10px">
          ${wechatMsgs.map((m) => m.role === 'user' ? `
            <div style="text-align:right;margin:6px 0"><span style="display:inline-block;background:#95ec69;padding:8px 12px;border-radius:12px;max-width:80%">${esc(m.text)}</span></div>
          ` : `
            <div style="text-align:left;margin:6px 0">
              <div style="display:inline-block;background:#fff;padding:8px 12px;border-radius:12px;max-width:85%">
                <div class="hanzi-font" style="font-weight:700">${esc(m.hz)} ${m.stickerEmoji || ''}</div>
                <div style="font-size:12px;color:#0f766e">${esc(m.py)}</div>
                <div style="font-size:12px;color:#475569">${esc(m.th)}</div>
                ${m.replyHint ? `<div style="font-size:11px;color:#b45309;margin-top:4px">💡 ลองตอบ: ${esc(m.replyHint)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <form id="vw-form" class="ss-input-row">
          <input id="vw-in" class="ss-input" placeholder="พิมพ์ภาษาจีนหรือพินอินตอบเพื่อน..." ${busy ? 'disabled' : ''} />
          <button type="submit" class="btn-primary" ${busy ? 'disabled' : ''}>ส่ง</button>
        </form>
      `;
      body.querySelectorAll('.vw-p').forEach((b) => b.addEventListener('click', () => { wechatPersona = b.dataset.p; render(); }));
      body.querySelector('#vw-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const txt = host.querySelector('#vw-in')?.value?.trim();
        if (!txt) return;
        wechatMsgs.push({ role: 'user', text: txt });
        busy = true;
        render();
        try {
          const r = await fetch('/api/ai/wechat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ persona: wechatPersona, message: txt, history: wechatMsgs.slice(-6) })
          });
          const d = await r.json();
          if (d.ok && d.reply) {
            wechatMsgs.push({ role: 'ai', ...d.reply });
            core?.speak?.(d.reply.hz);
          }
        } catch {
          core?.showToast?.('เชื่อมต่อ WeChat AI ไม่สำเร็จ', 'AI');
        } finally {
          busy = false;
          render();
        }
      });
    }

    if (tab === 'lyrics') {
      body.innerHTML = `
        <textarea id="vl-txt" class="ss-input" rows="3" style="width:100%;margin-bottom:8px" placeholder="แปะเนื้อเพลงจีน หรือประโยคจากซีรีส์จีนที่ชอบ... เช่น 月亮代表我的心"></textarea>
        <button type="button" class="btn-primary" id="vl-gen" ${busy ? 'disabled' : ''}>${busy ? 'กำลังแกะความหมาย...' : '🎤 แกะเพลง / ซีรีส์'}</button>
        ${lyricsRes ? `
          <div class="ss-card" style="padding:12px;margin-top:10px">
            <p class="ss-muted">🎭 อารมณ์ของบท: <strong>${esc(lyricsRes.mood)}</strong></p>
            ${(lyricsRes.lines || []).map((l) => `
              <div style="padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.2)">
                <div class="hanzi-font" style="font-size:1.15rem">${esc(l.hz)}</div>
                <div class="ss-py">${esc(l.py)}</div>
                <div class="ss-th">${esc(l.th)}</div>
                <div class="ss-muted" style="font-size:12px">📝 ${esc(l.grammarNote)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
      body.querySelector('#vl-gen')?.addEventListener('click', async () => {
        const text = host.querySelector('#vl-txt')?.value?.trim() || '月亮代表我的心';
        busy = true;
        render();
        try {
          const r = await fetch('/api/ai/lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });
          const d = await r.json();
          if (d.ok && d.breakdown) lyricsRes = d.breakdown;
        } catch {
          core?.showToast?.('แกะเนื้อเพลงไม่สำเร็จ', 'AI');
        } finally {
          busy = false;
          render();
        }
      });
    }

    if (tab === 'cert') {
      if (!certUrl) {
        certUrl = buildHskCertificatePng({
          name: core?.state?.profileName || 'ผู้เรียน 你好 Nihao',
          level: Number(core?.state?.xp || 0) >= 500 ? 'HSK 2–3' : 'HSK 1–2',
          score: 96
        });
      }
      body.innerHTML = `
        <div style="text-align:center">
          <img src="${certUrl}" alt="HSK Certificate" style="width:100%;max-width:520px;border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,0.2);margin-bottom:12px" />
          <div><a href="${certUrl}" download="nihao-hsk-certificate.png" class="btn-primary" style="text-decoration:none">⬇️ ดาวน์โหลดใบเกียรติบัตร (PNG)</a></div>
        </div>
      `;
    }
  }

  render();
}
