// #10 Global Display Mode (Pinyin+Hanzi / Hanzi only / Pinyin only / Character mode)
// Sets document.documentElement.dataset.pfDisplay and pf-mode-* / pf-hide-* classes.
// Emits core.emit('platform:display', { mode }) so other feature groups can respect it.

import { normalizeDisplayMode, nextDisplayMode } from './logic.js';

export const DISPLAY_MODE_META = {
  both: {
    id: 'both',
    short: '汉字+Py',
    label: 'อักษรจีน + พินอิน',
    desc: 'แสดงครบทั้งตัวจีนและพินอิน (ค่าเริ่มต้น)'
  },
  hanzi: {
    id: 'hanzi',
    short: '汉字',
    label: 'เฉพาะอักษรจีน',
    desc: 'ซ่อนพินอินเพื่อฝึกอ่านตัวอักษรจีนจริง'
  },
  pinyin: {
    id: 'pinyin',
    short: 'Pīnyīn',
    label: 'เฉพาะพินอิน',
    desc: 'ซ่อนอักษรจีนเพื่อโฟกัสการออกเสียงและวรรณยุกต์'
  },
  character: {
    id: 'character',
    short: 'แตะดู Py',
    label: 'Character Mode (แตะเพื่อดูพินอิน)',
    desc: 'ซ่อนพินอินไว้จนกว่าจะเอาเมาส์ชี้หรือแตะที่พินอิน'
  }
};

const ROOT_CLASSES = [
  'pf-mode-both',
  'pf-mode-hanzi',
  'pf-mode-pinyin',
  'pf-mode-character',
  'pf-hide-pinyin',
  'pf-hide-hanzi',
  'pf-char-mode'
];

export function initDisplayMode(core) {
  let currentMode = normalizeDisplayMode(core.getExt('platform')?.displayMode);
  let chipEl = null;

  function applyMode(mode, { persist = false, announce = false } = {}) {
    const valid = normalizeDisplayMode(mode);
    currentMode = valid;
    const root = document.documentElement;
    root.classList.remove(...ROOT_CLASSES);
    root.classList.add(`pf-mode-${valid}`);
    if (valid === 'hanzi') root.classList.add('pf-hide-pinyin');
    if (valid === 'pinyin') root.classList.add('pf-hide-hanzi');
    if (valid === 'character') root.classList.add('pf-char-mode');
    root.dataset.pfDisplay = valid;

    updateChip();
    core.emit('platform:display', { mode: valid });

    if (persist) {
      core.setExt('platform', { displayMode: valid }, { save: true, reason: 'display-mode' });
    }
    if (announce) {
      core.showToast(`โหมดการแสดงผล: ${DISPLAY_MODE_META[valid].label}`);
    }
  }

  function updateChip() {
    if (!chipEl) return;
    const meta = DISPLAY_MODE_META[currentMode];
    const labelSpan = chipEl.querySelector('.pf-chip-mode');
    if (labelSpan) labelSpan.textContent = meta.short;
    chipEl.setAttribute('aria-label', `สลับโหมดการแสดงผล (ปัจจุบัน: ${meta.label})`);
    chipEl.title = `${meta.label} — กดเพื่อสลับโหมด`;
  }

  function mountFloatingChip() {
    if (document.getElementById('pf-display-chip')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pf-display-chip';
    btn.className = 'pf-floating-chip';
    btn.innerHTML = `<span class="pf-chip-icon" aria-hidden="true">字</span><span class="pf-chip-mode"></span>`;
    btn.addEventListener('click', () => {
      const next = nextDisplayMode(currentMode);
      applyMode(next, { persist: true, announce: true });
    });
    document.body.appendChild(btn);
    chipEl = btn;
    updateChip();
  }

  // Tap-to-reveal support for Character mode on touch devices
  document.addEventListener('click', (e) => {
    if (currentMode !== 'character') return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const pyEl = target.closest(
      '.pinyin, .py, .vocab-pinyin, .vb-pinyin, .vb-row-pinyin, .vb-ex-py, .vb-modal-py, .fc-pinyin, .vsrs-fc-py, .vq-prompt-py, .vq-ch-py, .vq-wrong-py, .vst-line-py, .vcf-py, .tok-py, .chat-py, .example-pinyin, .podcast-word-py, .speaking-target-py, .writing-big-py, [data-pf-role="pinyin"]'
    );
    if (pyEl) {
      pyEl.classList.toggle('pf-revealed');
    }
  }, { passive: true });

  mountFloatingChip();
  applyMode(currentMode, { persist: false, announce: false });

  return {
    getMode: () => currentMode,
    setMode: (mode, opts = {}) => applyMode(mode, { persist: true, ...opts })
  };
}
