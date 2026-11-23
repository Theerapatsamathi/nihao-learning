// #14 Four Mini-Games: Word Sprint, Tone Bubble, Radical Builder, Measure-word Match
import {
  RADICAL_ITEMS,
  MEASURE_WORDS,
  MEASURE_ITEMS,
  TONE_BUBBLE_SETS,
  SPRINT_FALLBACK_VOCAB
} from './data-games.js';
import { buildSprintQuestion, getGrExt, saveBestScore, esc } from './utils.js';

const GAMES_META = [
  { id: 'sprint', emoji: '⚡', title: 'Word Sprint', sub: 'ทายคำศัพท์ ถูก/ผิด ภายใน 60 วินาที ยิ่งถูกต่อเนื่องยิ่งเร็ว!' },
  { id: 'bubble', emoji: '🫧', title: 'Tone Bubble', sub: 'ฟังเสียงวรรณยุกต์แล้วจิ้มฟองสบู่พินอินที่ตรงเสียงก่อนลอยหาย' },
  { id: 'radical', emoji: '🧩', title: 'Radical Builder', sub: 'ประกอบอักษรจีนจาก 2 ส่วนประกอบ (เช่น 女 + 子 = 好)' },
  { id: 'measure', emoji: '📏', title: 'Measure-word Match', sub: 'เลือกลักษณนามจีน (个/本/只/张/杯…) ให้ตรงกับคำนาม' }
];

function getVocabPool(core) {
  const fromCore = Array.isArray(core?.allVocabWords)
    ? core.allVocabWords
        .map((w) => ({
          zh: w.zh || w.hanzi || w.word || '',
          py: w.py || w.pinyin || '',
          th: w.th || w.meaning || w.thai || ''
        }))
        .filter((w) => w.zh && w.th)
    : [];
  return fromCore.length >= 20 ? fromCore : [...fromCore, ...SPRINT_FALLBACK_VOCAB];
}

function shuffle(core, arr) {
  if (core?.shuffleArray) return core.shuffleArray([...arr]);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function renderGamesSection(core, host) {
  let activeCleanup = null;
  const clearActive = () => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    core?.stopSpeech?.();
  };

  function showMenu() {
    clearActive();
    const ext = getGrExt(core);
    host.innerHTML = `
      <div class="gr-grid">
        ${GAMES_META.map((g) => {
          const best = ext.bestScores[g.id] || 0;
          return `
            <button type="button" class="gr-card gr-card-click" data-game="${g.id}">
              <div class="gr-card-head">
                <span class="gr-emoji">${g.emoji}</span>
                <span class="gr-badge">🏆 สูงสุด ${best}</span>
              </div>
              <h3 class="gr-title">${esc(core, g.title)}</h3>
              <p class="gr-sub">${esc(core, g.sub)}</p>
            </button>
          `;
        }).join('')}
      </div>
    `;
    host.querySelectorAll('[data-game]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.game;
        if (id === 'sprint') startWordSprint();
        else if (id === 'bubble') startToneBubble();
        else if (id === 'radical') startRadicalBuilder();
        else if (id === 'measure') startMeasureMatch();
      });
    });
  }

  function showResult(gameId, title, score, detailText, onReplay) {
    clearActive();
    const { best, isNewBest } = saveBestScore(core, gameId, score);
    const xp = Math.min(40, Math.max(5, Math.round(score / 10) * 5));
    if (score > 0) {
      core?.addXp?.(xp, `gr-game-${gameId}`);
      core?.logActivity?.(1);
      if (isNewBest) {
        core?.playChime?.('levelup', true);
        core?.spawnConfetti?.(24);
      }
    }
    host.innerHTML = `
      <div class="gr-game-stage" style="text-align:center">
        <div class="gr-emoji">${isNewBest ? '🏆' : '🎉'}</div>
        <h3 class="gr-title">${esc(core, title)} — จบเกม!</h3>
        <div style="font-size:2.2rem;font-weight:800;color:var(--sys-accent-text)">${score} คะแนน</div>
        <p class="gr-sub">${esc(core, detailText)}</p>
        <div class="gr-row" style="justify-content:center">
          <span class="gr-badge ${isNewBest ? 'gr-badge-orange' : ''}">${isNewBest ? '✨ สถิติใหม่!' : `สูงสุด: ${best}`}</span>
          ${score > 0 ? `<span class="gr-badge gr-badge-green">+${xp} XP</span>` : ''}
        </div>
        <div class="gr-row" style="justify-content:center;margin-top:8px">
          <button type="button" class="btn-primary" id="gr-replay">เล่นอีกครั้ง</button>
          <button type="button" class="btn-secondary" id="gr-back">กลับหน้ารวมเกม</button>
        </div>
      </div>
    `;
    host.querySelector('#gr-replay')?.addEventListener('click', onReplay);
    host.querySelector('#gr-back')?.addEventListener('click', showMenu);
  }

  // 1) Word Sprint (60s rapid true/false with speed-up)
  function startWordSprint() {
    clearActive();
    const pool = getVocabPool(core);
    let timeLeft = 60;
    let score = 0;
    let streak = 0;
    let answered = 0;
    let correctCount = 0;
    let cur = buildSprintQuestion(pool);
    let timerId = null;
    let roundDeadline = Date.now() + 5000;

    const getRoundWindowMs = () => Math.max(1800, 5000 - streak * 250);

    function nextQ() {
      cur = buildSprintQuestion(pool);
      roundDeadline = Date.now() + getRoundWindowMs();
      render();
    }

    function answer(choice) {
      if (!cur) return;
      answered += 1;
      if (choice === cur.isMatch) {
        streak += 1;
        correctCount += 1;
        const pts = 10 + Math.min(20, streak * 2);
        score += pts;
        core?.playChime?.('ok');
      } else {
        streak = 0;
        timeLeft = Math.max(0, timeLeft - 2);
        core?.playChime?.('err');
      }
      if (timeLeft <= 0) finish();
      else nextQ();
    }

    function finish() {
      if (timerId) clearInterval(timerId);
      timerId = null;
      showResult(
        'sprint',
        'Word Sprint',
        score,
        `ตอบถูก ${correctCount}/${answered} ข้อ`,
        startWordSprint
      );
    }

    function render() {
      const pct = Math.max(0, Math.min(100, (timeLeft / 60) * 100));
      host.innerHTML = `
        <div class="gr-game-stage">
          <div class="gr-between">
            <button type="button" class="btn-secondary" id="gr-exit">← ออก</button>
            <div class="gr-hud">
              <span>⏱ ${timeLeft.toFixed(0)}s</span>
              <span>🔥 x${streak}</span>
              <span>⭐ ${score}</span>
            </div>
          </div>
          <div class="gr-timer-bar"><div class="gr-timer-fill" style="width:${pct}%"></div></div>
          <div class="gr-sprint-card">
            <div class="gr-sprint-zh">${esc(core, cur.zh)}</div>
            ${cur.py ? `<div class="gr-sprint-py">${esc(core, cur.py)}</div>` : ''}
            <div class="gr-sprint-th">${esc(core, cur.shownTh)}</div>
            <p class="gr-sub" style="margin-top:10px">ความหมายตรงกันหรือไม่?</p>
          </div>
          <div class="gr-sprint-actions">
            <button type="button" class="gr-btn-true" id="gr-yes">✓ ตรงกัน</button>
            <button type="button" class="gr-btn-false" id="gr-no">✕ ไม่ตรง</button>
          </div>
        </div>
      `;
      host.querySelector('#gr-exit')?.addEventListener('click', showMenu);
      host.querySelector('#gr-yes')?.addEventListener('click', () => answer(true));
      host.querySelector('#gr-no')?.addEventListener('click', () => answer(false));
    }

    timerId = setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 0.25);
      if (Date.now() > roundDeadline) {
        streak = 0;
        core?.playChime?.('err');
        if (timeLeft > 0) nextQ();
      }
      const fill = host.querySelector('.gr-timer-fill');
      const hudTime = host.querySelector('.gr-hud span');
      if (fill) fill.style.width = `${Math.max(0, (timeLeft / 60) * 100)}%`;
      if (hudTime) hudTime.textContent = `⏱ ${Math.ceil(timeLeft)}s`;
      if (timeLeft <= 0) finish();
    }, 250);

    activeCleanup = () => {
      if (timerId) clearInterval(timerId);
    };
    render();
  }

  // 2) Tone Bubble (floating bubbles DOM animation + audio)
  function startToneBubble() {
    clearActive();
    let score = 0;
    let lives = 3;
    let round = 0;
    const maxRounds = 10;
    let rafId = null;
    let bubbles = [];
    let target = null;
    let arenaEl = null;
    let running = true;

    host.innerHTML = `
      <div class="gr-game-stage">
        <div class="gr-between">
          <button type="button" class="btn-secondary" id="gr-exit">← ออก</button>
          <div class="gr-hud">
            <span id="gr-tb-round">รอบ 1/${maxRounds}</span>
            <span id="gr-tb-lives">❤️❤️❤️</span>
            <span id="gr-tb-score">⭐ 0</span>
          </div>
        </div>
        <div class="gr-between">
          <div class="gr-sub" id="gr-tb-prompt">ฟังเสียงแล้วจิ้มฟองสบู่ที่มีวรรณยุกต์ถูกต้อง!</div>
          <button type="button" class="btn-primary" id="gr-tb-hear">🔊 ฟังเสียงอีกครั้ง</button>
        </div>
        <div class="gr-bubble-arena" id="gr-tb-arena" aria-label="พื้นที่ฟองสบู่วรรณยุกต์"></div>
      </div>
    `;

    arenaEl = host.querySelector('#gr-tb-arena');
    host.querySelector('#gr-exit')?.addEventListener('click', showMenu);
    host.querySelector('#gr-tb-hear')?.addEventListener('click', () => {
      if (target) core?.speak?.(target.zh);
    });

    function updateHud() {
      const rEl = host.querySelector('#gr-tb-round');
      const lEl = host.querySelector('#gr-tb-lives');
      const sEl = host.querySelector('#gr-tb-score');
      if (rEl) rEl.textContent = `รอบ ${Math.min(round, maxRounds)}/${maxRounds}`;
      if (lEl) lEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '💔';
      if (sEl) sEl.textContent = `⭐ ${score}`;
    }

    function spawnRound() {
      if (!running) return;
      if (lives <= 0 || round >= maxRounds) {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        showResult('bubble', 'Tone Bubble', score, `ผ่าน ${round} รอบ • เหลือหัวใจ ${lives}`, startToneBubble);
        return;
      }
      round += 1;
      updateHud();
      arenaEl.innerHTML = '';
      const set = TONE_BUBBLE_SETS[Math.floor(Math.random() * TONE_BUBBLE_SETS.length)];
      target = set.tones[Math.floor(Math.random() * set.tones.length)];
      const arenaW = Math.max(280, arenaEl.clientWidth || 320);
      const shuffledTones = shuffle(core, set.tones);
      const speedBase = 0.55 + round * 0.06;

      bubbles = shuffledTones.map((item, i) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'gr-bubble';
        el.innerHTML = `<span>${esc(core, item.py)}</span><span class="gr-bubble-tone">เสียง ${item.tone}</span>`;
        const colW = (arenaW - 90) / 4;
        const x = Math.max(8, Math.min(arenaW - 86, i * colW + 10 + Math.random() * 14));
        const y = 260 + i * 26;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.addEventListener('click', () => {
          if (!running) return;
          if (item.tone === target.tone) {
            score += 15;
            core?.playChime?.('ok');
            core?.showToast?.(`ถูกต้อง! ${item.zh} (${item.py}) = ${item.th}`);
            spawnRound();
          } else {
            lives -= 1;
            core?.playChime?.('err');
            el.style.opacity = '0.3';
            el.disabled = true;
            updateHud();
            if (lives <= 0) spawnRound();
          }
        });
        arenaEl.appendChild(el);
        return { el, x, y, vy: speedBase + Math.random() * 0.25, tone: item.tone };
      });

      core?.speak?.(target.zh);
    }

    function tick() {
      if (!running) return;
      let targetEscaped = false;
      for (const b of bubbles) {
        b.y -= b.vy;
        b.el.style.top = `${b.y}px`;
        if (b.y < -82 && b.tone === target?.tone) {
          targetEscaped = true;
        }
      }
      if (targetEscaped) {
        lives -= 1;
        core?.playChime?.('err');
        spawnRound();
      }
      rafId = requestAnimationFrame(tick);
    }

    activeCleanup = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
    spawnRound();
    rafId = requestAnimationFrame(tick);
  }

  // 3) Radical Builder (assemble character from 2 components)
  function startRadicalBuilder() {
    clearActive();
    const deck = shuffle(core, RADICAL_ITEMS).slice(0, 10);
    let idx = 0;
    let score = 0;
    let locked = false;

    function renderRound() {
      if (idx >= deck.length) {
        showResult('radical', 'Radical Builder', score, `ประกอบอักษรครบ ${deck.length} ข้อ`, startRadicalBuilder);
        return;
      }
      locked = false;
      const item = deck[idx];
      const allRights = [...new Set(RADICAL_ITEMS.map((r) => r.right).filter((r) => r !== item.right))];
      const distractors = shuffle(core, allRights).slice(0, 3);
      const options = shuffle(core, [item.right, ...distractors]);

      host.innerHTML = `
        <div class="gr-game-stage">
          <div class="gr-between">
            <button type="button" class="btn-secondary" id="gr-exit">← ออก</button>
            <div class="gr-hud">
              <span>ข้อ ${idx + 1}/${deck.length}</span>
              <span>⭐ ${score}</span>
            </div>
          </div>
          <p class="gr-sub" style="text-align:center">เลือกส่วนประกอบที่ขาดหายเพื่อสร้างอักษรที่มีความหมายว่า <strong>"${esc(core, item.th)}"</strong> (${esc(core, item.py)})</p>
          <div class="gr-formula">
            <span>${esc(core, item.left)}</span>
            <span>+</span>
            <span class="gr-slot" id="gr-rad-slot">?</span>
            <span>=</span>
            <span id="gr-rad-res" style="color:var(--sys-accent-text)">？</span>
          </div>
          <div class="gr-choices">
            ${options.map((opt) => `<button type="button" class="gr-choice-btn" data-opt="${esc(core, opt)}">${esc(core, opt)}</button>`).join('')}
          </div>
          <div id="gr-rad-fb" class="gr-sub" style="text-align:center;min-height:22px"></div>
        </div>
      `;
      host.querySelector('#gr-exit')?.addEventListener('click', showMenu);
      host.querySelectorAll('[data-opt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          locked = true;
          const picked = btn.dataset.opt;
          const ok = picked === item.right;
          host.querySelector('#gr-rad-slot').textContent = item.right;
          host.querySelector('#gr-rad-res').textContent = item.char;
          if (ok) {
            score += 15;
            btn.classList.add('is-correct');
            core?.playChime?.('ok');
          } else {
            btn.classList.add('is-wrong');
            core?.playChime?.('err');
          }
          core?.speak?.(item.char);
          host.querySelector('#gr-rad-fb').textContent = `${item.char} (${item.py}) — ${item.hint}`;
          setTimeout(() => {
            idx += 1;
            renderRound();
          }, 1250);
        });
      });
    }
    renderRound();
  }

  // 4) Measure-word Match (pick 个/本/只/张/杯/件/条/辆/位/双/支/瓶)
  function startMeasureMatch() {
    clearActive();
    const deck = shuffle(core, MEASURE_ITEMS).slice(0, 12);
    let idx = 0;
    let score = 0;
    let locked = false;

    function renderRound() {
      if (idx >= deck.length) {
        showResult('measure', 'Measure-word Match', score, `จับคู่ลักษณนามครบ ${deck.length} ข้อ`, startMeasureMatch);
        return;
      }
      locked = false;
      const item = deck[idx];
      const others = shuffle(
        core,
        MEASURE_WORDS.filter((m) => m.mw !== item.mw)
      ).slice(0, 3);
      const correctObj = MEASURE_WORDS.find((m) => m.mw === item.mw) || { mw: item.mw, py: '', hint: '' };
      const options = shuffle(core, [correctObj, ...others]);

      host.innerHTML = `
        <div class="gr-game-stage">
          <div class="gr-between">
            <button type="button" class="btn-secondary" id="gr-exit">← ออก</button>
            <div class="gr-hud">
              <span>ข้อ ${idx + 1}/${deck.length}</span>
              <span>⭐ ${score}</span>
            </div>
          </div>
          <div class="gr-formula">
            <span>一</span>
            <span class="gr-slot" id="gr-mw-slot">?</span>
            <span>${esc(core, item.noun)}</span>
          </div>
          <p class="gr-sub" style="text-align:center">${esc(core, item.py)} — <strong>${esc(core, item.th)}</strong></p>
          <div class="gr-choices">
            ${options
              .map(
                (o) =>
                  `<button type="button" class="gr-choice-btn" data-mw="${esc(core, o.mw)}">${esc(core, o.mw)} <span style="font-size:0.8rem;color:var(--sys-label-2)">${esc(core, o.py)}</span></button>`
              )
              .join('')}
          </div>
          <div id="gr-mw-fb" class="gr-sub" style="text-align:center;min-height:22px"></div>
        </div>
      `;
      host.querySelector('#gr-exit')?.addEventListener('click', showMenu);
      host.querySelectorAll('[data-mw]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (locked) return;
          locked = true;
          const picked = btn.dataset.mw;
          const ok = picked === item.mw;
          host.querySelector('#gr-mw-slot').textContent = item.mw;
          if (ok) {
            score += 10;
            btn.classList.add('is-correct');
            core?.playChime?.('ok');
          } else {
            btn.classList.add('is-wrong');
            core?.playChime?.('err');
          }
          core?.speak?.(`一${item.mw}${item.noun}`);
          host.querySelector('#gr-mw-fb').textContent = `一${item.mw}${item.noun} — ${correctObj.hint}`;
          setTimeout(() => {
            idx += 1;
            renderRound();
          }, 1200);
        });
      });
    }
    renderRound();
  }

  showMenu();
  return () => clearActive();
}
