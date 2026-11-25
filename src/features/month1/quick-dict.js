// In-App Quick Dictionary (press '/' from anywhere or click header search button)
// Upgraded with Pleco-style Handwriting Recognition Canvas (Gemini Vision + local stroke-count & shape matcher)
import { searchDictionary } from './logic.js';
import { HANZI_MNEMONICS } from './data-month1.js';

let modalEl = null;
let lastQuery = '';
let lexiconReady = false;

// Local stroke-count reference table for instant offline candidate suggestions while drawing
const STROKE_COUNT_CHARS = {
  1: ['一', '乙'],
  2: ['二', '十', '人', '入', '八', '九', '七', '几', '了', '力'],
  3: ['三', '大', '小', '口', '山', '女', '子', '上', '下', '个', '也'],
  4: ['水', '火', '木', '日', '月', '天', '太', '中', '不', '少', '五', '六'],
  5: ['白', '田', '目', '本', '出', '去', '生', '他', '们', '四'],
  6: ['好', '你', '她', '吃', '妈', '米', '有', '在', '再', '百'],
  7: ['我', '来', '没', '听', '见', '买', '吧', '冷', '坐'],
  8: ['学', '爸', '明', '朋', '林', '果', '国', '店'],
  9: ['茶', '是', '看', '说', '贵', '星', '昨天'[0]],
  10: ['家', '钱', '请', '读', '桌', '高', '爱']
};

export function suggestLocalHandwritingCandidates(strokeCount, mnemonics = HANZI_MNEMONICS) {
  const n = Math.max(1, Math.min(10, Number(strokeCount) || 1));
  const pool = [
    ...(STROKE_COUNT_CHARS[n] || []),
    ...(STROKE_COUNT_CHARS[n - 1] || []),
    ...(STROKE_COUNT_CHARS[n + 1] || [])
  ];
  const mnemMap = new Map(mnemonics.map(m => [m.hz, m]));
  const seen = new Set();
  const out = [];
  for (const ch of pool) {
    if (!ch || seen.has(ch)) continue;
    seen.add(ch);
    const info = mnemMap.get(ch);
    out.push({ hz: ch, py: info?.py || '', th: info?.th || 'แตะเพื่อค้นหา' });
    if (out.length >= 8) break;
  }
  return out;
}

export function initQuickDictionary(core) {
  if (document.getElementById('m1-dict-trigger')) return;

  const actions = document.querySelector('.header-actions');
  if (actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'm1-dict-trigger';
    btn.className = 'header-icon-btn m1-dict-btn';
    btn.title = 'พจนานุกรมค้นด่วน & วาดตัวจีน (กด /)';
    btn.setAttribute('aria-label', 'เปิดพจนานุกรมค้นด่วน');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    btn.addEventListener('click', () => openQuickDict(core));
    actions.insertBefore(btn, actions.firstChild);
  }

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
            <h3 style="margin:0">🔍 พจนานุกรมค้นด่วน & วาดมือค้นศัพท์</h3>
            <div class="m1-muted" style="font-size:12px">พิมพ์ไทย/พินอิน/จีน หรือกด <b>✍️ วาดตัวจีน</b> เมื่อเจอตัวที่อ่านไม่ออก · กด <kbd>/</kbd> ได้ทุกหน้า</div>
          </div>
          <button type="button" class="btn-secondary" id="m1-dict-close">✕ ปิด</button>
        </div>
        <div class="m1-dict-bar" style="display:flex;gap:8px">
          <input type="search" id="m1-dict-input" class="vb-search" style="flex:1" placeholder="ค้นหา เช่น ชานม, xiexie, 你好, ราคา..." autocomplete="off">
          <button type="button" class="btn-secondary" id="m1-dict-draw-toggle" style="white-space:nowrap">✍️ วาดตัวจีน</button>
        </div>
        <div id="m1-dict-draw-pad" class="m1-draw-pad-wrap" hidden>
          <canvas id="m1-dict-canvas" class="m1-draw-canvas" width="240" height="240"></canvas>
          <div style="flex:1;min-width:190px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px">
              <strong style="font-size:13px">วาดตัวจีน 1 ตัวด้วยนิ้ว / เมาส์</strong>
              <div style="display:flex;gap:4px">
                <button type="button" class="btn-secondary m1-mini-btn" id="m1-draw-undo">↶</button>
                <button type="button" class="btn-secondary m1-mini-btn" id="m1-draw-clear">ล้าง</button>
                <button type="button" class="btn-primary m1-mini-btn m1-ai-btn" id="m1-draw-ai">✨ AI จำแนก</button>
              </div>
            </div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:6px" id="m1-draw-status">ลากขีดในกรอบเพื่อดูตัวอักษรที่ใกล้เคียง:</div>
            <div class="m1-chip-row" id="m1-draw-cands"></div>
          </div>
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

    wireHandwritingPad(core, modalEl);
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

  if (!lexiconReady && typeof core.ensureLexiconLoaded === 'function') {
    core.ensureLexiconLoaded().then(() => {
      lexiconReady = true;
      if (modalEl && !modalEl.hidden && lastQuery) renderResults(core, lastQuery);
    });
  }
}

function wireHandwritingPad(core, root) {
  const padWrap = root.querySelector('#m1-dict-draw-pad');
  const toggleBtn = root.querySelector('#m1-dict-draw-toggle');
  const canvas = root.querySelector('#m1-dict-canvas');
  const candsEl = root.querySelector('#m1-draw-cands');
  const statusEl = root.querySelector('#m1-draw-status');
  const input = root.querySelector('#m1-dict-input');
  if (!canvas || !padWrap || !toggleBtn) return;

  const ctx = canvas.getContext('2d');
  const strokes = [];
  let cur = null;

  const redraw = () => {
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(225,29,72,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(120, 0); ctx.lineTo(120, 240);
    ctx.moveTo(0, 120); ctx.lineTo(240, 120);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    }
  };

  const renderCands = (list) => {
    if (!candsEl) return;
    candsEl.innerHTML = list.map(c =>
      `<button type="button" class="m1-chip hanzi-font" style="font-size:18px;font-weight:700;padding:5px 12px" data-pick-hz="${core.escapeHtml(c.hz)}" title="${core.escapeHtml(c.py)} · ${core.escapeHtml(c.th)}">${core.escapeHtml(c.hz)}</button>`
    ).join('');
    candsEl.querySelectorAll('[data-pick-hz]').forEach(b => b.addEventListener('click', () => {
      if (input) {
        input.value = (input.value || '') + b.dataset.pickHz;
        lastQuery = input.value;
        renderResults(core, lastQuery);
      }
    }));
  };

  const getPt = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rectLeft(r)) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height
    };
  };
  const rectLeft = (r) => r.left;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    cur = [getPt(e)];
    strokes.push(cur);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    e.preventDefault();
    cur.push(getPt(e));
    redraw();
  });
  const endStroke = () => {
    if (!cur) return;
    cur = null;
    if (strokes.length > 0) {
      if (statusEl) statusEl.textContent = `วาดแล้ว ${strokes.length} ขีด · แตะตัวอักษรเพื่อค้นหา หรือกด "✨ AI จำแนก"`;
      renderCands(suggestLocalHandwritingCandidates(strokes.length));
    }
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  toggleBtn.addEventListener('click', () => {
    padWrap.hidden = !padWrap.hidden;
    toggleBtn.classList.toggle('active', !padWrap.hidden);
    if (!padWrap.hidden) redraw();
  });

  root.querySelector('#m1-draw-undo')?.addEventListener('click', () => {
    strokes.pop();
    redraw();
    renderCands(strokes.length ? suggestLocalHandwritingCandidates(strokes.length) : []);
  });
  root.querySelector('#m1-draw-clear')?.addEventListener('click', () => {
    strokes.length = 0;
    redraw();
    renderCands([]);
    if (statusEl) statusEl.textContent = 'ลากขีดในกรอบเพื่อดูตัวอักษรที่ใกล้เคียง:';
  });
  root.querySelector('#m1-draw-ai')?.addEventListener('click', async (e) => {
    if (!strokes.length) return core.showToast('วาดตัวจีนลงในกรอบก่อนกดจำแนกครับ');
    const btn = e.currentTarget;
    btn.disabled = true;
    if (statusEl) statusEl.textContent = '🔍 Gemini Vision กำลังอ่านลายมือ...';
    try {
      const image = canvas.toDataURL('image/png');
      const res = await core.api('/api/ai/vision', { mode: 'recognize', image, strokeCount: strokes.length }, 'POST');
      if (res.ok && Array.isArray(res.data?.candidates) && res.data.candidates.length) {
        if (statusEl) statusEl.textContent = '✨ ผลจำแนกจาก AI (แตะเพื่อค้นหาคำแปล):';
        renderCands(res.data.candidates);
      } else {
        if (statusEl) statusEl.textContent = `ตัวเลือกตามจำนวนขีด (${strokes.length} ขีด):`;
        renderCands(suggestLocalHandwritingCandidates(strokes.length));
      }
    } finally {
      btn.disabled = false;
    }
  });
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
        <div style="font-weight:600;margin-bottom:6px">ลองค้นหาคำที่ใช้บ่อย หรือกด <b>✍️ วาดตัวจีน</b> ด้านบน:</div>
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
