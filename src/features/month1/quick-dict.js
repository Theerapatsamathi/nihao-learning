// In-App Quick Dictionary (press '/' from anywhere or click header search button)
import { searchDictionary } from './logic.js';

let modalEl = null;
let lastQuery = '';
let lexiconReady = false;

export function initQuickDictionary(core) {
  if (document.getElementById('m1-dict-trigger')) return;

  // Inject compact search trigger button into header-actions
  const actions = document.querySelector('.header-actions');
  if (actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'm1-dict-trigger';
    btn.className = 'header-icon-btn m1-dict-btn';
    btn.title = 'พจนานุกรมค้นด่วน (กด /)';
    btn.setAttribute('aria-label', 'เปิดพจนานุกรมค้นด่วน');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    btn.addEventListener('click', () => openQuickDict(core));
    actions.insertBefore(btn, actions.firstChild);
  }

  // Global '/' shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) {
      closeQuickDict();
      return;
    }
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      openQuickDict(core);
    }
  });
}

export function openQuickDict(core, initialQuery = '') {
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.className = 'm1-modal-backdrop';
    modalEl.id = 'm1-dict-backdrop';
    modalEl.innerHTML = `
      <div class="m1-modal" role="dialog" aria-modal="true" aria-label="พจนานุกรมค้นด่วน">
        <div class="m1-modal-head">
          <div>
            <h3 style="margin:0">🔍 พจนานุกรมค้นด่วน</h3>
            <div class="m1-muted" style="font-size:12px">พิมพ์ภาษาไทย, พินอิน (เช่น nihao) หรือตัวจีน · กด <kbd>/</kbd> ได้จากทุกหน้า</div>
          </div>
          <button type="button" class="btn-secondary" id="m1-dict-close">✕ ปิด</button>
        </div>
        <div class="m1-dict-bar">
          <input type="search" id="m1-dict-input" class="vb-search" placeholder="ค้นหา เช่น ชานม, xiexie, 你好, ราคา..." autocomplete="off">
        </div>
        <div id="m1-dict-stroke-box" class="m1-stroke-box" hidden></div>
        <div id="m1-dict-results" class="m1-dict-results"></div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeQuickDict(); });
    modalEl.querySelector('#m1-dict-close')?.addEventListener('click', closeQuickDict);
    const input = modalEl.querySelector('#m1-dict-input');
    input?.addEventListener('input', () => {
      lastQuery = input.value;
      renderResults(core, lastQuery);
    });
  }

  modalEl.hidden = false;
  const input = modalEl.querySelector('#m1-dict-input');
  if (input) {
    if (initialQuery) {
      input.value = initialQuery;
      lastQuery = initialQuery;
    }
    setTimeout(() => { input.focus(); input.select(); }, 30);
  }
  renderResults(core, lastQuery);

  // Lazy-load big lexicon in background for richer results
  if (!lexiconReady && typeof core.ensureLexiconLoaded === 'function') {
    core.ensureLexiconLoaded().then(() => {
      lexiconReady = true;
      if (modalEl && !modalEl.hidden && lastQuery) renderResults(core, lastQuery);
    });
  }
}

export function closeQuickDict() {
  if (modalEl) modalEl.hidden = true;
}

function renderResults(core, query) {
  if (!modalEl) return;
  const host = modalEl.querySelector('#m1-dict-results');
  const strokeBox = modalEl.querySelector('#m1-dict-stroke-box');
  if (strokeBox) strokeBox.hidden = true;
  if (!host) return;

  const q = String(query || '').trim();
  if (!q) {
    host.innerHTML = `
      <div class="m1-dict-empty">
        <div style="font-weight:600;margin-bottom:6px">ลองค้นหาคำที่ใช้บ่อยในเดือนแรก:</div>
        <div class="m1-chip-row">
          ${['你好', '谢谢', '多少钱', '奶茶', 'ชานม', 'ห้องน้ำ', 'nihao'].map(ex =>
            `<button type="button" class="m1-chip" data-q="${core.escapeHtml(ex)}">${core.escapeHtml(ex)}</button>`
          ).join('')}
        </div>
      </div>`;
    host.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      const inp = modalEl.querySelector('#m1-dict-input');
      if (inp) { inp.value = b.dataset.q; lastQuery = b.dataset.q; renderResults(core, lastQuery); }
    }));
    return;
  }

  const hits = searchDictionary(q, { vocabWords: core.allVocabWords || [], lexicon: core.lexicon || [] }, 24);
  if (!hits.length) {
    host.innerHTML = `<div class="m1-dict-empty">ไม่พบคำว่า "${core.escapeHtml(q)}" ลองพิมพ์สั้นลงหรือใช้พินอินไม่มีวรรณยุกต์</div>`;
    return;
  }

  host.innerHTML = hits.map((h, i) => `
    <div class="m1-dict-row">
      <div class="m1-dict-main">
        <div class="m1-dict-hz hanzi-font">${core.escapeHtml(h.hz)} <span class="m1-dict-py">${core.escapeHtml(h.py)}</span></div>
        <div class="m1-dict-th">${core.escapeHtml(h.th)}</div>
        ${h.extra ? `<div class="m1-dict-extra">💡 ${core.escapeHtml(h.extra)}</div>` : ''}
      </div>
      <div class="m1-dict-actions">
        <span class="m1-tag">${core.escapeHtml(h.tag)}</span>
        <button type="button" class="btn-secondary m1-mini-btn" data-act="speak" data-idx="${i}" title="ฟังเสียง">🔊</button>
        <button type="button" class="btn-secondary m1-mini-btn" data-act="stroke" data-idx="${i}" title="ดูลำดับขีด">✍️</button>
        <button type="button" class="btn-secondary m1-mini-btn" data-act="star" data-idx="${i}" title="บันทึกคำศัพท์">⭐</button>
      </div>
    </div>
  `).join('');

  host.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = hits[Number(btn.dataset.idx)];
      if (!item) return;
      if (btn.dataset.act === 'speak') {
        core.speak(item.hz);
      } else if (btn.dataset.act === 'stroke') {
        showStrokePreview(core, item.hz);
      } else if (btn.dataset.act === 'star') {
        core.setExt('month1', (cur) => {
          const saved = Array.isArray(cur.savedWords) ? cur.savedWords : [];
          if (!saved.some(x => x.hz === item.hz)) saved.push({ hz: item.hz, py: item.py, th: item.th });
          cur.savedWords = saved.slice(-100);
          return cur;
        }, { save: true, reason: `บันทึกคำศัพท์ ${item.hz}` });
        core.showToast(`บันทึก "${item.hz}" ไว้ทบทวนแล้ว ⭐`);
      }
    });
  });
}

export function showStrokePreview(core, text, targetContainer = null) {
  const box = targetContainer || modalEl?.querySelector('#m1-dict-stroke-box');
  if (!box) return;
  const chars = [...String(text || '')].filter(ch => /[\u4e00-\u9fff]/.test(ch)).slice(0, 4);
  if (!chars.length) return;
  box.hidden = false;
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong>✍️ ลำดับขีด: ${core.escapeHtml(chars.join(' '))}</strong>
      <button type="button" class="btn-secondary m1-mini-btn" id="m1-stroke-hide">ซ่อน</button>
    </div>
    <div class="m1-stroke-row">
      ${chars.map((c, i) => `<div class="m1-stroke-cell"><div id="m1-hw-${i}" class="m1-hw-box"></div><button type="button" class="btn-secondary m1-mini-btn" data-hw-anim="${i}">▶ เล่น</button></div>`).join('')}
    </div>
  `;
  box.querySelector('#m1-stroke-hide')?.addEventListener('click', () => { box.hidden = true; });

  if (typeof window.HanziWriter === 'undefined') {
    box.querySelector('.m1-stroke-row').innerHTML = `<div class="m1-muted">กำลังโหลดตัวแสดงลำดับขีด หรือเปิดแท็บ "ฝึกเขียนลำดับขีด"</div>`;
    return;
  }
  const writers = chars.map((ch, i) => {
    const el = box.querySelector(`#m1-hw-${i}`);
    if (!el) return null;
    try {
      const w = window.HanziWriter.create(el, ch, { width: 88, height: 88, padding: 6, showOutline: true, strokeAnimationSpeed: 1.2 });
      w.animateCharacter();
      return w;
    } catch { return null; }
  });
  box.querySelectorAll('[data-hw-anim]').forEach(b => {
    b.addEventListener('click', () => writers[Number(b.dataset.hwAnim)]?.animateCharacter());
  });
}
