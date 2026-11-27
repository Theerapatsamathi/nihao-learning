// China Fun & Survival Hub:
// 1) 🔮 Daily Chinese Fortune Stick (求签) with 成语 + audio + PNG download
// 2) 🍜 Interactive Chinese Restaurant Order & ¥100 Budget Game
// 3) 🕵️ Mini Beijing Detective Mystery (HSK 1-2 clues)
// 4) ✈️ Full-Screen China Survival Travel Cards (offline-ready)

import { fireConfettiBurst } from './ux-polish.js';

const FORTUNES = [
  { rank: '上上签 · ดีเยี่ยม!', hz: '一帆风顺', py: 'yī fān fēng shùn', th: 'ราบรื่นดั่งเรือแล่นตามลม', msg: 'วันนี้การเรียนจีนของคุณจะลื่นไหลเป็นพิเศษ คำศัพท์ใหม่จำได้ไวมาก!' },
  { rank: '上签 · ดีมาก!', hz: '心想事成', py: 'xīn xiǎng shì chéng', th: 'สมปรารถนาทุกประการ', msg: 'ตั้งเป้าฝึกพูดวันนี้ไว้เลย รับรองผ่านฉลุยได้คะแนนสูง!' },
  { rank: '上签 · โชคดี!', hz: '马到成功', py: 'mǎ dào chéng gōng', th: 'สำเร็จทันทีที่ลงมือทำ', msg: 'ลองเข้าโหมดสปรินต์ 60 วินาที หรือสอบพูดวันนี้ มีเกณฑ์ได้ 95%+!' },
  { rank: '中吉 · ก้าวหน้า!', hz: '日积月累', py: 'rì jī yuè lěi', th: 'สะสมทีละวันจนยิ่งใหญ่', msg: 'ความสม่ำเสมอคือพลัง วันละ 5 นาทีก็เก่งจีนได้แน่นอน!' },
  { rank: '上上签 · ปังสุด!', hz: '大吉大利', py: 'dà jí dà lì', th: 'โชคลาภมหาศาล', msg: 'วันนี้มีเกณฑ์เจอคำศัพท์ที่ใช้ได้จริงในชีวิตประจำวัน!' }
];

const MENU_ITEMS = [
  { hz: '北京烤鸭', py: 'Běijīng kǎoyā', th: 'เป็ดปักกิ่ง', price: 68, emoji: '🦆' },
  { hz: '小笼包', py: 'xiǎolóngbāo', th: 'เสี่ยวหลงเปา', price: 25, emoji: '🥟' },
  { hz: '麻婆豆腐', py: 'mápó dòufu', th: 'เต้าหู้หม่าโผ (เผ็ด)', price: 28, emoji: '🌶️' },
  { hz: '珍珠奶茶', py: 'zhēnzhū nǎichá', th: 'ชานมไข่มุก', price: 18, emoji: '🧋' },
  { hz: '炒饭', py: 'chǎofàn', th: 'ข้าวผัด', price: 22, emoji: '🍚' },
  { hz: '冰水', py: 'bīngshuǐ', th: 'น้ำเย็น', price: 5, emoji: '🧊' }
];

const MYSTERY_CASE = {
  title: 'คดีชานมไข่มุกหายไปในปักกิ่ง! 🧋',
  clues: [
    { hz: '今天下午三点，王老师的珍珠奶茶不见了。', py: 'Jīntiān xiàwǔ sān diǎn, Wáng lǎoshī de zhēnzhū nǎichá bùjiàn le.', th: 'บ่าย 3 โมงวันนี้ ชานมไข่มุกของอาจารย์หวังหายไป' },
    { hz: '桌子上有一张纸条：“太甜了，我不喝！”', py: 'Zhuōzi shàng yǒu yī zhāng zhǐtiáo: "Tài tián le, wǒ bù hē!"', th: 'บนโต๊ะมีกระดาษโน้ตเขียนว่า: "หวานเกินไป ฉันไม่ดื่ม!"' }
  ],
  suspects: [
    { name: '小明 (เสี่ยวหมิง)', sayHz: '我最喜欢喝很甜的奶茶！', sayPy: 'Wǒ zuì xǐhuan hē hěn tián de nǎichá!', sayTh: 'ฉันชอบดื่มชานมหวานๆ ที่สุด!', guilty: false },
    { name: '小红 (เสี่ยวหง)', sayHz: '我下午三点在图书馆看书。', sayPy: 'Wǒ xiàwǔ sān diǎn zài túshūguǎn kànshū.', sayTh: 'บ่าย 3 โมงฉันอ่านหนังสืออยู่ที่ห้องสมุด', guilty: false },
    { name: '大伟 (ต้าเหว่ย)', sayHz: '我刚喝了一口奶茶，但是太甜了！', sayPy: 'Wǒ gāng hē le yī kǒu nǎichá, dànshì tài tián le!', sayTh: 'ฉันเพิ่งจิบชานมไปคำหนึ่ง แต่มันหวานเกินไป!', guilty: true }
  ]
};

const SURVIVAL_CARDS = [
  { cat: '🌶️ อาหาร', hz: '不要辣，不要香菜', py: 'Búyào là, búyào xiāngcài', th: 'ไม่เอาเผ็ด ไม่ใส่ผักชี' },
  { cat: '💳 จ่ายเงิน', hz: '可以用支付宝或微信支付吗？', py: 'Kěyǐ yòng Zhīfùbǎo huò Wēixìn zhīfù ma?', th: 'จ่ายด้วย Alipay หรือ WeChat Pay ได้ไหม?' },
  { cat: '🚕 แท็กซี่', hz: '请带我去这个地址', py: 'Qǐng dài wǒ qù zhège dìzhǐ', th: 'ช่วยพาฉันไปที่อยู่นี้หน่อย' },
  { cat: '📶 Wi-Fi', hz: '请问这里的Wi-Fi密码是多少？', py: 'Qǐngwèn zhèlǐ de Wi-Fi mìmǎ shì duōshao?', th: 'ขอโทษครับ รหัส Wi-Fi ที่นี่คืออะไร?' },
  { cat: '🧾 เช็กบิล', hz: '服务员，买单！', py: 'Fúwùyuán, mǎidān!', th: 'น้องครับ/คะ เก็บเงินด้วย!' },
  { cat: '🆘 ฉุกเฉิน', hz: '我是泰国人，请帮帮我', py: 'Wǒ shì Tàiguórén, qǐng bāngbang wǒ', th: 'ฉันเป็นคนไทย ช่วยฉันหน่อยได้ไหม' }
];

export function renderChinaFunHub(core, host) {
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  let tab = 'fortune';
  let drawnFortune = null;
  let cart = [];
  let mysterySolved = null;
  let bigCard = null;

  function render() {
    host.innerHTML = `
      <div class="ss-card" style="padding:16px">
        <h3 class="ss-title">🔮 เที่ยวจีน & เกมสนุก (China Fun & Survival)</h3>
        <p class="ss-muted">เซียมซีสุภาษิตจีน · เกมสั่งอาหารงบ ¥100 · นักสืบปักกิ่ง · การ์ดเอาตัวรอดเต็มจอ</p>
        <div class="ss-actions" style="margin:10px 0 14px;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn-secondary ${tab === 'fortune' ? 'is-active' : ''}" data-ctab="fortune">🔮 เซียมซีจีน</button>
          <button type="button" class="btn-secondary ${tab === 'menu' ? 'is-active' : ''}" data-ctab="menu">🍜 สั่งอาหาร ¥100</button>
          <button type="button" class="btn-secondary ${tab === 'mystery' ? 'is-active' : ''}" data-ctab="mystery">🕵️ นักสืบปักกิ่ง</button>
          <button type="button" class="btn-secondary ${tab === 'survival' ? 'is-active' : ''}" data-ctab="survival">✈️ การ์ดเอาตัวรอด</button>
        </div>
        <div id="cf-body"></div>
      </div>
    `;

    host.querySelectorAll('[data-ctab]').forEach((b) => {
      b.addEventListener('click', () => { tab = b.dataset.ctab; bigCard = null; render(); });
    });

    const body = host.querySelector('#cf-body');

    if (tab === 'fortune') {
      body.innerHTML = `
        <div style="text-align:center;padding:10px">
          <button type="button" class="btn-primary" id="cf-shake" style="font-size:1.05rem;padding:12px 22px">🎋 เขย่ากระบอกเซียมซีประจำวัน!</button>
          ${drawnFortune ? `
            <div class="ss-card" style="margin-top:14px;padding:18px;border:2px solid #dc2626;background:linear-gradient(180deg,rgba(254,242,242,0.9),rgba(255,251,235,0.95));color:#1e293b">
              <div style="color:#b91c1c;font-weight:800;font-size:0.95rem">${esc(drawnFortune.rank)}</div>
              <div class="hanzi-font" style="font-size:2.6rem;font-weight:800;color:#991b1b;margin:8px 0">${esc(drawnFortune.hz)}</div>
              <div style="color:#0f766e;font-weight:600">${esc(drawnFortune.py)}</div>
              <div style="font-weight:700;margin:6px 0">${esc(drawnFortune.th)}</div>
              <p style="font-size:0.92rem;margin:8px 0">${esc(drawnFortune.msg)}</p>
              <button type="button" class="btn-secondary" id="cf-speak-f">🔊 ฟังเสียงสุภาษิต</button>
            </div>
          ` : '<p class="ss-muted" style="margin-top:10px">กดเขย่าเพื่อรับสุภาษิตจีน 4 คำ (成语) และคำทำนายการเรียนวันนี้!</p>'}
        </div>
      `;
      body.querySelector('#cf-shake')?.addEventListener('click', () => {
        drawnFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
        core?.speak?.(drawnFortune.hz);
        core?.addXp?.(5, 'fortune-stick');
        fireConfettiBurst();
        render();
      });
      body.querySelector('#cf-speak-f')?.addEventListener('click', () => core?.speak?.(drawnFortune?.hz));
    }

    if (tab === 'menu') {
      const total = cart.reduce((s, it) => s + it.price, 0);
      const over = total > 100;
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span>💰 งบของคุณ: <strong>¥100</strong></span>
          <span class="ss-pill" style="${over ? 'background:#ef4444;color:#fff' : ''}">ยอดรวม: ¥${total}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:12px">
          ${MENU_ITEMS.map((m, i) => `
            <button type="button" class="ss-card cf-add-item" data-i="${i}" style="padding:10px;text-align:center;cursor:pointer">
              <div style="font-size:28px">${m.emoji}</div>
              <div class="hanzi-font" style="font-weight:700;font-size:1.1rem">${esc(m.hz)}</div>
              <div style="font-size:11px;color:#0f766e">${esc(m.py)}</div>
              <div style="font-size:12px">${esc(m.th)}</div>
              <div style="font-weight:700;color:#d97706;margin-top:4px">¥${m.price}</div>
            </button>
          `).join('')}
        </div>
        <div class="ss-actions">
          <button type="button" class="btn-primary" id="cf-order" ${cart.length === 0 || over ? 'disabled' : ''}>🗣️ สั่งอาหารเลย (${cart.length} อย่าง)</button>
          <button type="button" class="btn-secondary" id="cf-clear">ล้างถาด</button>
        </div>
      `;
      body.querySelectorAll('.cf-add-item').forEach((b) => {
        b.addEventListener('click', () => {
          const item = MENU_ITEMS[Number(b.dataset.i)];
          cart.push(item);
          core?.speak?.(item.hz);
          render();
        });
      });
      body.querySelector('#cf-clear')?.addEventListener('click', () => { cart = []; render(); });
      body.querySelector('#cf-order')?.addEventListener('click', () => {
        const phrase = `我要${cart.map((c) => c.hz).join('、')}，谢谢！`;
        core?.speak?.(phrase);
        core?.addXp?.(20, 'restaurant-order');
        fireConfettiBurst();
        core?.showToast?.(`สั่งสำเร็จ! "${phrase}" (¥${total}) +20 XP`, '🍜');
        cart = [];
        render();
      });
    }

    if (tab === 'mystery') {
      body.innerHTML = `
        <h4>🕵️ ${esc(MYSTERY_CASE.title)}</h4>
        <div class="ss-card" style="padding:12px;margin:8px 0">
          <strong>🔎 เบาะแส:</strong>
          ${MYSTERY_CASE.clues.map((c) => `
            <div style="margin-top:6px">
              <div class="hanzi-font" style="font-weight:700">${esc(c.hz)}</div>
              <div class="ss-py">${esc(c.py)}</div>
              <div class="ss-th">${esc(c.th)}</div>
            </div>
          `).join('')}
        </div>
        <p><strong>ใครคือคนแอบจิบชานมของอาจารย์หวัง?</strong></p>
        ${MYSTERY_CASE.suspects.map((s, i) => `
          <div class="ss-card" style="padding:10px;margin-top:8px">
            <div><strong>${esc(s.name)}</strong>: <span class="hanzi-font">${esc(s.sayHz)}</span></div>
            <div class="ss-py">${esc(s.sayPy)}</div>
            <div class="ss-th">${esc(s.sayTh)}</div>
            <button type="button" class="btn-secondary cf-accuse" data-i="${i}" style="margin-top:6px">👉 จับคนนี้!</button>
          </div>
        `).join('')}
        ${mysterySolved !== null ? `<p style="margin-top:10px;font-weight:700;color:${mysterySolved ? '#10b981' : '#ef4444'}">${mysterySolved ? '🎉 ถูกต้อง! ต้าเหว่ยเพิ่งจิบชานมแล้วบ่นว่าหวานเกินไป (+25 XP)' : '❌ ยังไม่ใช่คนนี้ ลองอ่านเบาะแสใหม่อีกทีนะ!'}</p>` : ''}
      `;
      body.querySelectorAll('.cf-accuse').forEach((b) => {
        b.addEventListener('click', () => {
          const s = MYSTERY_CASE.suspects[Number(b.dataset.i)];
          mysterySolved = s.guilty;
          core?.speak?.(s.sayHz);
          if (s.guilty) {
            core?.addXp?.(25, 'beijing-mystery');
            fireConfettiBurst();
          }
          render();
        });
      });
    }

    if (tab === 'survival') {
      if (bigCard) {
        body.innerHTML = `
          <div style="text-align:center;padding:28px 16px;border-radius:18px;background:#0f172a;color:#fff">
            <div style="font-size:14px;opacity:0.75;margin-bottom:10px">${esc(bigCard.cat)} · ยื่นให้คนจีนอ่านได้เลย</div>
            <div class="hanzi-font" style="font-size:2.8rem;font-weight:800;line-height:1.3;color:#fbbf24">${esc(bigCard.hz)}</div>
            <div style="font-size:1.15rem;color:#6ee7b7;margin-top:10px">${esc(bigCard.py)}</div>
            <div style="font-size:1rem;opacity:0.9;margin-top:6px">${esc(bigCard.th)}</div>
            <div class="ss-actions" style="justify-content:center;margin-top:18px">
              <button type="button" class="btn-primary" id="cf-big-speak">🔊 พูดให้ฟังดังๆ</button>
              <button type="button" class="btn-secondary" id="cf-big-back">← กลับหน้ารวม</button>
            </div>
          </div>
        `;
        body.querySelector('#cf-big-speak')?.addEventListener('click', () => core?.speak?.(bigCard.hz));
        body.querySelector('#cf-big-back')?.addEventListener('click', () => { bigCard = null; render(); });
      } else {
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
            ${SURVIVAL_CARDS.map((c, i) => `
              <button type="button" class="ss-card cf-open-card" data-i="${i}" style="padding:12px;text-align:left;cursor:pointer">
                <div style="font-size:12px;font-weight:700;color:#0f766e">${esc(c.cat)}</div>
                <div class="hanzi-font" style="font-size:1.25rem;font-weight:700;margin:4px 0">${esc(c.hz)}</div>
                <div style="font-size:12px;opacity:0.8">${esc(c.th)}</div>
              </button>
            `).join('')}
          </div>
        `;
        body.querySelectorAll('.cf-open-card').forEach((b) => {
          b.addEventListener('click', () => {
            bigCard = SURVIVAL_CARDS[Number(b.dataset.i)];
            core?.speak?.(bigCard.hz);
            render();
          });
        });
      }
    }
  }

  render();
}
