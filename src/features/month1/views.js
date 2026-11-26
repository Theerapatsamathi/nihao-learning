// UI Views for Month-1 Starter Pack (Home/30-Day Blueprint, 20 Tone Pairs + Traps, 64 Mnemonics, 50 Survival Sentences)
import { TONE_PAIRS, THAI_TRAPS, MONTH1_DAYS_15_30, HANZI_MNEMONICS, SURVIVAL_50 } from './data-month1.js';
import { MONTH2_DAYS_31_60, MONTH3_DAYS_61_90 } from './data-months23.js';
import {
  DAILY_MASTERY_PASS_PCT,
  WEEKLY_BOSS_DAYS,
  calcMonth1Stats,
  calc90DayStats,
  getTodayBlueprintDay,
  getDayMasteryRecord,
  isDayMastered,
  getDecayedDays,
  isWeeklyBossPassed
} from './logic.js';
import { openQuickDict, showStrokePreview } from './quick-dict.js';
import { renderGuidedRunner, toggleBeginnerMode } from './guided-session.js';
import { renderDecayReverifyRunner, renderReflexSpeakingRunner, renderWeaknessGrinder, renderWeeklyBossRunner } from './mastery-drills.js';

const uiState = { subTab: 'home', activeMonth: 1, survCat: 'all', mnemQuery: '', toneQuiz: null };

export function renderMonth1Tab(core, host) {
  if (!host) return;
  const ext = core.getExt('month1');
  const stats = calcMonth1Stats(core.state.progress, ext);
  const todayDay = getTodayBlueprintDay(core.state.progress, ext);

  host.innerHTML = `
    <div class="m1-subnav">
      <button type="button" class="m1-pill ${uiState.subTab === 'home' ? 'active' : ''}" data-sub="home">🌱 แผน 90 วัน (HSK 1–3)</button>
      <button type="button" class="m1-pill ${uiState.subTab === 'tones' ? 'active' : ''}" data-sub="tones">🎵 20 คู่วรรณยุกต์ (${stats.tonePairsDone}/20)</button>
      <button type="button" class="m1-pill ${uiState.subTab === 'mnem' ? 'active' : ''}" data-sub="mnem">🧠 64 ภาพจำอักษร (${stats.mnemonicsDone}/64)</button>
      <button type="button" class="m1-pill ${uiState.subTab === 'surv' ? 'active' : ''}" data-sub="surv">🗣️ 50 ประโยคเอาตัวรอด</button>
      <button type="button" class="m1-pill m1-dict-pill" id="m1-open-dict-btn">🔍 ค้นศัพท์ (/)</button>
    </div>
    <div id="m1-view-body"></div>
  `;

  host.querySelectorAll('[data-sub]').forEach(b => {
    b.addEventListener('click', () => {
      uiState.subTab = b.dataset.sub;
      renderMonth1Tab(core, host);
    });
  });
  host.querySelector('#m1-open-dict-btn')?.addEventListener('click', () => openQuickDict(core));

  const body = host.querySelector('#m1-view-body');
  if (uiState.subTab === 'home') renderHomeView(core, body, host, ext, stats, todayDay);
  else if (uiState.subTab === 'tones') renderTonesView(core, body, host, ext);
  else if (uiState.subTab === 'mnem') renderMnemonicsView(core, body, host, ext);
  else if (uiState.subTab === 'surv') renderSurvivalView(core, body, host, ext);
}

function renderHomeView(core, body, rootHost, ext, stats, todayDay) {
  const beginnerOn = Boolean(ext.beginnerMode);
  const curRec = getDayMasteryRecord(todayDay, ext);
  const stats90 = calc90DayStats(core.state.progress, ext);
  const plan14 = Array.isArray(window.DAILY_PLAN_DATA) ? window.DAILY_PLAN_DATA : [];
  const decayedSet = new Set(getDecayedDays(ext, core.todayKey()).map(x => x.day));
  const curMonth = uiState.activeMonth || (todayDay <= 30 ? 1 : (todayDay <= 60 ? 2 : 3));

  const renderDayCard = (dObj, mode) => {
    const dayNum = dObj.day;
    const mastered = isDayMastered(dayNum, core.state.progress, ext);
    const isDecayed = decayedSet.has(dayNum);
    const rec = getDayMasteryRecord(dayNum, ext);
    const isCur = dayNum === todayDay;
    let badgeHtml = `<span class="m1-status-pill pending">🔒 รอสอบ ≥${DAILY_MASTERY_PASS_PCT}%</span>`;
    if (mastered && isDecayed) {
      badgeHtml = `<span class="m1-status-pill pending">🔔 ถึงรอบเช็กความจำซ้ำ!</span>`;
    } else if (mastered) {
      badgeHtml = `<span class="m1-status-pill pass">✅ ผ่าน ${rec.bestPct || 100}%</span>`;
    } else if (rec.attempts > 0) {
      badgeHtml = `<span class="m1-status-pill fail">⚠️ ล่าสุด ${rec.lastPct}% (ยังไม่ถึง ${DAILY_MASTERY_PASS_PCT}%)</span>`;
    }

    const words = mode === 'plan14'
      ? (Array.isArray(dObj.quickReview) ? dObj.quickReview.slice(0, 4).map(x => x.hanzi) : [])
      : mode === 'adv'
        ? (Array.isArray(dObj.vocab) ? dObj.vocab.slice(0, 4).map(x => x.hz) : [])
        : (Array.isArray(dObj.words) ? dObj.words : []);

    const bossCardAfter = WEEKLY_BOSS_DAYS.includes(dayNum) ? (() => {
      const bossOk = isWeeklyBossPassed(dayNum, ext);
      const bossRec = (ext.weeklyBoss || {})[dayNum];
      const wNum = Math.ceil(dayNum / 7);
      const rangeStart = dayNum <= 30 ? 1 : (dayNum <= 60 ? 31 : 61);
      return `
        <div class="m1-day-card ${bossOk ? 'done' : 'current'}" style="border-width:2px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="m1-tag">🐉 บอสประจำสัปดาห์ W${wNum}</span>
            <span class="m1-status-pill ${bossOk ? 'pass' : 'fail'}">${bossOk ? `✅ ผ่านบอส ${bossRec?.bestPct || 95}%` : `🎯 ต้องผ่าน ≥${DAILY_MASTERY_PASS_PCT}%`}</span>
          </div>
          <div style="font-weight:700;margin:6px 0 3px">สอบใหญ่สะสม Day ${rangeStart} – Day ${dayNum}</div>
          <div class="m1-muted" style="font-size:12px;margin-bottom:10px">ยำรวมข้อสอบสะสมพร้อมชี้เป้าวันที่ลืม</div>
          <button type="button" class="btn-primary m1-mini-btn" data-launch-boss="${dayNum}">🐉 เข้าสอบบอส W${wNum} →</button>
        </div>
      `;
    })() : '';

    return `
      <div class="m1-day-card ${mastered ? 'done' : ''} ${isCur ? 'current' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="m1-tag">Day ${dayNum} · ${dObj.level ? `${dObj.level} · ` : ''}W${dObj.week}</span>
          ${badgeHtml}
        </div>
        <div style="font-weight:700;margin:6px 0 3px">${core.escapeHtml(dObj.title)}</div>
        <div class="m1-muted" style="font-size:12px;margin-bottom:8px">${core.escapeHtml(mode === 'plan14' ? dObj.goal : dObj.focus)}</div>
        <div class="m1-chip-row">
          ${words.map(w => `<button type="button" class="m1-chip hanzi-font" data-say="${core.escapeHtml(w)}">🔊 ${core.escapeHtml(w)}</button>`).join('')}
        </div>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
          ${isDecayed ? `<button type="button" class="btn-primary m1-mini-btn" data-reverify-day="${dayNum}">🔔 เช็กความจำ 5 ข้อ</button>` : ''}
          <button type="button" class="${isDecayed ? 'btn-secondary' : 'btn-primary'} m1-mini-btn" data-launch-day="${dayNum}">
            ${mastered ? `🔄 ทวน & สอบซ้ำ` : (rec.attempts > 0 ? `📖 เรียนซ่อม & สอบใหม่` : `▶ เรียน & สอบ Day ${dayNum}`)}
          </button>
          ${mode === 'm1_15_30' ? `<button type="button" class="btn-secondary m1-mini-btn" data-go-tab="${dObj.tab}">สื่อเสริม →</button>` : (mode === 'plan14' ? `<button type="button" class="btn-secondary m1-mini-btn" data-open-plan14="${dayNum}">เนื้อหาละเอียด</button>` : '')}
        </div>
      </div>${bossCardAfter}`;
  };

  const renderWeeklyJourney = (daysList, mode) => {
    const weeksMap = new Map();
    for (const d of daysList) {
      const w = Number(d.week) || Math.ceil(d.day / 7);
      if (!weeksMap.has(w)) weeksMap.set(w, []);
      weeksMap.get(w).push(d);
    }
    return [...weeksMap.entries()].map(([wNum, wDays]) => {
      const doneCnt = wDays.filter(d => isDayMastered(d.day, core.state.progress, ext)).length;
      const containsToday = wDays.some(d => d.day === todayDay);
      const allDone = doneCnt === wDays.length;
      const bossDay = wDays.find(d => WEEKLY_BOSS_DAYS.includes(d.day))?.day || null;
      const bossOk = bossDay ? isWeeklyBossPassed(bossDay, ext) : false;
      const dotsHtml = wDays.map(d => {
        const m = isDayMastered(d.day, core.state.progress, ext);
        const dec = decayedSet.has(d.day);
        const rec = getDayMasteryRecord(d.day, ext);
        const cls = d.day === todayDay ? 'is-cur' : (m && dec ? 'is-decay' : (m ? 'is-pass' : (rec.attempts > 0 ? 'is-fail' : '')));
        return `<span class="ux-dot ${cls}" title="Day ${d.day}"></span>`;
      }).join('') + (bossDay ? `<span class="ux-dot is-boss ${bossOk ? 'is-pass' : ''}" title="Boss W${wNum}"></span>` : '');

      return `
        <details class="ux-week-group ${containsToday ? 'is-current' : ''}" ${containsToday || !allDone ? 'open' : ''} ${containsToday ? 'data-current-week="1"' : ''}>
          <summary class="ux-week-summary">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <strong>📅 สัปดาห์ที่ ${wNum} (Day ${wDays[0].day}–${wDays[wDays.length - 1].day})</strong>
              <span class="m1-status-pill ${allDone ? 'pass' : (containsToday ? 'pending' : '')}">${doneCnt}/${wDays.length} วัน</span>
              ${bossDay ? `<span class="m1-tag">${bossOk ? '✅' : '🐉'} Boss W${wNum}</span>` : ''}
            </div>
            <div class="ux-dot-strip">${dotsHtml}</div>
          </summary>
          <div class="ux-week-body">
            <div class="m1-days-grid">
              ${wDays.map(d => renderDayCard(d, mode)).join('')}
            </div>
          </div>
        </details>
      `;
    }).join('');
  };

  body.innerHTML = `
    <div class="card-panel m1-hero">
      <div class="m1-hero-left">
        <div class="m1-tag">🌱 เส้นทาง 90 วัน (0 → HSK 1 → HSK 2 → HSK 3) · มาตรฐานสอบผ่าน ≥ ${DAILY_MASTERY_PASS_PCT}% ทุกวัน</div>
        <h2 style="margin:8px 0 6px">เป้าหมายปัจจุบัน: Day ${todayDay} / 90 ${curRec.passed ? '✅ สอบผ่านครบแล้ว!' : (curRec.attempts > 0 ? `(ล่าสุด ${curRec.lastPct}% · ต้องซ่อมให้ถึง ${DAILY_MASTERY_PASS_PCT}%)` : '')}</h2>
        <p class="m1-muted" style="margin:0 0 14px">ระบบล็อกคุณภาพครบ 3 เดือน: <b>เคลียร์ FSRS → เรียนและฝึกพูด → สอบรายวัน ≥ ${DAILY_MASTERY_PASS_PCT}% → สอบบอสสะสมทุกสัปดาห์</b></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn-primary" id="m1-start-guided">
            ${curRec.attempts > 0 && !curRec.passed ? `📖 เรียนทบทวน & สอบแก้ตัว Day ${todayDay}` : `▶ เริ่มเรียน & สอบ Day ${todayDay} (≥${DAILY_MASTERY_PASS_PCT}%)`}
          </button>
          <button type="button" class="btn-secondary" id="m1-go-reflex">⚡ พูดสวนกลับ 4 วิ</button>
          <button type="button" class="btn-secondary" id="m1-go-weakness">💪 ซ้อมขยี้จุดอ่อน</button>
          <label class="m1-toggle-chip">
            <input type="checkbox" id="m1-beginner-chk" ${beginnerOn ? 'checked' : ''}>
            <span>โหมดโฟกัสมือใหม่</span>
          </label>
        </div>
      </div>
      <div class="m1-kpi-mini">
        <div><strong>${stats90.total90Done}/90</strong><span>ผ่านครบ 90 วัน</span></div>
        <div><strong>${stats90.m1Done}/30</strong><span>HSK 1</span></div>
        <div><strong>${stats90.m2Done + stats90.m3Done}/60</strong><span>HSK 2–3</span></div>
      </div>
    </div>

    <div class="m1-subnav" style="margin-top:16px">
      <button type="button" class="m1-pill ${curMonth === 1 ? 'active' : ''}" data-pick-month="1">🌱 เดือนที่ 1: Day 1–30 · HSK 1 (${stats90.m1Done}/30)</button>
      <button type="button" class="m1-pill ${curMonth === 2 ? 'active' : ''}" data-pick-month="2">🚀 เดือนที่ 2: Day 31–60 · HSK 2 (${stats90.m2Done}/30)</button>
      <button type="button" class="m1-pill ${curMonth === 3 ? 'active' : ''}" data-pick-month="3">👑 เดือนที่ 3: Day 61–90 · HSK 3 (${stats90.m3Done}/30)</button>
    </div>

    ${curMonth === 1 ? `
      ${plan14.length > 0 ? `
        <div class="card-panel" style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <h3 style="margin:0">📅 สัปดาห์ 1–2 (Day 1–14): พินอิน วรรณยุกต์ & รากฐานการออกเสียง</h3>
            <button type="button" class="btn-secondary" id="m1-go-plan14">เปิดตารางเรียนละเอียด 60 นาที →</button>
          </div>
          ${renderWeeklyJourney(plan14, 'plan14')}
        </div>
      ` : ''}
      <div class="card-panel" style="margin-top:16px">
        <h3 style="margin:0 0 12px">📅 สัปดาห์ 3–4 (Day 15–30): สนทนาเอาตัวรอด แต่งประโยค & สอบจบ HSK 1</h3>
        ${renderWeeklyJourney(MONTH1_DAYS_15_30, 'm1_15_30')}
      </div>
    ` : curMonth === 2 ? `
      <div class="card-panel" style="margin-top:12px">
        <h3 style="margin:0 0 6px">🚀 เดือนที่ 2 (Day 31–60 · HSK 2 · 300 คำ)</h3>
        <p class="m1-muted" style="margin:0 0 14px;font-size:13px">เชื่อมประโยคเหตุผล-ขัดแย้ง (因为…所以, 虽然…但是), เปรียบเทียบ 比, กำลังทำ 正在, ประสบการณ์ 过, หาหมอ, จองโรงแรม และสั่งเดลิเวอรี</p>
        ${renderWeeklyJourney(MONTH2_DAYS_31_60, 'adv')}
      </div>
    ` : `
      <div class="card-panel" style="margin-top:12px">
        <h3 style="margin:0 0 6px">👑 เดือนที่ 3 (Day 61–90 · HSK 3 · 600 คำ)</h3>
        <p class="m1-muted" style="margin:0 0 14px;font-size:13px">ปราบไวยากรณ์ระดับกลาง (ประโยค 把, ถูกกระทำ 被, ทิศทางซ้อน, คู่สับสน 或者/还是 · 刚才/刚刚 · 只要/只有) พร้อมภาษาทำงานและสอบจบ 90 วัน!</p>
        ${renderWeeklyJourney(MONTH3_DAYS_61_90, 'adv')}
      </div>
    `}
  `;

  body.querySelectorAll('[data-pick-month]').forEach(b => b.addEventListener('click', () => {
    uiState.activeMonth = Number(b.dataset.pickMonth) || 1;
    renderHomeView(core, body, rootHost, ext, stats, todayDay);
  }));

  body.querySelector('#m1-start-guided')?.addEventListener('click', () => {
    renderGuidedRunner(core, body, () => renderMonth1Tab(core, rootHost), { targetDay: todayDay });
  });
  body.querySelector('#m1-go-reflex')?.addEventListener('click', () => {
    renderReflexSpeakingRunner(core, body, () => renderMonth1Tab(core, rootHost));
  });
  body.querySelector('#m1-go-weakness')?.addEventListener('click', () => {
    renderWeaknessGrinder(core, body, () => renderMonth1Tab(core, rootHost));
  });
  body.querySelectorAll('[data-reverify-day]').forEach(b => b.addEventListener('click', () => {
    renderDecayReverifyRunner(core, body, Number(b.dataset.reverifyDay), () => renderMonth1Tab(core, rootHost));
    body.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }));
  body.querySelectorAll('[data-launch-boss]').forEach(b => b.addEventListener('click', () => {
    const cp = Number(b.dataset.launchBoss);
    renderWeeklyBossRunner(core, body, cp, {
      onPass: () => renderMonth1Tab(core, rootHost),
      onRepairDay: (dNum) => renderGuidedRunner(core, body, () => renderMonth1Tab(core, rootHost), { targetDay: dNum, bypassBossGate: true, skipFsrsGate: true }),
      onExit: () => renderMonth1Tab(core, rootHost)
    });
    body.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }));
  body.querySelector('#m1-beginner-chk')?.addEventListener('change', (e) => {
    toggleBeginnerMode(core, e.target.checked);
  });
  body.querySelector('#m1-go-plan14')?.addEventListener('click', () => core.switchTab('plan'));
  body.querySelectorAll('[data-open-plan14]').forEach(b => b.addEventListener('click', () => {
    core.state.selectedDay = Number(b.dataset.openPlan14) || 1;
    core.switchTab('plan');
  }));
  body.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.say)));
  body.querySelectorAll('[data-go-tab]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.goTab === 'month1') { uiState.subTab = 'tones'; renderMonth1Tab(core, rootHost); }
    else core.switchTab(b.dataset.goTab);
  }));
  body.querySelectorAll('[data-launch-day]').forEach(b => b.addEventListener('click', () => {
    const dNum = Number(b.dataset.launchDay) || 1;
    renderGuidedRunner(core, body, () => renderMonth1Tab(core, rootHost), { targetDay: dNum });
    body.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }));
}

function renderTonesView(core, body, rootHost, ext) {
  const doneSet = new Set(Array.isArray(ext.tonePairsDone) ? ext.tonePairsDone : []);

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <h3 style="margin:0">🎵 20 คู่วรรณยุกต์ (Tone Pairs Mastery)</h3>
          <div class="m1-muted" style="font-size:13px">ฝึกฟังและพูดตามครบทั้ง 20 คู่เสียง — เคล็ดลับให้สำเนียงจีนเป๊ะตั้งแต่เดือนแรก</div>
        </div>
        <button type="button" class="btn-primary" id="m1-tone-quiz-btn">🎧 ทดสอบฟังแยกคู่เสียง</button>
      </div>
      <div id="m1-tone-quiz-box"></div>
      <div class="m1-tone-grid">
        ${TONE_PAIRS.map(t => {
          const ok = doneSet.has(t.id);
          return `
            <div class="m1-tone-card ${ok ? 'done' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="m1-tag">${core.escapeHtml(t.label)}</span>
                <button type="button" class="m1-check-btn" data-tp-done="${t.id}">${ok ? '✅' : '○'}</button>
              </div>
              <div class="m1-hz hanzi-font" style="margin-top:6px">${core.escapeHtml(t.hz)}</div>
              <div class="m1-py">${core.escapeHtml(t.py)}</div>
              <div class="m1-muted" style="font-size:12.5px">${core.escapeHtml(t.th)}</div>
              <div class="m1-tip">💡 ${core.escapeHtml(t.tip)}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-say="${core.escapeHtml(t.hz)}">🔊 ฟัง</button>
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-slow="${core.escapeHtml(t.hz)}">🐢 ช้า</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card-panel" style="margin-top:16px">
      <h3 style="margin:0 0 8px">⚠️ กับดักเสียงคนไทยโดยเฉพาะ (Thai-Speaker Traps)</h3>
      <div class="m1-traps-grid">
        ${THAI_TRAPS.map(tr => `
          <div class="m1-trap-card">
            <div style="font-weight:700;margin-bottom:4px">${core.escapeHtml(tr.title)}</div>
            <div class="m1-muted" style="font-size:12.5px;margin-bottom:10px">${core.escapeHtml(tr.tip)}</div>
            ${tr.pairs.map(p => `
              <div class="m1-trap-pair">
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-say="${core.escapeHtml(p.a.hz)}">🔊 <b class="hanzi-font">${core.escapeHtml(p.a.hz)}</b> ${core.escapeHtml(p.a.py)} (${core.escapeHtml(p.a.th)})</button>
                <span class="m1-muted">vs</span>
                <button type="button" class="btn-secondary m1-mini-btn" data-tp-say="${core.escapeHtml(p.b.hz)}">🔊 <b class="hanzi-font">${core.escapeHtml(p.b.hz)}</b> ${core.escapeHtml(p.b.py)} (${core.escapeHtml(p.b.th)})</button>
              </div>`).join('')}
          </div>`).join('')}
      </div>
    </div>
  `;

  body.querySelectorAll('[data-tp-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.tpSay)));
  body.querySelectorAll('[data-tp-slow]').forEach(b => b.addEventListener('click', () => {
    const prev = core.state.rate;
    core.state.rate = 0.6;
    core.speak(b.dataset.tpSlow, () => { core.state.rate = prev; });
  }));
  body.querySelectorAll('[data-tp-done]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.tpDone;
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.tonePairsDone) ? cur.tonePairsDone : []);
      if (s.has(id)) s.delete(id); else s.add(id);
      cur.tonePairsDone = [...s];
      return cur;
    }, { save: true });
    renderMonth1Tab(core, rootHost);
  }));
  body.querySelector('#m1-tone-quiz-btn')?.addEventListener('click', () => startTonePairQuiz(core, body.querySelector('#m1-tone-quiz-box')));
}

function startTonePairQuiz(core, box) {
  if (!box) return;
  const target = TONE_PAIRS[Math.floor(Math.random() * TONE_PAIRS.length)];
  const distractors = core.shuffleArray(TONE_PAIRS.filter(x => x.id !== target.id)).slice(0, 3);
  const options = core.shuffleArray([target, ...distractors]);
  core.speak(target.hz);

  box.innerHTML = `
    <div class="m1-quiz-inline">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong>🎧 ฟังแล้วเลือกคู่เสียงที่ได้ยิน:</strong>
        <button type="button" class="btn-secondary m1-mini-btn" id="m1-tq-replay">🔊 ฟังอีกครั้ง</button>
      </div>
      <div class="m1-chip-row">
        ${options.map(o => `<button type="button" class="btn-secondary" data-tq-pick="${o.id}">${core.escapeHtml(o.label)} (${core.escapeHtml(o.hz)})</button>`).join('')}
      </div>
      <div id="m1-tq-fb" style="margin-top:8px;font-size:13px"></div>
    </div>`;
  box.querySelector('#m1-tq-replay')?.addEventListener('click', () => core.speak(target.hz));
  box.querySelectorAll('[data-tq-pick]').forEach(b => b.addEventListener('click', () => {
    const ok = b.dataset.tqPick === target.id;
    core.playChime(ok ? 'ok' : 'err');
    const fb = box.querySelector('#m1-tq-fb');
    if (ok) {
      core.addXp(5, 'ตอบถูกคู่เสียง!');
      fb.innerHTML = `<span style="color:var(--sys-green-text,#16a34a);font-weight:700">✓ ถูกต้อง! ${core.escapeHtml(target.hz)} (${core.escapeHtml(target.py)}) = ${core.escapeHtml(target.label)}</span> <button type="button" class="btn-primary m1-mini-btn" id="m1-tq-next">ข้อต่อไป →</button>`;
    } else {
      fb.innerHTML = `<span style="color:var(--sys-red-text,#dc2626);font-weight:700">✗ เฉลยคือ ${core.escapeHtml(target.label)}: ${core.escapeHtml(target.hz)} (${core.escapeHtml(target.py)})</span> <button type="button" class="btn-primary m1-mini-btn" id="m1-tq-next">ลองข้อใหม่ →</button>`;
    }
    box.querySelector('#m1-tq-next')?.addEventListener('click', () => startTonePairQuiz(core, box));
  }));
}

function renderMnemonicsView(core, body, rootHost, ext) {
  const doneSet = new Set(Array.isArray(ext.mnemonicsDone) ? ext.mnemonicsDone : []);
  const q = uiState.mnemQuery.trim().toLowerCase();
  const list = HANZI_MNEMONICS.filter(m => !q || m.hz.includes(q) || m.py.toLowerCase().includes(q) || m.th.toLowerCase().includes(q));

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div>
          <h3 style="margin:0">🧠 64 ภาพจำตัวอักษรจีนเดือนแรก (Thai Mnemonics)</h3>
          <div class="m1-muted" style="font-size:13px">จำอักษรจีนจากเรื่องเล่าภาษาไทย ไม่ต้องท่องจำแบบนกแก้วนกขุนทอง · กด ✍️ เพื่อดูลำดับขีด</div>
        </div>
        <input type="search" id="m1-mnem-search" class="vb-search" style="max-width:220px" placeholder="ค้นหาตัวอักษร/ความหมาย..." value="${core.escapeHtml(uiState.mnemQuery)}">
      </div>
      <div id="m1-mnem-stroke" class="m1-stroke-box" hidden></div>
      <div class="m1-mnem-grid">
        ${list.map(m => {
          const ok = doneSet.has(m.hz);
          return `
            <div class="m1-mnem-card ${ok ? 'done' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div class="m1-mnem-char hanzi-font">${core.escapeHtml(m.hz)}</div>
                <button type="button" class="m1-check-btn" data-mn-done="${core.escapeHtml(m.hz)}">${ok ? '✅' : '○'}</button>
              </div>
              <div class="m1-py">${core.escapeHtml(m.py)} · <b>${core.escapeHtml(m.th)}</b></div>
              <div class="m1-tag" style="margin:4px 0">${core.escapeHtml(m.parts)}</div>
              <div class="m1-muted" style="font-size:12.5px;line-height:1.45">${core.escapeHtml(m.story)}</div>
              <div class="m1-tip" style="margin-top:6px">ตัวอย่าง: ${core.escapeHtml(m.ex)}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button type="button" class="btn-secondary m1-mini-btn" data-mn-say="${core.escapeHtml(m.hz)}">🔊 ฟัง</button>
                <button type="button" class="btn-secondary m1-mini-btn" data-mn-stroke="${core.escapeHtml(m.hz)}">✍️ ลำดับขีด</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  body.querySelector('#m1-mnem-search')?.addEventListener('input', (e) => {
    uiState.mnemQuery = e.target.value;
    renderMnemonicsView(core, body, rootHost, ext);
  });
  body.querySelectorAll('[data-mn-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.mnSay)));
  body.querySelectorAll('[data-mn-stroke]').forEach(b => b.addEventListener('click', () => {
    showStrokePreview(core, b.dataset.mnStroke, body.querySelector('#m1-mnem-stroke'));
  }));
  body.querySelectorAll('[data-mn-done]').forEach(b => b.addEventListener('click', () => {
    const ch = b.dataset.mnDone;
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.mnemonicsDone) ? cur.mnemonicsDone : []);
      if (s.has(ch)) s.delete(ch); else s.add(ch);
      cur.mnemonicsDone = [...s];
      return cur;
    }, { save: true });
    renderMonth1Tab(core, rootHost);
  }));
}

function renderSurvivalView(core, body, rootHost, ext) {
  const doneSet = new Set(Array.isArray(ext.survivalDone) ? ext.survivalDone : []);
  const cats = [
    { id: 'all', label: 'ทั้งหมด (50)' },
    { id: 'greet', label: 'ทักทาย (10)' },
    { id: 'food', label: 'กิน/ชานม (10)' },
    { id: 'shop', label: 'ซื้อของ (10)' },
    { id: 'travel', label: 'เดินทาง (10)' },
    { id: 'help', label: 'ขอความช่วยเหลือ (10)' }
  ];
  const items = uiState.survCat === 'all' ? SURVIVAL_50 : SURVIVAL_50.filter(x => x.cat === uiState.survCat);

  body.innerHTML = `
    <div class="card-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <h3 style="margin:0">🗣️ 50 ประโยคเอาตัวรอดเดือนแรก (HSK 1 ล้วน)</h3>
          <div class="m1-muted" style="font-size:13px">คัดเฉพาะประโยคที่ใช้จริงทุกวัน ฟังช้า 0.6x แล้วพูดตามจนคล่อง</div>
        </div>
        <button type="button" class="btn-primary" id="m1-surv-roleplay">🎙️ ลองใช้จริงใน AI Roleplay →</button>
      </div>
      <div class="m1-chip-row" style="margin-bottom:14px">
        ${cats.map(c => `<button type="button" class="m1-chip ${uiState.survCat === c.id ? 'active' : ''}" data-scat="${c.id}">${c.label}</button>`).join('')}
      </div>
      <div class="m1-list">
        ${items.map((s) => {
          const ok = doneSet.has(s.hz);
          return `
            <div class="m1-item ${ok ? 'done' : ''}">
              <div>
                <span class="m1-tag">${core.escapeHtml(s.catLabel)}</span>
                <div class="m1-hz hanzi-font" style="margin-top:4px">${core.escapeHtml(s.hz)}</div>
                <div class="m1-py">${core.escapeHtml(s.py)}</div>
                <div class="m1-muted">${core.escapeHtml(s.th)} · 💡 ${core.escapeHtml(s.tip)}</div>
              </div>
              <div class="m1-row-btns">
                <button type="button" class="btn-secondary m1-mini-btn" data-ss-slow="${core.escapeHtml(s.hz)}">🐢 0.6x</button>
                <button type="button" class="btn-secondary m1-mini-btn" data-ss-say="${core.escapeHtml(s.hz)}">🔊 ฟัง</button>
                <button type="button" class="btn-primary m1-mini-btn" data-ss-done="${core.escapeHtml(s.hz)}">${ok ? '✓ คล่องแล้ว' : 'ฝึกแล้ว'}</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  body.querySelector('#m1-surv-roleplay')?.addEventListener('click', () => core.switchTab('speak-studio'));
  body.querySelectorAll('[data-scat]').forEach(b => b.addEventListener('click', () => {
    uiState.survCat = b.dataset.scat;
    renderSurvivalView(core, body, rootHost, ext);
  }));
  body.querySelectorAll('[data-ss-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.ssSay)));
  body.querySelectorAll('[data-ss-slow]').forEach(b => b.addEventListener('click', () => {
    const prev = core.state.rate;
    core.state.rate = 0.6;
    core.speak(b.dataset.ssSlow, () => { core.state.rate = prev; });
  }));
  body.querySelectorAll('[data-ss-done]').forEach(b => b.addEventListener('click', () => {
    const hz = b.dataset.ssDone;
    core.setExt('month1', (cur) => {
      const s = new Set(Array.isArray(cur.survivalDone) ? cur.survivalDone : []);
      if (s.has(hz)) s.delete(hz); else s.add(hz);
      cur.survivalDone = [...s];
      return cur;
    }, { save: true });
    renderMonth1Tab(core, rootHost);
  }));
}
