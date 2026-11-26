// UX/UI Enhancements: Tone-Colored Pinyin, Reading Comfort, Mobile Bottom Nav, Mic Wave & Live 95% HUD

const TONE_1_RE = /[āēīōūǖĀĒĪŌŪǕ]/;
const TONE_2_RE = /[áéíóúǘÁÉÍÓÚǗ]/;
const TONE_3_RE = /[ǎěǐǒǔǚǍĚǏǑǓǙ]/;
const TONE_4_RE = /[àèìòùǜÀÈÌÒÙǛ]/;

function escapeHtmlBasic(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function detectPinyinTone(syllable = '') {
  const s = String(syllable);
  if (TONE_1_RE.test(s)) return 1;
  if (TONE_2_RE.test(s)) return 2;
  if (TONE_3_RE.test(s)) return 3;
  if (TONE_4_RE.test(s)) return 4;
  return 0;
}

/**
 * Wraps each Pinyin syllable in a tone-colored span (tone-1..tone-4, tone-0).
 * Controlled visually via `.ux-tone-colors` class on <html>.
 */
export function colorizePinyin(pinyin = '') {
  const raw = String(pinyin ?? '');
  if (!raw.trim()) return '';
  return raw
    .split(/(\s+|[.,!?;:/()\-—·]+)/)
    .map(tok => {
      if (!tok || /^(\s+|[.,!?;:/()\-—·]+)$/.test(tok)) return escapeHtmlBasic(tok);
      const tone = detectPinyinTone(tok);
      return `<span class="ux-tone ux-tone-${tone}">${escapeHtmlBasic(tok)}</span>`;
    })
    .join('');
}

export function isToneColorsEnabled() {
  try {
    const v = localStorage.getItem('nihao_tone_colors');
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setToneColorsEnabled(enabled) {
  const on = Boolean(enabled);
  try { localStorage.setItem('nihao_tone_colors', on ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('ux-tone-colors', on);
  }
  return on;
}

export function isLargeHanziEnabled() {
  try {
    return localStorage.getItem('nihao_large_hanzi') === '1';
  } catch {
    return false;
  }
}

export function setLargeHanziEnabled(enabled) {
  const on = Boolean(enabled);
  try { localStorage.setItem('nihao_large_hanzi', on ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('ux-large-hanzi', on);
  }
  return on;
}

export function renderMicWaveHtml(active = false) {
  if (!active) return '';
  return `
    <div class="ux-mic-wave" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span>
    </div>
  `;
}

export function renderLiveScoreHud({ earned = 0, total = 20, passPct = 95, label = 'คะแนนสะสม' }) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const pct = Math.round((earned / safeTotal) * 100);
  const reached = pct >= passPct;
  return `
    <div class="ux-live-hud ${reached ? 'is-pass' : ''}">
      <div class="ux-live-hud-top">
        <span>${escapeHtmlBasic(label)}</span>
        <strong class="tabular-nums">${earned}/${safeTotal} (${pct}%) ${reached ? '✅ ถึงเกณฑ์แล้ว!' : `· เป้า ≥ ${passPct}%`}</strong>
      </div>
      <div class="ux-live-bar">
        <div class="ux-live-fill" style="width:${Math.min(100, pct)}%"></div>
        <div class="ux-live-marker" style="left:${passPct}%" title="เกณฑ์ผ่าน ${passPct}%"></div>
      </div>
    </div>
  `;
}

/**
 * Mounts header Tone-Color toggle button & Mobile Bottom Navigation Bar.
 */
export function initUxEnhancements(core) {
  if (typeof document === 'undefined') return;
  setToneColorsEnabled(isToneColorsEnabled());
  setLargeHanziEnabled(isLargeHanziEnabled());

  // 1. Add Tone Color Toggle button to header-actions (next to theme-toggle)
  const headerActions = document.querySelector('.header-actions');
  if (headerActions && !document.getElementById('ux-tone-toggle')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'ux-tone-toggle';
    btn.className = 'header-icon-btn ux-tone-btn';
    btn.title = 'เปิด/ปิดสีวรรณยุกต์พินอิน (Tone Colors)';
    btn.setAttribute('aria-label', 'เปิด/ปิดสีวรรณยุกต์พินอิน');
    const syncBtn = () => {
      const on = isToneColorsEnabled();
      btn.classList.toggle('is-on', on);
      btn.innerHTML = `<span style="font-size:13px;font-weight:800;letter-spacing:-0.5px">${on ? '🎨' : 'Aa'}</span>`;
    };
    syncBtn();
    btn.addEventListener('click', () => {
      const next = setToneColorsEnabled(!isToneColorsEnabled());
      syncBtn();
      core?.showToast?.(next ? '🎨 เปิดสีแยก 4 วรรณยุกต์แล้ว' : 'ปิดสีแยกวรรณยุกต์แล้ว');
    });
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn && themeBtn.parentNode === headerActions) {
      headerActions.insertBefore(btn, themeBtn);
    } else {
      headerActions.appendChild(btn);
    }
  }

  // 2. Mount Mobile Bottom Navigation Bar (Thumb-Zone)
  if (!document.getElementById('ux-bottom-nav')) {
    const nav = document.createElement('nav');
    nav.id = 'ux-bottom-nav';
    nav.className = 'ux-bottom-nav';
    nav.setAttribute('aria-label', 'เมนูหลักมือถือ');
    const items = [
      { tab: 'today', icon: '🏠', label: 'วันนี้' },
      { tab: 'month1', icon: '🗺️', label: '90 วัน' },
      { tab: 'speak-studio', icon: '🎙️', label: 'ฝึกพูด' },
      { tab: 'vocab', icon: '📚', label: 'คลังศัพท์' },
      { tab: 'profile', icon: '🏆', label: 'สถิติ' }
    ];
    nav.innerHTML = items.map(it => `
      <button type="button" class="ux-bnav-btn" data-bnav-tab="${it.tab}">
        <span class="ux-bnav-ico">${it.icon}</span>
        <span class="ux-bnav-lbl">${it.label}</span>
      </button>
    `).join('');

    const syncActive = (activeTab) => {
      nav.querySelectorAll('.ux-bnav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.bnavTab === activeTab);
      });
    };

    nav.querySelectorAll('.ux-bnav-btn').forEach(b => {
      b.addEventListener('click', () => {
        const t = b.dataset.bnavTab;
        if (core && typeof core.switchTab === 'function') {
          core.switchTab(t);
          syncActive(t);
          window.scrollTo?.({ top: 0, behavior: 'smooth' });
        }
      });
    });

    document.body.appendChild(nav);

    // Sync active state when sidebar tabs are clicked
    document.addEventListener('click', (e) => {
      const link = e.target?.closest?.('.nav-link[data-tab]');
      if (link?.dataset?.tab) syncActive(link.dataset.tab);
    });
    if (core && typeof core.on === 'function') {
      core.on('tab-changed', (tabId) => syncActive(tabId));
    }
    syncActive('today');
  }

  // 3. Global Auto Tone-Coloring for Pinyin elements across all tabs
  const PY_SELECTORS = '.m1-py, .m1-dict-py, .m1-tile-py, .py, .pinyin, .vocab-py, .example-py, .pair-py, .inspector-reading, .tone-pinyin';
  const applyToneColorsToDom = () => {
    document.querySelectorAll(PY_SELECTORS).forEach((el) => {
      if (el.dataset.uxToneDone === '1' || el.querySelector('.ux-tone')) return;
      if (el.children.length > 0) return;
      const txt = el.textContent || '';
      if (!/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(txt)) return;
      el.innerHTML = colorizePinyin(txt);
      el.dataset.uxToneDone = '1';
    });
  };
  applyToneColorsToDom();
  if (!window.__nihaoToneObserver) {
    let timer = null;
    window.__nihaoToneObserver = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(applyToneColorsToDom, 80);
    });
    window.__nihaoToneObserver.observe(document.body, { childList: true, subtree: true });
  }
}
