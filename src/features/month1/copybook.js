// Chinese Copybook Worksheet (สมุดคัดลายมือ 田字格 / 米字格) + Gemini Vision AI Handwriting Grader
// Supports Apple Pencil / Stylus / Touch / Mouse via Pointer Events, custom text, A4 Print, and AI grading.
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
  cols: 6,
  gridType: 'mi',    // 'tian' (田字格) | 'mi' (米字格)
  traceMode: 'half', // 'all' | 'half' | 'none'
  inkColor: '#111827',
  penWidth: 4.5,
  cellSize: 84,
  grading: false,
  lastReport: null
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

/**
 * Pure geometric fallback grader when Gemini Vision API is offline/unconfigured.
 * Analyzes bounding-box centering, fill ratio, and stroke distribution inside 米字格.
 */
export function evaluateLocalHandwriting(writtenCells) {
  if (!Array.isArray(writtenCells) || writtenCells.length === 0) {
    return null;
  }
  const byChar = new Map();
  for (const cell of writtenCells) {
    const pts = cell.strokes.flatMap(s => s.pts || []);
    if (pts.length < 2) continue;
    const size = cell.size || 168;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const wRatio = (maxX - minX) / size;
    const hRatio = (maxY - minY) / size;
    const cx = ((minX + maxX) / 2) / size;
    const cy = ((minY + maxY) / 2) / size;
    const centerDist = Math.hypot(cx - 0.5, cy - 0.5);

    // Ideal Chinese character occupies ~55%-82% of grid box and sits near center (0.5, 0.5)
    let score = 94;
    let balance = 'สมดุลกึ่งกลางช่องดีมาก';
    let tip = 'น้ำหนักเส้นมั่นคง รักษาจังหวะการตวัดปลายขีดได้ดีเลย!';

    if (centerDist > 0.14) {
      score -= Math.round(centerDist * 85);
      const dir = cx < 0.42 ? 'เอียงซ้าย' : cx > 0.58 ? 'เอียงขวา' : cy < 0.42 ? 'ลอยสูงไปนิด' : 'ค่อนลงล่าง';
      balance = `จุดศูนย์ถ่วง${dir}`;
      tip = 'ลองใช้จุดตัดเส้นทแยงมุมกลางช่อง 米字格 เป็นจุดยึดแกนกลางตัวอักษร';
    }
    if (wRatio < 0.35 && hRatio < 0.35) {
      score -= 16;
      balance = 'ตัวอักษรเล็กเกินไป';
      tip = 'ขยายสัดส่วนให้เต็มประมาณ 70–80% ของช่อง โดยเว้นขอบทั้ง 4 ด้านเท่าๆ กัน';
    } else if (wRatio > 0.92 || hRatio > 0.92) {
      score -= 12;
      balance = 'ชิดขอบตารางเกินไป';
      tip = 'เว้นระยะห่างจากเส้นกรอบนอกเล็กน้อย ตัวอักษรจะดูโปร่งและสง่างามขึ้น';
    }

    score = Math.max(55, Math.min(99, score));
    const prev = byChar.get(cell.char);
    if (!prev || score > prev.score) {
      byChar.set(cell.char, { char: cell.char, score, balance, tip });
    }
  }

  const items = [...byChar.values()];
  if (!items.length) return null;
  const avg = Math.round(items.reduce((s, x) => s + x.score, 0) / items.length);
  const overallGrade = avg >= 90 ? 'S' : avg >= 80 ? 'A' : avg >= 70 ? 'B' : 'C';
  return {
    overallGrade,
    overallScore: avg,
    summary: `ตรวจสัดส่วนบนตาราง 米字格 ครบ ${items.length} ตัวอักษร! ภาพรวมได้เกรด ${overallGrade} (${avg}/100) ลองดูคำแนะนำรายตัวด้านล่างเพื่อเก็บรายละเอียดครับ`,
    items,
    isLocalFallback: true
  };
}

function composeCopybookCompositePng(writtenCells) {
  const cols = Math.min(4, writtenCells.length);
  const rows = Math.ceil(writtenCells.length / cols);
  const box = 140;
  const pad = 16;
  const out = document.createElement('canvas');
  out.width = cols * (box + pad) + pad;
  out.height = rows * (box + pad + 24) + pad;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, out.width, out.height);

  writtenCells.forEach((cell, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const x = pad + c * (box + pad);
    const y = pad + r * (box + pad + 24);

    // Draw 米字格 guide
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, box, box);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + box / 2, y); ctx.lineTo(x + box / 2, y + box);
    ctx.moveTo(x, y + box / 2); ctx.lineTo(x + box, y + box / 2);
    ctx.moveTo(x, y); ctx.lineTo(x + box, y + box);
    ctx.moveTo(x + box, y); ctx.lineTo(x, y + box);
    ctx.stroke();
    ctx.restore();

    // Draw user strokes
    ctx.drawImage(cell.canvas, x, y, box, box);

    // Label target char underneath
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`เป้า: ${cell.char}`, x + box / 2, y + box + 16);
  });

  return out.toDataURL('image/png');
}

function renderReportBox(core, host) {
  const box = host.querySelector('#m1-cb-ai-report');
  if (!box) return;
  const rep = cbState.lastReport;
  if (!rep) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const gradeCls = rep.overallGrade === 'S' || rep.overallGrade === 'A' ? 'grade-high' : 'grade-mid';
  box.innerHTML = `
    <div class="m1-ai-grade-head">
      <div class="m1-ai-grade-badge ${gradeCls}">${core.escapeHtml(rep.overallGrade || 'A')}</div>
      <div style="flex:1;min-width:200px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <strong style="font-size:16px">✨ ผลวิเคราะห์ลายมือ (${Number(rep.overallScore || 85)}/100 คะแนน)</strong>
          <span class="m1-tag">${rep.isLocalFallback ? 'โหมดวิเคราะห์สัดส่วนอัตโนมัติ' : 'Gemini Vision AI'}</span>
        </div>
        <p class="m1-muted" style="margin:4px 0 0;font-size:13px">${core.escapeHtml(rep.summary || '')}</p>
      </div>
      <button type="button" class="btn-secondary m1-mini-btn" id="m1-cb-close-rep">✕ ซ่อน</button>
    </div>
    <div class="m1-ai-grade-grid">
      ${(rep.items || []).map(it => `
        <div class="m1-ai-grade-item">
          <div class="m1-ai-char hanzi-font">${core.escapeHtml(it.char)}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${core.escapeHtml(it.balance)} · <span style="color:var(--sys-accent-text)">${Number(it.score || 85)} คะแนน</span></div>
            <div class="m1-muted" style="font-size:12px;margin-top:2px">💡 ${core.escapeHtml(it.tip)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  box.querySelector('#m1-cb-close-rep')?.addEventListener('click', () => {
    cbState.lastReport = null;
    box.hidden = true;
  });
}

export function renderCopybookTab(core, host) {
  if (!host) return;
  const activeText = cbState.customText.trim()
    ? cbState.customText
    : (PRESET_DECKS.find(d => d.id === cbState.deckId)?.chars || PRESET_DECKS[0].chars);
  const chars = extractChineseChars(activeText, 12);

  // Track strokes per cell key ("row-col") for Undo / Clear / AI Vision export
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
        <button type="button" class="btn-primary m1-mini-btn m1-ai-btn" id="m1-cb-grade-ai">✨ ส่งครู AI ตรวจลายมือ</button>
        <button type="button" class="btn-primary m1-mini-btn" id="m1-cb-finish">✓ คัดจบหน้า (+20 XP)</button>
      </div>
    </div>

    <div class="card-panel m1-ai-grade-panel" id="m1-cb-ai-report" hidden></div>

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
                    <canvas class="m1-cb-canvas" data-row="${rIdx}" data-col="${cIdx}" data-char="${core.escapeHtml(ch)}" width="${cbState.cellSize * 2}" height="${cbState.cellSize * 2}"></canvas>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;

  renderReportBox(core, host);

  // Wire canvases with smooth Pointer Events (supports Apple Pencil pressure + touch + mouse)
  host.querySelectorAll('.m1-cb-canvas').forEach(canvas => {
    const ctx = canvas.getContext('2d');
    const r = Number(canvas.dataset.row);
    const c = Number(canvas.dataset.col);
    const ch = canvas.dataset.char || '';
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
      col: c,
      char: ch,
      canvas,
      strokes,
      size: canvas.width,
      hasInk: () => strokes.some(s => s.pts.length >= 2),
      clear() { strokes.length = 0; redraw(); }
    });
  });

  // Wire controls
  host.querySelectorAll('[data-cb-deck]').forEach(b => b.addEventListener('click', () => {
    cbState.deckId = b.dataset.cbDeck;
    cbState.customText = '';
    cbState.lastReport = null;
    renderCopybookTab(core, host);
  }));
  host.querySelector('#m1-cb-custom')?.addEventListener('change', (e) => {
    cbState.customText = e.target.value;
    cbState.lastReport = null;
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

  // Gemini Vision Handwriting Grader
  host.querySelector('#m1-cb-grade-ai')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const written = [...cellControllers.values()].filter(c => c.hasInk()).slice(0, 12);
    if (!written.length) {
      core.showToast('กรุณาเขียนตัวอักษรลงในช่องตารางอย่างน้อย 1 ช่องก่อนส่งตรวจครับ ✍️');
      return;
    }
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '🔍 ครู AI กำลังตรวจสัดส่วน...';

    try {
      const image = composeCopybookCompositePng(written);
      const uniqueChars = [...new Set(written.map(w => w.char))].join('');
      const res = await core.api('/api/ai/vision', { mode: 'handwriting', image, chars: uniqueChars }, 'POST');
      if (res.ok && res.data?.report) {
        cbState.lastReport = res.data.report;
      } else {
        cbState.lastReport = evaluateLocalHandwriting(written);
      }
      if (cbState.lastReport) {
        core.addXp(25, `ครู AI ตรวจลายมือได้เกรด ${cbState.lastReport.overallGrade}!`);
        core.playChime('ok');
        core.pandaSay(`ได้เกรด ${cbState.lastReport.overallGrade} เลย! เก่งมาก!`);
        renderReportBox(core, host);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });

  host.querySelector('#m1-cb-finish')?.addEventListener('click', () => {
    core.addXp(20, 'คัดลายมือจบหน้าแล้ว!');
    core.playChime('ok');
    core.spawnConfetti(20);
    core.pandaSay('写得真好看! ลายมือสวยมาก!');
  });
}
