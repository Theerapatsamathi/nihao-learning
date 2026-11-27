// Pinyin Type-Racer Arcade + Chinese RPG Profile Hub
import { fireConfettiBurst } from './ux-polish.js';

const RACER_WORDS = [
  { hz: '你好', py: 'nihao', disp: 'nǐ hǎo', th: 'สวัสดี' },
  { hz: '谢谢', py: 'xiexie', disp: 'xièxie', th: 'ขอบคุณ' },
  { hz: '再见', py: 'zaijian', disp: 'zàijiàn', th: 'ลาก่อน' },
  { hz: '奶茶', py: 'naicha', disp: 'nǎichá', th: 'ชานม' },
  { hz: '好吃', py: 'haochi', disp: 'hǎochī', th: 'อร่อย' },
  { hz: '北京', py: 'beijing', disp: 'Běijīng', th: 'ปักกิ่ง' },
  { hz: '上海', py: 'shanghai', disp: 'Shànghǎi', th: 'เซี่ยงไฮ้' },
  { hz: '朋友', py: 'pengyou', disp: 'péngyou', th: 'เพื่อน' },
  { hz: '咖啡', py: 'kafei', disp: 'kāfēi', th: 'กาแฟ' },
  { hz: '加油', py: 'jiayou', disp: 'jiāyóu', th: 'สู้ๆ' },
  { hz: '熊猫', py: 'xiongmao', disp: 'xióngmāo', th: 'แพนด้า' },
  { hz: '便宜', py: 'pianyi', disp: 'piányi', th: 'ราคาถูก' },
  { hz: '买单', py: 'maidan', disp: 'mǎidān', th: 'เช็กบิล' },
  { hz: '喜欢', py: 'xihuan', disp: 'xǐhuan', th: 'ชอบ' },
  { hz: '中文', py: 'zhongwen', disp: 'Zhōngwén', th: 'ภาษาจีน' }
];

export function renderArcadeRpgHub(core, host) {
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  let tab = 'racer';
  let running = false;
  let score = 0;
  let combo = 0;
  let lives = 3;
  let activeWords = []; // { id, hz, py, disp, th, x, y, speed }
  let tickId = null;
  let spawnId = null;

  function stopGame() {
    running = false;
    if (tickId) { clearInterval(tickId); tickId = null; }
    if (spawnId) { clearInterval(spawnId); spawnId = null; }
  }

  function startGame() {
    stopGame();
    running = true;
    score = 0;
    combo = 0;
    lives = 3;
    activeWords = [];
    const spawn = () => {
      if (!running || activeWords.length >= 4) return;
      const w = RACER_WORDS[Math.floor(Math.random() * RACER_WORDS.length)];
      activeWords.push({
        ...w,
        id: `${Date.now()}-${Math.random()}`,
        x: 10 + Math.random() * 68,
        y: 0,
        speed: 1.8 + Math.min(2.2, score / 250)
      });
    };
    spawn();
    spawnId = setInterval(spawn, 2400);
    tickId = setInterval(() => {
      if (!running) return;
      for (const w of activeWords) w.y += w.speed;
      const missed = activeWords.filter((w) => w.y >= 88);
      if (missed.length) {
        activeWords = activeWords.filter((w) => w.y < 88);
        lives = Math.max(0, lives - missed.length);
        combo = 0;
        if (lives <= 0) {
          stopGame();
          const xp = Math.max(10, Math.min(50, Math.round(score / 10)));
          core?.addXp?.(xp, 'pinyin-type-racer');
          if (score >= 100) fireConfettiBurst();
          core?.showToast?.(`จบเกม! คะแนน ${score} รับ +${xp} XP`, '⚡');
          render();
          return;
        }
      }
      updateBoard();
    }, 100);
    render();
  }

  function updateBoard() {
    const board = host.querySelector('#ptr-board');
    const hud = host.querySelector('#ptr-hud');
    if (hud) hud.innerHTML = `<span>⚡ คะแนน: <strong>${score}</strong></span> · <span>🔥 Combo x${Math.max(1, combo)}</span> · <span>${'❤️'.repeat(lives)}${'🖤'.repeat(Math.max(0, 3 - lives))}</span>`;
    if (!board) return;
    board.innerHTML = activeWords.map((w) => `
      <div style="position:absolute;left:${w.x}%;top:${w.y}%;padding:6px 12px;border-radius:12px;background:rgba(15,23,42,0.92);color:#fff;border:1px solid #10b981;box-shadow:0 6px 16px rgba(0,0,0,0.28);text-align:center;min-width:92px">
        <div class="hanzi-font" style="font-size:1.35rem;font-weight:800;color:#fbbf24">${esc(w.hz)}</div>
        <div style="font-size:11px;color:#6ee7b7">${esc(w.th)}</div>
      </div>
    `).join('');
  }

  function render() {
    const st = core?.state || {};
    const xp = Number(st.xp || 0);
    const level = Math.floor(xp / 200) + 1;
    const pct = Math.min(100, Math.round(((xp % 200) / 200) * 100));
    const mastered = Object.keys(st.vocabSrs || {}).length;

    host.innerHTML = `
      <div class="ss-card" style="padding:16px">
        <h3 class="ss-title">⚡ อาเขตพินอิน & โปรไฟล์ RPG</h3>
        <p class="ss-muted">ฝึกพิมพ์พินอินความเร็วสูง (Pinyin Type-Racer) · ดูหน้าโปรไฟล์พลังภาษาจีนของคุณ</p>
        <div class="ss-actions" style="margin:10px 0 14px;gap:6px">
          <button type="button" class="btn-secondary ${tab === 'racer' ? 'is-active' : ''}" data-atab="racer">⚡ เกมฝนพินอิน</button>
          <button type="button" class="btn-secondary ${tab === 'rpg' ? 'is-active' : ''}" data-atab="rpg">🪪 โปรไฟล์ RPG จีน</button>
        </div>
        <div id="ar-body"></div>
      </div>
    `;

    host.querySelectorAll('[data-atab]').forEach((b) => {
      b.addEventListener('click', () => { stopGame(); tab = b.dataset.atab; render(); });
    });

    const body = host.querySelector('#ar-body');

    if (tab === 'racer') {
      body.innerHTML = `
        <div id="ptr-hud" style="margin-bottom:8px;font-size:14px">
          <span>⚡ คะแนน: <strong>${score}</strong></span> · <span>🔥 Combo x${Math.max(1, combo)}</span> · <span>${'❤️'.repeat(lives)}</span>
        </div>
        <div id="ptr-board" style="position:relative;height:300px;border-radius:16px;background:linear-gradient(180deg,#0f172a,#134e4a);overflow:hidden;border:2px solid rgba(16,185,129,0.4);margin-bottom:10px">
          ${!running ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#fff;gap:10px">
            <div style="font-size:2rem">⚡ ฝนคำศัพท์พินอิน</div>
            <div style="opacity:0.85;font-size:13px">พิมพ์พินอินไม่ต้องใส่วรรณยุกต์ (เช่น nihao, xiexie) ก่อนคำตกถึงพื้น!</div>
            <button type="button" class="btn-primary" id="ptr-start">🚀 เริ่มเกม!</button>
          </div>` : ''}
        </div>
        ${running ? `
          <div class="ss-input-row">
            <input id="ptr-in" class="ss-input" placeholder="พิมพ์พินอินที่นี่ เช่น nihao..." autocomplete="off" autofocus />
            <button type="button" class="btn-secondary" id="ptr-stop">⏹ หยุด</button>
          </div>
        ` : ''}
      `;
      body.querySelector('#ptr-start')?.addEventListener('click', startGame);
      body.querySelector('#ptr-stop')?.addEventListener('click', () => { stopGame(); render(); });
      const inp = body.querySelector('#ptr-in');
      if (inp) {
        inp.focus();
        inp.addEventListener('input', () => {
          const val = inp.value.toLowerCase().replace(/[^a-z]/g, '');
          const hitIdx = activeWords.findIndex((w) => w.py === val);
          if (hitIdx >= 0) {
            const hit = activeWords[hitIdx];
            activeWords.splice(hitIdx, 1);
            combo += 1;
            score += 10 * Math.min(5, combo);
            core?.speak?.(hit.hz);
            inp.value = '';
            updateBoard();
          }
        });
      }
      if (running) updateBoard();
    }

    if (tab === 'rpg') {
      body.innerHTML = `
        <div class="ss-card" style="padding:18px;background:linear-gradient(135deg,#0f172a,#134e4a);color:#f8fafc">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div style="font-size:56px">${esc(st.avatar || '🐼')}</div>
            <div style="flex:1">
              <div style="font-size:1.35rem;font-weight:800">${esc(st.profileName || 'จอมยุทธ์ภาษาจีน')}</div>
              <div style="color:#6ee7b7;font-weight:600">Level ${level} · ${level >= 5 ? 'จอมยุทธ์ HSK' : 'ศิษย์สำนักเส้าหลิน'}</div>
              <div style="margin-top:8px;height:10px;border-radius:999px;background:rgba(255,255,255,0.15);overflow:hidden">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#fbbf24,#10b981)"></div>
              </div>
              <div style="font-size:12px;opacity:0.8;margin-top:4px">${xp} XP · อีก ${200 - (xp % 200)} XP เพื่ออัป Level ${level + 1}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;text-align:center">
            <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.08)"><div style="font-size:1.4rem;font-weight:800">🔥 ${Number(st.streak || 0)}</div><div style="font-size:11px;opacity:0.8">Streak (วัน)</div></div>
            <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.08)"><div style="font-size:1.4rem;font-weight:800">📚 ${mastered}</div><div style="font-size:11px;opacity:0.8">คำศัพท์ที่จำได้</div></div>
            <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,0.08)"><div style="font-size:1.4rem;font-weight:800">⚡ ${xp}</div><div style="font-size:11px;opacity:0.8">พลัง XP รวม</div></div>
          </div>
        </div>
      `;
    }
  }

  render();
}
