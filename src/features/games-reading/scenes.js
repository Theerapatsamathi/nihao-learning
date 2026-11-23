// #20 Immersive Scenes (animated mini-drama + subtitles + tap-to-translate + "Your Turn" SpeechRecognition)
import { IMMERSIVE_SCENES } from './data-scenes.js';
import { openWordPopover, closeWordPopover, renderTokensHtml } from './word-popover.js';
import { EXT_NS, getGrExt, scoreChineseSpeech, esc } from './utils.js';

export function renderScenesSection(core, host) {
  let showZh = true;
  let showPy = true;
  let showTh = true;
  let isPlaying = false;
  let roleplayMode = false;
  let activeRecognition = null;

  function stopAll() {
    isPlaying = false;
    core?.stopSpeech?.();
    if (activeRecognition) {
      try { activeRecognition.abort(); } catch {}
      activeRecognition = null;
    }
    closeWordPopover();
  }

  function showList() {
    stopAll();
    const ext = getGrExt(core);
    host.innerHTML = `
      <div class="gr-grid">
        ${IMMERSIVE_SCENES.map((sc) => {
          const done = !!ext.scenesDone[sc.id];
          return `
            <button type="button" class="gr-card gr-card-click" data-scene="${sc.id}">
              <div class="gr-card-head">
                <span class="gr-emoji">${sc.emoji}</span>
                <span class="gr-badge ${done ? 'gr-badge-green' : ''}">${done ? '✓ ผ่านแล้ว' : sc.level}</span>
              </div>
              <h3 class="gr-title">${esc(core, sc.titleTh)}</h3>
              <p class="gr-sub">${esc(core, sc.setting)}</p>
              <span class="gr-sub" style="font-size:0.78rem">${sc.lines.length} บทสนทนา · ดูมินิดราม่า + โหมดพูดโต้ตอบ</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
    host.querySelectorAll('[data-scene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sc = IMMERSIVE_SCENES.find((s) => s.id === btn.dataset.scene);
        if (sc) openScene(sc);
      });
    });
  }

  function openScene(scene) {
    stopAll();
    let lineIdx = 0;
    let roleFeedback = '';
    roleplayMode = false;

    const learnerActor = scene.cast.find((c) => c.isLearner) || scene.cast[1];

    function markSceneDone() {
      const ext = getGrExt(core);
      if (!ext.scenesDone[scene.id]) {
        core?.setExt?.(
          EXT_NS,
          (cur) => ({ ...cur, scenesDone: { ...(cur.scenesDone || {}), [scene.id]: true } }),
          { save: true, reason: `gr-scene-${scene.id}` }
        );
        core?.addXp?.(20, `gr-scene-${scene.id}`);
        core?.logActivity?.(1);
        core?.showToast?.('จบฉากจำลองแล้ว! +20 XP', '+20 XP');
      }
    }

    function playWatchSequence(idx) {
      if (!isPlaying || idx >= scene.lines.length) {
        isPlaying = false;
        if (idx >= scene.lines.length) markSceneDone();
        renderStage();
        return;
      }
      lineIdx = idx;
      renderStage();
      const line = scene.lines[idx];
      core?.speak?.(line.zh, () => {
        if (!isPlaying) return;
        setTimeout(() => playWatchSequence(idx + 1), 400);
      });
    }

    function startSpeechForLine(line) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        roleFeedback = 'เบราว์เซอร์ไม่รองรับไมค์รับเสียง — กด "ข้าม / พูดแล้ว" เพื่อไปต่อได้เลย';
        renderStage();
        return;
      }
      if (activeRecognition) {
        try { activeRecognition.abort(); } catch {}
      }
      const rec = new SR();
      activeRecognition = rec;
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      roleFeedback = '🎙️ กำลังฟัง... พูดประโยคภาษาจีนได้เลย';
      renderStage();

      rec.onresult = (ev) => {
        const spoken = ev.results?.[0]?.[0]?.transcript || '';
        const sim = scoreChineseSpeech(spoken, line.zh);
        if (sim >= 0.45) {
          core?.playChime?.('ok');
          roleFeedback = `✅ เยี่ยมมาก! ได้ยินว่า: "${spoken}" (${Math.round(sim * 100)}%)`;
          renderStage();
          setTimeout(() => advanceRoleplay(), 900);
        } else {
          core?.playChime?.('err');
          roleFeedback = `ได้ยินว่า "${spoken}" — ลองพูดอีกครั้งหรือกด "ข้าม"`;
          renderStage();
        }
      };
      rec.onerror = () => {
        roleFeedback = 'ไม่สามารถรับเสียงได้ในขณะนี้ — ลองกดอีกครั้งหรือกด "ข้าม"';
        renderStage();
      };
      rec.onend = () => {
        activeRecognition = null;
      };
      try {
        rec.start();
      } catch {
        roleFeedback = 'ไม่สามารถเริ่มไมค์ได้ — กด "ข้าม" เพื่อไปต่อ';
        renderStage();
      }
    }

    function advanceRoleplay() {
      roleFeedback = '';
      if (lineIdx + 1 >= scene.lines.length) {
        roleplayMode = false;
        markSceneDone();
        core?.showToast?.('ฝึกบทบาทสมมติจบฉากแล้ว! 🎉');
        renderStage();
        return;
      }
      lineIdx += 1;
      renderStage();
      const nextLine = scene.lines[lineIdx];
      if (nextLine.speaker !== learnerActor.id) {
        core?.speak?.(nextLine.zh, () => {
          if (roleplayMode) setTimeout(() => advanceRoleplay(), 500);
        });
      }
    }

    function renderStage() {
      const line = scene.lines[lineIdx] || scene.lines[0];
      const speakerObj = scene.cast.find((c) => c.id === line.speaker) || scene.cast[0];
      const isLearnerTurn = roleplayMode && line.speaker === learnerActor.id;

      host.innerHTML = `
        <div class="gr-game-stage">
          <div class="gr-between">
            <button type="button" class="btn-secondary" id="gr-sc-back">← ฉากทั้งหมด</button>
            <div class="gr-row">
              <button type="button" class="btn-secondary" id="gr-sc-zh">${showZh ? 'อักษรจีน: เปิด' : 'อักษรจีน: ปิด'}</button>
              <button type="button" class="btn-secondary" id="gr-sc-py">${showPy ? 'พินอิน: เปิด' : 'พินอิน: ปิด'}</button>
              <button type="button" class="btn-secondary" id="gr-sc-th">${showTh ? 'แปลไทย: เปิด' : 'แปลไทย: ปิด'}</button>
            </div>
          </div>

          <div class="gr-between">
            <h3 class="gr-title">${scene.emoji} ${esc(core, scene.titleTh)}</h3>
            <span class="gr-badge">บทที่ ${lineIdx + 1}/${scene.lines.length}</span>
          </div>

          <div class="gr-scene-stage">
            <div class="gr-scene-cast">
              ${scene.cast
                .map(
                  (actor) => `
                <div class="gr-actor ${actor.id === line.speaker ? 'is-speaking' : ''}">
                  <div class="gr-actor-avatar">${actor.avatar}</div>
                  <div class="gr-actor-name">${esc(core, actor.name)}</div>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="gr-bubble-dialog">
              <div class="gr-between">
                <span class="gr-pod-speaker">${speakerObj.avatar} ${esc(core, speakerObj.name)}</span>
                <button type="button" class="btn-secondary" id="gr-sc-hear" style="padding:4px 10px;font-size:0.8rem">🔊 ฟังเสียง</button>
              </div>
              ${showZh ? `<div style="line-height:2">${renderTokensHtml(core, line.tokens, { showPinyin: showPy, sentenceIdx: lineIdx })}</div>` : ''}
              ${!showZh && showPy ? `<div class="gr-popover-py">${esc(core, line.py)}</div>` : ''}
              ${showTh ? `<div class="gr-sent-th">${esc(core, line.th)}</div>` : ''}
            </div>
          </div>

          ${
            isLearnerTurn
              ? `
            <div class="gr-card" style="border-color:var(--sys-accent)">
              <div style="font-weight:700">🎤 ตาคุณพูดแล้ว! (${esc(core, learnerActor.name)})</div>
              <div class="gr-row">
                <button type="button" class="btn-primary" id="gr-sc-mic">🎙️ กดพูดภาษาจีน</button>
                <button type="button" class="btn-secondary" id="gr-sc-skip">ข้าม / พูดแล้ว →</button>
              </div>
              ${roleFeedback ? `<div class="gr-sub">${esc(core, roleFeedback)}</div>` : ''}
            </div>
          `
              : ''
          }

          <div class="gr-row">
            <button type="button" class="btn-primary" id="gr-sc-play">${isPlaying ? '⏹ หยุดเล่น' : '▶ เล่นทั้งฉาก'}</button>
            <button type="button" class="btn-secondary" id="gr-sc-role">${roleplayMode ? 'ออกจากโหมดโต้ตอบ' : '🎭 โหมดตาคุณพูด (Your Turn)'}</button>
            <button type="button" class="btn-secondary" id="gr-sc-prev" ${lineIdx <= 0 ? 'disabled' : ''}>◀ ก่อนหน้า</button>
            <button type="button" class="btn-secondary" id="gr-sc-next" ${lineIdx >= scene.lines.length - 1 ? 'disabled' : ''}>ถัดไป ▶</button>
          </div>
        </div>
      `;

      host.querySelector('#gr-sc-back')?.addEventListener('click', showList);
      host.querySelector('#gr-sc-zh')?.addEventListener('click', () => { showZh = !showZh; renderStage(); });
      host.querySelector('#gr-sc-py')?.addEventListener('click', () => { showPy = !showPy; renderStage(); });
      host.querySelector('#gr-sc-th')?.addEventListener('click', () => { showTh = !showTh; renderStage(); });
      host.querySelector('#gr-sc-hear')?.addEventListener('click', () => core?.speak?.(line.zh));

      host.querySelector('#gr-sc-play')?.addEventListener('click', () => {
        if (isPlaying) {
          stopAll();
          renderStage();
        } else {
          roleplayMode = false;
          isPlaying = true;
          playWatchSequence(lineIdx);
        }
      });

      host.querySelector('#gr-sc-role')?.addEventListener('click', () => {
        stopAll();
        roleplayMode = !roleplayMode;
        roleFeedback = '';
        if (roleplayMode) {
          lineIdx = 0;
          renderStage();
          if (scene.lines[0].speaker !== learnerActor.id) {
            core?.speak?.(scene.lines[0].zh, () => {
              if (roleplayMode) setTimeout(() => advanceRoleplay(), 500);
            });
          }
        } else {
          renderStage();
        }
      });

      host.querySelector('#gr-sc-prev')?.addEventListener('click', () => {
        stopAll();
        if (lineIdx > 0) lineIdx -= 1;
        renderStage();
      });
      host.querySelector('#gr-sc-next')?.addEventListener('click', () => {
        stopAll();
        if (lineIdx < scene.lines.length - 1) lineIdx += 1;
        renderStage();
      });

      host.querySelector('#gr-sc-mic')?.addEventListener('click', () => startSpeechForLine(line));
      host.querySelector('#gr-sc-skip')?.addEventListener('click', () => advanceRoleplay());

      host.querySelectorAll('.gr-tok').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ti = Number(btn.dataset.ti);
          const tok = line.tokens?.[ti];
          if (tok) openWordPopover(core, btn, tok);
        });
      });
    }

    renderStage();
  }

  showList();
  return stopAll;
}
