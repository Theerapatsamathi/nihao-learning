// #27 Daily Goal, #23 Streak Repair, #25 Hearts, #26 Combo settings
import {
  getCoins,
  analyzeStreakRepair,
  computeHeartsState,
  MAX_HEARTS
} from './logic.js';
import { getDefaultDailyGoal, getTodayActiveSeconds } from './hud.js';

export function renderGoalsStreakView(host, core, { onHudRefresh, openSubTab }) {
  function render() {
    const p = core.state.progress;
    const stats = core.computeGameStats();
    const coins = getCoins(stats.xp, p.spentCoins || 0);
    const goalMin = getDefaultDailyGoal(core);
    const activeSecs = getTodayActiveSeconds(core);
    const activeMins = Math.floor(activeSecs / 60);
    const goalPct = Math.min(100, Math.round((activeSecs / (goalMin * 60)) * 100));

    const repair = analyzeStreakRepair(p.activity, p.frozenDays, core.todayKey);
    const freezes = p.streakFreezes || 0;

    const ext = core.getExt('motivation') || {};
    const hearts = computeHeartsState(ext.hearts || {}, Date.now());
    const regenMin = Math.ceil(hearts.nextRegenMs / 60000);
    const bestCombo = ext.bestCombo || 0;

    host.innerHTML = `
      <div class="mo-card-grid">
        <!-- #27 Daily Goal -->
        <div class="card-panel">
          <h3>🎯 เป้าหมายรายวัน (Daily Goal)</h3>
          <p class="mo-muted">ระบบนับเวลาเรียนจริงเมื่อคุณเปิดหน้าเว็บและโต้ตอบ</p>
          <div class="mo-goal-stat">
            <strong>${activeMins} / ${goalMin} นาที</strong>
            <span class="mo-badge ${goalPct >= 100 ? 'mo-badge-ok' : ''}">${goalPct}%</span>
          </div>
          <div class="mo-progress-track">
            <div class="mo-progress-fill" style="width:${goalPct}%"></div>
          </div>
          <div class="mo-pills mo-mt" role="group" aria-label="เลือกเป้าหมายรายวัน">
            ${[5, 10, 15, 20].map((m) => `
              <button type="button" class="mo-pill ${goalMin === m ? 'active' : ''}" data-goal="${m}">${m} นาที/วัน</button>
            `).join('')}
          </div>
        </div>

        <!-- #23 Streak Repair -->
        <div class="card-panel">
          <h3>🔥 สตรีค & ซ่อมสตรีค (Streak Repair)</h3>
          <div class="mo-streak-row">
            <div>
              <div class="mo-big-num">🔥 ${stats.streak || 0} วัน</div>
              <div class="mo-muted mo-small">สตรีคต่อเนื่องปัจจุบัน</div>
            </div>
            <div>
              <div class="mo-big-num">🧊 ${freezes}</div>
              <div class="mo-muted mo-small">Streak Freeze คงเหลือ</div>
            </div>
            <div>
              <div class="mo-big-num">🪙 ${coins}</div>
              <div class="mo-muted mo-small">เหรียญไผ่</div>
            </div>
          </div>

          ${repair.canRepair ? `
            <div class="mo-repair-box">
              <p>สตรีคของคุณขาดไป ${repair.missingDays.length} วัน (${repair.missingDays.join(', ')}) สามารถซ่อมเพื่อกู้คืนเป็น <strong>${repair.restoredStreak} วัน</strong> ได้!</p>
              <button type="button" class="btn-primary" id="mo-repair-streak" ${coins < repair.cost ? 'disabled' : ''}>
                🛠️ ซ่อมสตรีค (${repair.cost} เหรียญไผ่)
              </button>
              ${coins < repair.cost ? `<p class="mo-muted mo-small">เหรียญไผ่ไม่พอ (ต้องการ ${repair.cost} เหรียญ)</p>` : ''}
            </div>
          ` : `
            <p class="mo-muted mo-mt">สตรีคของคุณอยู่ในสถานะปกติ หรือไม่มีช่วงที่ขาดภายใน 2 วันที่ผ่านมา</p>
          `}

          <div class="mo-btn-row mo-mt">
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-buy-freeze" ${coins < 50 ? 'disabled' : ''}>
              🧊 ซื้อ Streak Freeze (50 เหรียญ)
            </button>
          </div>
        </div>
      </div>

      <div class="mo-card-grid mo-mt">
        <!-- #25 Hearts -->
        <div class="card-panel">
          <div class="mo-section-head">
            <div>
              <h3>❤️ โหมดหัวใจ (Hearts)</h3>
              <p class="mo-muted">โหมดท้าทายเสริม (ปิดเป็นค่าเริ่มต้น): ตอบผิดเสีย 1 ดวง ฟื้นฟูทุก 30 นาที หรือทบทวนคำผิดเพื่อเติม</p>
            </div>
            <label class="mo-switch">
              <input type="checkbox" id="mo-hearts-toggle" ${hearts.enabled ? 'checked' : ''} />
              <span>${hearts.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}</span>
            </label>
          </div>
          ${hearts.enabled ? `
            <div class="mo-hearts-display">
              ${Array.from({ length: MAX_HEARTS }, (_, i) => i < hearts.count ? '❤️' : '🤍').join(' ')}
              <span class="mo-muted mo-small">(${hearts.count}/${MAX_HEARTS})</span>
            </div>
            ${hearts.count < MAX_HEARTS ? `
              <p class="mo-muted mo-small">ฟื้นฟูดวงถัดไปในอีกประมาณ ${regenMin} นาที</p>
              <button type="button" class="btn-secondary mo-btn-sm mo-mt" id="mo-refill-hearts">📕 ทบทวนคำผิดเพื่อเติมหัวใจ</button>
            ` : '<p class="mo-muted mo-small">หัวใจเต็มแล้ว พร้อมลุย!</p>'}
          ` : ''}
        </div>

        <!-- #26 Combo -->
        <div class="card-panel">
          <h3>⚡ คอมโบ & โบนัส (Combo)</h3>
          <p class="mo-muted">ตอบถูกต่อเนื่องในทุกแบบฝึกหัดเพื่อรับโบนัส XP อัตโนมัติ</p>
          <ul class="mo-simple-list">
            <li>🔥 ตอบถูกติดกัน <strong>5 ข้อ</strong> → ตัวคูณ <strong>x2</strong> (+3 XP โบนัส)</li>
            <li>🔥🔥 ตอบถูกติดกัน <strong>10 ข้อ</strong> → ตัวคูณ <strong>x3</strong> (+6 XP โบนัส)</li>
          </ul>
          <div class="mo-badge mo-badge-ok mo-mt">สถิติคอมโบสูงสุดของคุณ: ${bestCombo} ข้อติด</div>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-goal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mins = Number(btn.dataset.goal);
        core.setExt('motivation', { dailyGoalMinutes: mins }, { save: true, reason: 'daily-goal-change' });
        onHudRefresh?.();
        core.showToast(`ตั้งเป้าหมายรายวันเป็น ${mins} นาทีแล้ว`);
        render();
      });
    });

    host.querySelector('#mo-repair-streak')?.addEventListener('click', () => {
      if (coins < repair.cost) return;
      p.spentCoins = (p.spentCoins || 0) + repair.cost;
      if (!Array.isArray(p.frozenDays)) p.frozenDays = [];
      for (const d of repair.missingDays) {
        if (!p.frozenDays.includes(d)) p.frozenDays.push(d);
      }
      core.saveProgress('streak-repair');
      core.updateDashboard();
      core.spawnConfetti(30);
      core.showToast(`🛠️ ซ่อมสตรีคสำเร็จ! สตรีคกลับมาเป็น ${repair.restoredStreak} วัน`);
      render();
    });

    host.querySelector('#mo-buy-freeze')?.addEventListener('click', () => {
      if (coins < 50) return;
      p.spentCoins = (p.spentCoins || 0) + 50;
      p.streakFreezes = (p.streakFreezes || 0) + 1;
      core.saveProgress('buy-streak-freeze');
      core.updateDashboard();
      core.showToast('🧊 ซื้อ Streak Freeze สำเร็จ (+1)');
      render();
    });

    host.querySelector('#mo-hearts-toggle')?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      core.setExt('motivation', (prev) => ({
        ...prev,
        hearts: {
          enabled,
          count: prev.hearts?.count ?? MAX_HEARTS,
          lastLostAt: prev.hearts?.lastLostAt || 0
        }
      }), { save: true, reason: 'hearts-toggle' });
      onHudRefresh?.();
      render();
    });

    host.querySelector('#mo-refill-hearts')?.addEventListener('click', () => {
      openSubTab('mistakes');
    });
  }

  render();
}
