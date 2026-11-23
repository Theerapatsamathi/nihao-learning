// #21 Podcast Transcript: interactive audio-lesson episodes (speak/speakThai sequencing + tappable words + quiz)
import { PODCAST_EPISODES } from './data-podcast.js';
import { openWordPopover, closeWordPopover, renderTokensHtml } from './word-popover.js';
import { EXT_NS, getGrExt, esc } from './utils.js';

export function renderPodcastSection(core, host) {
  let isPlaying = false;
  let activeIdx = -1;

  function stopPlayback() {
    isPlaying = false;
    core?.stopSpeech?.();
    closeWordPopover();
  }

  function showList() {
    stopPlayback();
    const ext = getGrExt(core);
    host.innerHTML = `
      <div class="gr-grid">
        ${PODCAST_EPISODES.map((ep) => {
          const done = !!ext.podcastsDone[ep.id];
          return `
            <button type="button" class="gr-card gr-card-click" data-ep="${ep.id}">
              <div class="gr-card-head">
                <span class="gr-emoji">${ep.emoji}</span>
                <span class="gr-badge ${done ? 'gr-badge-green' : ''}">${done ? '✓ ฟังจบแล้ว' : `${ep.level} · ${ep.duration}`}</span>
              </div>
              <h3 class="gr-title">${esc(core, ep.title)}</h3>
              <p class="gr-sub">${esc(core, ep.desc)}</p>
            </button>
          `;
        }).join('')}
      </div>
    `;
    host.querySelectorAll('[data-ep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ep = PODCAST_EPISODES.find((e) => e.id === btn.dataset.ep);
        if (ep) openEpisode(ep);
      });
    });
  }

  function openEpisode(ep) {
    stopPlayback();
    activeIdx = 0;
    const quizAnswers = {};

    function playFrom(idx) {
      if (!isPlaying || idx >= ep.segments.length) {
        isPlaying = false;
        renderEp();
        return;
      }
      activeIdx = idx;
      renderEp();
      const seg = ep.segments[idx];
      const next = () => {
        if (!isPlaying) return;
        setTimeout(() => playFrom(idx + 1), 320);
      };
      if (seg.lang === 'th') {
        if (core?.speakThai) core.speakThai(seg.text, next);
        else setTimeout(next, 1800);
      } else {
        if (core?.speak) core.speak(seg.zh, next);
        else setTimeout(next, 1800);
      }
    }

    function renderEp() {
      host.innerHTML = `
        <div class="gr-game-stage">
          <div class="gr-between">
            <button type="button" class="btn-secondary" id="gr-pod-back">← ตอนทั้งหมด</button>
            <span class="gr-badge">${ep.level} · ${ep.duration}</span>
          </div>

          <div>
            <h3 class="gr-title" style="font-size:1.2rem">${ep.emoji} ${esc(core, ep.title)}</h3>
            <p class="gr-sub">${esc(core, ep.desc)} (แตะบรรทัดเพื่อเริ่มฟัง หรือแตะคำจีนเพื่อดูคำแปล)</p>
          </div>

          <div class="gr-row">
            <button type="button" class="btn-primary" id="gr-pod-play">${isPlaying ? '⏹ หยุดพอดแคสต์' : '▶ เล่นพอดแคสต์'}</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            ${ep.segments
              .map(
                (seg, idx) => `
              <div class="gr-pod-line ${idx === activeIdx ? 'is-active' : ''}" data-seg="${idx}">
                <div class="gr-pod-speaker">${esc(core, seg.speaker)} ${seg.lang === 'zh' ? '🇨🇳' : '🇹🇭'}</div>
                ${
                  seg.lang === 'zh'
                    ? `<div style="line-height:2">${renderTokensHtml(core, seg.tokens, { showPinyin: true, sentenceIdx: idx })}</div>
                       <div class="gr-sent-th">${esc(core, seg.th)}</div>`
                    : `<div style="font-size:0.94rem">${esc(core, seg.text)}</div>`
                }
              </div>
            `
              )
              .join('')}
          </div>

          <div class="gr-card" style="margin-top:6px">
            <h4 class="gr-title">🎧 ควิซท้ายตอน</h4>
            ${ep.quiz
              .map(
                (q, qi) => `
              <div style="display:flex;flex-direction:column;gap:6px">
                <div style="font-weight:600">${qi + 1}. ${esc(core, q.q)}</div>
                <div class="gr-row">
                  ${q.options
                    .map(
                      (opt, oi) =>
                        `<button type="button" class="gr-choice-btn ${quizAnswers[qi] === oi ? (oi === q.answer ? 'is-correct' : 'is-wrong') : ''}" data-qi="${qi}" data-oi="${oi}" style="font-size:0.9rem;padding:8px 12px">${esc(core, opt)}</button>`
                    )
                    .join('')}
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;

      host.querySelector('#gr-pod-back')?.addEventListener('click', showList);
      host.querySelector('#gr-pod-play')?.addEventListener('click', () => {
        if (isPlaying) {
          stopPlayback();
          renderEp();
        } else {
          isPlaying = true;
          playFrom(activeIdx >= 0 ? activeIdx : 0);
        }
      });

      host.querySelectorAll('[data-seg]').forEach((el) => {
        el.addEventListener('click', () => {
          const idx = Number(el.dataset.seg);
          isPlaying = true;
          playFrom(idx);
        });
      });

      host.querySelectorAll('.gr-tok').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const si = Number(btn.dataset.si);
          const ti = Number(btn.dataset.ti);
          const tok = ep.segments[si]?.tokens?.[ti];
          if (tok) openWordPopover(core, btn, tok);
        });
      });

      host.querySelectorAll('[data-qi]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const qi = Number(btn.dataset.qi);
          const oi = Number(btn.dataset.oi);
          quizAnswers[qi] = oi;
          core?.playChime?.(oi === ep.quiz[qi].answer ? 'ok' : 'err');
          renderEp();
          const allOk = ep.quiz.every((q, idx) => quizAnswers[idx] === q.answer);
          if (allOk) {
            const ext = getGrExt(core);
            if (!ext.podcastsDone[ep.id]) {
              core?.setExt?.(
                EXT_NS,
                (cur) => ({ ...cur, podcastsDone: { ...(cur.podcastsDone || {}), [ep.id]: true } }),
                { save: true, reason: `gr-pod-${ep.id}` }
              );
              core?.addXp?.(15, `gr-pod-${ep.id}`);
              core?.logActivity?.(1);
              core?.showToast?.('ทำควิซพอดแคสต์ครบแล้ว! +15 XP', '+15 XP');
            }
          }
        });
      });
    }

    renderEp();
  }

  showList();
  return stopPlayback;
}
