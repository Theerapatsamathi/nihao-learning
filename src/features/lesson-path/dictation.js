// #13 Dictation (ฝึกฟังเขียน): word / phrase / sentence
// Supports normal & slow audio, tone-marked / numbered / toneless pinyin (partial credit) or hanzi.

import { DICTATION_BANK } from './curriculum-data.js';
import { gradeDictationAnswer, seededShuffle } from './logic.js';

function speakSlow(core, zh) {
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(zh);
      u.lang = 'zh-CN';
      u.rate = 0.62;
      window.speechSynthesis.speak(u);
      return;
    } catch { /* fallback */ }
  }
  core.speak(zh);
}

export function renderDictationView(host, { core }) {
  let level = 'word';
  let sessionIdx = 0;
  let score = 0;
  let streak = 0;
  let items = [];
  let checked = false;
  let lastResult = null;
  let lastInput = '';

  const buildItems = (lvl) => {
    const base = [...(DICTATION_BANK[lvl] || [])];
    // Enrich word/sentence bank from existing L2 data when available
    if (lvl === 'word' && Array.isArray(core.data?.L2?.hsk1Words)) {
      const extra = core.data.L2.hsk1Words.slice(0, 12).map(w => ({ hz: w.hz, py: w.py, th: w.th }));
      for (const e of extra) {
        if (!base.some(b => b.hz === e.hz)) base.push(e);
      }
    }
    return seededShuffle(base, `dict:${lvl}:${core.todayKey?.() || 'today'}`).slice(0, 8);
  };

  const startLevel = (lvl) => {
    level = lvl;
    items = buildItems(lvl);
    sessionIdx = 0;
    score = 0;
    streak = 0;
    checked = false;
    lastResult = null;
    lastInput = '';
    render();
  };

  const render = () => {
    const done = sessionIdx >= items.length && items.length > 0;
    const cur = items[sessionIdx];

    host.innerHTML = `
      <div class="lp-section-card card-panel">
        <div class="lp-section-head">
          <div>
            <h3>✍️ ฝึกฟังเขียน (Dictation)</h3>
            <p class="lp-muted">ฟังเสียงภาษาจีนแล้วพิมพ์พินอิน (เช่น <code>ni3hao3</code>, <code>nǐ hǎo</code>, หรือไม่ใส่วรรณยุกต์ได้คะแนนบางส่วน) หรืออักษรจีน</p>
          </div>
          <div class="lp-pill-group" role="tablist" aria-label="ระดับการฟังเขียน">
            <button type="button" class="lp-pill ${level === 'word' ? 'is-active' : ''}" data-lvl="word">คำศัพท์</button>
            <button type="button" class="lp-pill ${level === 'phrase' ? 'is-active' : ''}" data-lvl="phrase">วลี</button>
            <button type="button" class="lp-pill ${level === 'sentence' ? 'is-active' : ''}" data-lvl="sentence">ประโยค</button>
          </div>
        </div>

        ${done ? `
          <div class="lp-dict-done">
            <div class="lp-end-badge">🎧</div>
            <h4>ฝึกฟังเขียนครบ ${items.length} ข้อแล้ว!</h4>
            <p>คะแนนรวม: <strong>${Math.round(score * 10) / 10} / ${items.length}</strong> (${Math.round((score / items.length) * 100)}%)</p>
            <button type="button" class="btn-primary" data-restart>ฝึกชุดใหม่อีกครั้ง</button>
          </div>
        ` : `
          <div class="lp-dict-meta">
            <span>ข้อที่ ${sessionIdx + 1} / ${items.length}</span>
            <span>คะแนน: <strong>${Math.round(score * 10) / 10}</strong> · ต่อเนื่อง ${streak} 🔥</span>
          </div>

          <div class="lp-dict-audio-bar">
            <button type="button" class="btn-primary lp-audio-btn" data-play>🔊 ฟังปกติ</button>
            <button type="button" class="btn-secondary lp-audio-btn" data-slow>🐢 ฟังช้า (0.6x)</button>
            <button type="button" class="btn-secondary lp-hint-btn" data-hint>💡 ดูความหมายไทย</button>
          </div>
          <div class="lp-dict-hint" id="lp-dict-hint" hidden>ความหมาย: <strong>${core.escapeHtml(cur.th)}</strong></div>

          <form class="lp-input-form" data-form>
            <input type="text" class="lp-text-input" value="${core.escapeHtml(lastInput)}" placeholder="พิมพ์พินอิน (ni3hao3) หรืออักษรจีน (你好)..." autocomplete="off" autocapitalize="none" spellcheck="false" ${checked ? 'disabled' : ''} />
            ${checked
              ? `<button type="button" class="btn-primary" data-next>ข้อถัดไป →</button>`
              : `<button type="submit" class="btn-primary">ตรวจคำตอบ</button>`
            }
          </form>

          ${checked && lastResult ? `
            <div class="lp-dict-result ${lastResult.status === 'exact' ? 'lp-fb-ok' : lastResult.status === 'partial' ? 'lp-fb-partial' : 'lp-fb-err'}">
              <div class="lp-fb-status">
                ${lastResult.status === 'exact'
                  ? '✅ ถูกต้องสมบูรณ์! (+1 คะแนน)'
                  : lastResult.status === 'partial'
                    ? '✨ ถูกต้องบางส่วน (+0.7 คะแนน — ลองใส่วรรณยุกต์ให้ครบนะ)'
                    : '❌ ยังไม่ตรง — ดูเฉลยด้านล่างแล้วฟังอีกครั้ง'}
              </div>
              <div class="lp-dict-answer">
                <span class="lp-hz-lg">${core.escapeHtml(cur.hz)}</span>
                <span class="lp-py-lg">${core.escapeHtml(cur.py)}</span>
                <span class="lp-th-lg">${core.escapeHtml(cur.th)}</span>
              </div>
            </div>
          ` : ''}
        `}
      </div>
    `;

    host.querySelectorAll('[data-lvl]').forEach(btn => {
      btn.addEventListener('click', () => startLevel(btn.dataset.lvl));
    });

    if (done) {
      host.querySelector('[data-restart]')?.addEventListener('click', () => startLevel(level));
      return;
    }

    host.querySelector('[data-play]')?.addEventListener('click', () => core.speak(cur.hz));
    host.querySelector('[data-slow]')?.addEventListener('click', () => speakSlow(core, cur.hz));
    host.querySelector('[data-hint]')?.addEventListener('click', () => {
      const el = host.querySelector('#lp-dict-hint');
      if (el) el.hidden = !el.hidden;
    });

    if (!checked) {
      const inp = host.querySelector('input');
      inp?.focus();
      host.querySelector('[data-form]')?.addEventListener('submit', e => {
        e.preventDefault();
        lastInput = inp?.value || '';
        const res = gradeDictationAnswer(lastInput, cur);
        lastResult = res;
        checked = true;
        if (res.status === 'exact' || res.status === 'partial') {
          score += res.score;
          streak += 1;
          core.playChime('ok');
        } else {
          streak = 0;
          core.playChime('err');
          core.recordMistake?.({ id: `lp-dict-${cur.hz}`, hz: cur.hz, py: cur.py, th: cur.th, source: 'lesson-path-dictation' });
        }
        render();
      });
    } else {
      host.querySelector('[data-next]')?.addEventListener('click', () => {
        sessionIdx += 1;
        checked = false;
        lastResult = null;
        lastInput = '';
        if (sessionIdx >= items.length) {
          const xp = Math.max(10, Math.round((score / items.length) * 30));
          core.addXp(xp, `lp-dictation-${level}`);
          core.showToast?.(`จบการฝึกฟังเขียน (+${xp} XP)`, `+${xp} XP`);
        }
        render();
      });
    }
  };

  startLevel('word');
}
