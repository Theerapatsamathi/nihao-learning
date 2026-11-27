// Zen Lofi Focus Mode (lofi.co style):
// - 4 Full-Screen Cozy Anime Chinese Lofi Scenes (sunset-room, night-city, starry-desk, rainy-tea)
// - 4 Canvas 60fps Floating Effects (fireflies, rain, petals, lanterns)
// - 4 Mixable Ambient Sound Engines (Guqin Pentatonic Lo-Fi, Soft Rain, Fireplace Crackle, Bamboo Wind)
// - True Distraction-Free Focus Mode: hides sidebar & topbar, floats study content in Frosted Glass

const SCENES = [
  { id: 'sunset-room', label: '🌇 ห้องเย็น', img: '/lofi/sunset-room.jpg', defaultFx: 'petals' },
  { id: 'night-city', label: '🌃 เมืองคืน', img: '/lofi/night-city.jpg', defaultFx: 'lanterns' },
  { id: 'starry-desk', label: '🌌 คืนดาวตก', img: '/lofi/starry-desk.jpg', defaultFx: 'fireflies' },
  { id: 'rainy-tea', label: '🌧️ ร้านชาฝนตก', img: '/lofi/rainy-tea.jpg', defaultFx: 'rain' }
];

const FX_MODES = [
  { id: 'fireflies', label: '✨ หิ่งห้อย' },
  { id: 'rain', label: '🌧️ ฝนโปรย' },
  { id: 'petals', label: '🌸 กลีบไม้' },
  { id: 'lanterns', label: '🏮 โคมลอย' }
];

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

const LOFI_CSS = `
  #nihao-lofi-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 500ms ease, background-image 600ms ease;
  }
  #nihao-lofi-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(15,23,42,0.18), rgba(15,23,42,0.58));
  }
  #nihao-lofi-fx {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    display: none;
  }
  body.nihao-lofi-active #nihao-lofi-bg { opacity: 1; }
  body.nihao-lofi-active #nihao-lofi-fx { display: block; }
  body.nihao-lofi-active aside,
  body.nihao-lofi-active .sidebar,
  body.nihao-lofi-active header,
  body.nihao-lofi-active .topbar,
  body.nihao-lofi-active .nihao-panda-coach,
  body.nihao-lofi-active .nihao-fab-ai {
    display: none !important;
  }
  body.nihao-lofi-active .app-shell,
  body.nihao-lofi-active #app,
  body.nihao-lofi-active .layout {
    display: block !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
    max-width: 100% !important;
    position: relative;
    z-index: 10;
    background: transparent !important;
  }
  body.nihao-lofi-active main {
    display: block !important;
    width: min(920px, 92vw) !important;
    max-width: 920px !important;
    margin: 28px auto 125px !important;
    padding: 24px !important;
    border-radius: 22px !important;
    background: rgba(15, 23, 42, 0.78) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(255,255,255,0.18) !important;
    box-shadow: 0 24px 60px rgba(0,0,0,0.45) !important;
    color: #f8fafc !important;
    transition: opacity 320ms ease, transform 320ms ease;
  }
  body.nihao-lofi-active.nihao-lofi-scenic main {
    opacity: 0 !important;
    pointer-events: none !important;
    transform: translateY(16px) scale(0.98) !important;
  }
  body.nihao-lofi-active main h1,
  body.nihao-lofi-active main h2,
  body.nihao-lofi-active main h3,
  body.nihao-lofi-active main h4,
  body.nihao-lofi-active main p,
  body.nihao-lofi-active main span,
  body.nihao-lofi-active main div {
    color: inherit;
  }
  body.nihao-lofi-active .card-panel,
  body.nihao-lofi-active .ss-card,
  body.nihao-lofi-active .gr-card {
    background: rgba(15, 23, 42, 0.72) !important;
    color: #f8fafc !important;
    border-color: rgba(255,255,255,0.16) !important;
  }
  #nihao-lofi-dock {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    z-index: 9995;
    display: none;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px;
    max-width: 95vw;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,0.2);
    box-shadow: 0 14px 40px rgba(0,0,0,0.5);
    color: #f8fafc;
  }
  body.nihao-lofi-active #nihao-lofi-dock { display: flex; }
  .lofi-pill {
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.08);
    color: #f8fafc;
    padding: 6px 11px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 140ms ease, background 160ms ease;
  }
  .lofi-pill:hover { background: rgba(255,255,255,0.18); transform: translateY(-1px); }
  .lofi-pill.on { background: linear-gradient(135deg, #10b981, #059669); border-color: #6ee7b7; }
  .lofi-pill.exit { background: rgba(239,68,68,0.85); border-color: #fca5a5; }
  .nihao-fab-lofi {
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 950;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 11px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.24);
    background: linear-gradient(135deg, #1e1b4b, #312e81 55%, #0f766e);
    color: #fff;
    font-weight: 800;
    font-size: 13.5px;
    cursor: pointer;
    box-shadow: 0 10px 26px rgba(30, 27, 75, 0.45);
    transition: transform 180ms ease;
  }
  .nihao-fab-lofi:hover { transform: translateY(-2px) scale(1.04); }
  body.nihao-lofi-active .nihao-fab-lofi { display: none; }
  @media (max-width: 768px) {
    .nihao-fab-lofi { bottom: 74px; left: 12px; padding: 9px 13px; font-size: 12.5px; }
    #nihao-lofi-dock { border-radius: 18px; bottom: 10px; }
  }
`;

function createAmbientSoundMixer() {
  let ctx = null;
  let master = null;
  const state = { guqin: false, rain: false, fire: false, wind: false };
  const nodes = { rain: null, fire: null, wind: null };
  let guqinTimer = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function makeNoiseLoop(type, freq, gainVal) {
    ensureCtx();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'fire') {
        ch[i] = Math.random() < 0.0025 ? (Math.random() * 2 - 1) * 1.4 : (last + 0.05 * w) / 1.05;
      } else {
        ch[i] = (last + 0.025 * w) / 1.025;
      }
      last = ch[i];
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'wind' ? 'bandpass' : 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    return src;
  }

  function pluckGuqin() {
    if (!state.guqin || !ctx) return;
    const now = ctx.currentTime;
    const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, now);
    lp.frequency.exponentialRampToValueAtTime(380, now + 2.6);
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.22, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    osc.connect(lp);
    lp.connect(env);
    env.connect(master);
    osc.start(now);
    osc.stop(now + 2.9);
    guqinTimer = setTimeout(pluckGuqin, 950 + Math.random() * 1400);
  }

  return {
    state,
    toggle(key) {
      state[key] = !state[key];
      if (key === 'guqin') {
        if (state.guqin) { ensureCtx(); pluckGuqin(); }
        else if (guqinTimer) { clearTimeout(guqinTimer); guqinTimer = null; }
      } else {
        if (nodes[key]) { try { nodes[key].stop(); } catch {} nodes[key] = null; }
        if (state[key]) {
          if (key === 'rain') nodes.rain = makeNoiseLoop('rain', 1000, 0.35);
          if (key === 'fire') nodes.fire = makeNoiseLoop('fire', 700, 0.45);
          if (key === 'wind') nodes.wind = makeNoiseLoop('wind', 420, 0.35);
        }
      }
      return state[key];
    },
    stopAll() {
      for (const k of Object.keys(state)) {
        if (state[k]) this.toggle(k);
      }
    }
  };
}

export function initZenLofiFocusMode() {
  if (typeof document === 'undefined' || document.getElementById('nihao-lofi-css')) return;

  const style = document.createElement('style');
  style.id = 'nihao-lofi-css';
  style.textContent = LOFI_CSS;
  document.head.appendChild(style);

  const bg = document.createElement('div');
  bg.id = 'nihao-lofi-bg';
  document.body.appendChild(bg);

  const fxCanvas = document.createElement('canvas');
  fxCanvas.id = 'nihao-lofi-fx';
  document.body.appendChild(fxCanvas);

  const dock = document.createElement('div');
  dock.id = 'nihao-lofi-dock';
  document.body.appendChild(dock);

  const mixer = createAmbientSoundMixer();
  let active = false;
  let scenicBreak = false;
  let sceneIdx = 0;
  let fxMode = 'fireflies';
  let rafId = null;
  let particles = [];
  let pomoSec = 25 * 60;
  let pomoRunning = false;
  let pomoTimer = null;
  let genBusy = false;

  function initParticles() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
    const count = fxMode === 'rain' ? 95 : 36;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * fxCanvas.width,
      y: Math.random() * fxCanvas.height,
      vx: fxMode === 'rain' ? -1.2 : (Math.random() - 0.5) * 0.8,
      vy: fxMode === 'rain' ? 11 + Math.random() * 6 : (fxMode === 'lanterns' ? -0.6 - Math.random() * 0.7 : 0.5 + Math.random() * 0.9),
      r: fxMode === 'lanterns' ? 6 + Math.random() * 5 : 2.5 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function animateFx() {
    if (!active) return;
    const ctx = fxCanvas.getContext('2d');
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += 0.04;
      if (p.y > fxCanvas.height + 15) { p.y = -10; p.x = Math.random() * fxCanvas.width; }
      if (p.y < -15) { p.y = fxCanvas.height + 10; p.x = Math.random() * fxCanvas.width; }
      if (p.x < -15) p.x = fxCanvas.width + 10;
      if (p.x > fxCanvas.width + 15) p.x = -10;

      if (fxMode === 'rain') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 3, p.y + 14);
        ctx.stroke();
      } else if (fxMode === 'petals') {
        ctx.fillStyle = 'rgba(251, 182, 206, 0.75)';
        ctx.beginPath();
        ctx.ellipse(p.x + Math.sin(p.phase) * 8, p.y, p.r + 2, p.r * 0.6, p.phase, 0, Math.PI * 2);
        ctx.fill();
      } else if (fxMode === 'lanterns') {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.r * 1.4, p.r * 1.9, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const glow = 0.4 + 0.55 * Math.sin(p.phase);
        ctx.fillStyle = `rgba(253, 224, 71, ${glow})`;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(p.phase) * 5, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    rafId = requestAnimationFrame(animateFx);
  }

  function applyScene(idx) {
    sceneIdx = idx % SCENES.length;
    const sc = SCENES[sceneIdx];
    bg.style.backgroundImage = `url('${sc.img}')`;
    fxMode = sc.defaultFx;
    initParticles();
    renderDock();
  }

  function fmtPomo(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderDock() {
    dock.innerHTML = `
      ${SCENES.map((s, i) => `<button type="button" class="lofi-pill ${i === sceneIdx ? 'on' : ''}" data-lsc="${i}">${s.label}</button>`).join('')}
      <button type="button" class="lofi-pill" id="lofi-gen-scene" ${genBusy ? 'disabled' : ''}>${genBusy ? '🎨 กำลังวาด...' : '🎨 เสกฉาก AI'}</button>
      <span style="opacity:0.35">|</span>
      ${FX_MODES.map((f) => `<button type="button" class="lofi-pill ${f.id === fxMode ? 'on' : ''}" data-lfx="${f.id}">${f.label}</button>`).join('')}
      <span style="opacity:0.35">|</span>
      <button type="button" class="lofi-pill ${mixer.state.guqin ? 'on' : ''}" data-lsnd="guqin">🎵 กู่เจิง</button>
      <button type="button" class="lofi-pill ${mixer.state.rain ? 'on' : ''}" data-lsnd="rain">🌧️ ฝน</button>
      <button type="button" class="lofi-pill ${mixer.state.fire ? 'on' : ''}" data-lsnd="fire">🔥 เตาผิง</button>
      <button type="button" class="lofi-pill ${mixer.state.wind ? 'on' : ''}" data-lsnd="wind">🌙 ลม</button>
      <span style="opacity:0.35">|</span>
      <button type="button" class="lofi-pill ${pomoRunning ? 'on' : ''}" id="lofi-pomo">⏱️ ${fmtPomo(pomoSec)}</button>
      <button type="button" class="lofi-pill ${scenicBreak ? 'on' : ''}" id="lofi-scenic">${scenicBreak ? '📖 กลับไปเรียน' : '👁️ พักสายตา'}</button>
      <button type="button" class="lofi-pill exit" id="lofi-exit">✕ ออก</button>
    `;
    dock.querySelectorAll('[data-lsc]').forEach((b) => b.addEventListener('click', () => applyScene(Number(b.dataset.lsc))));
    dock.querySelectorAll('[data-lfx]').forEach((b) => b.addEventListener('click', () => { fxMode = b.dataset.lfx; initParticles(); renderDock(); }));
    dock.querySelectorAll('[data-lsnd]').forEach((b) => b.addEventListener('click', () => { mixer.toggle(b.dataset.lsnd); renderDock(); }));
    dock.querySelector('#lofi-scenic')?.addEventListener('click', () => {
      scenicBreak = !scenicBreak;
      document.body.classList.toggle('nihao-lofi-scenic', scenicBreak);
      renderDock();
    });
    dock.querySelector('#lofi-pomo')?.addEventListener('click', () => {
      if (pomoRunning) {
        clearInterval(pomoTimer);
        pomoRunning = false;
      } else {
        pomoRunning = true;
        pomoTimer = setInterval(() => {
          pomoSec--;
          const btn = dock.querySelector('#lofi-pomo');
          if (btn) btn.textContent = `⏱️ ${fmtPomo(Math.max(0, pomoSec))}`;
          if (pomoSec <= 0) {
            clearInterval(pomoTimer);
            pomoRunning = false;
            pomoSec = 25 * 60;
            window.NihaoCore?.addXp?.(50, 'lofi-pomodoro');
            window.NihaoConfetti?.();
            renderDock();
          }
        }, 1000);
      }
      renderDock();
    });
    dock.querySelector('#lofi-gen-scene')?.addEventListener('click', async () => {
      const prompt = window.prompt('พิมพ์ฉาก Lofi ที่อยากให้ Imagen 3 วาดให้ (เช่น คาเฟ่หิมะตกที่ฮาร์บิน, ศาลาริมน้ำซูโจว):', 'Cozy rainy cafe in Shanghai at night, Makoto Shinkai anime film style');
      if (!prompt) return;
      genBusy = true;
      renderDock();
      try {
        const res = await fetch('/api/ai/imagen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, style: 'Makoto Shinkai ultra-detailed anime film background art, cinematic volumetric lighting, no text', aspectRatio: '16:9' })
        });
        const data = await res.json();
        if (data.ok && data.imageUrl) {
          bg.style.backgroundImage = `url('${data.imageUrl}')`;
        }
      } catch {}
      genBusy = false;
      renderDock();
    });
    dock.querySelector('#lofi-exit')?.addEventListener('click', () => setLofiActive(false));
  }

  function setLofiActive(on) {
    active = on;
    document.body.classList.toggle('nihao-lofi-active', on);
    if (on) {
      applyScene(sceneIdx);
      if (!mixer.state.guqin) mixer.toggle('guqin');
      renderDock();
      if (rafId) cancelAnimationFrame(rafId);
      animateFx();
    } else {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      mixer.stopAll();
    }
  }

  window.NihaoLofiMode = { enter: () => setLofiActive(true), exit: () => setLofiActive(false), toggle: () => setLofiActive(!active) };

  // Mount floating 🎧 Lofi Focus button on bottom-left
  const fab = document.createElement('button');
  fab.id = 'nihao-fab-lofi';
  fab.type = 'button';
  fab.className = 'nihao-fab-lofi';
  fab.innerHTML = '<span>🎧</span><span>Lofi Mode</span>';
  fab.title = 'เข้าโหมด Lofi เต็มจอ (ซ่อนเมนู + ฉากอนิเมะ + เสียงฝน/เตาผิง/กู่เจิง)';
  fab.addEventListener('click', () => setLofiActive(true));
  document.body.appendChild(fab);
}
