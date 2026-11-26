// Unified Today Dashboard (`today` tab) — One clean home hub combining:
// 1. 4-Step Daily Lesson + Mandatory >=95% Mastery Exam (Recall + Listening + Word Order + Real Mic Speaking)
// 2. FSRS Due Cards + 3-Minute Bedtime Review
// 3. AI Copybook Grader, Smart C-Pop/Lyrics Importer, Snap & Learn Camera, and 1v1 Arena / Boss Raid shortcuts

import { DAILY_MASTERY_PASS_PCT, calcMonth1Stats, getTodayBlueprintDay, getDayMasteryRecord } from './logic.js';
import { renderGuidedRunner, toggleBeginnerMode } from './guided-session.js';
import { openQuickDict } from './quick-dict.js';

export function renderTodayDashboard(core, host) {
  if (!host) return;
  const ext = core.getExt('month1');
  const m1Stats = calcMonth1Stats(core.state.progress, ext);
  const todayDay = getTodayBlueprintDay(core.state.progress, ext);
  const dayRec = getDayMasteryRecord(todayDay, ext);
  const g = core.computeGameStats();
  const dueSrs = typeof core.getDueVocabSrsCount === 'function' ? core.getDueVocabSrsCount() : 0;
  const beginnerOn = Boolean(ext.beginnerMode);

  let statusBadgeHtml = `<span class="m1-status-pill pending">🎯 เกณฑ์ผ่านประจำวัน ≥ ${DAILY_MASTERY_PASS_PCT}% (ฟัง · จำ · เรียงคำ · พูดไมค์)</span>`;
  let primaryBtnLabel = `▶ เริ่มเรียน & สอบ Day ${todayDay} (เกณฑ์ผ่าน ${DAILY_MASTERY_PASS_PCT}%)`;
  if (dayRec.passed) {
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
        <h2 style="margin:8px 0 6px">สวัสดี! เป้าหมายวันนี้: พิชิต Day ${todayDay} / 30 ให้ผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}%</h2>
        <p class="m1-muted" style="margin:0 0 14px">การันตีรู้จริงทุกวัน: <b>ทวนคำเดิมปิดโพย → ฝึกวรรณยุกต์ → ซ้อมพูด → สอบวัดผลฟัง+เรียงประโยค+พูดออกไมค์จริง</b> (ยังไม่ถึง ${DAILY_MASTERY_PASS_PCT}% ถือว่ายังไม่จบวัน ต้องทวนและสอบใหม่จนผ่าน!)</p>
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
        <div><strong>${m1Stats.totalDaysDone}/30</strong><span>วันผ่าน ≥95%</span></div>
        <div><strong>${dueSrs}</strong><span>การ์ด FSRS ค้าง</span></div>
      </div>
    </div>

    <div class="m1-days-grid" style="margin-top:16px;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr))">
      <!-- Card 1: FSRS & 3-Min Bedtime Review -->
      <div class="m1-day-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="m1-tag">🧠 FSRS-4.5 Memory</span>
          <strong>${dueSrs > 0 ? `${dueSrs} คำรอทวน` : 'ครบแล้ว ✨'}</strong>
        </div>
        <div style="font-weight:700;font-size:16px;margin:8px 0 4px">ทบทวนคำศัพท์ & โหมดก่อนนอน 3 นาที</div>
        <div class="m1-muted" style="font-size:12.5px;margin-bottom:12px">อัลกอริทึม FSRS คำนวณโอกาสลืมรายคำ ลดภาระทวนซ้ำ ~25% พร้อมโหมดคัด 12 คำเสี่ยงลืมก่อนนอน</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn-primary m1-mini-btn" id="td-go-srs">🔄 ทวน FSRS (${dueSrs})</button>
          <button type="button" class="btn-secondary m1-mini-btn" id="td-go-bedtime">🌙 ก่อนนอน 3 นาที</button>
        </div>
      </div>

      <!-- Card 2: AI Handwriting Grader -->
      <div class="m1-day-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="m1-tag">✨ Gemini Vision</span>
          <span>📝 สมุด 米字格</span>
        </div>
        <div style="font-weight:700;font-size:16px;margin:8px 0 4px">สมุดคัดลายมือ + ครู AI ตรวจสัดส่วน</div>
        <div class="m1-muted" style="font-size:12.5px;margin-bottom:12px">คัดตัวจีนด้วย Apple Pencil / นิ้ว / เมาส์ แล้วกดส่งครู AI ให้เกรด S/A/B/C รายตัวทันที</div>
        <button type="button" class="btn-primary m1-mini-btn m1-ai-btn" id="td-go-copybook">✍️ เปิดสมุดคัดลายมือ →</button>
      </div>

      <!-- Card 3: Smart Lyrics & Snap Camera -->
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

      <!-- Card 4: Arena 1v1 & Weekend Boss Raid -->
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

  host.querySelector('#td-start-15m')?.addEventListener('click', () => {
    renderGuidedRunner(core, host, () => renderTodayDashboard(core, host), { targetDay: todayDay });
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
