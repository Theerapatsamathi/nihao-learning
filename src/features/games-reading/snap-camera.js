// Snap & Learn Camera (ถ่ายรูปเมนูอาหาร / ป้ายร้านจีน แปลและสอนสั่งจริงด้วย Gemini Vision)
import { esc, toggleStarWord } from './utils.js';

const DEMO_SNAP = {
  sceneTitle: '🍜 ตัวอย่างเมนูร้านบะหมี่และชานมจีน',
  contextTip: 'เวลาสั่งอาหารในร้านจีน ใช้โครงสร้าง "我要一份... (ขอ... 1 ที่)" หรือชี้เมนูแล้วพูดว่า "这个一个 (อันนี้ 1 ที่)" ได้เลย!',
  items: [
    { hz: '红烧牛肉面', py: 'hóngshāo niúròumiàn', th: 'บะหมี่เนื้อตุ๋นน้ำแดง', note: 'เมนูยอดฮิต รสกลมกล่อมไม่เผ็ดมาก' },
    { hz: '小笼包', py: 'xiǎolóngbāo', th: 'เสี่ยวหลงเปา (ซาลาเปาน้ำซุป)', note: 'ระวังน้ำซุปร้อนด้านในตอนกัดคำแรก!' },
    { hz: '珍珠奶茶', py: 'zhēnzhū nǎichá', th: 'ชานมไข่มุก', note: 'สั่งหวานน้อยพูดว่า 半糖 (bàntáng)' },
    { hz: '微辣', py: 'wēilà', th: 'เผ็ดน้อย', note: 'ถ้าไม่กินเผ็ดเลยให้พูดว่า 不要辣 (bú yào là)' }
  ],
  orderPhrases: [
    { hz: '老板，我要一碗红烧牛肉面，微辣！', py: 'Lǎobǎn, wǒ yào yì wǎn hóngshāo niúròumiàn, wēilà!', th: 'เถ้าแก่ ขอเตี๋ยวเนื้อตุ๋น 1 ชาม เผ็ดน้อยครับ/ค่ะ!' },
    { hz: '再来一笼小笼包，可以扫码付钱吗？', py: 'Zài lái yì lóng xiǎolóngbāo, kěyǐ sǎomǎ fùqián ma?', th: 'เอาเสี่ยวหลงเปาเพิ่มอีก 1 เข่ง สแกนจ่ายได้ไหมครับ/คะ?' }
  ]
};

function downscaleImageFileToDataUrl(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => reject(new Error('รูปแบบไฟล์ภาพไม่รองรับ'));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function renderSnapCameraSection(core, host) {
  const state = {
    previewUrl: '',
    busy: false,
    result: null
  };

  function draw() {
    const snap = state.result;
    host.innerHTML = `
      <div class="gr-card">
        <div class="gr-between">
          <div>
            <h3 class="gr-title">📸 ถ่ายรูปเมนูอาหาร / ป้ายจีน แปลและสอนพูด (Snap & Learn)</h3>
            <p class="gr-sub">ถ่ายรูปเมนูร้านอาหาร ป้ายรถไฟ หรือซองขนมจีน → Gemini Vision ดึงคำศัพท์ + พินอิน + ประโยคพูดสั่งอาหารให้ทันที</p>
          </div>
          <span class="gr-badge gr-badge-orange">Gemini Vision</span>
        </div>

        <div class="gr-row" style="margin-top:6px">
          <label class="btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <span>📷 ถ่ายรูป / เลือกรูปเมนูจีน</span>
            <input type="file" id="gr-snap-file" accept="image/*" capture="environment" hidden>
          </label>
          <button type="button" class="btn-secondary" id="gr-snap-demo">🍜 ลองดูตัวอย่างเมนูร้านอาหาร</button>
        </div>

        ${state.busy ? `
          <div style="padding:18px;text-align:center;background:var(--sys-surface-2);border-radius:12px">
            <strong>🔍 ครู AI กำลังอ่านตัวอักษรจีนจากรูปภาพและเตรียมประโยคสั่งอาหาร...</strong>
          </div>
        ` : ''}

        ${state.previewUrl ? `
          <div style="margin-top:8px">
            <img src="${state.previewUrl}" alt="Uploaded Chinese photo" style="max-height:220px;border-radius:12px;border:1px solid var(--sys-separator);object-fit:contain">
          </div>
        ` : ''}
      </div>

      ${snap ? `
        <div class="gr-card" style="margin-top:12px">
          <div class="gr-between">
            <h3 class="gr-title">${esc(core, snap.sceneTitle)}</h3>
            <button type="button" class="btn-secondary" style="font-size:12px;padding:5px 10px" id="gr-snap-save-all">⭐ บันทึกทุกคำเข้าสมุดศัพท์</button>
          </div>
          <p class="gr-sub">💡 ${esc(core, snap.contextTip)}</p>

          <div class="gr-grid-2" style="margin-top:8px">
            ${(snap.items || []).map((it, idx) => `
              <div class="gr-story-sent">
                <div class="gr-between">
                  <div>
                    <div class="hanzi-font" style="font-size:20px;font-weight:700">${esc(core, it.hz)}</div>
                    <div style="font-size:13px;color:var(--sys-accent-text);font-weight:600">${esc(core, it.py)}</div>
                  </div>
                  <div class="gr-row">
                    <button type="button" class="btn-secondary" style="padding:4px 9px;font-size:12px" data-snap-say="${esc(core, it.hz)}">🔊</button>
                    <button type="button" class="btn-secondary" style="padding:4px 9px;font-size:12px" data-snap-star="${idx}">⭐</button>
                  </div>
                </div>
                <div style="font-weight:600;font-size:14px">${esc(core, it.th)}</div>
                ${it.note ? `<div class="gr-sub" style="font-size:12px">${esc(core, it.note)}</div>` : ''}
              </div>
            `).join('')}
          </div>

          <h4 style="margin:14px 0 6px">🗣️ ประโยคพูดจริงที่ใช้สั่ง/ถามได้ทันที</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${(snap.orderPhrases || []).map(p => `
              <div class="gr-story-sent">
                <div class="gr-between">
                  <div>
                    <div class="hanzi-font" style="font-size:17px;font-weight:700">${esc(core, p.hz)}</div>
                    <div style="font-size:13px;color:var(--sys-accent-text)">${esc(core, p.py)}</div>
                    <div class="gr-sub">${esc(core, p.th)}</div>
                  </div>
                  <button type="button" class="btn-primary" style="padding:6px 12px;font-size:12.5px" data-snap-say="${esc(core, p.hz)}">🔊 ฟัง & พูดตาม</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    host.querySelector('#gr-snap-demo')?.addEventListener('click', () => {
      state.result = DEMO_SNAP;
      core.playChime('ok', true);
      draw();
    });

    host.querySelector('#gr-snap-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      state.busy = true;
      draw();
      try {
        const dataUrl = await downscaleImageFileToDataUrl(file, 1024);
        state.previewUrl = dataUrl;
        const res = await core.api('/api/ai/vision', { mode: 'snap', image: dataUrl }, 'POST');
        if (res.ok && res.data?.snap) {
          state.result = res.data.snap;
          core.addXp(20, 'สแกนรูปภาพเรียนรู้ศัพท์จีนใหม่!');
          core.playChime('ok', true);
        } else {
          state.result = DEMO_SNAP;
          core.showToast(res.data?.error ? `${res.data.error} · แสดงตัวอย่างเมนูแทน` : 'แสดงตัวอย่างเมนูภาษาจีน');
        }
      } catch (err) {
        core.showToast(err.message || 'ไม่สามารถอ่านรูปภาพได้');
      } finally {
        state.busy = false;
        draw();
      }
    });

    host.querySelectorAll('[data-snap-say]').forEach(btn => {
      btn.addEventListener('click', () => core.speak(btn.dataset.snapSay));
    });

    host.querySelectorAll('[data-snap-star]').forEach(btn => {
      btn.addEventListener('click', () => {
        const it = snap?.items?.[Number(btn.dataset.snapStar)];
        if (!it) return;
        toggleStarWord(core, it.hz);
        core.showToast(`บันทึก "${it.hz}" ไว้ทบทวนแล้ว ⭐`);
      });
    });

    host.querySelector('#gr-snap-save-all')?.addEventListener('click', () => {
      if (!snap?.items?.length) return;
      snap.items.forEach(it => toggleStarWord(core, it.hz));
      core.addXp(10, 'บันทึกคำศัพท์จากรูปถ่ายเมนูจีน!');
      core.showToast(`บันทึกครบ ${snap.items.length} คำเรียบร้อย ⭐`);
    });
  }

  draw();
  return () => {};
}
