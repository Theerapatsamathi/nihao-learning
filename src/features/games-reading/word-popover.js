// Shared reusable tap-to-translate word popover for Stories, Scenes, and Podcast
import { isWordStarred, toggleStarWord, esc } from './utils.js';

let activePopoverEl = null;
let outsideClickHandler = null;
let keydownHandler = null;

export function closeWordPopover() {
  if (activePopoverEl) {
    activePopoverEl.remove();
    activePopoverEl = null;
  }
  if (outsideClickHandler) {
    document.removeEventListener('pointerdown', outsideClickHandler, true);
    outsideClickHandler = null;
  }
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }
}

/**
 * Open a tap-to-translate popover anchored near `anchorEl`.
 * `token` = { zh, py, th }
 */
export function openWordPopover(core, anchorEl, token) {
  if (!token || !token.zh || token.punct) return;
  closeWordPopover();

  const pop = document.createElement('div');
  pop.className = 'gr-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', `คำแปล ${token.zh}`);

  const renderContent = () => {
    const starred = isWordStarred(core, token.zh);
    pop.innerHTML = `
      <div class="gr-popover-head">
        <div>
          <div class="gr-popover-zh">${esc(core, token.zh)}</div>
          ${token.py ? `<div class="gr-popover-py">${esc(core, token.py)}</div>` : ''}
        </div>
        <button type="button" class="gr-popover-close" aria-label="ปิด">✕</button>
      </div>
      <div class="gr-popover-th">${esc(core, token.th || 'ไม่มีคำแปล')}</div>
      <div class="gr-popover-actions">
        <button type="button" class="btn-secondary gr-popover-btn" data-act="speak">🔊 ฟังเสียง</button>
        <button type="button" class="btn-secondary gr-popover-btn ${starred ? 'is-starred' : ''}" data-act="star">
          ${starred ? '⭐ บันทึกแล้ว' : '☆ บันทึกคำศัพท์'}
        </button>
      </div>
    `;

    pop.querySelector('.gr-popover-close')?.addEventListener('click', closeWordPopover);
    pop.querySelector('[data-act="speak"]')?.addEventListener('click', () => {
      core?.speak?.(token.zh);
    });
    pop.querySelector('[data-act="star"]')?.addEventListener('click', () => {
      const nowStarred = toggleStarWord(core, token.zh);
      core?.showToast?.(nowStarred ? `บันทึก "${token.zh}" ในรายการทบทวนแล้ว` : `นำ "${token.zh}" ออกจากรายการแล้ว`);
      renderContent();
    });
  };

  renderContent();
  document.body.appendChild(pop);
  activePopoverEl = pop;

  // Position near anchorEl while keeping inside viewport
  const rect = anchorEl?.getBoundingClientRect?.() || {
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    bottom: window.innerHeight / 2,
    width: 0
  };
  const popRect = pop.getBoundingClientRect();
  const margin = 10;
  let left = rect.left + rect.width / 2 - popRect.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - popRect.width - margin, left));

  let top = rect.bottom + 8;
  if (top + popRect.height > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - popRect.height - 8);
  }
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;

  // Play pronunciation gently on tap? Keep manual or optional; let's not auto-interrupt playback.
  outsideClickHandler = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorEl) {
      closeWordPopover();
    }
  };
  keydownHandler = (e) => {
    if (e.key === 'Escape') closeWordPopover();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', outsideClickHandler, true);
    document.addEventListener('keydown', keydownHandler, true);
  }, 0);
}

/**
 * Helper to render an array of authored tokens into tappable spans.
 */
export function renderTokensHtml(core, tokens, { showPinyin = false, sentenceIdx = 0 } = {}) {
  return tokens
    .map((t, ti) => {
      if (t.punct || !t.th) {
        return `<span class="gr-tok-punct" data-ti="${ti}">${esc(core, t.zh)}</span>`;
      }
      return `<button type="button" class="gr-tok" data-si="${sentenceIdx}" data-ti="${ti}" aria-label="${esc(core, t.zh)} ${esc(core, t.py || '')}">
        ${showPinyin && t.py ? `<span class="gr-tok-py">${esc(core, t.py)}</span>` : ''}
        <span class="gr-tok-zh">${esc(core, t.zh)}</span>
      </button>`;
    })
    .join('');
}
