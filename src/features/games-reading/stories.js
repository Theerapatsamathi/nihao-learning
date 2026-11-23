// #18 Graded Stories & #19 Karaoke Read-Along
import { GRADED_STORIES } from './data-stories.js';
import { openWordPopover, closeWordPopover, renderTokensHtml } from './word-popover.js';
import {
  EXT_NS,
  getGrExt,
  computeTokenTimings,
  estimateSentenceDurationMs,
  esc
} from './utils.js';

export function renderStoriesSection(core, host) {
  let filterLevel = 'ALL';
  let showPinyin = true;
  let showThai = true;
  let karaokeSpeed = 1.0;
  let loopSentence = false;
  let isPlaying = false;
  let activeSentIdx = -1;
  let wordTimers = [];
  let savedRate = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedUrl = null;
  let isRecording = false;
  let mediaStream = null;

  function clearWordTimers() {
    wordTimers.forEach((id) => clearTimeout(id));
    wordTimers = [];
    host.querySelectorAll('.gr-tok.is-karaoke').forEach((el) => el.classList.remove('is-karaoke'));
  }

  function restoreRate() {
    if (savedRate !== null && core?.state) {
      core.state.rate = savedRate;
      savedRate = null;
    }
  }

  function stopPlayback() {
    isPlaying = false;
    clearWordTimers();
    core?.stopSpeech?.();
    restoreRate();
    const playBtn = host.querySelector('#gr-k-play');
    if (playBtn) playBtn.textContent = '▶ เล่นคาราโอเกะ';
  }

  function stopRecordingCleanup() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((tr) => tr.stop());
      mediaStream = null;
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      recordedUrl = null;
    }
    isRecording = false;
  }

  function cleanup() {
    stopPlayback();
    stopRecordingCleanup();
    closeWordPopover();
  }

  function showList() {
    cleanup();
    const ext = getGrExt(core);
    const items = GRADED_STORIES.filter((s) => filterLevel === 'ALL' || s.level === filterLevel);
    host.innerHTML = `
      <div class="gr-row">
        ${['ALL', 'HSK1', 'HSK2']
          .map(
            (lv) =>
              `<button type="button" class="gr-subnav-btn ${filterLevel === lv ? 'is-active' : ''}" data-lv="${lv}">${lv === 'ALL' ? 'ทั้งหมด (8 เรื่อง)' : lv}</button>`
          )
          .join('')}
      </div>
      <div class="gr-grid">
        ${items
          .map((s) => {
            const done = !!ext.storiesDone[s.id];
            return `
              <button type="button" class="gr-card gr-card-click" data-story="${s.id}">
                <div class="gr-card-head">
                  <span class="gr-emoji">${s.emoji}</span>
                  <span class="gr-badge ${done ? 'gr-badge-green' : ''}">${done ? '✓ อ่านแล้ว' : s.level}</span>
                </div>
                <h3 class="gr-title">${esc(core, s.titleZh)}</h3>
                <p class="gr-sub">${esc(core, s.titlePy)} · ${esc(core, s.titleTh)}</p>
                <span class="gr-sub" style="font-size:0.78rem">${s.sentences.length} ประโยค · แตะคำแปลได้ + คาราโอเกะ</span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;
    host.querySelectorAll('[data-lv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterLevel = btn.dataset.lv;
        showList();
      });
    });
    host.querySelectorAll('[data-story]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const story = GRADED_STORIES.find((s) => s.id === btn.dataset.story);
        if (story) openStory(story);
      });
    });
  }

  function openStory(story) {
    cleanup();
    activeSentIdx = 0;
    const quizAnswers = {};

    function highlightSentence(si) {
      activeSentIdx = si;
      host.querySelectorAll('.gr-story-sent').forEach((el, idx) => {
        el.classList.toggle('is-active', idx === si);
      });
    }

    function playSentenceAt(si, autoAdvance) {
      if (si < 0 || si >= story.sentences.length) {
        stopPlayback();
        return;
      }
      clearWordTimers();
      highlightSentence(si);
      const sent = story.sentences[si];
      if (core?.state) {
        if (savedRate === null) savedRate = core.state.rate ?? 1.0;
        core.state.rate = karaokeSpeed;
      }

      const estMs = estimateSentenceDurationMs(sent.zh, karaokeSpeed);
      const timings = computeTokenTimings(sent.tokens, estMs);
      const sentEl = host.querySelector(`.gr-story-sent[data-si="${si}"]`);
      timings.forEach((tm) => {
        const id = setTimeout(() => {
          if (!isPlaying) return;
          sentEl?.querySelectorAll('.gr-tok.is-karaoke').forEach((el) => el.classList.remove('is-karaoke'));
          const tokEl = sentEl?.querySelector(`.gr-tok[data-ti="${tm.index}"]`);
          if (tokEl) tokEl.classList.add('is-karaoke');
        }, tm.start);
        wordTimers.push(id);
      });

      const onEnd = () => {
        clearWordTimers();
        if (!isPlaying) return;
        if (loopSentence) {
          playSentenceAt(si, autoAdvance);
        } else if (autoAdvance && si + 1 < story.sentences.length) {
          playSentenceAt(si + 1, true);
        } else {
          stopPlayback();
        }
      };

      if (core?.speak) {
        core.speak(sent.zh, onEnd);
      } else {
        const fallbackId = setTimeout(onEnd, estMs);
        wordTimers.push(fallbackId);
      }
    }

    function renderReader() {
      host.innerHTML = `
        <div class="gr-game-stage">
          <div class="gr-between">
            <button type="button" class="btn-secondary" id="gr-st-back">← รายการนิทาน</button>
            <div class="gr-row">
              <button type="button" class="btn-secondary" id="gr-tog-py">${showPinyin ? 'ซ่อนพินอิน' : 'แสดงพินอิน'}</button>
              <button type="button" class="btn-secondary" id="gr-tog-th">${showThai ? 'ซ่อนคำแปลไทย' : 'แสดงคำแปลไทย'}</button>
            </div>
          </div>

          <div>
            <span class="gr-badge">${story.level}</span>
            <h3 class="gr-title" style="font-size:1.35rem;margin-top:6px">${story.emoji} ${esc(core, story.titleZh)}</h3>
            <p class="gr-sub">${esc(core, story.titlePy)} — ${esc(core, story.titleTh)} (แตะที่คำจีนใดก็ได้เพื่อดูคำแปลและบันทึกคำศัพท์)</p>
          </div>

          <!-- #19 Karaoke Read-Along Controls -->
          <div class="gr-karaoke-bar">
            <button type="button" class="btn-primary" id="gr-k-play">${isPlaying ? '⏹ หยุดคาราโอเกะ' : '▶ เล่นคาราโอเกะ'}</button>
            <button type="button" class="btn-secondary" id="gr-k-loop">${loopSentence ? '🔁 วนประโยค: เปิด' : '🔁 วนประโยค: ปิด'}</button>
            <label class="gr-sub" style="display:inline-flex;align-items:center;gap:6px">
              ความเร็ว:
              <select id="gr-k-speed" style="padding:5px 8px;border-radius:8px;border:1px solid var(--sys-separator);background:var(--sys-surface);color:var(--sys-label)">
                ${[0.5, 0.75, 1.0, 1.2]
                  .map((r) => `<option value="${r}" ${karaokeSpeed === r ? 'selected' : ''}>${r}x</option>`)
                  .join('')}
              </select>
            </label>
            <button type="button" class="btn-secondary" id="gr-k-rec">${isRecording ? '⏹ หยุดอัดเสียง' : '🎙️ อัดเสียงอ่านตาม'}</button>
            ${recordedUrl ? `<audio controls src="${recordedUrl}" style="height:32px;max-width:220px"></audio>` : ''}
          </div>

          <!-- Sentences -->
          <div style="display:flex;flex-direction:column;gap:10px" id="gr-st-body">
            ${story.sentences
              .map(
                (s, si) => `
              <div class="gr-story-sent ${si === activeSentIdx ? 'is-active' : ''}" data-si="${si}">
                <div class="gr-between">
                  <div style="line-height:2">${renderTokensHtml(core, s.tokens, { showPinyin, sentenceIdx: si })}</div>
                  <button type="button" class="btn-secondary" data-play-sent="${si}" aria-label="ฟังประโยคที่ ${si + 1}" style="padding:5px 10px;font-size:0.82rem">🔊</button>
                </div>
                ${showThai ? `<div class="gr-sent-th">${esc(core, s.th)}</div>` : ''}
              </div>
            `
              )
              .join('')}
          </div>

          <!-- Comprehension Quiz -->
          <div class="gr-card" style="margin-top:8px">
            <h4 class="gr-title">📝 คำถามวัดความเข้าใจ</h4>
            ${story.quiz
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
            <div id="gr-st-quiz-msg" class="gr-sub"></div>
          </div>
        </div>
      `;

      host.querySelector('#gr-st-back')?.addEventListener('click', showList);
      host.querySelector('#gr-tog-py')?.addEventListener('click', () => {
        showPinyin = !showPinyin;
        renderReader();
      });
      host.querySelector('#gr-tog-th')?.addEventListener('click', () => {
        showThai = !showThai;
        renderReader();
      });

      host.querySelector('#gr-k-play')?.addEventListener('click', () => {
        if (isPlaying) {
          stopPlayback();
        } else {
          isPlaying = true;
          const btn = host.querySelector('#gr-k-play');
          if (btn) btn.textContent = '⏹ หยุดคาราโอเกะ';
          playSentenceAt(activeSentIdx >= 0 ? activeSentIdx : 0, true);
        }
      });

      host.querySelector('#gr-k-loop')?.addEventListener('click', (e) => {
        loopSentence = !loopSentence;
        e.currentTarget.textContent = loopSentence ? '🔁 วนประโยค: เปิด' : '🔁 วนประโยค: ปิด';
      });

      host.querySelector('#gr-k-speed')?.addEventListener('change', (e) => {
        karaokeSpeed = Number(e.target.value) || 1.0;
      });

      host.querySelector('#gr-k-rec')?.addEventListener('click', async () => {
        if (isRecording) {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          core?.showToast?.('เบราว์เซอร์นี้ไม่รองรับการอัดเสียง');
          return;
        }
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          recordedChunks = [];
          mediaRecorder = new MediaRecorder(mediaStream);
          mediaRecorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) recordedChunks.push(ev.data);
          };
          mediaRecorder.onstop = () => {
            isRecording = false;
            if (mediaStream) {
              mediaStream.getTracks().forEach((tr) => tr.stop());
              mediaStream = null;
            }
            if (recordedUrl) URL.revokeObjectURL(recordedUrl);
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            recordedUrl = URL.createObjectURL(blob);
            core?.showToast?.('บันทึกเสียงแล้ว! กดเล่นเทียบกับต้นฉบับได้เลย');
            renderReader();
          };
          mediaRecorder.start();
          isRecording = true;
          renderReader();
        } catch {
          core?.showToast?.('ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตสิทธิ์ไมโครโฟน');
        }
      });

      host.querySelectorAll('[data-play-sent]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const si = Number(btn.dataset.playSent);
          isPlaying = true;
          const playBtn = host.querySelector('#gr-k-play');
          if (playBtn) playBtn.textContent = '⏹ หยุดคาราโอเกะ';
          playSentenceAt(si, false);
        });
      });

      host.querySelectorAll('.gr-tok').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const si = Number(btn.dataset.si);
          const ti = Number(btn.dataset.ti);
          const tok = story.sentences[si]?.tokens?.[ti];
          if (tok) openWordPopover(core, btn, tok);
        });
      });

      host.querySelectorAll('[data-qi]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const qi = Number(btn.dataset.qi);
          const oi = Number(btn.dataset.oi);
          quizAnswers[qi] = oi;
          const ok = oi === story.quiz[qi].answer;
          core?.playChime?.(ok ? 'ok' : 'err');
          renderReader();
          const allCorrect = story.quiz.every((q, idx) => quizAnswers[idx] === q.answer);
          if (allCorrect) {
            const ext = getGrExt(core);
            if (!ext.storiesDone[story.id]) {
              core?.setExt?.(
                EXT_NS,
                (cur) => ({ ...cur, storiesDone: { ...(cur.storiesDone || {}), [story.id]: true } }),
                { save: true, reason: `gr-story-${story.id}` }
              );
              core?.addXp?.(20, `gr-story-${story.id}`);
              core?.logActivity?.(1);
              core?.showToast?.('อ่านนิทานและตอบคำถามครบแล้ว! +20 XP', '+20 XP');
            }
          }
        });
      });
    }

    renderReader();
  }

  showList();
  return cleanup;
}
