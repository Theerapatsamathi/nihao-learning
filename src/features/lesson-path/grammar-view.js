// #15 Grammar Cards (การ์ดไวยากรณ์ 21 หัวข้อ พร้อมตัวอย่างเสียงและควิซ 3 ข้อ)

import { GRAMMAR_CARDS } from './grammar-data.js';

export function renderGrammarView(host, { core }) {
  let filter = 'all'; // all | HSK 1 | HSK 2 | learned | unlearned
  let selectedId = null;

  const getLearnedMap = () => ({ ...(core.getExt('lesson-path')?.grammarLearned || {}) });

  const toggleLearned = (id, forceValue = null) => {
    const map = getLearnedMap();
    const nextVal = forceValue === null ? !map[id] : Boolean(forceValue);
    if (nextVal) map[id] = true;
    else delete map[id];
    core.setExt('lesson-path', { grammarLearned: map }, { reason: 'lp-grammar-learned' });
  };

  const renderDetail = (card) => {
    const learned = Boolean(getLearnedMap()[card.id]);
    const answers = {};
    let quizSubmitted = false;

    const draw = () => {
      const correctCount = quizSubmitted
        ? card.quiz.filter((q, i) => answers[i] === q.answer).length
        : 0;

      host.innerHTML = `
        <div class="lp-section-card card-panel">
          <div class="lp-detail-top">
            <button type="button" class="btn-secondary" data-back>← กลับรายการไวยากรณ์</button>
            <button type="button" class="lp-learned-btn ${learned ? 'is-learned' : ''}" data-toggle-learned>
              ${learned ? '✅ เรียนแล้ว' : '○ ทำเครื่องหมายว่าเรียนแล้ว'}
            </button>
          </div>

          <div class="lp-grammar-header">
            <span class="lp-level-tag">${core.escapeHtml(card.level)}</span>
            <h3>${core.escapeHtml(card.title)}</h3>
            <div class="lp-grammar-formula">${core.escapeHtml(card.pattern)}</div>
            <p class="lp-grammar-summary">${core.escapeHtml(card.summary)}</p>
            <div class="lp-grammar-tip">💡 <strong>เคล็ดลับ:</strong> ${core.escapeHtml(card.tip)}</div>
          </div>

          <div class="lp-grammar-examples">
            <h4>ตัวอย่างประโยค (3 ประโยค)</h4>
            ${card.examples.map(ex => `
              <div class="lp-example-row">
                <div class="lp-example-text">
                  <div class="lp-hz">${core.escapeHtml(ex.hz)}</div>
                  <div class="lp-py">${core.escapeHtml(ex.py)}</div>
                  <div class="lp-th">${core.escapeHtml(ex.th)}</div>
                </div>
                <button type="button" class="lp-icon-btn" data-speak="${core.escapeHtml(ex.hz)}" aria-label="ฟังเสียงตัวอย่าง">🔊</button>
              </div>
            `).join('')}
          </div>

          <div class="lp-grammar-quiz">
            <h4>แบบทดสอบสั้น 3 ข้อ</h4>
            ${card.quiz.map((q, qi) => `
              <div class="lp-quiz-q">
                <div class="lp-quiz-prompt">${qi + 1}. ${core.escapeHtml(q.q)}</div>
                <div class="lp-quiz-choices">
                  ${q.choices.map((ch, ci) => {
                    const picked = answers[qi] === ci;
                    let cls = '';
                    if (quizSubmitted) {
                      if (ci === q.answer) cls = 'is-correct';
                      else if (picked) cls = 'is-wrong';
                    } else if (picked) {
                      cls = 'is-selected';
                    }
                    return `<button type="button" class="lp-choice-btn lp-choice-row ${cls}" data-q="${qi}" data-c="${ci}" ${quizSubmitted ? 'disabled' : ''}>${core.escapeHtml(ch)}</button>`;
                  }).join('')}
                </div>
              </div>
            `).join('')}

            <div class="lp-quiz-footer">
              ${quizSubmitted
                ? `<div class="lp-quiz-result">ได้ <strong>${correctCount} / ${card.quiz.length}</strong> คะแนน ${correctCount >= 2 ? '🎉 ผ่านแล้ว!' : 'ลองทบทวนอีกครั้งนะ'}</div>
                   <button type="button" class="btn-secondary" data-retry>ทำควิซใหม่</button>`
                : `<button type="button" class="btn-primary" data-submit ${Object.keys(answers).length === card.quiz.length ? '' : 'disabled'}>ส่งคำตอบ</button>`
              }
            </div>
          </div>
        </div>
      `;

      host.querySelector('[data-back]')?.addEventListener('click', () => {
        selectedId = null;
        renderList();
      });
      host.querySelector('[data-toggle-learned]')?.addEventListener('click', () => {
        toggleLearned(card.id);
        renderDetail(card);
      });
      host.querySelectorAll('[data-speak]').forEach(btn => {
        btn.addEventListener('click', () => core.speak(btn.dataset.speak));
      });
      host.querySelectorAll('[data-q]').forEach(btn => {
        btn.addEventListener('click', () => {
          answers[Number(btn.dataset.q)] = Number(btn.dataset.c);
          draw();
        });
      });
      host.querySelector('[data-submit]')?.addEventListener('click', () => {
        quizSubmitted = true;
        const okCount = card.quiz.filter((q, i) => answers[i] === q.answer).length;
        if (okCount >= 2) {
          core.playChime('ok');
          if (!getLearnedMap()[card.id]) {
            toggleLearned(card.id, true);
            core.addXp(15, `lp-grammar-${card.id}`);
          }
        } else {
          core.playChime('err');
        }
        draw();
      });
      host.querySelector('[data-retry]')?.addEventListener('click', () => {
        for (const k of Object.keys(answers)) delete answers[k];
        quizSubmitted = false;
        draw();
      });
    };

    draw();
  };

  const renderList = () => {
    const learnedMap = getLearnedMap();
    const learnedCount = GRAMMAR_CARDS.filter(c => learnedMap[c.id]).length;
    const filtered = GRAMMAR_CARDS.filter(c => {
      if (filter === 'HSK 1' || filter === 'HSK 2') return c.level === filter;
      if (filter === 'learned') return Boolean(learnedMap[c.id]);
      if (filter === 'unlearned') return !learnedMap[c.id];
      return true;
    });

    host.innerHTML = `
      <div class="lp-section-card card-panel">
        <div class="lp-section-head">
          <div>
            <h3>📖 การ์ดไวยากรณ์ (${learnedCount}/${GRAMMAR_CARDS.length} เรียนแล้ว)</h3>
            <p class="lp-muted">สรุปไวยากรณ์ HSK 1–2 ภาษาไทยเข้าใจง่าย พร้อมตัวอย่างเสียงและควิซ 3 ข้อทุกหัวข้อ</p>
          </div>
          <div class="lp-pill-group">
            <button type="button" class="lp-pill ${filter === 'all' ? 'is-active' : ''}" data-f="all">ทั้งหมด (${GRAMMAR_CARDS.length})</button>
            <button type="button" class="lp-pill ${filter === 'HSK 1' ? 'is-active' : ''}" data-f="HSK 1">HSK 1</button>
            <button type="button" class="lp-pill ${filter === 'HSK 2' ? 'is-active' : ''}" data-f="HSK 2">HSK 2</button>
            <button type="button" class="lp-pill ${filter === 'unlearned' ? 'is-active' : ''}" data-f="unlearned">ยังไม่เรียน</button>
          </div>
        </div>

        ${filtered.length ? `
          <div class="lp-grammar-grid">
            ${filtered.map(c => `
              <button type="button" class="lp-grammar-card ${learnedMap[c.id] ? 'is-learned' : ''}" data-open="${c.id}">
                <div class="lp-grammar-card-top">
                  <span class="lp-level-tag">${core.escapeHtml(c.level)}</span>
                  <span class="lp-learned-mark">${learnedMap[c.id] ? '✅ เรียนแล้ว' : '○ ยังไม่เรียน'}</span>
                </div>
                <div class="lp-grammar-card-title">${core.escapeHtml(c.title)}</div>
                <div class="lp-grammar-card-pattern">${core.escapeHtml(c.pattern)}</div>
              </button>
            `).join('')}
          </div>
        ` : '<div class="lp-empty">ไม่มีการ์ดไวยากรณ์ในตัวกรองนี้</div>'}
      </div>
    `;

    host.querySelectorAll('[data-f]').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.f;
        renderList();
      });
    });
    host.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedId = btn.dataset.open;
        const card = GRAMMAR_CARDS.find(c => c.id === selectedId);
        if (card) renderDetail(card);
      });
    });
  };

  renderList();
}
