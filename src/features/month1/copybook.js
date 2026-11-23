// Chinese Copybook Worksheet (สมุดคัดลายมือ 田字格 / 米字格)
// Supports Apple Pencil / Stylus / Touch / Mouse via Pointer Events, custom text, A4 Print, and PNG export.
import { HANZI_MNEMONICS } from './data-month1.js';

const PRESET_DECKS = [
  { id: 'numbers', label: 'ตัวเลข 1–10', chars: '一二三四五六七八九十' },
  { id: 'greet', label: 'ทักทายพื้นฐาน', chars: '你好谢谢再见对不起' },
  { id: 'nature', label: 'ธรรมชาติ', chars: '日月水火山木林森' },
  { id: 'people', label: 'คน & ครอบครัว', chars: '人大口女子好家爸爸妈妈' },
  { id: 'food', label: 'กิน & ชานม', chars: '吃喝茶米饭菜奶茶' },
  { id: 'month1-1', label: 'เดือนแรก ชุด 1', chars: HANZI_MNEMONICS.slice(0, 12).map(x => x.hz).join('') },
  { id: 'month1-2', label: 'เดือนแรก ชุด 2', chars: HANZI_MNEMONICS.slice(12, 24).map(x => x.hz).join('') }
];

const cbState = {
  deckId: 'greet',
  customText: '',
  cols: 6,          // practice boxes per character row
  gridType: 'mi',   // 'tian' (田字格) | 'mi' (米字格)
  traceMode: 'half', // 'all' | 'half' | 'none'
  inkColor: '#111827',
  penWidth: 4.5,
  cellSize: 84
};

const mnemonicMap = new Map(HANZI_MNEMONICS.map(m => [m.hz, m]));

export function extractChineseChars(str, maxChars = 16) {
  const out = [];
  const seen = new Set();
  for (const ch of String(str || '')) {
    if (/[\u4e00-\u9fff]/.test(ch) && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
      if (out.length >= maxChars) break;
    }
  }
  return out;
}

export function renderCopybookTab(core, host) {
  if (!host) return;
  const activeText = cbState.customText.trim()
    ? cbState.customText
    : (PRESET_DECKS.find(d => d.id === cbState.deckId)?.chars || PRESET_DECKS[0].chars);
  const chars = extractChineseChars(activeText, 12);

  // Track strokes per cell key ("row-col") for Undo / Clear
  const cellControllers = new Map();

  host.innerHTML = `
    <div class="card-panel m1-cb-toolbar">
      <div class="m1-cb-row">
        <div class="m1-chip-row">
          ${PRESET_DECKS.map(d => `
            <button type="button" class="m1-chip ${!cbState.customText && cbState.deckId === d.id ? 'active' : ''}" data-cb-deck="${d.id}">${core.escapeHtml(d.label)}</button>
          `).join('')}
        </div>
      </div>

      <div class="m1-cb-controls">
        <input type="text" id="m1-cb-custom" class="vb-search" style="flex:1;min-width:180px"
          placeholder="หรือพิมพ์ตัวจีนเอง เช่น 我爱学习中文..." value="${core.escapeHtml(cbState.customText)}">

        <select id="m1-cb-grid" class="vb-search" style="width:auto">
          <option value="mi" ${cbState.gridType === 'mi' ? 'selected' : ''}>ตาราง 米字格 (8 ทิศ)</option>
          <option value="tian" ${cbState.gridType === 'tian' ? 'selected' : ''}>ตาราง 田字格 (4 ช่อง)</option>
        </select>

        <select id="m1-cb-trace" class="vb-search" style="width:auto">
          <option value="half" ${cbState.traceMode === 'half' ? 'selected' : ''}>รอยประ 2 ช่องแรก</option>
          <option value="all" ${cbState.traceMode === 'all' ? 'selected' : ''}>รอยประทุกช่อง</option>
          <option value="none" ${cbState.traceMode === 'none' ? 'selected' : ''}>ช่องเปล่าทั้งหมด</option>
        </select>

        <select id="m1-cb-cols" class="vb-search" style="width:auto">
          <option value="5" ${cbState.cols === 5 ? 'selected' : ''}>5 ช่อง/แถว</option>
          <option value="6" ${cbState.cols === 6 ? 'selected' : ''}>6 ช่อง/แถว</option>
          <option value="8" ${cbState.cols === 8 ? 'selected' : ''}>8 ช่อง/แถว</option>
        </select>

        <div class="m1-cb-inks" title="สีหมึก">
          ${[
            { c: '#111827', n: 'หมึกดำ' },
            { c: '#1d4ed8', n: 'หมึกน้ำเงิน' },
            { c: '#b91c1c', n: 'หมึกแดง' }
          ].map(k => `<button type="button" class="m1-ink-dot ${cbState.inkColor === k.c ? 'active' : ''}" data-ink="${k.c}" style="background:${k.c}" title="${k.n}"></button>`).join('')}
        </div>

        <button type="button" class="btn-secondary m1-mini-btn" id="m1-cb-clear-all">🧹 ล้างทั้งหน้า</button>
        <button type="button" class="btn-secondary m1-mini-btn" id="m1-cb-print">🖨️ พิมพ์ A4</button>
        <button type="button" class="btn-primary m1-mini-btn" id="m1-cb-finish">✓ คัดจบหน้า (+20 XP)</button>
      </div>
    </div>

    <div class="card-panel m1-cb-sheet" id="m1-cb-sheet">
      ${chars.length === 0 ? `<div class="m1-muted" style="text-align:center;padding:24px">พิมพ์ตัวอักษรจีนอย่างน้อย 1 ตัว หรือเลือกชุดคำด้านบน</div>` : chars.map((ch, rIdx) => {
        const info = mnemonicMap.get(ch);
        return `
          <div class="m1-cb-char-row">
            <div class="m1-cb-meta">
              <div class="m1-cb-ref hanzi-font">${core.escapeHtml(ch)}</div>
              <div class="m1-cb-meta-info">
                <div class="m1-py">${core.escapeHtml(info?.py || '')}</div>
                <div class="m1-muted" style="font-size:11.5px">${core.escapeHtml(info?.th || 'อักษรจีน')}</div>
                <div style="display:flex;gap:4px;margin-top:4px">
                  <button type="button" class="btn-secondary m1-tiny-btn" data-cb-say="${core.escapeHtml(ch)}" title="ฟังเสียง">🔊</button>
                  <button type="button" class="btn-secondary m1-tiny-btn" data-cb-clear-row="${rIdx}" title="ล้างแถวนี้">↺</button>
                </div>
              </div>
            </div>
            <div class="m1-cb-cells">
              ${Array.from({ length: cbState.cols }).map((_, cIdx) => {
                const showGhost = cbState.traceMode === 'all' || (cbState.traceMode === 'half' && cIdx < 2);
                return `
                  <div class="m1-cb-cell ${cbState.gridType === 'mi' ? 'grid-mi' : 'grid-tian'}">
                    ${showGhost ? `<span class="m1-cb-ghost hanzi-font" aria-hidden="true">${core.escapeHtml(ch)}</span>` : ''}
                    <canvas class="m1-cb-canvas" data-row="${rIdx}" data-col="${cIdx}" width="${cbState.cellSize * 2}" height="${cbState.cellSize * 2}"></canvas>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;

  // Wire canvases with smooth Pointer Events (supports Apple Pencil pressure + touch + mouse)
  host.querySelectorAll('.m1-cb-canvas').forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const r = Number(canvas.dataset.row);
    const c = Number(canvas.dataset.col);
    const key = `${r}-${c}`;
    const strokes = [];
    let drawing = false;
    let curStroke = null;

    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const st of strokes) {
        if (!st.pts.length) continue;
        ctx.strokeStyle = st.color;
        ctx.lineWidth = st.width;
        ctx.beginPath();
        ctx.moveTo(st.pts[0].x, st.pts[0].y);
        for (let i = 1; i < st.pts.length; i++) {
          ctx.lineTo(st.pts[i].x, st.pts[i].y);
        }
        ctx.stroke();
      }
    };

    const getPt = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height
      };
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      drawing = true;
      const pressure = e.pressure && e.pressure > 0 ? Math.max(0.55, Math.min(1.4, e.pressure * 1.4)) : 1;
      curStroke = { color: cbState.inkColor, width: cbState.penWidth * 2 * pressure, pts: [getPt(e)] };
      strokes.push(curStroke);
      redraw();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !curStroke) return;
      e.preventDefault();
      curStroke.pts.push(getPt(e));
      redraw();
    });

    const stopDraw = () => { drawing = false; curStroke = null; };
    canvas.addEventListener('pointerup', stopDraw);
    canvas.addEventListener('pointercancel', stopDraw);

    cellControllers.set(key, {
      row: r,
      clear() { strokes.length = 0; redraw(); }
    });
  });

  // Wire controls
  host.querySelectorAll('[data-cb-deck]').forEach(b => b.addEventListener('click', () => {
    cbState.deckId = b.dataset.cbDeck;
    cbState.customText = '';
    renderCopybookTab(core, host);
  }));
  host.querySelector('#m1-cb-custom')?.addEventListener('change', (e) => {
    cbState.customText = e.target.value;
    renderCopybookTab(core, host);
  });
  host.querySelector('#m1-cb-grid')?.addEventListener('change', (e) => {
    cbState.gridType = e.target.value;
    renderCopybookTab(core, host);
  });
  host.querySelector('#m1-cb-trace')?.addEventListener('change', (e) => {
    cbState.traceMode = e.target.value;
    renderCopybookTab(core, host);
  });
  host.querySelector('#m1-cb-cols')?.addEventListener('change', (e) => {
    cbState.cols = Number(e.target.value) || 6;
    renderCopybookTab(core, host);
  });
  host.querySelectorAll('[data-ink]').forEach(b => b.addEventListener('click', () => {
    cbState.inkColor = b.dataset.ink;
    host.querySelectorAll('[data-ink]').forEach(x => x.classList.toggle('active', x === b));
  }));
  host.querySelectorAll('[data-cb-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.cbSay)));
  host.querySelectorAll('[data-cb-clear-row]').forEach(b => b.addEventListener('click', () => {
    const r = Number(b.dataset.cbClearRow);
    cellControllers.forEach(ctrl => { if (ctrl.row === r) ctrl.clear(); });
  }));
  host.querySelector('#m1-cb-clear-all')?.addEventListener('click', () => {
    cellControllers.forEach(ctrl => ctrl.clear());
  });
  host.querySelector('#m1-cb-print')?.addEventListener('click', () => window.print());
  host.querySelector('#m1-cb-finish')?.addEventListener('click', () => {
    core.addXp(20, 'คัดลายมือจบหน้าแล้ว!');
    core.playChime('ok');
    core.spawnConfetti(20);
    core.pandaSay('写得真好看! ลายมือสวยมาก!');
  });
}
