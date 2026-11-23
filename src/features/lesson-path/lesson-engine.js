// Mixed-Exercise Lesson Engine (#9) & Unit Checkpoint Runner
// Supports 10 exercise types, deterministic generation, immediate feedback, XP & stars.

import {
  seededShuffle,
  seededPick,
  gradeDictationAnswer,
  calcStars,
  calcLessonXp,
  normalizeHanzi
} from './logic.js';

/**
 * Deterministically build 10-12 mixed exercises for a lesson or checkpoint.
 * @param {object} unit
 * @param {object|null} lesson - null when checkpoint
 * @param {Array} allUnits
 * @param {boolean} hasHanziWriter
 */
export function buildLessonExercises(unit, lesson, allUnits, hasHanziWriter = false) {
  const isCheckpoint = !lesson;
  const seedBase = isCheckpoint ? `cp:${unit.id}` : `ls:${lesson.id}`;
  const lessonIdx = isCheckpoint ? 0 : Math.max(0, unit.lessons.findIndex(l => l.id === lesson.id));

  // Pool of words from this unit; slice/rotate per lesson for variety
  const unitWords = unit.words || [];
  const rotated = unitWords.slice(lessonIdx * 3).concat(unitWords.slice(0, lessonIdx * 3));
  const focusWords = isCheckpoint ? seededPick(unitWords, 10, `${seedBase}:fw`) : rotated.slice(0, 8);
  const allWordsPool = allUnits.flatMap(u => u.words || []);

  const pickDistractors = (targetWord, count, key) => {
    const others = unitWords.filter(w => w.hz !== targetWord.hz);
    const pool = others.length >= count ? others : allWordsPool.filter(w => w.hz !== targetWord.hz);
    return seededPick(pool, count, `${seedBase}:dist:${key}`);
  };

  const exercises = [];
  const sents = unit.sentences || [];

  // 1. Picture/emoji choice
  if (focusWords[0]) {
    const w = focusWords[0];
    const choices = seededShuffle([w, ...pickDistractors(w, 3, 'e0')], `${seedBase}:c0`);
    exercises.push({ type: 'emoji-choice', word: w, choices });
  }

  // 2. Listen and choose
  if (focusWords[1]) {
    const w = focusWords[1];
    const choices = seededShuffle([w, ...pickDistractors(w, 3, 'e1')], `${seedBase}:c1`);
    exercises.push({ type: 'listen-choose', word: w, choices });
  }

  // 3. Chinese -> Thai
  if (focusWords[2]) {
    const w = focusWords[2];
    const choices = seededShuffle([w, ...pickDistractors(w, 3, 'e2')], `${seedBase}:c2`);
    exercises.push({ type: 'zh-to-th', word: w, choices });
  }

  // 4. Thai -> Chinese
  if (focusWords[3]) {
    const w = focusWords[3];
    const choices = seededShuffle([w, ...pickDistractors(w, 3, 'e3')], `${seedBase}:c3`);
    exercises.push({ type: 'th-to-zh', word: w, choices });
  }

  // 5. Matching pairs (4 pairs)
  const matchWords = seededPick(unitWords, 4, `${seedBase}:match`);
  if (matchWords.length === 4) {
    exercises.push({
      type: 'matching',
      pairs: matchWords,
      leftOrder: seededShuffle(matchWords, `${seedBase}:ml`),
      rightOrder: seededShuffle(matchWords, `${seedBase}:mr`)
    });
  }

  // 6. Sentence ordering (tap tiles)
  const sent1 = sents[lessonIdx % sents.length];
  if (sent1 && sent1.tokens?.length >= 2) {
    exercises.push({
      type: 'sentence-order',
      sentence: sent1,
      tiles: seededShuffle(sent1.tokens.map((t, i) => ({ id: i, text: t })), `${seedBase}:so1`)
    });
  }

  // 7. Fill-in-the-blank
  const sent2 = sents[(lessonIdx + 1) % sents.length];
  if (sent2 && sent2.tokens?.length >= 2) {
    const blankIdx = Math.min(sent2.blankIdx ?? 1, sent2.tokens.length - 1);
    const answerToken = sent2.tokens[blankIdx];
    const distractorTokens = seededPick(
      unitWords.map(w => w.hz).filter(hz => hz !== answerToken),
      3,
      `${seedBase}:fb`
    );
    exercises.push({
      type: 'fill-blank',
      sentence: sent2,
      blankIdx,
      answerToken,
      choices: seededShuffle([answerToken, ...distractorTokens], `${seedBase}:fbc`)
    });
  }

  // 8. Type pinyin
  if (focusWords[4]) {
    exercises.push({ type: 'type-pinyin', word: focusWords[4] });
  }

  // 9. Speak-it (with graceful skip)
  if (focusWords[5]) {
    exercises.push({ type: 'speak-it', word: focusWords[5] });
  }

  // 10. Write a character (if HanziWriter loaded, else extra listen-choose)
  const writeWord = focusWords[6] || focusWords[0];
  if (writeWord) {
    if (hasHanziWriter && writeWord.char) {
      exercises.push({ type: 'write-char', word: writeWord, char: writeWord.char });
    } else {
      const choices = seededShuffle([writeWord, ...pickDistractors(writeWord, 3, 'e9')], `${seedBase}:c9`);
      exercises.push({ type: 'zh-to-th', word: writeWord, choices });
    }
  }

  // 11. Second sentence order or Thai->Chinese for richness (11 items total)
  const sent3 = sents[(lessonIdx + 2) % sents.length];
  if (sent3 && sent3.tokens?.length >= 2 && sent3 !== sent1) {
    exercises.push({
      type: 'sentence-order',
      sentence: sent3,
      tiles: seededShuffle(sent3.tokens.map((t, i) => ({ id: i, text: t })), `${seedBase}:so2`)
    });
  }

  return exercises;
}

/**
 * Render and run an interactive lesson or checkpoint inside `host`.
 */
export function runLessonView(host, { core, unit, lesson, allUnits, onComplete, onExit }) {
  const isCheckpoint = !lesson;
  const exercises = buildLessonExercises(unit, lesson, allUnits, Boolean(window.HanziWriter));

  let idx = 0;
  let score = 0;
  let answered = false;
  const mistakes = [];
  let activeRecognition = null;

  const stopRec = () => {
    try { activeRecognition?.stop(); } catch { /* ignore */ }
    activeRecognition = null;
  };

  const recordWrong = (item) => {
    if (!item) return;
    mistakes.push(item);
    try {
      core.recordMistake({
        id: `lp-${item.hz}`,
        hz: item.hz,
        py: item.py || '',
        th: item.th || '',
        source: 'lesson-path'
      });
    } catch { /* ignore */ }
  };

  const renderEndScreen = () => {
    stopRec();
    const total = exercises.length || 1;
    const accuracy = score / total;
    const pct = Math.round(accuracy * 100);
    const passed = isCheckpoint ? pct >= 80 : pct >= 50;
    const stars = calcStars(accuracy);
    const xp = calcLessonXp(accuracy, isCheckpoint);

    if (passed) {
      core.addXp(xp, isCheckpoint ? `lp-checkpoint-${unit.id}` : `lp-lesson-${lesson.id}`);
      core.spawnConfetti?.(isCheckpoint ? 40 : 20);
      core.pandaSay?.(isCheckpoint ? `สุดยอด! ผ่านด่านทดสอบบทที่ ${unit.num} แล้ว 🎉` : `เก่งมาก! ได้ ${stars} ดาว (+${xp} XP)`);
    }

    onComplete({
      passed,
      stars,
      accuracy,
      pct,
      xp: passed ? xp : 0,
      isCheckpoint
    });

    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    host.innerHTML = `
      <div class="lp-end-card card-panel">
        <div class="lp-end-badge">${passed ? (isCheckpoint ? '🏆' : '🎉') : '💪'}</div>
        <h2 class="lp-end-title">${
          isCheckpoint
            ? (passed ? `ผ่าน Checkpoint บทที่ ${unit.num}!` : `ยังไม่ผ่านเกณฑ์ 80%`)
            : (passed ? 'จบบทเรียนเรียบร้อย!' : 'ลองฝึกอีกครั้งนะ')
        }</h2>
        <div class="lp-end-stars" aria-label="${stars} จาก 3 ดาว">${starStr}</div>
        <div class="lp-end-stats">
          <div class="lp-stat-box"><span>ความแม่นยำ</span><strong>${pct}%</strong></div>
          <div class="lp-stat-box"><span>คะแนน</span><strong>${Math.round(score * 10) / 10} / ${total}</strong></div>
          <div class="lp-stat-box"><span>XP ที่ได้รับ</span><strong>+${passed ? xp : 0} XP</strong></div>
        </div>
        ${mistakes.length ? `
          <div class="lp-mistake-review">
            <h4>คำที่ควรทบทวน (${mistakes.length})</h4>
            <div class="lp-mistake-list">
              ${mistakes.map(m => `
                <div class="lp-mistake-row">
                  <span class="lp-hz">${core.escapeHtml(m.hz)}</span>
                  <span class="lp-py">${core.escapeHtml(m.py)}</span>
                  <span class="lp-th">${core.escapeHtml(m.th)}</span>
                  <button type="button" class="lp-icon-btn" data-speak="${core.escapeHtml(m.hz)}" aria-label="ฟังเสียง">🔊</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '<p class="lp-perfect-msg">ตอบถูกครบทุกข้อ ไม่มีจุดผิดพลาดเลย!</p>'}
        <div class="lp-end-actions">
          <button type="button" class="btn-secondary" data-action="retry">ทำอีกครั้ง</button>
          <button type="button" class="btn-primary" data-action="back">กลับสู่เส้นทางบทเรียน</button>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-speak]').forEach(btn => {
      btn.addEventListener('click', () => core.speak(btn.dataset.speak));
    });
    host.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      runLessonView(host, { core, unit, lesson, allUnits, onComplete, onExit });
    });
    host.querySelector('[data-action="back"]')?.addEventListener('click', onExit);
  };

  const renderExercise = () => {
    stopRec();
    if (idx >= exercises.length) {
      renderEndScreen();
      return;
    }
    answered = false;
    const ex = exercises[idx];
    const pct = Math.round((idx / exercises.length) * 100);
    const title = isCheckpoint ? `🏆 Checkpoint บทที่ ${unit.num}: ${unit.title}` : `${lesson.emoji} ${lesson.title}`;

    host.innerHTML = `
      <div class="lp-runner">
        <div class="lp-runner-top">
          <button type="button" class="lp-close-btn" data-action="exit" aria-label="ออกจากบทเรียน">✕</button>
          <div class="lp-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="lp-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="lp-progress-count">${idx + 1}/${exercises.length}</span>
        </div>
        <div class="lp-runner-meta">${core.escapeHtml(title)}</div>
        <div class="lp-exercise-body" id="lp-ex-body"></div>
        <div class="lp-feedback-bar" id="lp-feedback" hidden></div>
      </div>
    `;

    host.querySelector('[data-action="exit"]')?.addEventListener('click', () => {
      stopRec();
      onExit();
    });

    const body = host.querySelector('#lp-ex-body');
    const fb = host.querySelector('#lp-feedback');

    const finishStep = ({ ok, partial = false, correctHz, correctPy, correctTh, note = '', wrongItem = null }) => {
      if (answered) return;
      answered = true;
      stopRec();

      if (ok) {
        score += partial ? 0.7 : 1;
        core.playChime('ok');
      } else {
        core.playChime('err');
        if (wrongItem) recordWrong(wrongItem);
      }

      fb.hidden = false;
      fb.className = `lp-feedback-bar ${ok ? (partial ? 'lp-fb-partial' : 'lp-fb-ok') : 'lp-fb-err'}`;
      fb.innerHTML = `
        <div class="lp-fb-info">
          <div class="lp-fb-status">${ok ? (partial ? '✨ ถูกต้องบางส่วน (วรรณยุกต์ยังไม่ครบ)' : '✅ ถูกต้อง!') : '❌ ยังไม่ถูก'}</div>
          <div class="lp-fb-answer">
            <strong>${core.escapeHtml(correctHz)}</strong>
            <span>${core.escapeHtml(correctPy)}</span>
            ${correctTh ? `<span class="lp-fb-th">— ${core.escapeHtml(correctTh)}</span>` : ''}
            ${correctHz ? `<button type="button" class="lp-icon-btn" data-fb-speak aria-label="ฟังเสียง">🔊</button>` : ''}
          </div>
          ${note ? `<div class="lp-fb-note">${core.escapeHtml(note)}</div>` : ''}
        </div>
        <button type="button" class="btn-primary lp-fb-next" data-fb-next>ข้อถัดไป →</button>
      `;

      fb.querySelector('[data-fb-speak]')?.addEventListener('click', () => core.speak(correctHz));
      fb.querySelector('[data-fb-next]')?.addEventListener('click', () => {
        idx += 1;
        renderExercise();
      });
    };

    // --- Render each exercise type ---
    if (ex.type === 'emoji-choice') {
      body.innerHTML = `
        <div class="lp-ex-label">เลือกรูปและคำศัพท์ภาษาจีนที่ตรงกับภาพ</div>
        <div class="lp-emoji-stage">
          <div class="lp-emoji-big">${ex.word.emoji || '🀄'}</div>
          <div class="lp-emoji-hint">${core.escapeHtml(ex.word.th)}</div>
        </div>
        <div class="lp-choice-grid">
          ${ex.choices.map((c, i) => `
            <button type="button" class="lp-choice-btn" data-ci="${i}">
              <span class="lp-choice-hz">${core.escapeHtml(c.hz)}</span>
              <span class="lp-choice-py">${core.escapeHtml(c.py)}</span>
            </button>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-ci]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          const picked = ex.choices[Number(btn.dataset.ci)];
          const ok = picked.hz === ex.word.hz;
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          core.speak(ex.word.hz);
          finishStep({ ok, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th, wrongItem: ok ? null : ex.word });
        });
      });
    } else if (ex.type === 'listen-choose') {
      body.innerHTML = `
        <div class="lp-ex-label">ฟังเสียงแล้วเลือกคำแปลที่ถูกต้อง</div>
        <div class="lp-audio-stage">
          <button type="button" class="lp-audio-big-btn" data-play>🔊 กดฟังเสียง</button>
        </div>
        <div class="lp-choice-grid">
          ${ex.choices.map((c, i) => `
            <button type="button" class="lp-choice-btn" data-ci="${i}">
              <span class="lp-choice-hz">${core.escapeHtml(c.hz)}</span>
              <span class="lp-choice-th">${core.escapeHtml(c.th)}</span>
            </button>
          `).join('')}
        </div>
      `;
      body.querySelector('[data-play]')?.addEventListener('click', () => core.speak(ex.word.hz));
      setTimeout(() => core.speak(ex.word.hz), 180);
      body.querySelectorAll('[data-ci]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          const picked = ex.choices[Number(btn.dataset.ci)];
          const ok = picked.hz === ex.word.hz;
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          finishStep({ ok, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th, wrongItem: ok ? null : ex.word });
        });
      });
    } else if (ex.type === 'zh-to-th') {
      body.innerHTML = `
        <div class="lp-ex-label">คำภาษาจีนนี้แปลว่าอะไร?</div>
        <div class="lp-prompt-card">
          <div class="lp-prompt-hz">${core.escapeHtml(ex.word.hz)}</div>
          <div class="lp-prompt-py">${core.escapeHtml(ex.word.py)}</div>
          <button type="button" class="lp-icon-btn" data-play aria-label="ฟังเสียง">🔊</button>
        </div>
        <div class="lp-choice-list">
          ${ex.choices.map((c, i) => `
            <button type="button" class="lp-choice-btn lp-choice-row" data-ci="${i}">
              ${core.escapeHtml(c.th)}
            </button>
          `).join('')}
        </div>
      `;
      body.querySelector('[data-play]')?.addEventListener('click', () => core.speak(ex.word.hz));
      body.querySelectorAll('[data-ci]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          const picked = ex.choices[Number(btn.dataset.ci)];
          const ok = picked.hz === ex.word.hz;
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          finishStep({ ok, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th, wrongItem: ok ? null : ex.word });
        });
      });
    } else if (ex.type === 'th-to-zh') {
      body.innerHTML = `
        <div class="lp-ex-label">เลือกภาษาจีนที่ตรงกับความหมาย</div>
        <div class="lp-prompt-card">
          <div class="lp-prompt-th">${core.escapeHtml(ex.word.th)}</div>
        </div>
        <div class="lp-choice-grid">
          ${ex.choices.map((c, i) => `
            <button type="button" class="lp-choice-btn" data-ci="${i}">
              <span class="lp-choice-hz">${core.escapeHtml(c.hz)}</span>
              <span class="lp-choice-py">${core.escapeHtml(c.py)}</span>
            </button>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-ci]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          const picked = ex.choices[Number(btn.dataset.ci)];
          const ok = picked.hz === ex.word.hz;
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          core.speak(ex.word.hz);
          finishStep({ ok, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th, wrongItem: ok ? null : ex.word });
        });
      });
    } else if (ex.type === 'sentence-order') {
      const selected = [];
      const renderTiles = () => {
        const selectedIds = new Set(selected.map(t => t.id));
        body.innerHTML = `
          <div class="lp-ex-label">แตะเรียงคำให้เป็นประโยคภาษาจีนที่ถูกต้อง</div>
          <div class="lp-prompt-card">
            <div class="lp-prompt-th">${core.escapeHtml(ex.sentence.th)}</div>
          </div>
          <div class="lp-answer-tray" aria-label="ประโยคที่คุณเรียง">
            ${selected.length
              ? selected.map((t, i) => `<button type="button" class="lp-tile lp-tile-placed" data-rem="${i}">${core.escapeHtml(t.text)}</button>`).join('')
              : '<span class="lp-tray-placeholder">แตะคำด้านล่างเพื่อเรียงประโยค...</span>'}
          </div>
          <div class="lp-tile-bank">
            ${ex.tiles.map(t => `
              <button type="button" class="lp-tile" data-add="${t.id}" ${selectedIds.has(t.id) ? 'disabled' : ''}>
                ${core.escapeHtml(t.text)}
              </button>
            `).join('')}
          </div>
          <div class="lp-ex-actions">
            <button type="button" class="btn-secondary" data-clear ${selected.length ? '' : 'disabled'}>ล้าง</button>
            <button type="button" class="btn-primary" data-check ${selected.length === ex.tiles.length ? '' : 'disabled'}>ตรวจคำตอบ</button>
          </div>
        `;
        body.querySelectorAll('[data-add]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (answered) return;
            const tile = ex.tiles.find(t => t.id === Number(btn.dataset.add));
            if (tile) { selected.push(tile); renderTiles(); }
          });
        });
        body.querySelectorAll('[data-rem]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (answered) return;
            selected.splice(Number(btn.dataset.rem), 1);
            renderTiles();
          });
        });
        body.querySelector('[data-clear]')?.addEventListener('click', () => {
          if (answered) return;
          selected.length = 0;
          renderTiles();
        });
        body.querySelector('[data-check]')?.addEventListener('click', () => {
          const userStr = selected.map(t => t.text).join('');
          const targetStr = ex.sentence.tokens.join('');
          const ok = userStr === targetStr;
          core.speak(ex.sentence.hz);
          finishStep({
            ok,
            correctHz: ex.sentence.hz,
            correctPy: ex.sentence.py,
            correctTh: ex.sentence.th,
            wrongItem: ok ? null : ex.sentence
          });
        });
      };
      renderTiles();
    } else if (ex.type === 'matching') {
      let pickedLeft = null;
      const matched = new Set();
      let hadError = false;

      const renderMatch = () => {
        body.innerHTML = `
          <div class="lp-ex-label">จับคู่คำภาษาจีนกับความหมายภาษาไทย (${matched.size}/${ex.pairs.length})</div>
          <div class="lp-match-grid">
            <div class="lp-match-col">
              ${ex.leftOrder.map(w => `
                <button type="button" class="lp-match-btn ${pickedLeft === w.hz ? 'is-selected' : ''} ${matched.has(w.hz) ? 'is-matched' : ''}" data-left="${core.escapeHtml(w.hz)}" ${matched.has(w.hz) ? 'disabled' : ''}>
                  <strong>${core.escapeHtml(w.hz)}</strong>
                  <small>${core.escapeHtml(w.py)}</small>
                </button>
              `).join('')}
            </div>
            <div class="lp-match-col">
              ${ex.rightOrder.map(w => `
                <button type="button" class="lp-match-btn ${matched.has(w.hz) ? 'is-matched' : ''}" data-right="${core.escapeHtml(w.hz)}" ${matched.has(w.hz) ? 'disabled' : ''}>
                  ${core.escapeHtml(w.th)}
                </button>
              `).join('')}
            </div>
          </div>
        `;
        body.querySelectorAll('[data-left]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (answered) return;
            pickedLeft = btn.dataset.left;
            core.speak(pickedLeft);
            renderMatch();
          });
        });
        body.querySelectorAll('[data-right]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (answered || !pickedLeft) return;
            const rightHz = btn.dataset.right;
            if (rightHz === pickedLeft) {
              matched.add(rightHz);
              pickedLeft = null;
              if (matched.size === ex.pairs.length) {
                finishStep({
                  ok: true,
                  partial: hadError,
                  correctHz: ex.pairs.map(p => p.hz).join(' · '),
                  correctPy: 'จับคู่ครบทุกคำแล้ว!',
                  correctTh: ''
                });
              } else {
                renderMatch();
              }
            } else {
              hadError = true;
              btn.classList.add('is-wrong');
              core.playChime('err');
              setTimeout(() => btn.classList.remove('is-wrong'), 450);
            }
          });
        });
      };
      renderMatch();
    } else if (ex.type === 'fill-blank') {
      const displayTokens = ex.sentence.tokens.map((t, i) => (i === ex.blankIdx ? ' ____ ' : t)).join('');
      body.innerHTML = `
        <div class="lp-ex-label">เติมคำที่หายไปในประโยค</div>
        <div class="lp-prompt-card">
          <div class="lp-prompt-hz">${core.escapeHtml(displayTokens)}</div>
          <div class="lp-prompt-th">${core.escapeHtml(ex.sentence.th)}</div>
        </div>
        <div class="lp-choice-grid">
          ${ex.choices.map((c, i) => `
            <button type="button" class="lp-choice-btn" data-ci="${i}">
              <span class="lp-choice-hz">${core.escapeHtml(c)}</span>
            </button>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('[data-ci]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          const picked = ex.choices[Number(btn.dataset.ci)];
          const ok = picked === ex.answerToken;
          btn.classList.add(ok ? 'is-correct' : 'is-wrong');
          core.speak(ex.sentence.hz);
          finishStep({
            ok,
            correctHz: ex.sentence.hz,
            correctPy: ex.sentence.py,
            correctTh: ex.sentence.th,
            wrongItem: ok ? null : ex.sentence
          });
        });
      });
    } else if (ex.type === 'type-pinyin') {
      body.innerHTML = `
        <div class="lp-ex-label">พิมพ์พินอิน (เช่น ni3hao3 หรือ nǐ hǎo) หรืออักษรจีน</div>
        <div class="lp-prompt-card">
          <div class="lp-prompt-hz">${core.escapeHtml(ex.word.hz)}</div>
          <div class="lp-prompt-th">${core.escapeHtml(ex.word.th)}</div>
          <button type="button" class="lp-icon-btn" data-play aria-label="ฟังเสียง">🔊</button>
        </div>
        <form class="lp-input-form" data-form>
          <input type="text" class="lp-text-input" placeholder="พิมพ์พินอิน เช่น ni3hao3..." autocomplete="off" autocapitalize="none" spellcheck="false" />
          <button type="submit" class="btn-primary">ตรวจ</button>
        </form>
      `;
      body.querySelector('[data-play]')?.addEventListener('click', () => core.speak(ex.word.hz));
      const input = body.querySelector('input');
      input?.focus();
      body.querySelector('[data-form]')?.addEventListener('submit', e => {
        e.preventDefault();
        if (answered) return;
        const res = gradeDictationAnswer(input.value, ex.word);
        const ok = res.status === 'exact' || res.status === 'partial';
        core.speak(ex.word.hz);
        finishStep({
          ok,
          partial: res.status === 'partial',
          correctHz: ex.word.hz,
          correctPy: ex.word.py,
          correctTh: ex.word.th,
          wrongItem: ok ? null : ex.word
        });
      });
    } else if (ex.type === 'speak-it') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      body.innerHTML = `
        <div class="lp-ex-label">ฝึกออกเสียงภาษาจีน</div>
        <div class="lp-prompt-card">
          <div class="lp-prompt-hz">${core.escapeHtml(ex.word.hz)}</div>
          <div class="lp-prompt-py">${core.escapeHtml(ex.word.py)}</div>
          <div class="lp-prompt-th">${core.escapeHtml(ex.word.th)}</div>
          <button type="button" class="lp-icon-btn" data-play aria-label="ฟังตัวอย่าง">🔊 ฟังตัวอย่าง</button>
        </div>
        <div class="lp-speak-stage">
          ${SR
            ? `<button type="button" class="btn-primary lp-mic-btn" data-mic>🎙️ กดเพื่อพูด</button>
               <div class="lp-speak-status" data-status>กดปุ่มไมโครโฟนแล้วพูดคำด้านบน</div>`
            : `<div class="lp-speak-status">เบราว์เซอร์นี้ไม่รองรับการรับเสียงอัตโนมัติ — กดฟังตัวอย่างแล้วฝึกออกเสียงตามได้เลย</div>`
          }
          <button type="button" class="btn-secondary" data-skip>ข้ามข้อนี้ (ไม่เสียคะแนน)</button>
        </div>
      `;
      body.querySelector('[data-play]')?.addEventListener('click', () => core.speak(ex.word.hz));
      body.querySelector('[data-skip]')?.addEventListener('click', () => {
        finishStep({
          ok: true,
          correctHz: ex.word.hz,
          correctPy: ex.word.py,
          correctTh: ex.word.th,
          note: 'ข้ามการพูด (สามารถฝึกออกเสียงย้อนหลังได้ตลอด)'
        });
      });
      body.querySelector('[data-mic]')?.addEventListener('click', () => {
        if (answered || !SR) return;
        const statusEl = body.querySelector('[data-status]');
        try {
          const rec = new SR();
          activeRecognition = rec;
          rec.lang = 'zh-CN';
          rec.interimResults = false;
          rec.maxAlternatives = 3;
          statusEl.textContent = 'กำลังฟัง... พูดได้เลยครับ';
          rec.onresult = (ev) => {
            const transcripts = Array.from(ev.results[0] || []).map(r => r.transcript);
            const targetNorm = normalizeHanzi(ex.word.hz);
            const matched = transcripts.some(t => normalizeHanzi(t).includes(targetNorm) || targetNorm.includes(normalizeHanzi(t)));
            statusEl.textContent = `ได้ยินว่า: "${transcripts[0] || ''}"`;
            finishStep({
              ok: matched,
              correctHz: ex.word.hz,
              correctPy: ex.word.py,
              correctTh: ex.word.th,
              note: matched ? 'ออกเสียงชัดเจนมาก!' : `ระบบได้ยิน "${transcripts[0] || ''}" ลองฟังตัวอย่างอีกครั้งนะ`,
              wrongItem: matched ? null : ex.word
            });
          };
          rec.onerror = () => {
            statusEl.textContent = 'ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณากดข้ามหรือลองใหม่';
          };
          rec.start();
        } catch {
          statusEl.textContent = 'ไม่สามารถเริ่มไมโครโฟนได้';
        }
      });
    } else if (ex.type === 'write-char') {
      body.innerHTML = `
        <div class="lp-ex-label">ฝึกเขียนอักษรจีนตามลำดับขีด</div>
        <div class="lp-prompt-card">
          <div class="lp-prompt-py">${core.escapeHtml(ex.word.py)} — ${core.escapeHtml(ex.word.th)}</div>
        </div>
        <div class="lp-writer-box" id="lp-hanzi-target"></div>
        <div class="lp-ex-actions">
          <button type="button" class="btn-secondary" data-skip>ข้ามข้อเขียน</button>
        </div>
      `;
      body.querySelector('[data-skip]')?.addEventListener('click', () => {
        finishStep({ ok: true, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th });
      });
      try {
        const writer = window.HanziWriter.create('lp-hanzi-target', ex.char, {
          width: 200,
          height: 200,
          padding: 12,
          showOutline: true
        });
        writer.quiz({
          onComplete: () => {
            finishStep({ ok: true, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th, note: 'เขียนครบทุกขีดยอดเยี่ยม!' });
          }
        });
      } catch {
        finishStep({ ok: true, correctHz: ex.word.hz, correctPy: ex.word.py, correctTh: ex.word.th });
      }
    }
  };

  renderExercise();
}
