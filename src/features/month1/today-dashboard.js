// Unified Today Dashboard (`today` tab) — Focus-First Single Primary Action + Clean Segmented Hub

import {
  DAILY_MASTERY_PASS_PCT,
  WEEKLY_BOSS_DAYS,
  normalizeIntensity,
  getIntensityConfig,
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
import { isLargeHanziEnabled, setLargeHanziEnabled } from './ux-utils.js';
import { renderToneCoachRunner } from './tone-coach.js';
import { renderLiveVoiceCallRunner } from './live-voice-call.js';

let activeHubSection = 'practice'; // 'practice' | 'realworld' | 'tools'

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
  const intensityLv = normalizeIntensity(ext.intensity || 1);
  const intensityCfg = getIntensityConfig(intensityLv);
  const largeHanziOn = isLargeHanziEnabled();
  const rwp = realWorldProgress(ext.realWorld);

  // Single Primary Action priority:
  // 1) Pending Weekly Boss -> 2) Morning FSRS Gate -> 3) Memory Decay Check -> 4) Today's Daily Lesson & >=95% Exam
  let heroActionType = 'lesson';
  let statusBadgeHtml = `<span class="m1-status-pill pending">🎯 เกณฑ์ผ่านประจำวัน ≥ ${DAILY_MASTERY_PASS_PCT}%</span>`;
  let heroTitle = `เป้าหมายวันนี้: พิชิต Day ${todayDay} / 90 (${todayDay <= 30 ? 'HSK 1' : (todayDay <= 60 ? 'HSK 2' : 'HSK 3')})`;
  let heroSub = `เรียนฝึกครบ 3 ขั้น → สอบรายวัน ≥ ${DAILY_MASTERY_PASS_PCT}% เพื่อปลดล็อกวันถัดไป`;
  let primaryBtnLabel = `▶ เริ่มเรียน & สอบ Day ${todayDay}`;

  if (pendingBoss) {
    heroActionType = 'boss';
    const wNum = Math.ceil(pendingBoss / 7);
    statusBadgeHtml = `<span class="m1-status-pill fail">🐉 ด่านบอสสะสม W${wNum} (ต้องผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}%)</span>`;
    heroTitle = `ถึงคิวสอบใหญ่! พิชิตบอสสะสม สัปดาห์ที่ ${wNum} (Day 1–${pendingBoss})`;
    heroSub = `ต้องสอบผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}% ก่อนปลดล็อกสัปดาห์ถัดไป หากไม่ผ่านระบบจะชี้เป้าวันที่ต้องซ่อม`;
    primaryBtnLabel = `🐉 เข้าสอบบอสสะสม W${wNum} ตอนนี้`;
  } else if (dueM1Fsrs.length > 0 && !dayRec.passed) {
    heroActionType = 'fsrs';
    statusBadgeHtml = `<span class="m1-status-pill pending">🧠 Morning Gate · รอทวน ${dueM1Fsrs.length} คำ</span>`;
    heroTitle = `ทวนศัพท์ FSRS ${dueM1Fsrs.length} คำก่อนเริ่ม Day ${todayDay}`;
    heroSub = `เคลียร์การ์ดความจำที่ถึงกำหนดวันนี้ให้ครบก่อน เพื่อล็อกความจำระยะยาวแล้วลุยบทใหม่`;
    primaryBtnLabel = `🧠 เริ่มทวน FSRS (${dueM1Fsrs.length} คำ) →`;
  } else if (decayedDays.length > 0) {
    heroActionType = 'decay';
    const firstDecay = decayedDays[0];
    statusBadgeHtml = `<span class="m1-status-pill pending">🔔 เช็กความจำ 7/21 วัน (${decayedDays.length} วัน)</span>`;
    heroTitle = `เช็กความจำด่วน 5 ข้อ: Day ${firstDecay.day}`;
    heroSub = `ผ่านมานานแล้ว มาทดสอบสั้นๆ 5 ข้อเพื่อยืนยันว่ายังจำได้ ≥ ${DAILY_MASTERY_PASS_PCT}%`;
    primaryBtnLabel = `🔔 ทำควิซเช็กความจำ Day ${firstDecay.day} (5 ข้อ)`;
  } else if (dayRec.passed) {
    statusBadgeHtml = `<span class="m1-status-pill pass">✅ สอบผ่าน Day ${todayDay} แล้ว (${dayRec.bestPct}%)</span>`;
    heroTitle = `เยี่ยมมาก! คุณสอบผ่าน Day ${todayDay} ครบเกณฑ์แล้ว`;
    heroSub = `สามารถทบทวนซ้ำ หรือเลือกฝึกโหมดพูดไว/สถานการณ์จริงด้านล่างได้เลย`;
    primaryBtnLabel = `🔄 ทบทวน & สอบซ้ำ Day ${todayDay}`;
  } else if (dayRec.attempts > 0) {
    statusBadgeHtml = `<span class="m1-status-pill fail">⏳ ล่าสุด ${dayRec.lastPct}% (ต้องถึง ${DAILY_MASTERY_PASS_PCT}%)</span>`;
    heroTitle = `ซ่อมจุดพลาด & สอบแก้ตัว Day ${todayDay}`;
    heroSub = `สูงสุด ${dayRec.bestPct}% — ระบบเก็บคำที่ผิดไว้ให้ทบทวนแล้ว สอบรอบนี้ให้ผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}%!`;
    primaryBtnLabel = `📖 เรียนทบทวน & สอบแก้ตัว Day ${todayDay}`;
  }

  host.innerHTML = `
    <!-- Focus-First Single Primary Action Hero -->
    <div class="card-panel m1-hero ux-focus-hero" style="background:linear-gradient(135deg, rgba(0,122,255,0.10), rgba(124,58,237,0.08));border-color:rgba(0,122,255,0.28)">
      <div class="m1-hero-left">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="m1-tag">🏠 วันนี้ · LV.${g.level} (${core.escapeHtml(g.rank?.th || 'ผู้เรียน')})</div>
          ${statusBadgeHtml}
        </div>
        <h2 style="margin:10px 0 6px">${core.escapeHtml(heroTitle)}</h2>
        <p class="m1-muted" style="margin:0 0 14px">${core.escapeHtml(heroSub)}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn-primary ux-primary-cta" id="td-start-15m">${core.escapeHtml(primaryBtnLabel)}</button>
          <button type="button" class="btn-secondary m1-ai-btn" id="td-go-live-call">📞 โทรคุยสดครูจีน AI</button>
          <button type="button" class="btn-secondary" id="td-go-tone-coach">📈 โค้ชตรวจการออกเสียง</button>
          <button type="button" class="btn-secondary" id="td-open-dict">🔍 ค้นศัพท์ (/)</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">
          <div class="m1-chip-row" role="group" aria-label="ระดับความเข้มข้น">
            <button type="button" class="m1-chip ${intensityLv === 1 ? 'active' : ''}" data-set-intensity="1">1x ปกติ</button>
            <button type="button" class="m1-chip ${intensityLv === 5 ? 'active' : ''}" data-set-intensity="5">🔥 5x เข้มข้น</button>
            <button type="button" class="m1-chip ${intensityLv === 10 ? 'active' : ''}" data-set-intensity="10">💀 10x โหดจัด</button>
          </div>
          <label class="m1-toggle-chip">
            <input type="checkbox" id="td-beginner-chk" ${beginnerOn ? 'checked' : ''}>
            <span>โหมดโฟกัสมือใหม่</span>
          </label>
          <label class="m1-toggle-chip">
            <input type="checkbox" id="td-large-hanzi-chk" ${largeHanziOn ? 'checked' : ''}>
            <span>ตัวจีนใหญ่พิเศษ</span>
          </label>
        </div>
      </div>
      <div class="m1-kpi-mini">
        <div><strong>🔥 ${g.streak || 0}</strong><span>Streak</span></div>
        <div><strong>${stats90.total90Done}/90</strong><span>ผ่าน ≥95%</span></div>
        <div><strong>${totalDueCards}</strong><span>รอทวน</span></div>
      </div>
    </div>

    ${decayedDays.length > 0 && heroActionType !== 'decay' ? `
      <div class="card-panel" style="margin-top:12px;border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.08)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <strong>🔔 เช็กความจำเสื่อมตามเวลา (${decayedDays.length} วัน)</strong>
            <div class="m1-muted" style="font-size:12.5px">ทำควิซด่วน 5 ข้อเพื่อยืนยันว่ายังจำได้ ≥ ${DAILY_MASTERY_PASS_PCT}%</div>
          </div>
          <div class="m1-chip-row">
            ${decayedDays.map(dd => `
              <button type="button" class="btn-primary m1-mini-btn" data-decay-day="${dd.day}" title="${core.escapeHtml(dd.reason)}">
                🔔 Day ${dd.day} (5 ข้อ)
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Clean Segmented Hub Switcher (reduces visual clutter) -->
    <div class="ux-hub-tabs" role="tablist">
      <button type="button" class="m1-pill ${activeHubSection === 'practice' ? 'active' : ''}" data-hub-sec="practice">🔥 ฝึกทวน & สอบบอส</button>
      <button type="button" class="m1-pill ${activeHubSection === 'realworld' ? 'active' : ''}" data-hub-sec="realworld">🌏 ด่านโลกจริง ${rwp.certified ? '🏅' : ''}</button>
      <button type="button" class="m1-pill ${activeHubSection === 'tools' ? 'active' : ''}" data-hub-sec="tools">✨ เครื่องมือ AI & Arena</button>
    </div>

    ${activeHubSection === 'practice' ? `
      <div class="card-panel">
        <div class="m1-days-grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr))">
          <div class="m1-day-card">
            <span class="m1-tag">📈 Tone Pitch Coach</span>
            <div style="font-weight:700;margin:6px 0 4px">กราฟวรรณยุกต์สด + โค้ชแก้สำเนียง</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">วาดเส้นเสียงทับเจ้าของภาษา พร้อมแนะนำตำแหน่งลิ้น พ่นลม และกฎผันเสียงละเอียด</div>
            <button type="button" class="btn-primary m1-mini-btn" id="td-go-tone-coach-card">📈 เปิดโค้ชตรวจเสียง →</button>
          </div>

          <div class="m1-day-card">
            <span class="m1-tag">⚡ Reflex 4s</span>
            <div style="font-weight:700;margin:6px 0 4px">พูดสวนกลับไวใน 4 วินาที</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ฝึกสมองสั่งปากพูดภาษาจีนทันทีก่อนหมดเวลา แก้อาการคิดช้าอ้ำอึ้ง</div>
            <button type="button" class="btn-primary m1-mini-btn" id="td-go-reflex">⚡ เริ่มซ้อมพูดไว 4 วิ →</button>
          </div>

          <div class="m1-day-card">
            <span class="m1-tag">💪 Endless Drill</span>
            <div style="font-weight:700;margin:6px 0 4px">สนามซ้อมขยี้จุดอ่อน 4 ท่า</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ดึงคำที่เคยผิดมาวนยำ: ฟังเร็ว · พิมพ์พินอิน · พูดไมค์ · แปลไว</div>
            <button type="button" class="btn-primary m1-mini-btn" id="td-go-weakness">💪 ลุยขยี้จุดอ่อน →</button>
          </div>

          <div class="m1-day-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="m1-tag">🧠 Quiz-FSRS</span>
              <strong>${totalDueCards > 0 ? `${totalDueCards} รอทวน` : 'เคลียร์ครบ ✨'}</strong>
            </div>
            <div style="font-weight:700;margin:6px 0 4px">ทวนคำสะสมแบบสอบจริงก่อนเฉลย</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">คำจากบทเรียนที่สอบผ่านจะถูกป้อนเข้า FSRS อัตโนมัติ</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${dueM1Fsrs.length > 0 ? `<button type="button" class="btn-primary m1-mini-btn" id="td-go-m1fsrs">🧠 ทวนบทเรียน (${dueM1Fsrs.length})</button>` : ''}
              <button type="button" class="btn-secondary m1-mini-btn" id="td-go-srs">🔄 คลัง FSRS (${dueVocabSrs})</button>
              <button type="button" class="btn-secondary m1-mini-btn" id="td-go-bedtime">🌙 ก่อนนอน 3 นาที</button>
            </div>
          </div>

          <div class="m1-day-card">
            <span class="m1-tag">🐉 12 Weekly Bosses ≥95%</span>
            <div style="font-weight:700;margin:6px 0 4px">สอบใหญ่บอสสะสมทุกสัปดาห์</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:8px">ยำรวมข้อสอบสะสมพร้อมชี้เป้าวันที่ลืม</div>
            <div class="m1-chip-row">
              ${WEEKLY_BOSS_DAYS.map(cp => {
                const ok = isWeeklyBossPassed(cp, ext);
                const unlocked = todayDay >= cp || ok || pendingBoss === cp;
                return `<button type="button" class="m1-chip ${ok ? 'active' : ''}" data-boss-cp="${cp}" ${unlocked ? '' : 'disabled title="สอบผ่านให้ถึง Day ' + cp + ' ก่อน"'}>${ok ? '✅' : '🐉'} W${Math.ceil(cp / 7)}</button>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    ` : activeHubSection === 'realworld' ? `
      <div class="card-panel">
        <div style="margin-bottom:10px">
          <h3 style="margin:0">🌏 ด่านโลกจริง: ใช้ได้นอกตำรา ${rwp.certified ? '<span class="m1-status-pill pass">🏅 Real-World Certified</span>' : ''}</h3>
          <div class="m1-muted" style="font-size:12.5px">ไม่มีสคริปต์ · ความเร็วคนจีนจริง · พลิกแพลงประโยค · เขียนจากความจำล้วน</div>
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
            <span class="m1-tag">🧩 พลิกแพลงประโยค · ${rwp.patterns}/${rwp.patternTotal}</span>
            <div style="font-weight:700;margin:6px 0 4px">โครงสร้างเดียว เปลี่ยนโจทย์รัวๆ 5 ข้อ</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">是/不是 · 有/没有 · 想/要/会 · 在 · 疑问词 · 很/太…了</div>
            <button type="button" class="btn-primary m1-mini-btn" id="td-rw-pattern">🧩 เข้าโรงฝึก →</button>
          </div>
          <div class="m1-day-card ${rwp.blindChars >= 10 ? 'done' : ''}">
            <span class="m1-tag">✍️ เขียนไร้รอยประ · ${rwp.blindChars} ตัว</span>
            <div style="font-weight:700;margin:6px 0 4px">เขียนตามคำบอก ไม่มีเส้นร่าง ไม่มีขีดใบ้</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ลากขีดจากความจำ พลาดได้ไม่เกิน 1 ครั้งต่อตัว</div>
            <button type="button" class="btn-primary m1-mini-btn" id="td-rw-blind">✍️ เริ่มเขียนล้วน →</button>
          </div>
        </div>
      </div>
    ` : `
      <div class="card-panel">
        <div class="m1-days-grid" style="grid-template-columns:repeat(auto-fit, minmax(230px, 1fr))">
          <div class="m1-day-card">
            <span class="m1-tag">✨ Gemini Vision</span>
            <div style="font-weight:700;margin:6px 0 4px">สมุดคัดลายมือ + ครู AI ตรวจสัดส่วน</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">คัดตัวจีนด้วยนิ้ว/ปากกา/เมาส์ ส่งครู AI ให้เกรด S/A/B/C</div>
            <button type="button" class="btn-primary m1-mini-btn m1-ai-btn" id="td-go-copybook">✍️ เปิดสมุดคัดลายมือ →</button>
          </div>
          <div class="m1-day-card">
            <span class="m1-tag">🎵 C-Pop & Camera</span>
            <div style="font-weight:700;margin:6px 0 4px">แกะเพลงจีน & ถ่ายรูปแปลเมนูอาหาร</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">วางเนื้อเพลงแตะแปลทุกคำ หรือถ่ายรูปเมนูร้านจีน</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn-primary m1-mini-btn" id="td-go-lyrics">🎵 แกะเพลง</button>
              <button type="button" class="btn-secondary m1-mini-btn" id="td-go-snap">📸 ถ่ายรูปเมนู</button>
            </div>
          </div>
          <div class="m1-day-card">
            <span class="m1-tag">⚔️ Live Social</span>
            <div style="font-weight:700;margin:6px 0 4px">ห้องดวล 6 หลัก & ตีบอสมังกร</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">แข่งกับเพื่อนหรือรวมพลังตีบอสประจำสัปดาห์</div>
            <button type="button" class="btn-primary m1-mini-btn" id="td-go-arena">⚔️ เข้าสู่ Arena →</button>
          </div>
          <div class="m1-day-card">
            <span class="m1-tag">🗺️ ทางลัดเรียนเสริม</span>
            <div style="font-weight:700;margin:6px 0 4px">Skill Tree & Speak Studio AI</div>
            <div class="m1-muted" style="font-size:12px;margin-bottom:10px">20 คู่เสียง (${m1Stats.tonePairsDone}/20) · 64 ภาพจำ (${m1Stats.mnemonicsDone}/64)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn-secondary m1-mini-btn" id="td-go-path">🗺️ Skill Tree</button>
              <button type="button" class="btn-secondary m1-mini-btn" id="td-go-speak">🎙️ Speak Studio</button>
            </div>
          </div>
        </div>
      </div>
    `}
  `;

  const redrawSelf = () => renderTodayDashboard(core, host);

  host.querySelectorAll('[data-hub-sec]').forEach(b => b.addEventListener('click', () => {
    activeHubSection = b.dataset.hubSec || 'practice';
    redrawSelf();
  }));

  host.querySelector('#td-start-15m')?.addEventListener('click', () => {
    if (heroActionType === 'boss' && pendingBoss) {
      renderWeeklyBossRunner(core, host, pendingBoss, {
        onPass: redrawSelf,
        onRepairDay: (dNum) => renderGuidedRunner(core, host, redrawSelf, { targetDay: dNum, bypassBossGate: true, skipFsrsGate: true }),
        onExit: redrawSelf
      });
      return;
    }
    if (heroActionType === 'fsrs') {
      renderFsrsQuizGate(core, host, { onCleared: redrawSelf, onExit: redrawSelf });
      return;
    }
    if (heroActionType === 'decay' && decayedDays.length > 0) {
      renderDecayReverifyRunner(core, host, decayedDays[0].day, redrawSelf);
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
  host.querySelector('#td-go-live-call')?.addEventListener('click', () => renderLiveVoiceCallRunner(core, host, redrawSelf));
  host.querySelector('#td-go-tone-coach')?.addEventListener('click', () => renderToneCoachRunner(core, host, redrawSelf));
  host.querySelector('#td-go-tone-coach-card')?.addEventListener('click', () => renderToneCoachRunner(core, host, redrawSelf));
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
  host.querySelectorAll('[data-set-intensity]').forEach(b => b.addEventListener('click', () => {
    const lv = normalizeIntensity(b.dataset.setIntensity);
    core.setExt('month1', { intensity: lv }, { save: true });
    core.showToast(`ตั้งความเข้มข้นเป็น ${getIntensityConfig(lv).label} แล้ว!`);
    redrawSelf();
  }));
  host.querySelector('#td-open-dict')?.addEventListener('click', () => openQuickDict(core));
  host.querySelector('#td-beginner-chk')?.addEventListener('change', (e) => {
    toggleBeginnerMode(core, e.target.checked);
  });
  host.querySelector('#td-large-hanzi-chk')?.addEventListener('change', (e) => {
    setLargeHanziEnabled(e.target.checked);
    core.showToast(e.target.checked ? '🔍 เปิดโหมดตัวจีนใหญ่พิเศษแล้ว' : 'กลับสู่ขนาดตัวอักษรปกติแล้ว');
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
