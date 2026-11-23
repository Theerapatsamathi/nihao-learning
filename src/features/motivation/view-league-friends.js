// #24 Weekly League & #28 Friends views
import {
  LEAGUE_TIERS,
  getIsoWeekKey,
  generateOfflineLeague
} from './logic.js';
import { getWeeklyXp } from './hud.js';

export function renderLeagueView(host, core) {
  const weekKey = getIsoWeekKey();
  const myWeeklyXp = getWeeklyXp(core, weekKey);
  const ext = core.getExt('motivation') || {};
  const user = core.getUser?.();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'คุณ';

  host.innerHTML = `<div class="mo-loading card-panel">กำลังโหลดตารางลีกประจำสัปดาห์...</div>`;

  async function load() {
    let online = false;
    let tierIdx = Number(ext.offlineTier) || 0;
    let members = [];
    let promoteTop = 7;
    let demoteBottom = 5;
    let notice = '';

    if (core.isSignedIn()) {
      try {
        const res = await core.api('/api/league', { xp: myWeeklyXp, displayName }, 'POST');
        if (res.ok && res.data?.ok) {
          online = true;
          tierIdx = Number(res.data.tier) || 0;
          members = res.data.members || [];
          promoteTop = res.data.promoteTop || 7;
          demoteBottom = res.data.demoteBottom || 5;
          if (res.data.promoted) notice = '🎉 ยินดีด้วย! คุณเลื่อนชั้นจากสัปดาห์ก่อน!';
          else if (res.data.demoted) notice = '📉 สัปดาห์ก่อนคุณตกชั้น สู้ใหม่สัปดาห์นี้นะ!';
        }
      } catch { /* fallback to offline */ }
    }

    if (!online) {
      members = generateOfflineLeague(weekKey, tierIdx, myWeeklyXp, displayName);
    }

    const tier = LEAGUE_TIERS[Math.max(0, Math.min(LEAGUE_TIERS.length - 1, tierIdx))];

    host.innerHTML = `
      <div class="mo-league-header card-panel">
        <div class="mo-league-tier-badge" style="--mo-tier-color:${tier.color}">
          <span class="mo-tier-emoji">${tier.emoji}</span>
          <div>
            <h3>ลีก ${tier.name} (${tier.th})</h3>
            <p class="mo-muted">สัปดาห์ ${core.escapeHtml(weekKey)} · XP สัปดาห์นี้ของคุณ: <strong>${myWeeklyXp.toLocaleString()} XP</strong></p>
          </div>
        </div>
        <div class="mo-league-mode">
          ${online
            ? '<span class="mo-badge mo-badge-ok">🌐 ลีกออนไลน์</span>'
            : '<span class="mo-badge mo-badge-warn">📴 โหมดออฟไลน์ (คู่แข่งจำลอง)</span>'}
          ${!core.isSignedIn() ? '<button type="button" class="btn-secondary mo-btn-sm" id="mo-league-login">เข้าสู่ระบบเพื่อแข่งออนไลน์</button>' : ''}
        </div>
      </div>

      ${notice ? `<div class="mo-banner card-panel">${core.escapeHtml(notice)}</div>` : ''}

      <div class="mo-tier-strip" aria-label="ระดับลีกทั้งหมด">
        ${LEAGUE_TIERS.map((t, i) => `
          <span class="mo-tier-dot ${i === tierIdx ? 'current' : i < tierIdx ? 'passed' : ''}" title="${t.name} (${t.th})">${t.emoji}</span>
        `).join('')}
      </div>

      <div class="mo-league-legend">
        <span class="mo-legend-up">▲ อันดับ 1–${promoteTop} เลื่อนชั้น</span>
        <span class="mo-legend-down">▼ ${demoteBottom} อันดับสุดท้าย ตกชั้น</span>
      </div>

      <div class="mo-league-list card-panel">
        ${members.map((m, i) => {
          const rank = m.rank || i + 1;
          const isPromote = rank <= promoteTop;
          const isDemote = members.length >= 8 && rank > members.length - demoteBottom;
          return `
            <div class="mo-league-row ${m.isMe ? 'me' : ''} ${isPromote ? 'zone-up' : isDemote ? 'zone-down' : ''}">
              <span class="mo-rank">${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}</span>
              <span class="mo-member-name">${core.escapeHtml(m.displayName)}${m.isMe ? ' (คุณ)' : ''}</span>
              <span class="mo-member-xp">${Number(m.xp || 0).toLocaleString()} XP</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    host.querySelector('#mo-league-login')?.addEventListener('click', () => core.openAuthModal());
  }

  load();
}

export function renderFriendsView(host, core) {
  if (!core.isSignedIn()) {
    host.innerHTML = `
      <div class="mo-empty card-panel">
        <div class="mo-empty-icon">🤝</div>
        <h4>ระบบเพื่อน & ภารกิจคู่หู (Friend Quest)</h4>
        <p>เข้าสู่ระบบเพื่อรับรหัสเพื่อน แชร์ลิงก์ชวนเพื่อน และทำภารกิจสะสม 500 XP ประจำสัปดาห์ร่วมกัน</p>
        <button type="button" class="btn-primary" id="mo-friends-login">เข้าสู่ระบบ / สมัครสมาชิก</button>
      </div>
    `;
    host.querySelector('#mo-friends-login')?.addEventListener('click', () => core.openAuthModal());
    return;
  }

  host.innerHTML = `<div class="mo-loading card-panel">กำลังโหลดรายชื่อเพื่อน...</div>`;

  async function loadAndRender() {
    const stats = core.computeGameStats();
    const weeklyXp = getWeeklyXp(core);
    const user = core.getUser?.();
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Learner';

    let data = null;
    try {
      const res = await core.api('/api/friends', {
        action: 'sync',
        weeklyXp,
        streak: stats.streak || 0,
        displayName
      }, 'POST');
      if (res.ok && res.data?.ok) data = res.data;
    } catch { /* ignore */ }

    if (!data) {
      host.innerHTML = `
        <div class="mo-empty card-panel">
          <div class="mo-empty-icon">📡</div>
          <h4>ไม่สามารถเชื่อมต่อระบบเพื่อนได้ชั่วคราว</h4>
          <p>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
          <button type="button" class="btn-secondary" id="mo-friends-retry">ลองใหม่</button>
        </div>
      `;
      host.querySelector('#mo-friends-retry')?.addEventListener('click', loadAndRender);
      return;
    }

    const ext = core.getExt('motivation') || {};
    const pendingCode = ext.pendingFriendCode || '';
    const quest = data.quest || { targetXp: 500, combinedXp: 0, completed: false };
    const questPct = Math.min(100, Math.round((quest.combinedXp / quest.targetXp) * 100));
    const claimedWeek = ext.friendQuestClaimedWeek || '';
    const canClaimQuest = quest.completed && claimedWeek !== data.weekKey;
    const inviteUrl = `${window.location.origin}${window.location.pathname}?friend=${encodeURIComponent(data.me.friendCode)}`;

    host.innerHTML = `
      <div class="mo-card-grid">
        <div class="card-panel mo-friend-code-card">
          <h4>รหัสเพื่อนของคุณ</h4>
          <div class="mo-code-box">
            <code class="mo-code-val">${core.escapeHtml(data.me.friendCode)}</code>
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-copy-code">คัดลอกรหัส</button>
            <button type="button" class="btn-primary mo-btn-sm" id="mo-copy-link">คัดลอกลิงก์ชวน</button>
          </div>
        </div>

        <div class="card-panel mo-friend-add-card">
          <h4>เพิ่มเพื่อนด้วยรหัส</h4>
          <form id="mo-add-friend-form" class="mo-inline-form">
            <input type="text" class="mo-input" id="mo-friend-code-input" placeholder="เช่น NH8K2P9Q" value="${core.escapeHtml(pendingCode)}" maxlength="16" required />
            <button type="submit" class="btn-primary">เพิ่มเพื่อน</button>
          </form>
        </div>
      </div>

      <div class="card-panel mo-quest-card">
        <div class="mo-section-head">
          <div>
            <h4>🤝 ภารกิจเพื่อนประจำสัปดาห์ (Friend Quest)</h4>
            <p class="mo-muted">สะสม XP รวมกันกับเพื่อนให้ครบ ${quest.targetXp} XP ในสัปดาห์นี้ (${data.weekKey})</p>
          </div>
          ${canClaimQuest
            ? '<button type="button" class="btn-primary" id="mo-claim-quest">🎁 รับรางวัล +40 XP</button>'
            : claimedWeek === data.weekKey
              ? '<span class="mo-badge mo-badge-ok">✓ รับรางวัลแล้ว</span>'
              : `<span class="mo-badge">${questPct}%</span>`}
        </div>
        <div class="mo-progress-track">
          <div class="mo-progress-fill" style="width:${questPct}%"></div>
        </div>
        <div class="mo-muted mo-small">${quest.combinedXp.toLocaleString()} / ${quest.targetXp.toLocaleString()} XP</div>
      </div>

      <div class="card-panel">
        <h4>เพื่อนของคุณ (${data.friends.length})</h4>
        ${data.friends.length === 0 ? `
          <p class="mo-muted">ยังไม่มีเพื่อนในรายชื่อ แชร์รหัสของคุณหรือใส่รหัสเพื่อนด้านบนได้เลย!</p>
        ` : `
          <div class="mo-list">
            ${data.friends.map((f) => `
              <div class="mo-friend-row">
                <div>
                  <strong>${core.escapeHtml(f.displayName)}</strong>
                  <div class="mo-muted mo-small">รหัส ${core.escapeHtml(f.friendCode)} · 🔥 ${f.streak} วัน</div>
                </div>
                <div class="mo-btn-row">
                  <span class="mo-badge mo-badge-ok">${f.weeklyXp.toLocaleString()} XP</span>
                  <button type="button" class="btn-secondary mo-btn-sm" data-rm-friend="${core.escapeHtml(f.userId)}" aria-label="ลบเพื่อน">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    host.querySelector('#mo-copy-code')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(data.me.friendCode).catch(() => {});
      core.showToast('คัดลอกรหัสเพื่อนแล้ว');
    });
    host.querySelector('#mo-copy-link')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(inviteUrl).catch(() => {});
      core.showToast('คัดลอกลิงก์เชิญเพื่อนแล้ว');
    });
    host.querySelector('#mo-add-friend-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = host.querySelector('#mo-friend-code-input')?.value.trim().toUpperCase();
      if (!code) return;
      const res = await core.api('/api/friends', { action: 'add', code }, 'POST');
      if (res.ok && res.data?.ok) {
        core.setExt('motivation', { pendingFriendCode: '' }, { save: false });
        core.showToast(`เพิ่มเพื่อน ${res.data.addedName || code} สำเร็จ!`);
        loadAndRender();
      } else {
        core.showToast(res.data?.error || 'ไม่สามารถเพิ่มเพื่อนได้');
      }
    });
    host.querySelector('#mo-claim-quest')?.addEventListener('click', () => {
      core.setExt('motivation', { friendQuestClaimedWeek: data.weekKey }, { save: true, reason: 'friend-quest' });
      core.addXp(40, 'friend-quest-complete');
      core.spawnConfetti(35);
      core.showToast('🎉 รับรางวัล Friend Quest +40 XP!', 40);
      loadAndRender();
    });
    host.querySelectorAll('[data-rm-friend]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res = await core.api('/api/friends', { action: 'remove', friendUserId: btn.dataset.rmFriend }, 'POST');
        if (res.ok && res.data?.ok) {
          core.showToast('ลบเพื่อนออกจากรายชื่อแล้ว');
          loadAndRender();
        }
      });
    });
  }

  loadAndRender();
}
