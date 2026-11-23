// #31 Adaptive Placement Test & #32 Goal Selection Onboarding Modal

import { GOALS, DAILY_MINUTES_OPTIONS, PLACEMENT_BANK, UNITS } from './curriculum-data.js';
import {
  createPlacementState,
  pickNextPlacementQuestion,
  submitPlacementAnswer,
  computePlacementResult
} from './logic.js';

/**
 * Render #31 Adaptive Placement Test inside `host`.
 */
export function renderPlacementView(host, { core, onApplied }) {
  const existing = core.getExt('lesson-path')?.placement || null;
  let pState = null;
  let currentQ = null;
  let result = null;

  const startTest = () => {
    pState = createPlacementState(10);
    result = null;
    currentQ = pickNextPlacementQuestion(pState, PLACEMENT_BANK);
    render();
  };

  const render = () => {
    if (!pState && !result) {
      host.innerHTML = `
        <div class="lp-section-card card-panel lp-placement-intro">
          <div class="lp-end-badge">🎯</div>
          <h3>แบบทดสอบวัดระดับ (Adaptive Placement Test)</h3>
          <p class="lp-muted">ตอบคำถาม 10 ข้อ ระบบจะปรับระดับความยากขึ้น-ลงตามคำตอบของคุณอัตโนมัติ เพื่อแนะนำบทเรียนที่เหมาะสมและปลดล็อกบทก่อนหน้าให้ทันที</p>
          ${existing ? `
            <div class="lp-placement-prev">
              ผลวัดระดับล่าสุด: <strong>${core.escapeHtml(existing.levelLabel)}</strong> (${existing.scorePct}%) · แนะนำเริ่มที่ <strong>บทที่ ${existing.recommendedUnitIdx + 1}</strong>
            </div>
          ` : ''}
          <button type="button" class="btn-primary" data-start>${existing ? 'ทำแบบทดสอบวัดระดับใหม่' : 'เริ่มวัดระดับเลย (10 ข้อ)'}</button>
        </div>
      `;
      host.querySelector('[data-start]')?.addEventListener('click', startTest);
      return;
    }

    if (result) {
      const recUnit = UNITS[result.recommendedUnitIdx] || UNITS[0];
      host.innerHTML = `
        <div class="lp-section-card card-panel lp-placement-result">
          <div class="lp-end-badge">🏆</div>
          <h3>ผลวัดระดับของคุณ: ${core.escapeHtml(result.levelLabel)}</h3>
          <div class="lp-end-stats">
            <div class="lp-stat-box"><span>ตอบถูก</span><strong>${result.scorePct}%</strong></div>
            <div class="lp-stat-box"><span>ระดับแนะนำ</span><strong>บทที่ ${recUnit.num}</strong></div>
            <div class="lp-stat-box"><span>บทที่ปลดล็อก</span><strong>1 – ${recUnit.num}</strong></div>
          </div>
          <p class="lp-muted">แนะนำให้เริ่มที่ <strong>บทที่ ${recUnit.num}: ${core.escapeHtml(recUnit.title)}</strong></p>
          <div class="lp-end-actions">
            <button type="button" class="btn-secondary" data-retry>ทำแบบทดสอบใหม่</button>
            <button type="button" class="btn-primary" data-apply>ปลดล็อกและไปยังเส้นทางบทเรียน</button>
          </div>
        </div>
      `;
      host.querySelector('[data-retry]')?.addEventListener('click', startTest);
      host.querySelector('[data-apply]')?.addEventListener('click', () => {
        const ext = core.getExt('lesson-path') || {};
        const prevUnlocked = Number(ext.unlockedUpTo || 0);
        const nextUnlocked = Math.max(prevUnlocked, result.recommendedUnitIdx);
        const nextProfile = {
          ...(ext.profile || { goal: 'hsk', dailyMinutes: 10 }),
          level: result.levelLabel
        };
        core.setExt('lesson-path', {
          unlockedUpTo: nextUnlocked,
          placement: { ...result, at: Date.now() },
          profile: nextProfile
        }, { reason: 'lp-placement-applied' });
        core.emit('lesson-path:profile', nextProfile);
        core.addXp(25, 'lp-placement-complete');
        core.showToast?.(`ปลดล็อกถึงบทที่ ${nextUnlocked + 1} แล้ว!`, '+25 XP');
        onApplied?.();
      });
      return;
    }

    if (!currentQ) {
      result = computePlacementResult(pState, UNITS.length);
      render();
      return;
    }

    const pct = Math.round((pState.step / pState.totalQuestions) * 100);
    host.innerHTML = `
      <div class="lp-section-card card-panel">
        <div class="lp-runner-top">
          <span class="lp-level-tag">ระดับความยาก ${currentQ.difficulty}/5</span>
          <div class="lp-progress-track">
            <div class="lp-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="lp-progress-count">${pState.step + 1}/${pState.totalQuestions}</span>
        </div>

        <div class="lp-prompt-card">
          <div class="lp-prompt-th">${core.escapeHtml(currentQ.prompt)}</div>
          ${currentQ.audio ? `<button type="button" class="lp-icon-btn" data-speak aria-label="ฟังเสียง">🔊 ฟังเสียง</button>` : ''}
        </div>

        <div class="lp-choice-list">
          ${currentQ.choices.map((ch, i) => `
            <button type="button" class="lp-choice-btn lp-choice-row" data-ci="${i}">
              ${core.escapeHtml(ch)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    host.querySelector('[data-speak]')?.addEventListener('click', () => core.speak(currentQ.audio));
    host.querySelectorAll('[data-ci]').forEach(btn => {
      btn.addEventListener('click', () => {
        const picked = Number(btn.dataset.ci);
        const correct = picked === currentQ.answer;
        core.playChime(correct ? 'ok' : 'err');
        pState = submitPlacementAnswer(pState, currentQ, correct);
        if (pState.step >= pState.totalQuestions) {
          result = computePlacementResult(pState, UNITS.length);
          currentQ = null;
        } else {
          currentQ = pickNextPlacementQuestion(pState, PLACEMENT_BANK);
        }
        render();
      });
    });
  };

  render();
}

/**
 * Show #32 Goal Selection Onboarding Modal.
 * Stores under ext 'lesson-path'.profile ({ goal, dailyMinutes, level }) and emits 'lesson-path:profile'.
 */
export function openGoalModal({ core, onSaved }) {
  document.querySelector('.lp-modal-backdrop')?.remove();
  const existing = core.getExt('lesson-path')?.profile || {};
  let selectedGoal = existing.goal || 'hsk';
  let selectedMinutes = Number(existing.dailyMinutes) || 10;

  const backdrop = document.createElement('div');
  backdrop.className = 'lp-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'ตั้งเป้าหมายการเรียนภาษาจีน');

  const draw = () => {
    backdrop.innerHTML = `
      <div class="lp-modal card-panel">
        <div class="lp-modal-head">
          <h3>🎯 ตั้งเป้าหมายการเรียนของคุณ</h3>
          <button type="button" class="lp-close-btn" data-close aria-label="ปิด">✕</button>
        </div>
        <p class="lp-muted">เลือกเป้าหมายและเวลาเรียนต่อวัน เพื่อให้เราจัดลำดับบทเรียนที่เหมาะกับคุณที่สุด</p>

        <div class="lp-modal-section">
          <div class="lp-modal-label">1. เป้าหมายหลักของคุณคืออะไร?</div>
          <div class="lp-goal-grid">
            ${GOALS.map(g => `
              <button type="button" class="lp-goal-card ${selectedGoal === g.id ? 'is-selected' : ''}" data-goal="${g.id}">
                <span class="lp-goal-emoji">${g.emoji}</span>
                <strong>${core.escapeHtml(g.label)}</strong>
                <small>${core.escapeHtml(g.desc)}</small>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="lp-modal-section">
          <div class="lp-modal-label">2. เป้าหมายเวลาเรียนต่อวัน</div>
          <div class="lp-pill-group">
            ${DAILY_MINUTES_OPTIONS.map(m => `
              <button type="button" class="lp-pill ${selectedMinutes === m ? 'is-active' : ''}" data-min="${m}">${m} นาที/วัน</button>
            `).join('')}
          </div>
        </div>

        <div class="lp-modal-footer">
          <button type="button" class="btn-primary lp-full-btn" data-save>บันทึกเป้าหมายและเริ่มเรียน</button>
        </div>
      </div>
    `;

    backdrop.querySelector('[data-close]')?.addEventListener('click', () => backdrop.remove());
    backdrop.querySelectorAll('[data-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedGoal = btn.dataset.goal;
        draw();
      });
    });
    backdrop.querySelectorAll('[data-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedMinutes = Number(btn.dataset.min);
        draw();
      });
    });
    backdrop.querySelector('[data-save]')?.addEventListener('click', () => {
      const profile = {
        goal: selectedGoal,
        dailyMinutes: selectedMinutes,
        level: existing.level || 'HSK 1 เริ่มต้น'
      };
      core.setExt('lesson-path', { profile }, { reason: 'lp-profile-saved' });
      core.emit('lesson-path:profile', profile);
      backdrop.remove();
      core.showToast?.(`บันทึกเป้าหมายแล้ว (${selectedMinutes} นาที/วัน)`);
      onSaved?.(profile);
    });
  };

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.remove();
  });

  draw();
  document.body.appendChild(backdrop);
}
