// Multiplayer Arena & Live Social entry point (tab: arena)
// Includes: 1v1/Party Rooms (Vocab, Tones, Survival, Tone Sniper, Hanzi Speed Draw, Custom Lyrics),
// Shareable 9:16 Battle Card PNG, Weekend Dragon Co-op Boss Raid, Live Leaderboard, Study Squad & Avatar Shop.

import './style.css';
import {
  PANDA_AVATARS,
  ARENA_TITLES,
  DUEL_BANK,
  buildSeededDuelQuestions,
  calcDuelPoints,
  calcRaidBossDamage
} from './logic.js';
import { generateAndShareBattleCard } from './battle-card.js';

const core = window.NihaoCore;
const ui = {
  sub: 'duel',
  lbSort: 'weeklyXp',
  activeRoom: null,
  pollId: null,
  duelIdx: 0,
  duelScore: 0,
  duelStartTs: 0,
  duelQuestions: [],
  duelDone: false,
  raidCombo: 0,
  raidQ: null,
  raidQTs: 0
};

const TOPIC_LABELS = {
  vocab: 'คำศัพท์ HSK 1',
  tones: '20 คู่วรรณยุกต์',
  survival: '50 ประโยคเอาตัวรอด',
  'tone-sniper': '🎧 Tone Sniper (ฟังไวแย่งกดเสียง)',
  'speed-draw': '✍️ Hanzi Speed Draw (แข่งเขียนไว)',
  custom: '🎵 ดวลศัพท์จากเพลง/บทความ'
};

function getPlayerProfile() {
  const ext = core.getExt('arena');
  const fb = window.__nihaoFirebaseUser;
  const g = core.computeGameStats();
  return {
    name: ext.displayName || fb?.displayName || fb?.email?.split('@')[0] || 'ผู้เรียน',
    avatar: ext.avatar || '🐼',
    title: ext.title || ARENA_TITLES[0],
    weeklyXp: g.xp,
    totalXp: g.xp,
    streak: g.streak || 0,
    speedBest: core.state.progress.speedBest || 0
  };
}

async function syncMyLeaderboard() {
  const me = getPlayerProfile();
  await core.api('/api/arena/leaderboard', me, 'POST');
}

function stopPoll() {
  if (ui.pollId) { clearInterval(ui.pollId); ui.pollId = null; }
}

function renderArena(host) {
  if (!host) return;
  stopPoll();

  // Check if Smart Importer launched a custom duel room
  if (window.__nihaoPendingArenaRoom) {
    const pending = window.__nihaoPendingArenaRoom;
    window.__nihaoPendingArenaRoom = null;
    ui.sub = 'duel';
    ui.activeRoom = pending;
    ui.duelQuestions = buildSeededDuelQuestions(pending.topic, pending.seed, 10, pending.customQuestions);
    ui.duelIdx = 0;
    ui.duelScore = 0;
    ui.duelDone = false;
    ui.duelStartTs = Date.now();
  }

  host.innerHTML = `
    <div class="ar-subnav">
      <button type="button" class="ar-pill ${ui.sub === 'duel' ? 'active' : ''}" data-sub="duel">⚔️ ห้องดวล 1v1 / มินิเกม</button>
      <button type="button" class="ar-pill ${ui.sub === 'raid' ? 'active' : ''}" data-sub="raid">🐉 Boss Raid รายสัปดาห์</button>
      <button type="button" class="ar-pill ${ui.sub === 'lb' ? 'active' : ''}" data-sub="lb">🏆 Live Leaderboard</button>
      <button type="button" class="ar-pill ${ui.sub === 'squad' ? 'active' : ''}" data-sub="squad">🤝 Study Squad & Feed</button>
      <button type="button" class="ar-pill ${ui.sub === 'avatar' ? 'active' : ''}" data-sub="avatar">🐼 อวตาร & ฉายา</button>
    </div>
    <div id="ar-body"></div>
  `;
  host.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => {
    ui.sub = b.dataset.sub;
    renderArena(host);
  }));
  const body = host.querySelector('#ar-body');
  if (ui.sub === 'duel') renderDuelView(body, host);
  else if (ui.sub === 'raid') renderRaidView(body);
  else if (ui.sub === 'lb') renderLeaderboardView(body);
  else if (ui.sub === 'squad') renderSquadFeedView(body);
  else if (ui.sub === 'avatar') renderAvatarView(body);
}

function renderDuelView(body, rootHost) {
  if (ui.activeRoom) return renderActiveDuelRoom(body, rootHost);
  body.innerHTML = `
    <div class="ar-grid-2">
      <div class="card-panel">
        <h3 style="margin:0 0 6px">⚔️ สร้างห้องแข่งรหัส 6 หลัก (1v1 / Party)</h3>
        <p class="ar-muted" style="font-size:13px;margin:0 0 12px">เลือกโหมดแล้วส่งรหัสให้เพื่อนแข่งโจทย์ชุดเดียวกัน 10 ข้อ จบเกมสร้างการ์ด PNG แชร์ลง IG Story / LINE ได้เลย!</p>
        <select id="ar-topic" class="vb-search" style="width:100%;margin-bottom:10px">
          <option value="vocab">📚 คำศัพท์ HSK 1 (10 ข้อ)</option>
          <option value="tone-sniper">🎧 NEW · Tone Sniper (แข่งฟังเสียงแย่งกดวรรณยุกต์)</option>
          <option value="speed-draw">✍️ NEW · Hanzi Speed Draw (แข่งเขียนตัวจีนไว)</option>
          <option value="tones">🎵 20 คู่วรรณยุกต์ (10 ข้อ)</option>
          <option value="survival">🗣️ 50 ประโยคเอาตัวรอด (10 ข้อ)</option>
        </select>
        <button type="button" class="btn-primary" id="ar-create-room" style="width:100%">🚀 สร้างห้องแข่งเดี๋ยวนี้</button>
      </div>

      <div class="card-panel">
        <h3 style="margin:0 0 6px">🔑 เข้าร่วมห้องด้วยรหัส 6 หลัก</h3>
        <p class="ar-muted" style="font-size:13px;margin:0 0 12px">พิมพ์รหัสห้องจากเพื่อนเพื่อเข้าดวลพร้อมกัน หรือแข่งทำคะแนนแซงแบบ Async</p>
        <input type="text" id="ar-join-code" class="vb-search" style="width:100%;margin-bottom:10px;text-transform:uppercase" placeholder="เช่น AB12CD" maxlength="8">
        <button type="button" class="btn-secondary" id="ar-join-room" style="width:100%">เข้าห้องแข่ง →</button>
      </div>
    </div>
  `;

  body.querySelector('#ar-create-room')?.addEventListener('click', async () => {
    const topic = body.querySelector('#ar-topic')?.value || 'vocab';
    const me = getPlayerProfile();
    const res = await core.api('/api/arena/rooms', { topic, name: me.name, avatar: me.avatar }, 'POST');
    if (!res.ok || !res.data?.room) return core.showToast(res.data?.error || 'สร้างห้องไม่สำเร็จ');
    startDuelInRoom(res.data.room, body, rootHost);
  });

  body.querySelector('#ar-join-room')?.addEventListener('click', async () => {
    const code = String(body.querySelector('#ar-join-code')?.value || '').trim().toUpperCase();
    if (!code) return core.showToast('กรุณาพิมพ์รหัสห้อง 6 หลัก');
    const res = await core.api(`/api/arena/rooms/${encodeURIComponent(code)}`, null, 'GET');
    if (!res.ok || !res.data?.room) return core.showToast(res.data?.error || 'ไม่พบห้องรหัสนี้');
    startDuelInRoom(res.data.room, body, rootHost);
  });
}

function startDuelInRoom(room, body, rootHost) {
  ui.activeRoom = room;
  ui.duelQuestions = buildSeededDuelQuestions(room.topic, room.seed, 10, room.customQuestions);
  ui.duelIdx = 0;
  ui.duelScore = 0;
  ui.duelDone = false;
  ui.duelStartTs = Date.now();
  renderActiveDuelRoom(body, rootHost);
}

function renderActiveDuelRoom(body, rootHost) {
  const room = ui.activeRoom;
  if (!room) return renderDuelView(body, rootHost);
  const shareUrl = `${window.location.origin}/?duel=${room.code}`;
  const players = Object.values(room.players || {}).sort((a, b) => (b.score || 0) - (a.score || 0));
  const topicLabel = room.title || TOPIC_LABELS[room.topic] || room.topic;

  const renderBoardHtml = (pls) => pls.map((pl, idx) => `
    <div class="ar-lb-row">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="ar-rank">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
        <span class="ar-avatar">${core.escapeHtml(pl.avatar || '🐼')}</span>
        <strong>${core.escapeHtml(pl.name || 'ผู้เล่น')}</strong>
      </div>
      <div><strong>${Number(pl.score || 0)}</strong> แต้ม (${Number(pl.progress || 0)}/${ui.duelQuestions.length}) ${pl.done ? '✅' : ''}</div>
    </div>`).join('');

  const submitAnswer = async (isCorrect, clickedBtn = null) => {
    const pts = calcDuelPoints(isCorrect, Date.now() - ui.duelStartTs);
    ui.duelScore += pts;
    core.playChime(isCorrect ? 'ok' : 'err');
    if (clickedBtn) clickedBtn.classList.add(isCorrect ? 'ok' : 'err');
    ui.duelIdx++;
    ui.duelStartTs = Date.now();
    const finished = ui.duelIdx >= ui.duelQuestions.length;
    if (finished) {
      ui.duelDone = true;
      core.addXp(35, `จบดวลห้อง ${room.code} (${ui.duelScore} แต้ม)`);
      core.spawnConfetti(26);
      const me = getPlayerProfile();
      core.api('/api/arena/feed', { name: me.name, avatar: me.avatar, text: `ทำคะแนนดวลโหมด ${topicLabel} ได้ ${ui.duelScore} แต้มในห้อง ${room.code}! ⚔️` }, 'POST');
      syncMyLeaderboard();
    }
    const me = getPlayerProfile();
    const res = await core.api(`/api/arena/rooms/${encodeURIComponent(room.code)}/score`, {
      name: me.name, avatar: me.avatar, score: ui.duelScore, progress: ui.duelIdx, done: finished
    }, 'POST');
    if (res.ok && res.data?.room) ui.activeRoom = res.data.room;
    setTimeout(() => renderActiveDuelRoom(body, rootHost), 260);
  };

  if (ui.duelDone) {
    const me = getPlayerProfile();
    const myRankIdx = Math.max(0, players.findIndex(p => p.name === me.name));
    const rankLabel = myRankIdx === 0 ? '🥇 อันดับที่ 1' : `🏆 อันดับที่ ${myRankIdx + 1}`;

    body.innerHTML = `
      <div class="card-panel" style="text-align:center">
        <div style="font-size:46px">🏆</div>
        <h2 style="margin:6px 0">จบการแข่งขัน! คุณได้ ${ui.duelScore.toLocaleString()} แต้ม</h2>
        <div class="ar-muted" style="margin-bottom:8px">โหมด: <b>${core.escapeHtml(topicLabel)}</b></div>
        <div style="margin:10px 0"><span class="ar-code-badge">${core.escapeHtml(room.code)}</span></div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:14px">
          <button type="button" class="btn-primary ar-share-card-btn" id="ar-share-png">📸 แชร์การ์ด PNG ลง IG Story / LINE</button>
          <button type="button" class="btn-secondary" id="ar-copy-link">📋 คัดลอกลิงก์ท้าเพื่อน</button>
          <button type="button" class="btn-secondary" id="ar-leave-room">กลับหน้าห้องดวล</button>
        </div>
        <div class="ar-lb-list" id="ar-live-players">${renderBoardHtml(players)}</div>
      </div>`;

    body.querySelector('#ar-share-png')?.addEventListener('click', () => {
      generateAndShareBattleCard({
        playerName: me.name,
        avatar: me.avatar,
        title: me.title,
        score: ui.duelScore,
        roomCode: room.code,
        topicLabel,
        rankLabel,
        shareUrl
      }, core);
    });
  } else {
    const q = ui.duelQuestions[ui.duelIdx];
    const isToneSniper = q.mode === 'tone-sniper';
    const isSpeedDraw = q.mode === 'speed-draw' && q.char;

    body.innerHTML = `
      <div class="card-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span class="ar-code-badge" style="font-size:14px;padding:3px 10px">ห้อง ${core.escapeHtml(room.code)}</span>
            <span class="ar-title-tag" style="margin-left:6px">${core.escapeHtml(topicLabel)}</span>
            <button type="button" class="btn-secondary" id="ar-copy-link" style="padding:4px 10px;font-size:12px;margin-left:6px">📋 ชวนเพื่อน</button>
          </div>
          <div>ข้อที่ <b>${ui.duelIdx + 1}/${ui.duelQuestions.length}</b> · คะแนน: <b>${ui.duelScore}</b></div>
        </div>
        <h2 style="margin:18px 0 8px;font-size:22px" class="hanzi-font">${core.escapeHtml(q.q)}</h2>

        ${isToneSniper ? `
          <div style="margin:10px 0">
            <button type="button" class="btn-primary" id="ar-sniper-play">🔊 กดฟังเสียงอีกครั้ง</button>
          </div>
        ` : ''}

        ${isSpeedDraw ? `
          <div class="ar-draw-stage">
            <div id="ar-hanzi-quiz-box" class="ar-hanzi-box"></div>
            <div class="ar-muted" style="font-size:12.5px;margin-top:6px">ลากขีดเขียนตัวอักษรในกรอบให้ครบตามลำดับ! (หากอุปกรณ์ไม่รองรับใช้ปุ่มตัวเลือกด้านล่างแทนได้)</div>
          </div>
        ` : ''}

        <div class="ar-opts">
          ${q.opts.map((opt, i) => `<button type="button" class="ar-opt-btn" data-opt="${i}">${core.escapeHtml(opt)}</button>`).join('')}
        </div>
      </div>
      <div class="card-panel" style="margin-top:12px">
        <div style="font-weight:700;margin-bottom:8px">📊 คะแนนสดในห้อง</div>
        <div class="ar-lb-list" id="ar-live-players">${renderBoardHtml(players)}</div>
      </div>`;

    if (isToneSniper && q.audioText) {
      setTimeout(() => core.speak(q.audioText), 120);
      body.querySelector('#ar-sniper-play')?.addEventListener('click', () => core.speak(q.audioText));
    }

    if (isSpeedDraw && typeof window.HanziWriter !== 'undefined') {
      const targetEl = body.querySelector('#ar-hanzi-quiz-box');
      if (targetEl) {
        try {
          const writer = window.HanziWriter.create(targetEl, q.char, {
            width: 190,
            height: 190,
            padding: 12,
            showCharacter: false,
            showOutline: true,
            showHintAfterMisses: 2
          });
          writer.quiz({
            onComplete: () => {
              submitAnswer(true);
            }
          });
        } catch { /* fallback to choice buttons */ }
      }
    }

    body.querySelectorAll('[data-opt]').forEach(btn => btn.addEventListener('click', () => {
      const picked = q.opts[Number(btn.dataset.opt)];
      submitAnswer(picked === q.a, btn);
    }));
  }

  body.querySelector('#ar-copy-link')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    core.showToast(`คัดลอกลิงก์ห้อง ${room.code} แล้ว ส่งให้เพื่อนเลย!`);
  });
  body.querySelector('#ar-leave-room')?.addEventListener('click', () => {
    stopPoll();
    ui.activeRoom = null;
    renderDuelView(body, rootHost);
  });

  stopPoll();
  ui.pollId = setInterval(async () => {
    if (!ui.activeRoom) return stopPoll();
    const r = await core.api(`/api/arena/rooms/${encodeURIComponent(ui.activeRoom.code)}`, null, 'GET');
    if (r.ok && r.data?.room) {
      ui.activeRoom = r.data.room;
      const listEl = body.querySelector('#ar-live-players');
      if (listEl) {
        const pls = Object.values(r.data.room.players || {}).sort((a, b) => (b.score || 0) - (a.score || 0));
        listEl.innerHTML = renderBoardHtml(pls);
      }
    }
  }, 2500);
}

// ---- NEW: Weekend Co-op Boss Raid (บอสมังกรคำศัพท์ 50,000 HP) ----
async function renderRaidView(body) {
  body.innerHTML = `<div class="card-panel"><div class="ar-muted">กำลังเชื่อมต่อรังมังกรหยก...</div></div>`;
  const res = await core.api('/api/arena/raid', null, 'GET');
  let raid = res.ok && res.data?.raid ? res.data.raid : {
    weekId: 'LIVE',
    bossName: 'มังกรหยกคำศัพท์ · 翡翠词龙',
    maxHp: 50000,
    hp: 42800,
    totalHits: 12,
    attackers: {},
    recentLogs: []
  };

  const pickRaidQuestion = () => {
    const allPools = [...DUEL_BANK.vocab, ...DUEL_BANK.tones, ...DUEL_BANK.survival];
    const item = allPools[Math.floor(Math.random() * allPools.length)];
    ui.raidQ = { q: item.q, a: item.a, opts: [...item.opts].sort(() => Math.random() - 0.5) };
    ui.raidQTs = Date.now();
  };
  if (!ui.raidQ) pickRaidQuestion();

  const drawRaid = () => {
    const hpPct = Math.max(0, Math.min(100, Math.round((raid.hp / (raid.maxHp || 50000)) * 100)));
    const topAttackers = Object.values(raid.attackers || {}).sort((a, b) => (b.damage || 0) - (a.damage || 0)).slice(0, 10);
    const defeated = raid.hp <= 0;

    body.innerHTML = `
      <div class="card-panel ar-raid-banner">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:52px;line-height:1">${defeated ? '👑' : '🐉'}</div>
            <div>
              <span class="ar-title-tag">Co-op Boss Raid · ${core.escapeHtml(raid.weekId || 'ประจำสัปดาห์')}</span>
              <h2 style="margin:4px 0">${core.escapeHtml(raid.bossName)}</h2>
              <div class="ar-muted" style="font-size:13px">ผู้เล่นทั้งเซิร์ฟเวอร์และ Study Squad ช่วยกันตอบคำถามทำดาเมจ! ตีบอสแตกรับฉายา <b>อัศวินปราบมังกรหยก 🐉</b></div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:800;color:#ef4444">${Number(raid.hp).toLocaleString()} / ${Number(raid.maxHp).toLocaleString()} HP</div>
            <div class="ar-muted" style="font-size:12px">โจมตีรวม ${Number(raid.totalHits || 0).toLocaleString()} ครั้ง · คอมโบของคุณ x${ui.raidCombo}</div>
          </div>
        </div>
        <div class="ar-hp-track">
          <div class="ar-hp-fill" style="width:${hpPct}%"></div>
        </div>
      </div>

      <div class="ar-grid-2" style="margin-top:14px">
        <div class="card-panel">
          ${defeated ? `
            <div style="text-align:center;padding:18px">
              <div style="font-size:44px">🎉</div>
              <h3>มังกรหยกประจำสัปดาห์ถูกพิชิตแล้ว!</h3>
              <p class="ar-muted">คุณได้รับสิทธิ์ใช้อวตาร ⚡ และฉายาพิเศษ "อัศวินปราบมังกรหยก 🐉" ในแท็บอวตารแล้ว!</p>
              <button type="button" class="btn-primary" id="ar-claim-raid-reward">🎖️ รับฉายาพิเศษทันที (+50 XP)</button>
            </div>
          ` : `
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>⚔️ โจมตีบอส! (ตอบไว + คอมโบต่อเนื่อง = คริติคอล!)</strong>
              <span class="ar-title-tag">Combo 🔥 ${ui.raidCombo}</span>
            </div>
            <h3 style="margin:14px 0 8px;font-size:22px" class="hanzi-font">${core.escapeHtml(ui.raidQ.q)}</h3>
            <div class="ar-opts">
              ${ui.raidQ.opts.map((o, idx) => `<button type="button" class="ar-opt-btn" data-raid-opt="${idx}">${core.escapeHtml(o)}</button>`).join('')}
            </div>
          `}
        </div>

        <div class="card-panel">
          <h3 style="margin:0 0 8px">🏅 อันดับผู้ทำดาเมจสูงสุดประจำสัปดาห์</h3>
          <div class="ar-lb-list">
            ${topAttackers.length === 0 ? `<div class="ar-muted">เปิดฉากโจมตีมังกรคนแรกของสัปดาห์นี้เลย!</div>` : topAttackers.map((a, i) => `
              <div class="ar-lb-row">
                <div>
                  <span class="ar-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  <span class="ar-avatar">${core.escapeHtml(a.avatar || '🐼')}</span>
                  <b>${core.escapeHtml(a.name)}</b>
                  ${a.squadCode ? `<span class="ar-title-tag">แก๊ง ${core.escapeHtml(a.squadCode)}</span>` : ''}
                </div>
                <strong style="color:#ef4444">💥 ${Number(a.damage || 0).toLocaleString()} DMG</strong>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    body.querySelector('#ar-claim-raid-reward')?.addEventListener('click', () => {
      core.setExt('arena', { avatar: '⚡', title: 'อัศวินปราบมังกรหยก 🐉' }, { save: true });
      core.addXp(50, 'รับรางวัลพิชิต Boss Raid!');
      core.spawnConfetti(30);
    });

    body.querySelectorAll('[data-raid-opt]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const picked = ui.raidQ.opts[Number(btn.dataset.raidOpt)];
        const ok = picked === ui.raidQ.a;
        if (ok) {
          ui.raidCombo++;
          const dmg = calcRaidBossDamage(true, ui.raidCombo, Date.now() - ui.raidQTs);
          core.playChime('ok');
          btn.classList.add('ok');
          const me = getPlayerProfile();
          const ext = core.getExt('arena') || {};
          raid.hp = Math.max(0, raid.hp - dmg);
          const r = await core.api('/api/arena/raid', {
            damage: dmg,
            name: me.name,
            avatar: me.avatar,
            squadCode: ext.squadCode || ''
          }, 'POST');
          if (r.ok && r.data?.raid) raid = r.data.raid;
          core.addXp(8, `โจมตีมังกร -${dmg} HP!`);
        } else {
          ui.raidCombo = 0;
          core.playChime('err');
          btn.classList.add('err');
          core.showToast(`พลาดเป้า! เฉลยคือ "${ui.raidQ.a}"`);
        }
        pickRaidQuestion();
        setTimeout(drawRaid, 260);
      });
    });
  };

  drawRaid();
}

async function renderLeaderboardView(body) {
  body.innerHTML = `<div class="card-panel"><div class="ar-muted">กำลังโหลดอันดับจริงจาก Firestore...</div></div>`;
  await syncMyLeaderboard();
  const res = await core.api(`/api/arena/leaderboard?sort=${encodeURIComponent(ui.lbSort)}`, null, 'GET');
  const players = res.ok && Array.isArray(res.data?.players) ? res.data.players : [];

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h3 style="margin:0">🏆 Live Leaderboard (ทุก User บนเว็บ)</h3>
        <div class="ar-subnav" style="margin:0">
          ${[
            ['weeklyXp', '🔥 XP สัปดาห์'],
            ['streak', '🗓️ Streak'],
            ['speedBest', '⚡ Speed Match']
          ].map(([k, lbl]) => `<button type="button" class="ar-pill ${ui.lbSort === k ? 'active' : ''}" data-sort="${k}">${lbl}</button>`).join('')}
        </div>
      </div>
      <div class="ar-lb-list">
        ${players.length === 0 ? `<div class="ar-muted">ยังไม่มีข้อมูลผู้เล่น ลองเล่นเก็บ XP เพื่อขึ้นอันดับ 1 เลย!</div>` : players.map((pl, idx) => `
          <div class="ar-lb-row">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="ar-rank">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
              <span class="ar-avatar">${core.escapeHtml(pl.avatar || '🐼')}</span>
              <div>
                <strong>${core.escapeHtml(pl.name || 'ผู้เรียน')}</strong>
                <span class="ar-title-tag">${core.escapeHtml(pl.title || 'ผู้เริ่มต้น')}</span>
                <div class="ar-muted" style="font-size:12px">🔥 ${Number(pl.streak || 0)} วัน · 👏 ${Number(pl.cheers || 0)} กำลังใจ</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <strong>${Number(pl[ui.lbSort] || 0).toLocaleString()}</strong>
              <button type="button" class="btn-secondary" data-cheer="${core.escapeHtml(pl.userId)}" style="padding:4px 10px;font-size:12px">👏 ส่งกำลังใจ</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  body.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
    ui.lbSort = b.dataset.sort;
    renderLeaderboardView(body);
  }));
  body.querySelectorAll('[data-cheer]').forEach(b => b.addEventListener('click', async () => {
    await core.api('/api/arena/leaderboard', { cheerTarget: b.dataset.cheer }, 'POST');
    core.showToast('ส่งกำลังใจให้เพื่อนแล้ว 👏');
    renderLeaderboardView(body);
  }));
}

async function renderSquadFeedView(body) {
  const ext = core.getExt('arena');
  const feedRes = await core.api('/api/arena/feed', null, 'GET');
  const feed = feedRes.ok && Array.isArray(feedRes.data?.items) ? feedRes.data.items : [];
  let squad = null;
  if (ext.squadCode) {
    const sqRes = await core.api(`/api/arena/squads?code=${encodeURIComponent(ext.squadCode)}`, null, 'GET');
    if (sqRes.ok && sqRes.data?.squad) squad = sqRes.data.squad;
  }

  const members = squad ? Object.values(squad.members || {}) : [];
  const totalSquadXp = members.reduce((s, m) => s + Number(m.weeklyXp || 0), 0);
  const goalPct = squad ? Math.min(100, Math.round((totalSquadXp / (squad.goalXp || 2000)) * 100)) : 0;

  body.innerHTML = `
    <div class="ar-grid-2">
      <div class="card-panel">
        <h3 style="margin:0 0 8px">🤝 Study Squad (ทีมเรียนร่วมกัน)</h3>
        ${squad ? `
          <div style="margin-bottom:8px"><b>${core.escapeHtml(squad.name)}</b> · รหัสกลุ่ม: <span class="ar-code-badge" style="font-size:14px;padding:2px 8px">${core.escapeHtml(squad.code)}</span></div>
          <div class="ar-muted" style="font-size:13px">เป้าหมายสัปดาห์รวม: <b>${totalSquadXp.toLocaleString()} / ${(squad.goalXp || 2000).toLocaleString()} XP</b> (${goalPct}%)</div>
          <div class="ar-prog"><div class="ar-prog-fill" style="width:${goalPct}%"></div></div>
          <div class="ar-lb-list" style="margin-top:10px">
            ${members.map(m => `<div class="ar-lb-row"><div>${core.escapeHtml(m.avatar || '🐼')} <b>${core.escapeHtml(m.name)}</b></div><div>${Number(m.weeklyXp || 0)} XP</div></div>`).join('')}
          </div>
        ` : `
          <p class="ar-muted" style="font-size:13px">สร้างกลุ่มกับเพื่อน 2–10 คน ช่วยกันเก็บ XP รวมให้ถึง 2,000 XP/สัปดาห์ และร่วมกันตี Boss Raid!</p>
          <input type="text" id="ar-sq-name" class="vb-search" style="width:100%;margin-bottom:8px" placeholder="ตั้งชื่อแก๊ง เช่น แก๊งพิชิต HSK 1">
          <button type="button" class="btn-primary" id="ar-sq-create" style="width:100%;margin-bottom:12px">สร้างกลุ่มเรียนใหม่</button>
          <div style="display:flex;gap:6px">
            <input type="text" id="ar-sq-code" class="vb-search" style="flex:1;text-transform:uppercase" placeholder="หรือใส่รหัสกลุ่มเพื่อน">
            <button type="button" class="btn-secondary" id="ar-sq-join">เข้าร่วม</button>
          </div>
        `}
      </div>

      <div class="card-panel">
        <h3 style="margin:0 0 8px">📢 Activity Feed เพื่อนๆ</h3>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <input type="text" id="ar-feed-msg" class="vb-search" style="flex:1" placeholder="แชร์ความคืบหน้าวันนี้ เช่น วันนี้คัดลายมือได้เกรด S!">
          <button type="button" class="btn-primary" id="ar-feed-post">โพสต์</button>
        </div>
        <div class="ar-lb-list">
          ${feed.length === 0 ? `<div class="ar-muted">ยังไม่มีกิจกรรม ลองโพสต์ทักทายเพื่อนๆ เป็นคนแรกเลย!</div>` : feed.map(it => `
            <div class="ar-lb-row">
              <div><span class="ar-avatar">${core.escapeHtml(it.avatar || '🐼')}</span> <b>${core.escapeHtml(it.name)}</b>: ${core.escapeHtml(it.text)}</div>
              <button type="button" class="btn-secondary" data-clap="${core.escapeHtml(it.id)}" style="padding:3px 9px;font-size:12px">🎉 ${Number(it.claps || 0)}</button>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  body.querySelector('#ar-sq-create')?.addEventListener('click', async () => {
    const me = getPlayerProfile();
    const squadName = body.querySelector('#ar-sq-name')?.value.trim() || 'แก๊งเรียนจีน';
    const r = await core.api('/api/arena/squads', { action: 'create', squadName, name: me.name, avatar: me.avatar, weeklyXp: me.weeklyXp }, 'POST');
    if (r.ok && r.data?.squad) {
      core.setExt('arena', { squadCode: r.data.squad.code }, { save: true });
      core.showToast(`สร้างกลุ่มรหัส ${r.data.squad.code} แล้ว!`);
      renderSquadFeedView(body);
    }
  });
  body.querySelector('#ar-sq-join')?.addEventListener('click', async () => {
    const me = getPlayerProfile();
    const code = String(body.querySelector('#ar-sq-code')?.value || '').trim().toUpperCase();
    const r = await core.api('/api/arena/squads', { action: 'join', code, name: me.name, avatar: me.avatar, weeklyXp: me.weeklyXp }, 'POST');
    if (r.ok && r.data?.squad) {
      core.setExt('arena', { squadCode: r.data.squad.code }, { save: true });
      core.showToast(`เข้าร่วมกลุ่ม ${r.data.squad.name} แล้ว!`);
      renderSquadFeedView(body);
    } else core.showToast(r.data?.error || 'ไม่พบกลุ่มรหัสนี้');
  });
  body.querySelector('#ar-feed-post')?.addEventListener('click', async () => {
    const text = String(body.querySelector('#ar-feed-msg')?.value || '').trim();
    if (!text) return;
    const me = getPlayerProfile();
    await core.api('/api/arena/feed', { name: me.name, avatar: me.avatar, text }, 'POST');
    renderSquadFeedView(body);
  });
  body.querySelectorAll('[data-clap]').forEach(b => b.addEventListener('click', async () => {
    await core.api('/api/arena/feed', { reactId: b.dataset.clap }, 'POST');
    renderSquadFeedView(body);
  }));
}

function renderAvatarView(body) {
  const me = getPlayerProfile();
  body.innerHTML = `
    <div class="card-panel">
      <h3 style="margin:0 0 10px">🐼 ปรับแต่งอวตาร & ฉายา (โชว์บน Leaderboard, ห้องดวล และการ์ดแชร์ PNG)</h3>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
        <div style="font-size:44px">${core.escapeHtml(me.avatar)}</div>
        <div style="flex:1;min-width:200px">
          <input type="text" id="ar-display-name" class="vb-search" style="width:100%;margin-bottom:6px" placeholder="ชื่อเล่นที่แสดงในตารางอันดับ" value="${core.escapeHtml(me.name)}">
          <select id="ar-title-select" class="vb-search" style="width:100%">
            ${ARENA_TITLES.map(t => `<option value="${core.escapeHtml(t)}" ${me.title === t ? 'selected' : ''}>${core.escapeHtml(t)}</option>`).join('')}
          </select>
        </div>
        <button type="button" class="btn-primary" id="ar-save-profile">💾 บันทึก & อัปเดตอันดับ</button>
      </div>
      <div class="ar-avatar-grid">
        ${PANDA_AVATARS.map(a => `
          <div class="ar-avatar-card ${me.avatar === a.emoji ? 'active' : ''}" data-pick-av="${core.escapeHtml(a.emoji)}">
            <div style="font-size:32px">${a.emoji}</div>
            <div style="font-size:12.5px;font-weight:600;margin-top:4px">${core.escapeHtml(a.label)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  body.querySelectorAll('[data-pick-av]').forEach(card => card.addEventListener('click', () => {
    core.setExt('arena', { avatar: card.dataset.pickAv }, { save: true });
    renderAvatarView(body);
  }));
  body.querySelector('#ar-save-profile')?.addEventListener('click', async () => {
    const displayName = String(body.querySelector('#ar-display-name')?.value || '').trim() || 'ผู้เรียน';
    const title = body.querySelector('#ar-title-select')?.value || ARENA_TITLES[0];
    core.setExt('arena', { displayName, title }, { save: true });
    await syncMyLeaderboard();
    core.showToast('บันทึกอวตารและอัปเดตบน Live Leaderboard แล้ว!');
  });
}

if (core) {
  core.registerTab({
    id: 'arena',
    label: 'ดวล 1v1 & ตีบอส',
    title: '⚔️ Multiplayer Arena · Boss Raid & Live Leaderboard',
    desc: 'ห้องดวลรหัส 6 หลัก (Tone Sniper / Speed Draw), การ์ดแชร์ผลดวล PNG, บอสมังกรรายสัปดาห์ และอันดับสดทุกคนบนเว็บ',
    emoji: '⚔️',
    iconClass: 'icon-red',
    badge: 'LIVE',
    section: 'social',
    sectionTitle: '⚔️ แข่งขัน & สังคม',
    render(host) {
      renderArena(host);
    }
  });

  const duelCode = new URLSearchParams(window.location.search).get('duel');
  if (duelCode) {
    core.on('features-ready', async () => {
      core.switchTab('arena');
      const r = await core.api(`/api/arena/rooms/${encodeURIComponent(duelCode.toUpperCase())}`, null, 'GET');
      if (r.ok && r.data?.room) {
        ui.activeRoom = r.data.room;
        ui.duelQuestions = buildSeededDuelQuestions(r.data.room.topic, r.data.room.seed, 10, r.data.room.customQuestions);
        ui.duelIdx = 0; ui.duelScore = 0; ui.duelDone = false; ui.duelStartTs = Date.now();
        renderArena(document.getElementById('feature-host-arena'));
      }
    });
  }
}
