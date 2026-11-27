// Vibe Studio:
// 1) 🎧 Chinese Guqin / Pentatonic Lo-Fi Focus Radio + Soft Rain + Pomodoro Timer (Web Audio API)
// 2) 🎨 4 Chinese World Themes (Jade, Lantern, Shanghai Cyber, Ink Minimal)
// 3) ⚡ Ctrl+K Quick Command Palette & Instant Tab/Vocab Jump

import { fireConfettiBurst } from './ux-polish.js';

const THEME_KEY = 'nihao_world_theme_v1';

const THEMES = {
  default: {
    name: '⚪ ธีมปกติ (Original)',
    accent: '#2563eb',
    css: ''
  },
  jade: {
    name: '💚 หยกจักรพรรดิ',
    accent: '#10b981',
    css: `
      .card-panel, .ss-card, .gr-card { border-color: rgba(16,185,129,0.38) !important; box-shadow: 0 6px 22px rgba(16,185,129,0.12) !important; }
      .btn-primary { background: linear-gradient(135deg, #059669, #10b981) !important; }
      .nihao-spark { background: radial-gradient(circle, #34d399, #fbbf24) !important; opacity: 0.65 !important; }
    `
  },
  lantern: {
    name: '🏮 โคมแดงตรุษจีน',
    accent: '#dc2626',
    css: `
      .card-panel, .ss-card, .gr-card { border-color: rgba(239,68,68,0.35) !important; box-shadow: 0 6px 22px rgba(220,38,38,0.12) !important; }
      .btn-primary { background: linear-gradient(135deg, #dc2626, #d97706) !important; }
      .nihao-spark { background: radial-gradient(circle, #fbbf24, #ef4444) !important; opacity: 0.75 !important; }
    `
  },
  cyber: {
    name: '🌃 เซี่ยงไฮ้ไซเบอร์',
    accent: '#06b6d4',
    css: `
      .card-panel, .ss-card, .gr-card { border-color: rgba(6,182,212,0.42) !important; box-shadow: 0 6px 22px rgba(139,92,246,0.14) !important; }
      .btn-primary { background: linear-gradient(135deg, #06b6d4, #8b5cf6) !important; }
      .nihao-spark { background: radial-gradient(circle, #22d3ee, #e879f9) !important; opacity: 0.75 !important; }
    `
  },
  ink: {
    name: '🖌️ หมึกพู่กันมินิมอล',
    accent: '#475569',
    css: `
      .card-panel, .ss-card, .gr-card { border-color: rgba(100,116,139,0.32) !important; }
      .btn-primary { background: linear-gradient(135deg, #334155, #0f172a) !important; }
      .nihao-spark { background: radial-gradient(circle, #94a3b8, #cbd5e1) !important; opacity: 0.5 !important; }
    `
  }
};

// Chinese Gong Pentatonic Frequencies (C4, D4, E4, G4, A4, C5, D5, E5, G5)
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

function createGuqinLofiEngine() {
  let ctx = null;
  let masterGain = null;
  let playing = false;
  let rainOn = false;
  let rainNode = null;
  let rainGain = null;
  let noteTimer = null;
  let volume = 0.35;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function pluckNote(freq, dur = 2.6, amp = 0.22) {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + dur);

    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(amp, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(masterGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + dur + 0.05);
    osc2.stop(now + dur + 0.05);
  }

  function scheduleNext() {
    if (!playing) return;
    const base = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    pluckNote(base, 2.8, 0.2);
    if (Math.random() < 0.35) {
      setTimeout(() => { if (playing) pluckNote(base * 0.5, 3.4, 0.12); }, 320);
    }
    const gap = 900 + Math.random() * 1400;
    noteTimer = setTimeout(scheduleNext, gap);
  }

  function setRain(on) {
    rainOn = on;
    if (!on) {
      if (rainNode) { try { rainNode.stop(); } catch {} rainNode = null; }
      return;
    }
    ensureCtx();
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 1.8;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.28;
    src.connect(lp);
    lp.connect(rainGain);
    rainGain.connect(masterGain);
    src.start();
    rainNode = src;
  }

  return {
    isPlaying: () => playing,
    isRainOn: () => rainOn,
    start() {
      ensureCtx();
      if (playing) return;
      playing = true;
      scheduleNext();
    },
    stop() {
      playing = false;
      if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
      setRain(false);
    },
    toggleRain() { setRain(!rainOn); return rainOn; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v)));
      if (masterGain) masterGain.gain.value = volume;
    }
  };
}

const audioEngine = createGuqinLofiEngine();

export function applyWorldTheme(themeId) {
  const id = THEMES[themeId] ? themeId : 'jade';
  try { localStorage.setItem(THEME_KEY, id); } catch {}
  document.documentElement.dataset.nihaoTheme = id;
  let styleEl = document.getElementById('nihao-world-theme-css');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'nihao-world-theme-css';
    document.head.appendChild(styleEl);
  }
  const t = THEMES[id];
  styleEl.textContent = t.css || '';
  return id;
}

export function initVibeAndCommandPalette(core) {
  if (typeof document === 'undefined') return;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) applyWorldTheme(saved);
  } catch {}

  // Ctrl+K Quick Command Palette
  if (!window._nihaoCmdKBound) {
    window._nihaoCmdKBound = true;
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCommandPalette(core);
      }
    });
  }
}

export function openCommandPalette(core) {
  const existing = document.getElementById('nihao-cmdk-modal');
  if (existing) { existing.remove(); return; }
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  const quickTabs = [
    { id: 'ai-flagship-studio', label: '✨ AI Studio (Podcast · ภาพช่วยจำ · ข่าวจีน · แร็ป)' },
    { id: 'panda-retention', label: '🎋 สวนแพนด้า · สปรินต์ 60 วิ · กล่องสุ่ม · พาสปอร์ต' },
    { id: 'viral-chinese-lab', label: '🏮 ชื่อจีนมงคล · แชท WeChat · แกะเพลง · ใบเกียรติบัตร' },
    { id: 'china-fun-hub', label: '🔮 เซียมซีจีน · สั่งอาหาร ¥100 · นักสืบ · การ์ดเอาตัวรอด' },
    { id: 'vibe-focus-studio', label: '🎧 เพลงกู่เจิง Lo-Fi · Pomodoro · เปลี่ยนธีมโลกจีน' },
    { id: 'settings-plus', label: '⚙️ ตั้งค่า & โหมดออฟไลน์' }
  ];

  const modal = document.createElement('div');
  modal.id = 'nihao-cmdk-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9990;background:rgba(15,23,42,0.58);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh';
  modal.innerHTML = `
    <div style="width:min(540px,92vw);background:#0f172a;color:#f8fafc;border-radius:18px;padding:16px;border:1px solid rgba(110,231,183,0.3);box-shadow:0 24px 60px rgba(0,0,0,0.45)">
      <input id="cmdk-in" placeholder="พิมพ์ค้นหาเมนู หรือกระโดดไปฟีเจอร์... (ESC ปิด)" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:#fff;font-size:15px;outline:none" />
      <div id="cmdk-list" style="margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const inp = modal.querySelector('#cmdk-in');
  const list = modal.querySelector('#cmdk-list');

  function renderList(q = '') {
    const query = q.trim().toLowerCase();
    const hits = quickTabs.filter((t) => !query || t.label.toLowerCase().includes(query) || t.id.includes(query));
    list.innerHTML = hits.map((t) => `
      <button type="button" class="cmdk-item" data-tab="${esc(t.id)}" style="text-align:left;padding:10px 12px;border-radius:10px;border:none;background:rgba(255,255,255,0.07);color:#f8fafc;cursor:pointer;font-size:14px">
        ${esc(t.label)}
      </button>
    `).join('') || '<div style="opacity:0.6;padding:10px">ไม่พบเมนูที่ค้นหา</div>';
    list.querySelectorAll('.cmdk-item').forEach((b) => {
      b.addEventListener('click', () => {
        if (core?.switchTab) core.switchTab(b.dataset.tab);
        else if (core?.setTab) core.setTab(b.dataset.tab);
        modal.remove();
      });
    });
  }

  renderList();
  inp.focus();
  inp.addEventListener('input', () => renderList(inp.value));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.remove(); });
}

export function renderVibeStudio(core, host) {
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  let pomoSec = 25 * 60;
  let pomoRunning = false;
  let pomoTimer = null;
  let currentTheme = document.documentElement.dataset.nihaoTheme || 'jade';

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    host.innerHTML = `
      <div class="pf-grid">
        <!-- 🎧 Guqin Lo-Fi Focus Radio -->
        <section class="card-panel pf-card" style="background:linear-gradient(135deg,rgba(15,23,42,0.92),rgba(19,78,74,0.92));color:#f8fafc">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title" style="color:#6ee7b7">🎧 วิทยุกู่เจิง Lo-Fi จีน (Focus Radio)</h2>
              <p class="pf-card-desc" style="color:#cbd5e1">เสียงพิณจีนเพนทาโทนิก (宫商角徵羽) คลอเบาๆ สร้าง Vibe อ่านหนังสือระดับพรีเมียม</p>
            </div>
            <span class="pf-badge">${audioEngine.isPlaying() ? '🎵 กำลังเล่น' : '⏸️ พักอยู่'}</span>
          </div>
          <div class="ss-actions" style="margin-top:12px;flex-wrap:wrap;gap:8px">
            <button type="button" class="btn-primary" id="vs-play">${audioEngine.isPlaying() ? '⏹️ หยุดเพลงกู่เจิง' : '▶️ เปิดเพลงกู่เจิง Lo-Fi'}</button>
            <button type="button" class="btn-secondary" id="vs-rain">${audioEngine.isRainOn() ? '🌧️ ปิดเสียงฝนตก' : '🌧️ เพิ่มเสียงฝนตกเบาๆ'}</button>
          </div>
          <div style="margin-top:12px;display:flex;align-items:center;gap:10px">
            <span style="font-size:12px;opacity:0.85">🔊 ความดัง:</span>
            <input type="range" id="vs-vol" min="0" max="1" step="0.05" value="0.35" style="flex:1" />
          </div>
        </section>

        <!-- ⏱️ Pomodoro Focus Timer -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">⏱️ นาฬิกาโฟกัส Pomodoro</h2>
              <p class="pf-card-desc">ตั้งใจเรียนจนครบเวลา รับโบนัส <strong>+50 XP ⚡</strong> พร้อมพลุฉลอง!</p>
            </div>
          </div>
          <div style="text-align:center;margin:12px 0">
            <div id="vs-clock" style="font-size:3rem;font-weight:900;letter-spacing:2px;color:#0f766e">${fmtTime(pomoSec)}</div>
            <div class="ss-actions" style="justify-content:center;margin-top:10px;gap:8px">
              <button type="button" class="btn-primary" id="vs-pomo-toggle">${pomoRunning ? '⏸️ พักเวลา' : '🚀 เริ่มโฟกัส'}</button>
              <button type="button" class="btn-secondary vs-preset" data-min="5">5 นาที</button>
              <button type="button" class="btn-secondary vs-preset" data-min="15">15 นาที</button>
              <button type="button" class="btn-secondary vs-preset" data-min="25">25 นาที</button>
            </div>
          </div>
        </section>

        <!-- 🎨 4 Chinese World Themes -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">🎨 เปลี่ยนธีมโลกจีน 4 สไตล์</h2>
              <p class="pf-card-desc">เลือกบรรยากาศที่คุณชอบได้ทันที (และกด <code>Ctrl+K</code> เพื่อค้นหาด่วนได้จากทุกหน้า)</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
            ${Object.entries(THEMES).map(([id, t]) => `
              <button type="button" class="btn-secondary vs-theme ${currentTheme === id ? 'is-active' : ''}" data-tid="${id}">${esc(t.name)}</button>
            `).join('')}
          </div>
          <button type="button" class="btn-secondary" id="vs-open-cmdk" style="margin-top:10px;width:100%">⚡ เปิดหน้าต่างค้นหาด่วน (Ctrl+K)</button>
        </section>
      </div>
    `;

    host.querySelector('#vs-play')?.addEventListener('click', () => {
      if (audioEngine.isPlaying()) audioEngine.stop();
      else audioEngine.start();
      render();
    });

    host.querySelector('#vs-rain')?.addEventListener('click', () => {
      audioEngine.toggleRain();
      render();
    });

    host.querySelector('#vs-vol')?.addEventListener('input', (e) => {
      audioEngine.setVolume(e.target.value);
    });

    host.querySelector('#vs-pomo-toggle')?.addEventListener('click', () => {
      if (pomoRunning) {
        clearInterval(pomoTimer);
        pomoRunning = false;
      } else {
        pomoRunning = true;
        pomoTimer = setInterval(() => {
          pomoSec--;
          const clk = host.querySelector('#vs-clock');
          if (clk) clk.textContent = fmtTime(Math.max(0, pomoSec));
          if (pomoSec <= 0) {
            clearInterval(pomoTimer);
            pomoRunning = false;
            pomoSec = 25 * 60;
            core?.addXp?.(50, 'pomodoro-focus');
            fireConfettiBurst();
            core?.showToast?.('🎉 โฟกัสครบเวลาแล้ว! รับโบนัส +50 XP', 'FOCUS');
            render();
          }
        }, 1000);
      }
      render();
    });

    host.querySelectorAll('.vs-preset').forEach((b) => {
      b.addEventListener('click', () => {
        if (pomoTimer) clearInterval(pomoTimer);
        pomoRunning = false;
        pomoSec = Number(b.dataset.min) * 60;
        render();
      });
    });

    host.querySelectorAll('.vs-theme').forEach((b) => {
      b.addEventListener('click', () => {
        currentTheme = applyWorldTheme(b.dataset.tid);
        core?.showToast?.(`เปลี่ยนธีมเป็น ${THEMES[currentTheme].name} แล้ว`, 'THEME');
        render();
      });
    });

    host.querySelector('#vs-open-cmdk')?.addEventListener('click', () => openCommandPalette(core));
  }

  render();
}
