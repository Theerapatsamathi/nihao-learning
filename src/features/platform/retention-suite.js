// Retention & Habit Loop Suite:
// 1) Virtual Pet Panda Garden (feed Bamboo to evolve)
// 2) 1-Minute Streak Saver Micro-Sprint (5 rapid questions)
// 3) Daily Mystery Chest (variable daily reward)
// 4) China Passport Stamps (6 iconic cities)
// 5) 1-Click Friend Challenge Share

import { fireConfettiBurst } from './ux-polish.js';

const PET_KEY = 'nihao_panda_pet_v1';

const SPRINT_POOL = [
  { hz: '你好', py: 'nǐ hǎo', th: 'สวัสดี', opts: ['สวัสดี', 'ขอบคุณ', 'ลาก่อน', 'ขอโทษ'] },
  { hz: '谢谢', py: 'xièxie', th: 'ขอบคุณ', opts: ['ไม่เป็นไร', 'ขอบคุณ', 'ยินดีที่ได้รู้จัก', 'อร่อย'] },
  { hz: '珍珠奶茶', py: 'zhēnzhū nǎichá', th: 'ชานมไข่มุก', opts: ['กาแฟเย็น', 'ชานมไข่มุก', 'น้ำเปล่า', 'ชาเขียว'] },
  { hz: '多少钱', py: 'duōshao qián', th: 'ราคาเท่าไหร่', opts: ['อยู่ที่ไหน', 'กี่โมงแล้ว', 'ราคาเท่าไหร่', 'ชื่ออะไร'] },
  { hz: '太好吃了', py: 'tài hǎochī le', th: 'อร่อยมาก', opts: ['แพงมาก', 'อร่อยมาก', 'เผ็ดมาก', 'ร้อนมาก'] },
  { hz: '没关系', py: 'méi guānxi', th: 'ไม่เป็นไร', opts: ['ไม่เป็นไร', 'ช่วยด้วย', 'เข้าใจแล้ว', 'ลืมแล้ว'] },
  { hz: '我想去北京', py: 'wǒ xiǎng qù Běijīng', th: 'ฉันอยากไปปักกิ่ง', opts: ['ฉันอยู่ที่ไทย', 'ฉันอยากไปปักกิ่ง', 'ฉันชอบกินข้าว', 'ฉันกำลังเรียนจีน'] },
  { hz: '加油', py: 'jiāyóu', th: 'สู้ๆ', opts: ['สู้ๆ', 'ระวัง', 'รีบหน่อย', 'ช้าๆ'] }
];

const PASSPORT_CITIES = [
  { id: 'beijing', name: 'ปักกิ่ง · 北京', emoji: '🏯', reqXp: 0, stamp: 'กำแพงเมืองจีน' },
  { id: 'shanghai', name: 'เซี่ยงไฮ้ · 上海', emoji: '🌆', reqXp: 100, stamp: 'หอไข่มุก' },
  { id: 'chengdu', name: 'เฉิงตู · 成都', emoji: '🐼', reqXp: 250, stamp: 'ศูนย์แพนด้า' },
  { id: 'xian', name: 'ซีอาน · 西安', emoji: '🗿', reqXp: 500, stamp: 'สุสานจิ๋นซี' },
  { id: 'guangzhou', name: 'กว่างโจว · 广州', emoji: '🥟', reqXp: 800, stamp: 'ติ่มซำต้นตำรับ' },
  { id: 'hangzhou', name: 'หางโจว · 杭州', emoji: '🌊', reqXp: 1200, stamp: 'ทะเลสาบซีหู' }
];

function loadPet() {
  try {
    const raw = JSON.parse(localStorage.getItem(PET_KEY) || '{}');
    return {
      bamboo: Number(raw.bamboo ?? 2),
      fedTotal: Number(raw.fedTotal ?? 0),
      lastChestDate: String(raw.lastChestDate || ''),
      freezes: Number(raw.freezes ?? 0),
      bestSprintScore: Number(raw.bestSprintScore ?? 0)
    };
  } catch {
    return { bamboo: 2, fedTotal: 0, lastChestDate: '', freezes: 0, bestSprintScore: 0 };
  }
}

function savePet(pet) {
  try { localStorage.setItem(PET_KEY, JSON.stringify(pet)); } catch {}
}

function getPandaStage(fedTotal) {
  if (fedTotal >= 30) return { emoji: '👑🐼', title: 'ปรมาจารย์แพนด้า (Master)', next: null };
  if (fedTotal >= 15) return { emoji: '🏮🐼', title: 'แพนด้าเซียนภาษาจีน', next: 30 };
  if (fedTotal >= 5) return { emoji: '🥋🐼', title: 'แพนด้ากังฟู', next: 15 };
  return { emoji: '🐼', title: 'ลูกแพนด้าน้อย', next: 5 };
}

export function renderRetentionSuite(core, host) {
  const esc = core?.escapeHtml || ((s) => String(s ?? ''));
  const today = core?.todayKey ? core.todayKey(0) : new Date().toISOString().slice(0, 10);
  let pet = loadPet();
  let sprintState = null; // { idx, score, items, leftSec, timerId }

  function clearSprintTimer() {
    if (sprintState?.timerId) clearInterval(sprintState.timerId);
  }

  function startSprint() {
    clearSprintTimer();
    const shuffled = [...SPRINT_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
    sprintState = { idx: 0, score: 0, items: shuffled, leftSec: 60, timerId: null };
    sprintState.timerId = setInterval(() => {
      if (!sprintState) return;
      sprintState.leftSec--;
      const el = host.querySelector('#rs-timer');
      if (el) el.textContent = `${sprintState.leftSec}s`;
      if (sprintState.leftSec <= 0) {
        clearSprintTimer();
        sprintState = null;
        core?.showToast?.('หมดเวลา 60 วินาที ลองใหม่อีกครั้งนะ!', 'SPRINT');
        render();
      }
    }, 1000);
    render();
  }

  function render() {
    const stage = getPandaStage(pet.fedTotal);
    const totalXp = Number(core?.state?.xp || 0);
    const chestAvailable = pet.lastChestDate !== today;

    host.innerHTML = `
      <div class="pf-grid">
        <!-- 1. Virtual Pet Panda Garden -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">${stage.emoji} สวนไผ่น้องแพนด้า</h2>
              <p class="pf-card-desc">ระดับปัจจุบัน: <strong>${esc(stage.title)}</strong> · ป้อนแล้ว ${pet.fedTotal} ครั้ง ${stage.next ? `(อีก ${stage.next - pet.fedTotal} ครั้งเพื่อวิวัฒนาการ)` : '(ขั้นสูงสุดแล้ว!)'}</p>
            </div>
            <span class="pf-badge pf-badge-ok">🎋 ${pet.bamboo} ไผ่</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            <button type="button" class="btn-primary" id="rs-feed" ${pet.bamboo <= 0 ? 'disabled' : ''}>🎋 ป้อนไผ่น้องแพนด้า (+10 XP)</button>
            <span class="pf-badge">❄️ Streak Freeze: ${pet.freezes}</span>
          </div>
        </section>

        <!-- 2. 1-Minute Streak Saver Micro-Sprint -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">⚡ โหมดต่อ Streak ด่วน 60 วินาที</h2>
              <p class="pf-card-desc">มีเวลาแค่ 1 นาที? ทวนศัพท์ 5 คำรับ +25 XP และไผ่ +2 ทันที! (สถิติสูงสุด: ${pet.bestSprintScore}/5)</p>
            </div>
            ${sprintState ? `<span class="pf-badge" id="rs-timer">${sprintState.leftSec}s</span>` : ''}
          </div>
          ${sprintState ? (() => {
            const q = sprintState.items[sprintState.idx];
            return `
              <div style="margin-top:10px;padding:12px;border-radius:12px;background:rgba(15,23,42,0.06)">
                <div style="font-size:12px;opacity:0.75">ข้อ ${sprintState.idx + 1}/5</div>
                <div class="hanzi-font" style="font-size:2rem;font-weight:700;margin:4px 0">${esc(q.hz)}</div>
                <div style="color:#0f766e;margin-bottom:10px">${esc(q.py)}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                  ${q.opts.map((o) => `<button type="button" class="btn-secondary rs-opt" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
                </div>
              </div>
            `;
          })() : `
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
              <button type="button" class="btn-primary" id="rs-start-sprint">🚀 เริ่มสปรินต์ 60 วินาที</button>
              <button type="button" class="btn-secondary" id="rs-challenge">⚔️ ท้าเพื่อนผ่าน LINE</button>
            </div>
          `}
        </section>

        <!-- 3. Daily Mystery Chest -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">🎁 กล่องสุ่มรายวัน (Daily Mystery Chest)</h2>
              <p class="pf-card-desc">เปิดรับรางวัลสุ่มฟรีวันละ 1 ครั้ง (XP โบนัส, ไผ่, หรือ Streak Freeze)</p>
            </div>
          </div>
          <button type="button" class="btn-primary" id="rs-chest" style="margin-top:10px" ${chestAvailable ? '' : 'disabled'}>
            ${chestAvailable ? '🎁 เปิดกล่องสุ่มวันนี้!' : '✓ เปิดกล่องของวันนี้แล้ว (เจอกันพรุ่งนี้!)'}
          </button>
        </section>

        <!-- 4. China Passport Stamps -->
        <section class="card-panel pf-card">
          <div class="pf-card-head">
            <div>
              <h2 class="pf-card-title">🛂 สมุดพาสปอร์ตเที่ยวเมืองจีน</h2>
              <p class="pf-card-desc">สะสม XP เพื่อปลดล็อกตราประทับ 6 เมืองดังของจีน (XP ปัจจุบัน: ${totalXp})</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:10px">
            ${PASSPORT_CITIES.map((c) => {
              const unlocked = totalXp >= c.reqXp;
              return `
                <div style="padding:10px;border-radius:12px;text-align:center;border:1px dashed ${unlocked ? '#10b981' : '#94a3b8'};opacity:${unlocked ? '1' : '0.45'}">
                  <div style="font-size:28px">${c.emoji}</div>
                  <div style="font-weight:700;font-size:13px">${esc(c.name)}</div>
                  <div style="font-size:11px;opacity:0.8">${unlocked ? `✓ ${esc(c.stamp)}` : `ล็อก (${c.reqXp} XP)`}</div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </div>
    `;

    host.querySelector('#rs-feed')?.addEventListener('click', () => {
      if (pet.bamboo <= 0) return;
      pet.bamboo -= 1;
      pet.fedTotal += 1;
      savePet(pet);
      core?.addXp?.(10, 'panda-feed');
      core?.speak?.('谢谢你！好好吃！');
      fireConfettiBurst();
      core?.showToast?.('น้องแพนด้าดีใจมาก! +10 XP', '🐼');
      render();
    });

    host.querySelector('#rs-start-sprint')?.addEventListener('click', startSprint);

    host.querySelector('#rs-challenge')?.addEventListener('click', async () => {
      const url = `${window.location.origin}/?challenge=sprint&score=${pet.bestSprintScore}`;
      const text = `⚔️ มาแข่งภาษาจีน 60 วินาทีกับฉันบน 你好 Nihao! สถิติฉัน ${pet.bestSprintScore}/5 ลองดูสิ: ${url}`;
      try {
        await navigator.clipboard.writeText(text);
        core?.showToast?.('คัดลอกลิงก์ท้าเพื่อนแล้ว! ส่งเข้า LINE ได้เลย', '⚔️');
      } catch {
        core?.showToast?.(text, '⚔️');
      }
    });

    host.querySelectorAll('.rs-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!sprintState) return;
        const q = sprintState.items[sprintState.idx];
        const ok = btn.dataset.opt === q.th;
        if (ok) sprintState.score += 1;
        core?.speak?.(q.hz);
        sprintState.idx += 1;
        if (sprintState.idx >= sprintState.items.length) {
          const finalScore = sprintState.score;
          clearSprintTimer();
          sprintState = null;
          pet.bamboo += 2;
          pet.bestSprintScore = Math.max(pet.bestSprintScore, finalScore);
          savePet(pet);
          core?.addXp?.(25, 'micro-sprint');
          fireConfettiBurst();
          core?.showToast?.(`จบสปรินต์ 60 วิ! ได้ ${finalScore}/5 (+25 XP · 🎋 +2 ไผ่)`, '⚡');
        }
        render();
      });
    });

    host.querySelector('#rs-chest')?.addEventListener('click', () => {
      if (pet.lastChestDate === today) return;
      pet.lastChestDate = today;
      const roll = Math.random();
      let msg = '';
      if (roll < 0.35) {
        pet.bamboo += 3;
        msg = 'ได้ไผ่โบนัส +3 🎋 สำหรับน้องแพนด้า!';
      } else if (roll < 0.7) {
        core?.addXp?.(40, 'daily-chest');
        msg = 'ได้ XP โบนัส +40 XP ⚡!';
      } else {
        pet.freezes += 1;
        msg = 'ได้บัตรกันสตรีคขาด (Streak Freeze +1 ❄️)!';
      }
      savePet(pet);
      fireConfettiBurst();
      core?.showToast?.(`🎁 ${msg}`, 'CHEST');
      render();
    });
  }

  render();
}
