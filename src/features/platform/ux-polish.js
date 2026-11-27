// Game-Feel Animation Engine:
// - Floating ambient game particles (jade/gold lantern sparks)
// - 3D tactile Duolingo-style buttons + cursor click sparkle burst
// - Floating "+XP!" RPG reward popups on XP gain
// - Spring overshoot card entrances + glowing hover lift
// - Animated bobbing Panda Coach + Floating ✨ AI Studio FAB + Confetti

const POLISH_CSS = `
  /* 3D Tactile Game Buttons */
  .btn-primary {
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 0 rgba(6, 78, 59, 0.55), 0 8px 18px rgba(16, 185, 129, 0.22);
    transition: transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 140ms ease,
                filter 160ms ease;
  }
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.06);
    box-shadow: 0 6px 0 rgba(6, 78, 59, 0.55), 0 12px 24px rgba(16, 185, 129, 0.34);
  }
  .btn-primary:active:not(:disabled) {
    transform: translateY(3px) scale(0.98);
    box-shadow: 0 1px 0 rgba(6, 78, 59, 0.55);
  }

  .btn-secondary, .pf-mode-btn {
    box-shadow: 0 3px 0 rgba(15, 23, 42, 0.16);
    transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 150ms ease,
                border-color 180ms ease;
  }
  .btn-secondary:hover:not(:disabled), .pf-mode-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 0 rgba(15, 23, 42, 0.18), 0 8px 16px rgba(15, 23, 42, 0.08);
  }
  .btn-secondary:active:not(:disabled), .pf-mode-btn:active {
    transform: translateY(2px) scale(0.97);
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.16);
  }

  /* Juicy Spring Card Entrances & Glow Hover */
  @keyframes nihaoGamePop {
    0% { opacity: 0; transform: translateY(14px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  .ss-card, .gr-card, .card-panel {
    animation: nihaoGamePop 340ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 220ms ease,
                border-color 220ms ease;
  }
  .ss-scenario-card:hover, .gr-card-click:hover, .cf-add-item:hover, .cf-open-card:hover {
    transform: translateY(-5px) scale(1.015);
    box-shadow: 0 14px 32px rgba(16, 185, 129, 0.22), 0 0 0 2px rgba(16, 185, 129, 0.35);
  }

  /* Ambient Floating Game Sparks */
  .nihao-ambient-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  @keyframes nihaoDrift {
    0% { transform: translateY(105vh) translateX(0) scale(0.7); opacity: 0; }
    15% { opacity: 0.45; }
    85% { opacity: 0.35; }
    100% { transform: translateY(-10vh) translateX(28px) scale(1.15); opacity: 0; }
  }
  .nihao-spark {
    position: absolute;
    border-radius: 999px;
    animation: nihaoDrift linear infinite;
    filter: blur(0.5px);
  }

  /* Floating RPG +XP Popup */
  @keyframes nihaoXpFloat {
    0% { opacity: 0; transform: translate(-50%, 10px) scale(0.7); }
    20% { opacity: 1; transform: translate(-50%, -18px) scale(1.15); }
    100% { opacity: 0; transform: translate(-50%, -78px) scale(0.95); }
  }
  .nihao-xp-pop {
    position: fixed;
    left: 50%;
    top: 22%;
    z-index: 9998;
    pointer-events: none;
    padding: 8px 18px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f59e0b, #10b981);
    color: #fff;
    font-weight: 900;
    font-size: 20px;
    letter-spacing: 0.5px;
    box-shadow: 0 10px 28px rgba(245, 158, 11, 0.45);
    animation: nihaoXpFloat 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  /* Cursor Tap Sparkle */
  @keyframes nihaoTapRing {
    0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.85; }
    100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
  }
  .nihao-tap-ring {
    position: fixed;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 2.5px solid #fbbf24;
    pointer-events: none;
    z-index: 9997;
    animation: nihaoTapRing 420ms ease-out forwards;
  }

  /* Floating AI Studio FAB */
  @keyframes nihaoPulseGlow {
    0%, 100% { box-shadow: 0 10px 28px rgba(5, 150, 105, 0.42); }
    50% { box-shadow: 0 10px 36px rgba(251, 191, 36, 0.58); }
  }
  .nihao-fab-ai {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 950;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.28);
    background: linear-gradient(135deg, #0f766e, #059669 55%, #d97706);
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    animation: nihaoPulseGlow 3s ease-in-out infinite;
    transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .nihao-fab-ai:hover { transform: translateY(-3px) scale(1.06); }
  .nihao-fab-ai:active { transform: scale(0.93); }

  /* Bobbing RPG Companion Panda */
  @keyframes nihaoPandaBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .nihao-panda-coach {
    position: fixed;
    right: 18px;
    bottom: 74px;
    z-index: 949;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 260px;
    padding: 8px 12px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.92);
    color: #f8fafc;
    font-size: 12.5px;
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.34);
    border: 1px solid rgba(110, 231, 183, 0.32);
    cursor: pointer;
    animation: nihaoPandaBob 2.8s ease-in-out infinite;
  }
  .nihao-panda-coach:active { transform: scale(0.92); }

  /* Mobile Bottom Navigation Bar (Duolingo-style) */
  .nihao-mobile-nav {
    display: none;
  }
  @media (max-width: 768px) {
    body { padding-bottom: 68px; }
    .nihao-fab-ai { bottom: 74px; right: 12px; padding: 10px 14px; font-size: 13px; }
    .nihao-panda-coach { bottom: 124px; right: 12px; }
    .nihao-mobile-nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: 60px;
      z-index: 960;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(10px);
      border-top: 1px solid rgba(255,255,255,0.12);
    }
    .nihao-mnav-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      border: none;
      background: transparent;
      color: #cbd5e1;
      font-size: 10.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .nihao-mnav-btn span:first-child { font-size: 19px; }
    .nihao-mnav-btn:active { transform: scale(0.9); color: #6ee7b7; }
  }
`;

export function fireConfettiBurst() {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#10b981', '#fbbf24', '#38bdf8', '#f43f5e', '#a855f7'];
  const pieces = Array.from({ length: 65 }, () => ({
    x: canvas.width * (0.25 + Math.random() * 0.5),
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: -7 - Math.random() * 10,
    size: 6 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.28
  }));
  let frame = 0;
  function step() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.36;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 80);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (frame < 80) requestAnimationFrame(step);
    else canvas.remove();
  }
  requestAnimationFrame(step);
}

function showFloatingXp(amount) {
  if (typeof document === 'undefined' || !amount) return;
  const el = document.createElement('div');
  el.className = 'nihao-xp-pop';
  el.textContent = `+${amount} XP ⚡`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

export function initUxPolish(core) {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('nihao-ux-polish-css')) {
    const style = document.createElement('style');
    style.id = 'nihao-ux-polish-css';
    style.textContent = POLISH_CSS;
    document.head.appendChild(style);
  }

  // Ambient floating game particles
  if (!document.getElementById('nihao-ambient-layer')) {
    const layer = document.createElement('div');
    layer.id = 'nihao-ambient-layer';
    layer.className = 'nihao-ambient-layer';
    const colors = ['rgba(16,185,129,0.35)', 'rgba(251,191,36,0.35)', 'rgba(56,189,248,0.28)'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('div');
      s.className = 'nihao-spark';
      const sz = 5 + (i % 4) * 3;
      s.style.cssText = `left:${(i * 7.3) % 96}%;width:${sz}px;height:${sz}px;background:${colors[i % 3]};animation-duration:${10 + (i % 6) * 2.5}s;animation-delay:${-(i * 1.3)}s;`;
      layer.appendChild(s);
    }
    document.body.appendChild(layer);
  }

  // Cursor tap sparkle burst on button clicks
  if (!window._nihaoTapSparkBound) {
    window._nihaoTapSparkBound = true;
    document.addEventListener('pointerdown', (e) => {
      if (!e.target?.closest?.('button, .ss-card, .gr-card')) return;
      const ring = document.createElement('div');
      ring.className = 'nihao-tap-ring';
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 440);
    }, { passive: true });
  }

  window.NihaoConfetti = fireConfettiBurst;

  // Hook XP wins -> Floating "+XP!" popup + Confetti on big wins
  if (core && typeof core.addXp === 'function' && !core._polishXpHooked) {
    const origAddXp = core.addXp.bind(core);
    core.addXp = (amount, reason) => {
      const out = origAddXp(amount, reason);
      if (Number(amount) > 0) showFloatingXp(Number(amount));
      if (Number(amount) >= 20) fireConfettiBurst();
      return out;
    };
    core._polishXpHooked = true;
  }

  const PANDA_LINES = [
    { hz: '加油！你很棒！', th: 'สู้ๆ นะ คุณเก่งมาก!' },
    { hz: '今天也要学中文哦！', th: 'วันนี้ก็มาเรียนจีนกันนะ!' },
    { hz: '太厉害了！', th: 'สุดยอดไปเลย!' },
    { hz: '慢慢来，没关系！', th: 'ค่อยๆ ไป ไม่เป็นไรนะ!' },
    { hz: '你的发音越来越好！', th: 'ออกเสียงดีขึ้นเรื่อยๆ เลย!' }
  ];

  // Interactive Bobbing Panda Coach 🐼
  if (!document.getElementById('nihao-panda-coach')) {
    let idx = 0;
    const panda = document.createElement('div');
    panda.id = 'nihao-panda-coach';
    panda.className = 'nihao-panda-coach';
    const renderPanda = () => {
      const line = PANDA_LINES[idx % PANDA_LINES.length];
      panda.innerHTML = `<span style="font-size:24px">🐼</span><div><div class="hanzi-font" style="font-weight:700;color:#6ee7b7">${line.hz}</div><div style="opacity:0.85">${line.th}</div></div>`;
    };
    renderPanda();
    panda.title = 'แตะเพื่อฟังน้องแพนด้าให้กำลังใจเป็นภาษาจีน';
    panda.addEventListener('click', () => {
      const line = PANDA_LINES[idx % PANDA_LINES.length];
      core?.speak?.(line.hz);
      idx++;
      renderPanda();
    });
    document.body.appendChild(panda);
  }

  // Mount Floating ✨ AI Studio Quick-Launch Button
  if (!document.getElementById('nihao-fab-ai')) {
    const btn = document.createElement('button');
    btn.id = 'nihao-fab-ai';
    btn.type = 'button';
    btn.className = 'nihao-fab-ai';
    btn.innerHTML = '<span>✨</span><span>AI Studio</span>';
    btn.title = 'เปิด Flagship AI Studio (พอดแคสต์ · ภาพช่วยจำ · ซ่อมจุดอ่อน · การ์ดแชร์)';
    btn.addEventListener('click', () => {
      if (core?.switchTab) core.switchTab('ai-flagship-studio');
      else if (core?.setTab) core.setTab('ai-flagship-studio');
    });
    document.body.appendChild(btn);
  }

  // Mount Mobile Bottom Navigation Bar
  if (!document.getElementById('nihao-mobile-nav')) {
    const nav = document.createElement('nav');
    nav.id = 'nihao-mobile-nav';
    nav.className = 'nihao-mobile-nav';
    const items = [
      { tab: 'today', icon: '🏠', label: 'หน้าหลัก' },
      { tab: 'speak-studio', icon: '🎙️', label: 'ฝึกพูด' },
      { tab: 'ai-flagship-studio', icon: '✨', label: 'AI Studio' },
      { tab: 'panda-retention', icon: '🐼', label: 'แพนด้า' },
      { tab: 'vibe-focus-studio', icon: '🎧', label: 'กู่เจิง' }
    ];
    nav.innerHTML = items.map((it) => `<button type="button" class="nihao-mnav-btn" data-mtab="${it.tab}"><span>${it.icon}</span><span>${it.label}</span></button>`).join('');
    nav.querySelectorAll('[data-mtab]').forEach((b) => {
      b.addEventListener('click', () => {
        if (core?.switchTab) core.switchTab(b.dataset.mtab);
        else if (core?.setTab) core.setTab(b.dataset.mtab);
      });
    });
    document.body.appendChild(nav);
  }
}
