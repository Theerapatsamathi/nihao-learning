// Silky UX Polish Pack:
// - Spring button press, smooth card hover lift, fade-up animations, shimmer skeletons
// - Lightweight Canvas Confetti celebration on big XP / exam pass
// - Floating ✨ AI Studio quick-launch button

const POLISH_CSS = `
  .btn-primary, .btn-secondary, .ss-card, .gr-card, .card-panel, .pf-mode-btn {
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
                background-color 180ms ease,
                border-color 180ms ease;
  }
  .btn-primary:active, .btn-secondary:active, .pf-mode-btn:active {
    transform: scale(0.96);
  }
  .ss-scenario-card:hover, .gr-card-click:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  }
  @keyframes nihaoFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ss-card, .gr-card, .card-panel {
    animation: nihaoFadeUp 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
    border: 1px solid rgba(255,255,255,0.22);
    background: linear-gradient(135deg, #0f766e, #059669 55%, #d97706);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 10px 28px rgba(5, 150, 105, 0.38);
    transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease;
  }
  .nihao-fab-ai:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 34px rgba(5, 150, 105, 0.48);
  }
  .nihao-fab-ai:active {
    transform: scale(0.95);
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
  const pieces = Array.from({ length: 55 }, () => ({
    x: canvas.width * (0.3 + Math.random() * 0.4),
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 9,
    size: 6 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.25
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
      ctx.globalAlpha = Math.max(0, 1 - frame / 75);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (frame < 75) requestAnimationFrame(step);
    else canvas.remove();
  }
  requestAnimationFrame(step);
}

export function initUxPolish(core) {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('nihao-ux-polish-css')) {
    const style = document.createElement('style');
    style.id = 'nihao-ux-polish-css';
    style.textContent = POLISH_CSS;
    document.head.appendChild(style);
  }

  window.NihaoConfetti = fireConfettiBurst;

  // Hook big XP wins (>= 20 XP) to fire celebratory confetti
  if (core && typeof core.addXp === 'function' && !core._polishXpHooked) {
    const origAddXp = core.addXp.bind(core);
    core.addXp = (amount, reason) => {
      const out = origAddXp(amount, reason);
      if (Number(amount) >= 20) fireConfettiBurst();
      return out;
    };
    core._polishXpHooked = true;
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
}
