// Unified Today Dashboard (`today` tab) — Complete Mastery Loop Hub:
// 1. Morning Quiz-FSRS Gate + 4-Step Daily Lesson + Mandatory >=95% Mastery Exam
// 2. Weekly Cumulative Boss Exam (Day 7/14/21/30 >=95%) & 7/21-Day Memory Decay Re-Verify
// 3. 4-Second Reflex Speaking Trainer & Endless Adaptive Weakness Grinder
// 4. AI Copybook Grader, Smart Lyrics Importer, Snap Camera & 1v1 Arena

import {
  DAILY_MASTERY_PASS_PCT,
  WEEKLY_BOSS_DAYS,
  calcMonth1Stats,
  calc90DayStats,
  getTodayBlueprintDay,
  getDayMasteryRecord,
  getDueMonth1FsrsCards,
  getDecayedDays,
  getPendingWeeklyBoss,
  isWeeklyBossPassed
} from './logic.js';
import { renderGuidedRunner, toggleBeginnerMode } from './guided-session.js';
import {
  renderFsrsQuizGate,
  renderDecayReverifyRunner,
  renderReflexSpeakingRunner,
  renderWeaknessGrinder,
  renderWeeklyBossRunner
} from './mastery-drills.js';
import {
  renderUnscriptedSpeakingRunner,
  renderStreetListeningRunner,
  renderPatternWorkshopRunner,
  renderBlindDictationRunner
} from './realworld-drills.js';
import { realWorldProgress } from './realworld-logic.js';
import { openQuickDict } from './quick-dict.js';

export function renderTodayDashboard(core, host) {
  if (!host) return;
  const ext = core.getExt('month1') || {};
  const tk = core.todayKey();
  const m1Stats = calcMonth1Stats(core.state.progress, ext);
  const stats90 = calc90DayStats(core.state.progress, ext);
  const todayDay = getTodayBlueprintDay(core.state.progress, ext);
  const dayRec = getDayMasteryRecord(todayDay, ext);
  const dueM1Fsrs = getDueMonth1FsrsCards(ext.fsrsDeck || {}, tk);
  const decayedDays = getDecayedDays(ext, tk);
  const pendingBoss = getPendingWeeklyBoss(core.state.progress, ext);
  const g = core.computeGameStats();
  const dueVocabSrs = typeof core.getDueVocabSrsCount === 'function' ? core.getDueVocabSrsCount() : 0;
  const totalDueCards = dueM1Fsrs.length + dueVocabSrs;
  const beginnerOn = Boolean(ext.beginnerMode);
  const rwp = realWorldProgress(ext.realWorld);

  let statusBadgeHtml = `<span class="m1-status-pill pending">🎯 เกณฑ์ผ่านประจำวัน ≥ ${DAILY_MASTERY_PASS_PCT}%</span>`;
  let primaryBtnLabel = dueM1Fsrs.length > 0 && !dayRec.passed
    ? `🔒 ทวน FSRS (${dueM1Fsrs.length} คำ) → เริ่มเรียน Day ${todayDay}`
    : `▶ เริ่มเรียน & สอบ Day ${todayDay} (เกณฑ์ผ่าน ${DAILY_MASTERY_PASS_PCT}%)`;

  if (pendingBoss) {
    statusBadgeHtml = `<span class="m1-status-pill fail">🐉 ติดด่านบอสสะสม สัปดาห์ที่ ${Math.ceil(pendingBoss / 7)} (Day 1–${pendingBoss}) · ต้องสอบผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}% ก่อนขึ้นสัปดาห์ใหม่!</span>`;
    primaryBtnLabel = `🐉 เข้าสอบบอสสะสม Day 1–${pendingBoss} (เกณฑ์ ≥ ${DAILY_MASTERY_PASS_PCT}%)`;
  } else if (dayRec.passed) {
    statusBadgeHtml = `<span class="m1-status-pill pass">✅ สอบผ่านครบทุกวันแล้ว! (Day ${todayDay} สถิติ ${dayRec.bestPct}%)</span>`;
    primaryBtnLabel = `🔄 ทบทวน & สอบซ้ำ Day ${todayDay}`;
  } else if (dayRec.attempts > 0) {
    statusBadgeHtml = `<span class="m1-status-pill fail">⏳ ยังไม่จบ Day ${todayDay} · ล่าสุด ${dayRec.lastPct}% (สูงสุด ${dayRec.bestPct}% / ต้องถึง ${DAILY_MASTERY_PASS_PCT}%)</span>`;
    primaryBtnLabel = `📖 เรียนทบทวนใหม่ & สอบแก้ตัว Day ${todayDay} (ครั้งที่ ${dayRec.attempts + 1})`;
  }

  host.innerHTML = `
    <div class="card-panel m1-hero" style="background:linear-gradient(135deg, rgba(0,122,255,0.10), rgba(124,58,237,0.08));border-color:rgba(0,122,255,0.25)">
      <div class="m1-hero-left">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="m1-tag">🏠 ศูนย์รวมการเรียนวันนี้ · LV.${g.level} (${core.escapeHtml(g.rank?.th || 'ผู้เรียน')})</div>
          ${statusBadgeHtml}
        </div>
        <h2 style="margin:8px 0 6px">
          ${pendingBoss
            ? `ด่านสำคัญ! พิชิตสอบใหญ่บอสสะสม Day 1–${pendingBoss} ให้ถึง ${DAILY_MASTERY_PASS_PCT}%`
            : `สวัสดี! เป้าหมายวันนี้: พิชิต Day ${todayDay} / 90 (${todayDay <= 30 ? 'HSK 1' : (todayDay <= 60 ? 'HSK 2' : 'HSK 3')}) ให้ผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}%`}
        </h2>
        <p class="m1-muted" style="margin:0 0 14px">ระบบล็อกคุณภาพครบวงจร: <b>เคลียร์การ์ด FSRS ก่อนเรียน → เรียนฝึกครบ 3 ขั้น → สอบรายวัน ≥ ${DAILY_MASTERY_PASS_PCT}% → สอบบอสสะสมทุก 7 วัน ≥ ${DAILY_MASTERY_PASS_PCT}%</b></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn-primary" id="td-start-15m">${core.escapeHtml(primaryBtnLabel)}</button>
          <button type="button" class="btn-secondary" id="td-open-dict">🔍 ค้นศัพท์ / วาดตัวจีน (/)</button>
          <label class="m1-toggle-chip">
            <input type="checkbox" id="td-beginner-chk" ${beginnerOn ? 'checked' : ''}>
            <span>โหมดโฟกัสมือใหม่</span>
          </label>
        </div>
      </div>
      <div class="m1-kpi-mini">
        <div><strong>🔥 ${g.streak || 0}</strong><span>Streak</span></div>
        <div><strong>${stats90.total90Done}/90</strong><span>วันผ่าน ≥95%</span></div>
        <div><strong>${totalDueCards}</strong><span>การ์ดรอทวน</span></div>
      </div>
    </div>

    ${decayedDays.length > 0 ? `
      <div class="card-panel" style="margin-top:14px;border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.08)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <strong>🔔 แจ้งเตือนเช็กความจำเสื่อมตามเวลา (Memory Decay Check · ${decayedDays.length} วัน)</strong>
            <div class="m1-muted" style="font-size:12.5px">วันที่สอบผ่านไปแล้วครบ 7 หรือ 21 วัน กดทำควิซด่วน 5 ข้อเพื่อยืนยันว่ายังจำได้ ≥ ${DAILY_MASTERY_PASS_PCT}%!</div>
          </div>
          <div class="m1-chip-row">
            ${decayedDays.map(dd => `
              <button type="button" class="btn-primary m1-mini-btn" data-decay-day="${dd.day}" title="${core.escapeHtml(dd.reason)}">
                🔔 สอบเช็กซ้ำ Day ${dd.day} (5 ข้อ)
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Intensive Review · Practice · Boss Exam Bar -->
    <div class="card-panel" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <h3 style="margin:0">🔥 โหมดฝึกพิเศษ: ทวนให้แม่น · พูดให้ไว · สอบสะสม</h3>
          <div class="m1-muted" style="font-size:12.5px">ฝึกซ้ำได้ไม่จำกัดรอบเพื่อให้คล่องปากและจำฝังใจระยะยาว</div>
        </div>
      </div>
      <div class="m1-days-grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr))">
        <div class="m1-day-card">
          <span class="m1-tag">⚡ Reflex 4s</span>
          <div style="font-weight:700;margin:6px 0 4px">พูดสวนกลับไวใน 4 วินาที</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ฝึกสมองสั่งปากพูดภาษาจีนทันทีก่อนหมดเวลา แก้อาการคิดช้าอ้ำอึ้งเวลาเจอคนจีนจริง</div>
          <button type="button" class="btn-primary m1-mini-btn" id="td-go-reflex">⚡ เริ่มซ้อมพูดไว 4 วิ →</button>
        </div>

        <div class="m1-day-card">
          <span class="m1-tag">💪 Endless Drill</span>
          <div style="font-weight:700;margin:6px 0 4px">สนามซ้อมขยี้จุดอ่อน 4 ท่า</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ดึงคำที่เคยผิดมาวนยำ 4 รูปแบบ: ฟังเร็ว · พิมพ์พินอิน · พูดไมค์ · แปลไว ซ้อมได้ไม่จำกัดยก</div>
          <button type="button" class="btn-primary m1-mini-btn" id="td-go-weakness">💪 ลุยขยี้จุดอ่อน →</button>
        </div>

        <div class="m1-day-card">
          <span class="m1-tag">🐉 Weekly Boss ≥95%</span>
          <div style="font-weight:700;margin:6px 0 4px">สอบใหญ่บอสสะสมทุก 7 วัน</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:8px">ยำรวมข้อสอบทุกวันตั้งแต่ Day 1 พร้อมชี้เป้าวันที่ลืมหากได้ไม่ถึง 95%</div>
          <div class="m1-chip-row">
            ${WEEKLY_BOSS_DAYS.map(cp => {
              const ok = isWeeklyBossPassed(cp, ext);
              const unlocked = todayDay >= cp || ok || pendingBoss === cp;
              return `<button type="button" class="m1-chip ${ok ? 'active' : ''}" data-boss-cp="${cp}" ${unlocked ? '' : 'disabled title="สอบผ่านให้ถึง Day ' + cp + ' ก่อน"'}>${ok ? '✅' : '🐉'} W${Math.ceil(cp / 7)} (D1–${cp})</button>`;
            }).join('')}
          </div>
        </div>

        <div class="m1-day-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="m1-tag">🧠 Quiz-FSRS</span>
            <strong>${totalDueCards > 0 ? `${totalDueCards} รอทวน` : 'เคลียร์ครบ ✨'}</strong>
          </div>
          <div style="font-weight:700;margin:6px 0 4px">ทวนคำสะสมแบบสอบจริงก่อนเฉลย</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">คำจากบทเรียนที่สอบผ่านจะถูกป้อนเข้า FSRS อัตโนมัติ วัดความไวตอบจริง</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${dueM1Fsrs.length > 0 ? `<button type="button" class="btn-primary m1-mini-btn" id="td-go-m1fsrs">🧠 ทวนบทเรียน (${dueM1Fsrs.length})</button>` : ''}
            <button type="button" class="btn-secondary m1-mini-btn" id="td-go-srs">🔄 คลัง FSRS (${dueVocabSrs})</button>
            <button type="button" class="btn-secondary m1-mini-btn" id="td-go-bedtime">🌙 ก่อนนอน 3 นาที</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card-panel" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <h3 style="margin:0">🌏 ด่านโลกจริง: ใช้ได้นอกตำรา ${rwp.certified ? '<span class="m1-status-pill pass">🏅 Real-World Certified</span>' : ''}</h3>
          <div class="m1-muted" style="font-size:12.5px">ไม่มีสคริปต์ · ความเร็วคนจีนจริง · พลิกแพลงประโยค · เขียนจากความจำล้วน (ครบทุกด่านรับตรา Certified)</div>
        </div>
      </div>
      <div class="m1-days-grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr))">
        <div class="m1-day-card ${rwp.unscripted ? 'done' : ''}">
          <span class="m1-tag">🗣️ พูดสดไร้สคริปต์</span>
          <div style="font-weight:700;margin:6px 0 4px">พูดตามสถานการณ์ ไม่มีตัวจีนให้ดู</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">สั่งชานม ถามราคา ถามทาง — ต้องสื่อใจความครบ ≥ 95%</div>
          <button type="button" class="btn-primary m1-mini-btn" id="td-rw-unscripted">${rwp.unscripted ? '✅ ' : ''}🗣️ เริ่มพูดสด →</button>
        </div>
        <div class="m1-day-card ${rwp.street === 3 ? 'done' : ''}">
          <span class="m1-tag">🎧 ฟังคนจีนพูดจริง · ${rwp.street}/3 ระดับ</span>
          <div style="font-weight:700;margin:6px 0 4px">เร็ว 1.2x + เสียงคาเฟ่/รถไฟใต้ดิน</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">3 ระดับความสมจริง ผ่านต้อง ≥ 90% (9/10 ข้อ)</div>
          <button type="button" class="btn-primary m1-mini-btn" id="td-rw-street">🎧 เลือกระดับฟัง →</button>
        </div>
        <div class="m1-day-card ${rwp.patterns >= 3 ? 'done' : ''}">
          <span class="m1-tag">🧩 พลิกแพลงประโยค · ${rwp.patterns}/${rwp.patternTotal} โครงสร้าง</span>
          <div style="font-weight:700;margin:6px 0 4px">โครงสร้างเดียว เปลี่ยนโจทย์รัวๆ 5 ข้อ</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">是/不是 · 有/没有 · 想/要/会 · 在 · 疑问词 · 很/太…了</div>
          <button type="button" class="btn-primary m1-mini-btn" id="td-rw-pattern">🧩 เข้าโรงฝึก →</button>
        </div>
        <div class="m1-day-card ${rwp.blindChars >= 10 ? 'done' : ''}">
          <span class="m1-tag">✍️ เขียนไร้รอยประ · ${rwp.blindChars} ตัวที่เขียนได้</span>
          <div style="font-weight:700;margin:6px 0 4px">เขียนตามคำบอก ไม่มีเส้นร่าง ไม่มีขีดใบ้</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ลากขีดจากความจำ พลาดได้ไม่เกิน 1 ครั้งต่อตัว</div>
          <button type="button" class="btn-primary m1-mini-btn" id="td-rw-blind">✍️ เริ่มเขียนล้วน →</button>
        </div>
      </div>
    </div>

    <div class="m1-days-grid" style="margin-top:16px;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr))">
      <!-- AI Handwriting Grader -->
      <div class="m1-day-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="m1-tag">✨ Gemini Vision</span>
          <span>📝 สมุด 米字格</span>
        </div>
        <div style="font-weight:700;font-size:16px;margin:8px 0 4px">สมุดคัดลายมือ + ครู AI ตรวจสัดส่วน</div>
        <div class="m1-muted" style="font-size:12.5px;margin-bottom:12px">คัดตัวจีนด้วย Apple Pencil / นิ้ว / เมาส์ แล้วกดส่งครู AI ให้เกรด S/A/B/C รายตัวทันที</div>
        <button type="button" class="btn-primary m1-mini-btn m1-ai-btn" id="td-go-copybook">✍️ เปิดสมุดคัดลายมือ →</button>
      </div>

      <!-- Smart Lyrics & Snap Camera -->
      <div class="m1-day-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="m1-tag">🎵 C-Pop & Camera</span>
          <span>NEW</span>
        </div>
        <div style="font-weight:700;font-size:16px;margin:8px 0 4px">แกะเพลงจีน & ถ่ายรูปแปลเมนูอาหาร</div>
        <div class="m1-muted" style="font-size:12.5px;margin-bottom:12px">วางเนื้อเพลงจีนแตะแปลทุกคำ หรือถ่ายรูปเมนูร้านจีนให้ AI สอนประโยคสั่งอาหารจริง</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn-primary m1-mini-btn" id="td-go-lyrics">🎵 แกะเพลง/ซับ</button>
          <button type="button" class="btn-secondary m1-mini-btn" id="td-go-snap">📸 ถ่ายรูปเมนู</button>
        </div>
      </div>

      <!-- Arena 1v1 & Weekend Boss Raid -->
      <div class="m1-day-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="m1-tag">⚔️ Live Social</span>
          <span>🐉 Boss Raid</span>
        </div>
        <div style="font-weight:700;font-size:16px;margin:8px 0 4px">ห้องดวล 6 หลัก & ตีบอสมังกร 50,000 HP</div>
        <div class="m1-muted" style="font-size:12.5px;margin-bottom:12px">แข่ง Tone Sniper / Speed Draw กับเพื่อน แชร์การ์ด PNG ลง IG Story หรือรวมพลังตีบอสประจำสัปดาห์</div>
        <button type="button" class="btn-primary m1-mini-btn" id="td-go-arena">⚔️ เข้าสู่ Arena →</button>
      </div>
    </div>

    <div class="card-panel" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <strong>🗺️ เส้นทางเรียนต่อจากจุดเดิม (มาตรฐานสอบผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}%)</strong>
        <div class="m1-muted" style="font-size:12.5px">ผ่านเกณฑ์แล้ว ${m1Stats.pct}% (${m1Stats.totalDaysDone}/30 วัน) · 20 คู่เสียง (${m1Stats.tonePairsDone}/20) · 64 ภาพจำ (${m1Stats.mnemonicsDone}/64)</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn-secondary m1-mini-btn" id="td-go-month1">🌱 ตารางสอบ 30 วัน & ภาพจำ</button>
        <button type="button" class="btn-secondary m1-mini-btn" id="td-go-path">🗺️ Skill Tree บทเรียน</button>
        <button type="button" class="btn-secondary m1-mini-btn" id="td-go-speak">🎙️ Speak Studio AI</button>
      </div>
    </div>
  `;

  const redrawSelf = () => renderTodayDashboard(core, host);

  host.querySelector('#td-start-15m')?.addEventListener('click', () => {
    if (pendingBoss) {
      renderWeeklyBossRunner(core, host, pendingBoss, {
        onPass: redrawSelf,
        onRepairDay: (dNum) => renderGuidedRunner(core, host, redrawSelf, { targetDay: dNum, bypassBossGate: true, skipFsrsGate: true }),
        onExit: redrawSelf
      });
      return;
    }
    renderGuidedRunner(core, host, redrawSelf, { targetDay: todayDay });
  });
  host.querySelectorAll('[data-decay-day]').forEach(b => b.addEventListener('click', () => {
    renderDecayReverifyRunner(core, host, Number(b.dataset.decayDay), redrawSelf);
  }));
  host.querySelector('#td-rw-unscripted')?.addEventListener('click', () => renderUnscriptedSpeakingRunner(core, host, redrawSelf));
  host.querySelector('#td-rw-street')?.addEventListener('click', () => renderStreetListeningRunner(core, host, redrawSelf));
  host.querySelector('#td-rw-pattern')?.addEventListener('click', () => renderPatternWorkshopRunner(core, host, redrawSelf));
  host.querySelector('#td-rw-blind')?.addEventListener('click', () => renderBlindDictationRunner(core, host, redrawSelf));
  host.querySelector('#td-go-reflex')?.addEventListener('click', () => renderReflexSpeakingRunner(core, host, redrawSelf));
  host.querySelector('#td-go-weakness')?.addEventListener('click', () => renderWeaknessGrinder(core, host, redrawSelf));
  host.querySelectorAll('[data-boss-cp]').forEach(b => b.addEventListener('click', () => {
    const cp = Number(b.dataset.bossCp);
    renderWeeklyBossRunner(core, host, cp, {
      onPass: redrawSelf,
      onRepairDay: (dNum) => renderGuidedRunner(core, host, redrawSelf, { targetDay: dNum, bypassBossGate: true, skipFsrsGate: true }),
      onExit: redrawSelf
    });
  }));
  host.querySelector('#td-go-m1fsrs')?.addEventListener('click', () => {
    renderFsrsQuizGate(core, host, { onCleared: redrawSelf, onExit: redrawSelf });
  });
  host.querySelector('#td-open-dict')?.addEventListener('click', () => openQuickDict(core));
  host.querySelector('#td-beginner-chk')?.addEventListener('change', (e) => {
    toggleBeginnerMode(core, e.target.checked);
  });
  host.querySelector('#td-go-srs')?.addEventListener('click', () => {
    core.state.vocabMode = 'srs';
    core.switchTab('vocab');
  });
  host.querySelector('#td-go-bedtime')?.addEventListener('click', () => {
    if (typeof core.openVocabBedtimeReview === 'function') core.openVocabBedtimeReview();
  });
  host.querySelector('#td-go-copybook')?.addEventListener('click', () => core.switchTab('copybook'));
  host.querySelector('#td-go-lyrics')?.addEventListener('click', () => {
    window.__nihaoOpenReadingSub = 'importer';
    core.switchTab('games-reading');
  });
  host.querySelector('#td-go-snap')?.addEventListener('click', () => {
    window.__nihaoOpenReadingSub = 'snap';
    core.switchTab('games-reading');
  });
  host.querySelector('#td-go-arena')?.addEventListener('click', () => core.switchTab('arena'));
  host.querySelector('#td-go-month1')?.addEventListener('click', () => core.switchTab('month1'));
  host.querySelector('#td-go-path')?.addEventListener('click', () => core.switchTab('lesson-path'));
  host.querySelector('#td-go-speak')?.addEventListener('click', () => core.switchTab('speak-studio'));
}
