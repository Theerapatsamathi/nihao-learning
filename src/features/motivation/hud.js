// Global HUD & background trackers for Motivation (#25 Hearts, #26 Combo, #27 Daily Goal, #24 Weekly XP, #28 Invite Link)
import {
  getIsoWeekKey,
  computeHeartsState,
  computeComboBonus,
  MAX_HEARTS
} from './logic.js';

export function getDefaultDailyGoal(core) {
  const ext = core.getExt('motivation') || {};
  if (Number.isInteger(ext.dailyGoalMinutes) && ext.dailyGoalMinutes >= 5) {
    return ext.dailyGoalMinutes;
  }
  const lp = core.getExt('lesson-path') || {};
  const fromLp = Number(lp?.profile?.dailyMinutes);
  if ([5, 10, 15, 20].includes(fromLp)) return fromLp;
  return 10;
}

export function getTodayActiveSeconds(core) {
  const ext = core.getExt('motivation') || {};
  const log = ext.dailySecondsLog || {};
  return Number(log[core.todayKey(0)]) || 0;
}

export function getWeeklyXp(core, weekKey = getIsoWeekKey()) {
  const ext = core.getExt('motivation') || {};
  const map = ext.weeklyXp || {};
  return Number(map[weekKey]) || 0;
}

export function initMotivationHud(core, { openSubTab }) {
  let combo = 0;
  let lastComboXpAt = 0;
  let lastInteractionAt = Date.now();
  let leagueSyncTimer = null;
  let zeroHeartModalOpen = false;

  // Track user interaction for active study minutes (#27)
  const markActive = () => { lastInteractionAt = Date.now(); };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, markActive, { passive: true });
  });

  // Handle ?friend=CODE invite link (#28)
  try {
    const params = new URLSearchParams(window.location.search);
    const friendCode = (params.get('friend') || '').trim().toUpperCase();
    if (/^[A-Z0-9]{4,16}$/.test(friendCode)) {
      core.setExt('motivation', { pendingFriendCode: friendCode }, { save: false });
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('friend');
      window.history.replaceState({}, '', cleanUrl.toString());
      setTimeout(() => {
        core.showToast(`ได้รับคำเชิญเพื่อนรหัส ${friendCode} — เปิดแท็บ ภารกิจ & ลีก เพื่อยืนยัน`);
      }, 900);
    }
  } catch { /* ignore */ }

  // 1) Inject Daily Goal Ring defensively into .header-actions
  let ringBtn = null;
  function ensureHeaderRing() {
    if (ringBtn && ringBtn.isConnected) return ringBtn;
    const actions = document.querySelector('.header-actions');
    if (!actions) return null;
    ringBtn = document.createElement('button');
    ringBtn.type = 'button';
    ringBtn.className = 'mo-header-ring';
    ringBtn.setAttribute('aria-label', 'เป้าหมายรายวัน');
    ringBtn.title = 'เป้าหมายการเรียนรายวัน';
    ringBtn.innerHTML = `
      <svg class="mo-ring-svg" viewBox="0 0 36 36" width="28" height="28" aria-hidden="true">
        <circle class="mo-ring-bg" cx="18" cy="18" r="14"></circle>
        <circle class="mo-ring-fg" cx="18" cy="18" r="14" stroke-dasharray="88" stroke-dashoffset="88"></circle>
      </svg>
      <span class="mo-ring-label">0m</span>
    `;
    ringBtn.addEventListener('click', () => {
      openSubTab('goals');
      core.switchTab('motivation');
    });
    actions.appendChild(ringBtn);
    return ringBtn;
  }

  function updateHeaderRing() {
    const btn = ensureHeaderRing();
    if (!btn) return;
    const goalMin = getDefaultDailyGoal(core);
    const secs = getTodayActiveSeconds(core);
    const mins = Math.floor(secs / 60);
    const pct = Math.min(1, secs / (goalMin * 60));
    const offset = Math.round(88 * (1 - pct));
    const fg = btn.querySelector('.mo-ring-fg');
    const lbl = btn.querySelector('.mo-ring-label');
    if (fg) fg.setAttribute('stroke-dashoffset', String(offset));
    if (lbl) lbl.textContent = `${mins}/${goalMin}m`;
    btn.classList.toggle('mo-ring-done', pct >= 1);
  }

  // 2) Inject fixed HUD overlay for Hearts & Combo
  const hudEl = document.createElement('div');
  hudEl.className = 'mo-hud';
  hudEl.setAttribute('aria-live', 'polite');
  hudEl.style.display = 'none';
  hudEl.innerHTML = `
    <button type="button" class="mo-hud-pill mo-hud-hearts" hidden style="display: none !important;" aria-label="หัวใจคงเหลือ"></button>
    <div class="mo-hud-pill mo-hud-combo" hidden style="display: none !important;"></div>
  `;
  document.body.appendChild(hudEl);

  const heartsPill = hudEl.querySelector('.mo-hud-hearts');
  const comboPill = hudEl.querySelector('.mo-hud-combo');

  function updateHudVisibility() {
    const showHearts = Boolean(heartsPill && !heartsPill.hidden && heartsPill.style.display !== 'none' && heartsPill.innerHTML.trim());
    const showCombo = Boolean(comboPill && !comboPill.hidden && comboPill.style.display !== 'none' && comboPill.innerHTML.trim());
    hudEl.style.display = (showHearts || showCombo) ? 'flex' : 'none';
  }
  comboPill.style.cursor = 'pointer';
  comboPill.setAttribute('role', 'status');
  comboPill.setAttribute('title', 'คอมโบตอบถูกต่อเนื่อง (แตะเพื่อดูรายละเอียด · รีเซ็ตอัตโนมัติเมื่อหยุดพัก)');
  comboPill.addEventListener('click', () => {
    if (combo >= 2) {
      const bonus = computeComboBonus(combo);
      core.showToast(`🔥 สตรีคคอมโบตอบถูก ${combo} ข้อติด! (โบนัสคูณ XP x${bonus.multiplier})`, 0);
    }
  });

  let comboTimer = null;
  function resetComboTimer() {
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      if (combo > 0) {
        combo = 0;
        updateComboHud();
      }
    }, 20000); // Auto-expire after 20s of quiz inactivity
  }

  core.on?.('tab', () => {
    if (comboTimer) clearTimeout(comboTimer);
    if (combo > 0) {
      combo = 0;
      updateComboHud();
    }
  });

  heartsPill.addEventListener('click', () => {
    openSubTab('goals');
    core.switchTab('motivation');
  });

  function updateHeartsHud() {
    const ext = core.getExt('motivation') || {};
    const h = computeHeartsState(ext.hearts || {}, Date.now());
    if (!h.enabled) {
      heartsPill.hidden = true;
      heartsPill.style.display = 'none';
      heartsPill.innerHTML = '';
      updateHudVisibility();
      return h;
    }
    if (ext.hearts && h.count !== ext.hearts.count) {
      core.setExt('motivation', (prev) => ({
        ...prev,
        hearts: { ...(prev.hearts || {}), enabled: true, count: h.count, lastLostAt: h.lastLostAt }
      }), { save: false });
    }
    heartsPill.hidden = false;
    heartsPill.style.display = '';
    heartsPill.innerHTML = `<span class="mo-heart-icon">❤️</span><span>${h.count}/${MAX_HEARTS}</span>`;
    heartsPill.classList.toggle('mo-hud-low', h.count <= 1);
    updateHudVisibility();
    return h;
  }

  function updateComboHud() {
    if (combo < 2) {
      comboPill.hidden = true;
      comboPill.style.display = 'none';
      comboPill.innerHTML = '';
      updateHudVisibility();
      return;
    }
    const bonus = computeComboBonus(combo);
    comboPill.hidden = false;
    comboPill.style.display = '';
    comboPill.classList.toggle('mo-combo-hot', combo >= 5);
    comboPill.classList.toggle('mo-combo-fire', combo >= 10);
    comboPill.innerHTML = `
      <span class="mo-flame">🔥</span>
      <span>${combo}</span>
      ${bonus.multiplier > 1 ? `<span class="mo-combo-mult">x${bonus.multiplier}</span>` : ''}
    `;
    updateHudVisibility();
  }

  function showZeroHeartsModal() {
    if (zeroHeartModalOpen) return;
    zeroHeartModalOpen = true;
    const backdrop = document.createElement('div');
    backdrop.className = 'mo-modal-backdrop';
    backdrop.innerHTML = `
      <div class="mo-modal card-panel" role="dialog" aria-modal="true" aria-label="หัวใจหมดแล้ว">
        <div class="mo-modal-emoji">💔</div>
        <h3>หัวใจหมดชั่วคราวแล้ว</h3>
        <p>คุณยังเรียนต่อได้ตามปกติ หรือไปทบทวนสมุดคำผิด 1 รอบเพื่อเติมหัวใจ +1 ดวงทันที (หรือรอฟื้นฟูอัตโนมัติ 1 ดวงทุก 30 นาที)</p>
        <div class="mo-modal-actions">
          <button type="button" class="btn-primary" data-mo-go-review>ทบทวนคำผิดเติมหัวใจ</button>
          <button type="button" class="btn-secondary" data-mo-close>เรียนต่อเลย</button>
        </div>
      </div>
    `;
    const close = () => {
      zeroHeartModalOpen = false;
      backdrop.remove();
    };
    backdrop.querySelector('[data-mo-close]')?.addEventListener('click', close);
    backdrop.querySelector('[data-mo-go-review]')?.addEventListener('click', () => {
      close();
      openSubTab('mistakes');
      core.switchTab('motivation');
    });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
  }

  // Listen to `answer` events (#25 Hearts, #26 Combo)
  core.on('answer', ({ correct } = {}) => {
    markActive();
    if (correct) {
      combo += 1;
      const ext = core.getExt('motivation') || {};
      if (combo > (ext.bestCombo || 0)) {
        core.setExt('motivation', { bestCombo: combo }, { save: false });
      }
      const bonus = computeComboBonus(combo);
      const now = Date.now();
      if (bonus.bonusXp > 0 && now - lastComboXpAt > 4000) {
        lastComboXpAt = now;
        core.addXp(bonus.bonusXp, `combo-x${bonus.multiplier}`);
        core.showToast(`🔥 คอมโบ ${combo} ข้อติด! ${bonus.label}`, bonus.bonusXp);
      }
      updateComboHud();
      resetComboTimer();
    } else {
      if (comboTimer) clearTimeout(comboTimer);
      combo = 0;
      updateComboHud();
      const ext = core.getExt('motivation') || {};
      const h = computeHeartsState(ext.hearts || {}, Date.now());
      if (h.enabled && h.count > 0) {
        const nextCount = h.count - 1;
        const nextLastLost = h.lastLostAt || Date.now();
        core.setExt('motivation', (prev) => ({
          ...prev,
          hearts: { enabled: true, count: nextCount, lastLostAt: nextLastLost }
        }), { save: true, reason: 'heart-lost' });
        updateHeartsHud();
        if (nextCount === 0) showZeroHeartsModal();
      }
    }
  });

  // Listen to `progress` events for Weekly XP (#24)
  core.on('progress', ({ xpGained } = {}) => {
    const gained = Number(xpGained) || 0;
    if (gained <= 0) return;
    const wk = getIsoWeekKey();
    const prevExt = core.getExt('motivation') || {};
    const weeklyXp = { ...(prevExt.weeklyXp || {}) };
    weeklyXp[wk] = (Number(weeklyXp[wk]) || 0) + gained;
    core.setExt('motivation', { weeklyXp }, { save: false });

    // Debounced sync to /api/league if signed in
    if (core.isSignedIn()) {
      clearTimeout(leagueSyncTimer);
      leagueSyncTimer = setTimeout(() => {
        core.api('/api/league', { xp: weeklyXp[wk] }, 'POST').catch(() => {});
      }, 3000);
    }
  });

  // Active study time ticker every 10s (#27)
  setInterval(() => {
    updateHeartsHud();
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastInteractionAt > 60_000) return;

    const today = core.todayKey(0);
    const goalMin = getDefaultDailyGoal(core);
    const prevExt = core.getExt('motivation') || {};
    const log = { ...(prevExt.dailySecondsLog || {}) };
    const prevSec = Number(log[today]) || 0;
    const nextSec = prevSec + 10;
    log[today] = nextSec;

    const goalMetMap = { ...(prevExt.goalMetDays || {}) };
    const justMet = !goalMetMap[today] && nextSec >= goalMin * 60;
    if (justMet) {
      goalMetMap[today] = true;
    }

    core.setExt('motivation', { dailySecondsLog: log, goalMetDays: goalMetMap }, {
      save: justMet || nextSec % 60 === 0,
      reason: justMet ? 'daily-goal-met' : ''
    });

    updateHeaderRing();

    if (justMet) {
      core.spawnConfetti(40);
      core.playChime('levelup', true);
      core.showToast(`🎯 บรรลุเป้าหมายรายวัน ${goalMin} นาทีแล้ว! ยอดเยี่ยมมาก`, 15);
      core.addXp(15, 'daily-goal-met');
      core.emit('motivation:goal-met', { date: today, minutes: goalMin });
    }
  }, 10_000);

  // Initial paint
  updateHeaderRing();
  updateHeartsHud();
  updateComboHud();
  updateHudVisibility();

  return {
    refresh() {
      updateHeaderRing();
      updateHeartsHud();
      updateComboHud();
      updateHudVisibility();
    },
    getCombo: () => combo
  };
}
