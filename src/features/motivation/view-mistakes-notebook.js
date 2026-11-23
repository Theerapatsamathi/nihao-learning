// #16 Mistake Book & #17 Notebook views
import {
  formatNotebookCsv,
  formatNotebookAnkiTsv,
  computeHeartsState,
  MAX_HEARTS
} from './logic.js';

function getVocabMap(core) {
  const map = new Map();
  for (const w of (core.allVocabWords || [])) {
    map.set(w.id, w);
  }
  return map;
}

export function collectUnifiedMistakes(core) {
  const p = core.state.progress;
  const vocabMap = getVocabMap(core);
  const items = [];
  const seen = new Set();

  // 1) progress.mistakes
  for (const m of (p.mistakes || [])) {
    if (!m || !m.id) continue;
    const key = `core:${m.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      source: 'core',
      id: m.id,
      zh: m.zh || m.q || m.id,
      pinyin: m.pinyin || m.py || '',
      th: m.th || m.ans || '',
      misses: m.misses || 1,
      streakOk: m.streakOk || 0
    });
  }

  // 2) progress.vocabMistakes
  const vocabStreakMap = (core.getExt('motivation')?.vocabMistakeStreak) || {};
  for (const wid of (p.vocabMistakes || [])) {
    const key = `vocab:${wid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const w = vocabMap.get(wid);
    if (!w) continue;
    items.push({
      key,
      source: 'vocab',
      id: wid,
      zh: w.zh || '',
      pinyin: w.py || w.pinyin || '',
      th: w.th || '',
      misses: 1,
      streakOk: vocabStreakMap[wid] || 0
    });
  }

  // 3) ext.*.mistakes exposed by other feature groups
  const extRoot = p.ext || {};
  for (const [ns, val] of Object.entries(extRoot)) {
    if (ns === 'motivation' || !val || !Array.isArray(val.mistakes)) continue;
    for (const m of val.mistakes) {
      if (!m) continue;
      const id = m.id || m.zh || m.q;
      if (!id) continue;
      const key = `ext:${ns}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        key,
        source: `ext:${ns}`,
        id,
        zh: m.zh || m.q || String(id),
        pinyin: m.pinyin || m.py || '',
        th: m.th || m.ans || '',
        misses: m.misses || 1,
        streakOk: m.streakOk || 0
      });
    }
  }

  return items;
}

export function renderMistakeBook(host, core, { onHeartsChanged }) {
  let filterSource = 'all';
  let sortBy = 'misses';
  let quizState = null;

  function render() {
    if (quizState) {
      renderQuiz();
      return;
    }
    const all = collectUnifiedMistakes(core);
    let filtered = all.filter((item) => {
      if (filterSource === 'all') return true;
      if (filterSource === 'vocab') return item.source === 'vocab';
      if (filterSource === 'core') return item.source === 'core';
      return item.source.startsWith('ext:');
    });

    if (sortBy === 'misses') {
      filtered.sort((a, b) => (b.misses - a.misses) || (a.streakOk - b.streakOk));
    } else if (sortBy === 'streak') {
      filtered.sort((a, b) => a.streakOk - b.streakOk);
    }

    host.innerHTML = `
      <div class="mo-section-head">
        <div>
          <h3>📕 สมุดคำผิด (Mistake Book)</h3>
          <p class="mo-muted">รวมคำที่ตอบผิดจากทุกโหมด ตอบถูกติดกัน 3 ครั้งเพื่อลบออกอัตโนมัติ</p>
        </div>
        <button type="button" class="btn-primary" id="mo-start-review" ${all.length === 0 ? 'disabled' : ''}>
          🎯 ทบทวนทั้งหมด (${all.length})
        </button>
      </div>

      <div class="mo-toolbar">
        <div class="mo-pills" role="group" aria-label="กรองตามแหล่งที่มา">
          <button type="button" class="mo-pill ${filterSource === 'all' ? 'active' : ''}" data-src="all">ทั้งหมด (${all.length})</button>
          <button type="button" class="mo-pill ${filterSource === 'vocab' ? 'active' : ''}" data-src="vocab">คำศัพท์</button>
          <button type="button" class="mo-pill ${filterSource === 'core' ? 'active' : ''}" data-src="core">แบบฝึกหัด</button>
        </div>
        <select class="mo-select" id="mo-mistake-sort" aria-label="เรียงลำดับ">
          <option value="misses" ${sortBy === 'misses' ? 'selected' : ''}>เรียงตามผิดบ่อยสุด</option>
          <option value="streak" ${sortBy === 'streak' ? 'selected' : ''}>เรียงตามใกล้เคลียร์</option>
        </select>
      </div>

      ${filtered.length === 0 ? `
        <div class="mo-empty card-panel">
          <div class="mo-empty-icon">🎉</div>
          <h4>ยังไม่มีคำผิดค้างอยู่!</h4>
          <p>เยี่ยมมาก! เมื่อคุณตอบผิดในแบบฝึกหัดหรือคำศัพท์ รายการจะถูกรวบรวมไว้ที่นี่เพื่อให้กลับมาทบทวน</p>
        </div>
      ` : `
        <div class="mo-list">
          ${filtered.map((item) => `
            <div class="mo-mistake-card card-panel">
              <div class="mo-mistake-main">
                <div class="mo-hanzi">${core.escapeHtml(item.zh)}</div>
                <div>
                  <div class="mo-pinyin">${core.escapeHtml(item.pinyin)}</div>
                  <div class="mo-thai">${core.escapeHtml(item.th || '—')}</div>
                </div>
              </div>
              <div class="mo-mistake-meta">
                <span class="mo-badge mo-badge-warn">ผิด ${item.misses} ครั้ง</span>
                <span class="mo-badge mo-badge-ok">ถูก ${item.streakOk}/3</span>
                <button type="button" class="btn-secondary mo-btn-sm" data-speak="${core.escapeHtml(item.zh)}" aria-label="ฟังเสียง">🔊</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    host.querySelectorAll('[data-src]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterSource = btn.dataset.src;
        render();
      });
    });
    host.querySelector('#mo-mistake-sort')?.addEventListener('change', (e) => {
      sortBy = e.target.value;
      render();
    });
    host.querySelectorAll('[data-speak]').forEach((btn) => {
      btn.addEventListener('click', () => core.speak(btn.dataset.speak));
    });
    host.querySelector('#mo-start-review')?.addEventListener('click', () => {
      const pool = core.shuffleArray([...all]).slice(0, 10);
      quizState = { pool, idx: 0, correctCount: 0, answered: false, mode: 'meaning' };
      renderQuiz();
    });
  }

  function recordQuizOutcome(item, isCorrect) {
    const p = core.state.progress;
    if (item.source === 'core') {
      const idx = (p.mistakes || []).findIndex((m) => m.id === item.id);
      if (idx >= 0) {
        if (isCorrect) {
          p.mistakes[idx].streakOk = (p.mistakes[idx].streakOk || 0) + 1;
          if (p.mistakes[idx].streakOk >= 3) p.mistakes.splice(idx, 1);
        } else {
          p.mistakes[idx].streakOk = 0;
          p.mistakes[idx].misses = (p.mistakes[idx].misses || 1) + 1;
        }
      }
    } else if (item.source === 'vocab') {
      const ext = core.getExt('motivation') || {};
      const map = { ...(ext.vocabMistakeStreak || {}) };
      if (isCorrect) {
        map[item.id] = (map[item.id] || 0) + 1;
        if (map[item.id] >= 3) {
          p.vocabMistakes = (p.vocabMistakes || []).filter((id) => id !== item.id);
          delete map[item.id];
        }
      } else {
        map[item.id] = 0;
      }
      core.setExt('motivation', { vocabMistakeStreak: map }, { save: false });
    }
    core.saveProgress('mistake-review');
  }

  function renderQuiz() {
    if (quizState.idx >= quizState.pool.length) {
      // Completed round: award modest XP + restore 1 heart if enabled
      core.addXp(15, 'mistake-review-complete');
      const ext = core.getExt('motivation') || {};
      const h = computeHeartsState(ext.hearts || {}, Date.now());
      let heartMsg = '';
      if (h.enabled && h.count < MAX_HEARTS) {
        const nextCount = Math.min(MAX_HEARTS, h.count + 1);
        core.setExt('motivation', (prev) => ({
          ...prev,
          hearts: { enabled: true, count: nextCount, lastLostAt: nextCount >= MAX_HEARTS ? 0 : Date.now() }
        }), { save: true, reason: 'heart-refill' });
        heartMsg = ' + เติมหัวใจ ❤️ +1 ดวง!';
        onHeartsChanged?.();
      }
      host.innerHTML = `
        <div class="mo-empty card-panel">
          <div class="mo-empty-icon">🏆</div>
          <h4>ทบทวนครบ ${quizState.pool.length} ข้อแล้ว!</h4>
          <p>ตอบถูก ${quizState.correctCount}/${quizState.pool.length} ข้อ (+15 XP${heartMsg})</p>
          <button type="button" class="btn-primary" id="mo-quiz-done">กลับไปสมุดคำผิด</button>
        </div>
      `;
      host.querySelector('#mo-quiz-done')?.addEventListener('click', () => {
        quizState = null;
        render();
      });
      return;
    }

    const cur = quizState.pool[quizState.idx];
    const isListen = quizState.idx % 2 === 1;
    const distractors = core.shuffleArray(
      (core.allVocabWords || []).filter((w) => w.th && w.th !== cur.th)
    ).slice(0, 3).map((w) => w.th);
    const options = core.shuffleArray([cur.th || cur.zh, ...distractors]);

    host.innerHTML = `
      <div class="mo-quiz card-panel">
        <div class="mo-quiz-top">
          <span>ข้อ ${quizState.idx + 1} / ${quizState.pool.length}</span>
          <button type="button" class="btn-secondary mo-btn-sm" id="mo-quiz-exit">ออก</button>
        </div>
        <div class="mo-quiz-prompt">
          ${isListen ? `
            <p class="mo-muted">ฟังเสียงแล้วเลือกความหมายที่ถูกต้อง</p>
            <button type="button" class="btn-primary" id="mo-quiz-speak">🔊 ฟังเสียง</button>
          ` : `
            <div class="mo-quiz-zh">${core.escapeHtml(cur.zh)}</div>
            <div class="mo-pinyin">${core.escapeHtml(cur.pinyin)}</div>
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-quiz-speak">🔊 ฟังเสียง</button>
          `}
        </div>
        <div class="mo-quiz-options">
          ${options.map((opt) => `
            <button type="button" class="mo-opt-btn" data-opt="${core.escapeHtml(opt)}">${core.escapeHtml(opt)}</button>
          `).join('')}
        </div>
      </div>
    `;

    if (isListen) core.speak(cur.zh);
    host.querySelector('#mo-quiz-speak')?.addEventListener('click', () => core.speak(cur.zh));
    host.querySelector('#mo-quiz-exit')?.addEventListener('click', () => { quizState = null; render(); });

    host.querySelectorAll('.mo-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (quizState.answered) return;
        quizState.answered = true;
        const picked = btn.dataset.opt;
        const ok = picked === (cur.th || cur.zh);
        btn.classList.add(ok ? 'mo-opt-ok' : 'mo-opt-err');
        if (ok) quizState.correctCount += 1;
        core.playChime(ok ? 'ok' : 'err');
        recordQuizOutcome(cur, ok);
        setTimeout(() => {
          quizState.idx += 1;
          quizState.answered = false;
          renderQuiz();
        }, 700);
      });
    });
  }

  render();
}

export function renderNotebook(host, core) {
  let query = '';

  function getNotebookItems() {
    const p = core.state.progress;
    const vocabMap = getVocabMap(core);
    const starred = new Set(p.vocabStarred || []);
    const notes = p.vocabNotes || {};
    const ids = new Set([...starred, ...Object.keys(notes).filter((k) => notes[k]?.trim())]);

    const list = [];
    for (const id of ids) {
      const w = vocabMap.get(id);
      if (!w) continue;
      list.push({
        id,
        zh: w.zh || '',
        py: w.py || w.pinyin || '',
        th: w.th || '',
        starred: starred.has(id),
        note: notes[id] || ''
      });
    }
    return list;
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function render() {
    const all = getNotebookItems();
    const q = query.trim().toLowerCase();
    const items = q
      ? all.filter((w) =>
          w.zh.toLowerCase().includes(q) ||
          w.py.toLowerCase().includes(q) ||
          w.th.toLowerCase().includes(q) ||
          w.note.toLowerCase().includes(q)
        )
      : all;

    host.innerHTML = `
      <div class="mo-section-head">
        <div>
          <h3>📒 สมุดโน้ตคำศัพท์ (Notebook)</h3>
          <p class="mo-muted">รวมคำที่ปักหมุดและโน้ตช่วยจำของคุณ ส่งออกเป็น CSV / Anki หรือพิมพ์ได้ทันที</p>
        </div>
        <div class="mo-btn-row">
          <button type="button" class="btn-secondary mo-btn-sm" id="mo-export-csv" ${all.length === 0 ? 'disabled' : ''}>📄 CSV</button>
          <button type="button" class="btn-secondary mo-btn-sm" id="mo-export-anki" ${all.length === 0 ? 'disabled' : ''}>🃏 Anki TSV</button>
          <button type="button" class="btn-secondary mo-btn-sm" id="mo-print-nb" ${all.length === 0 ? 'disabled' : ''}>🖨️ พิมพ์</button>
        </div>
      </div>

      <input type="search" class="mo-input" id="mo-nb-search" placeholder="ค้นหาคำจีน พินอิน คำแปล หรือโน้ต..." value="${core.escapeHtml(query)}" />

      ${items.length === 0 ? `
        <div class="mo-empty card-panel">
          <div class="mo-empty-icon">⭐</div>
          <h4>${all.length === 0 ? 'ยังไม่มีคำศัพท์ในสมุดโน้ต' : 'ไม่พบคำที่ค้นหา'}</h4>
          <p>กดปุ่ม ★ ปักหมุด หรือจดโน้ตในหน้าคำศัพท์ เพื่อเก็บคำสำคัญไว้ทบทวนที่นี่</p>
        </div>
      ` : `
        <div class="mo-list">
          ${items.map((w) => `
            <div class="mo-nb-card card-panel">
              <div class="mo-nb-top">
                <div>
                  <span class="mo-hanzi">${core.escapeHtml(w.zh)}</span>
                  <span class="mo-pinyin">${core.escapeHtml(w.py)}</span>
                  ${w.starred ? '<span class="mo-star-tag">★</span>' : ''}
                </div>
                <button type="button" class="btn-secondary mo-btn-sm" data-speak="${core.escapeHtml(w.zh)}" aria-label="ฟังเสียง">🔊</button>
              </div>
              <div class="mo-thai">${core.escapeHtml(w.th)}</div>
              <div class="mo-nb-note-row">
                <input type="text" class="mo-input mo-note-input" data-note-id="${core.escapeHtml(w.id)}" value="${core.escapeHtml(w.note)}" placeholder="เพิ่มโน้ตช่วยจำ..." />
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    host.querySelector('#mo-nb-search')?.addEventListener('input', (e) => {
      query = e.target.value;
      render();
    });
    host.querySelector('#mo-export-csv')?.addEventListener('click', () => {
      downloadBlob(formatNotebookCsv(all), 'nihao-notebook.csv', 'text/csv;charset=utf-8');
      core.showToast('ส่งออกไฟล์ CSV แล้ว');
    });
    host.querySelector('#mo-export-anki')?.addEventListener('click', () => {
      downloadBlob(formatNotebookAnkiTsv(all), 'nihao-anki.tsv', 'text/tab-separated-values;charset=utf-8');
      core.showToast('ส่งออกไฟล์ Anki TSV แล้ว');
    });
    host.querySelector('#mo-print-nb')?.addEventListener('click', () => window.print());
    host.querySelectorAll('[data-speak]').forEach((btn) => {
      btn.addEventListener('click', () => core.speak(btn.dataset.speak));
    });
    host.querySelectorAll('.mo-note-input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.noteId;
        const notes = core.state.progress.vocabNotes || (core.state.progress.vocabNotes = {});
        const val = inp.value.trim();
        if (val) notes[id] = val;
        else delete notes[id];
        core.saveProgress('notebook-note');
        core.showToast('บันทึกโน้ตแล้ว');
      });
    });
  }

  render();
}
