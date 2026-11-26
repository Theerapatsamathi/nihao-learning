// Interactive Mastery Analytics & Calendar Hub (`analytics` tab)
import {
  buildStudyCalendar,
  computeSkillStrengthsWeaknesses,
  computeHskEtaForecast,
  computeTrophyCase
} from './analytics-logic.js';
import { renderToneCoachRunner } from './tone-coach.js';
import { renderStreetListeningRunner, renderBlindDictationRunner } from './realworld-drills.js';
import { renderFsrsQuizGate, renderWeaknessGrinder } from './mastery-drills.js';

export function renderAnalyticsTab(core, host) {
  if (!host) return;
  const ext = core.getExt('month1') || {};
  const tk = core.todayKey();
  const g = core.computeGameStats();
  const cal = buildStudyCalendar(core.state.progress, ext, tk, 84);
  const diag = computeSkillStrengthsWeaknesses(core.state.progress, ext);
  const eta = computeHskEtaForecast(core.state.progress, ext, tk);
  const trophies = computeTrophyCase(core.state.progress, ext, g);
  let selectedDate = tk;

  const render = () => {
    const selCell = cal.cells.find(c => c.dateKey === selectedDate) || cal.cells[cal.cells.length - 1];
    const earnedCount = trophies.filter(t => t.unlocked).length;

    host.innerHTML = `
      <div class="card-panel m1-hero">
        <div class="m1-hero-left">
          <div class="m1-tag">📊 ปฏิทิน & ศูนย์วิเคราะห์ผลการเรียน (Mastery Analytics)</div>
          <h2 style="margin:8px 0 4px">สรุปเวลาเรียน · จุดเด่น/จุดด้อย · เหรียญตราของคุณ</h2>
          <p class="m1-muted" style="margin:0">คลิกที่แต่ละช่องในปฏิทินเพื่อดูบันทึกย้อนหลังว่าวันนั้นเรียนอะไรไปบ้างและใช้เวลากี่นาที</p>
        </div>
        <div class="m1-kpi-mini">
          <div><strong>${cal.summary.todayMin} น.</strong><span>วันนี้</span></div>
          <div><strong>${cal.summary.weekHours} ชม.</strong><span>7 วันล่าสุด</span></div>
          <div><strong>${cal.summary.totalHours} ชม.</strong><span>สะสม 12 สัปดาห์</span></div>
          <div><strong>${earnedCount}/${trophies.length}</strong><span>เหรียญตรา</span></div>
        </div>
      </div>

      <!-- 1. Interactive 12-Week Study Calendar -->
      <div class="card-panel" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <h3 style="margin:0">📅 ปฏิทินการเรียน 12 สัปดาห์ (${cal.summary.activeDays} วันที่เข้าเรียน)</h3>
          <span class="m1-muted" style="font-size:12px">สีอ่อน = เรียนสั้น · สีเข้ม = อัดหนัก (คลิกวันเพื่อดูรายละเอียด)</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(14, minmax(0, 1fr));gap:5px;margin-bottom:12px">
          ${cal.cells.map(c => {
            const bg = c.level === 0 ? 'rgba(120,120,128,0.14)'
              : c.level === 1 ? 'rgba(34,197,94,0.3)'
              : c.level === 2 ? 'rgba(34,197,94,0.55)'
              : c.level === 3 ? 'rgba(22,163,74,0.8)'
              : '#15803d';
            const isSel = c.dateKey === selectedDate;
            return `<button type="button" data-cal-day="${c.dateKey}" title="${c.dateKey}: ${c.minutes} นาที" style="height:26px;border-radius:6px;border:${isSel ? '2px solid var(--sys-accent,#007aff)' : '1px solid transparent'};background:${bg};cursor:pointer"></button>`;
          }).join('')}
        </div>

        <div class="m1-item" style="background:var(--sys-fill-3,rgba(120,120,128,.06))">
          <div>
            <strong>📌 บันทึกวันที่ ${core.escapeHtml(selCell.dateKey)}</strong>
            <div class="m1-muted" style="font-size:13px;margin-top:2px">
              เวลาเรียนประมาณ <b>${selCell.minutes} นาที</b> ·
              ${selCell.passedDays.length
                ? `สอบผ่าน ≥95%: ${selCell.passedDays.map(p => `Day ${p.day} (${p.pct}%)`).join(', ')}`
                : (selCell.actCount > 0 ? `ฝึกทบทวน ${selCell.actCount} กิจกรรม` : 'ยังไม่มีบันทึกการเรียนในวันนี้')}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Strengths vs Weaknesses (4 Skills) + Top 5 Nemesis Words -->
      <div class="m1-days-grid" style="margin-top:14px;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr))">
        <div class="card-panel">
          <h3 style="margin:0 0 10px">⚖️ จุดเด่น vs จุดด้อย (4 ทักษะหลัก)</h3>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
            ${diag.skills.map(sk => `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                  <span>${sk.label}</span>
                  <strong class="tabular-nums">${sk.score}%</strong>
                </div>
                <div class="m1-prog" style="margin:0"><div class="m1-prog-fill" style="width:${sk.score}%;background:${sk.score >= 70 ? '#16a34a' : (sk.score >= 40 ? '#f59e0b' : '#ef4444')}"></div></div>
              </div>
            `).join('')}
          </div>
          <div class="m1-item" style="margin-bottom:10px">
            <div style="font-size:13px">
              <div>✅ <b>จุดเด่น:</b> ${diag.strength.label} (${diag.strength.score}%)</div>
              <div style="margin-top:4px">⚠️ <b>ควรปรับปรุงด่วน:</b> ${diag.weakness.label} (${diag.weakness.score}%) — ${diag.weakness.tip}</div>
            </div>
          </div>
          <button type="button" class="btn-primary m1-mini-btn" id="an-fix-weak">💪 ซ่อมจุดด้อยทันที →</button>
        </div>

        <div class="card-panel">
          <h3 style="margin:0 0 10px">🎯 พยากรณ์วันจบ HSK 1–3 (สปีด ${eta.pacePerWeek} วัน/สัปดาห์)</h3>
          <div class="m1-list" style="margin-bottom:12px">
            <div class="m1-item"><span>🌱 HSK 1 (Day 30)</span><strong>${core.escapeHtml(eta.hsk1.etaDate)}</strong></div>
            <div class="m1-item"><span>🚀 HSK 2 (Day 60)</span><strong>${core.escapeHtml(eta.hsk2.etaDate)}</strong></div>
            <div class="m1-item"><span>👑 HSK 3 (Day 90)</span><strong>${core.escapeHtml(eta.hsk3.etaDate)}</strong></div>
          </div>
          <h4 style="margin:10px 0 6px;font-size:13.5px">⚠️ คำที่ผิดบ่อยที่สุด (Top 5 Nemesis)</h4>
          ${diag.nemesis.length ? `
            <div class="m1-chip-row">
              ${diag.nemesis.map(n => `<button type="button" class="m1-chip hanzi-font" data-say="${core.escapeHtml(n.hz)}">🔊 ${core.escapeHtml(n.hz)} (ผิด ${n.misses})</button>`).join('')}
            </div>
          ` : `<div class="m1-muted" style="font-size:12.5px">ยังไม่มีคำที่ผิดซ้ำ ยอดเยี่ยมมาก!</div>`}
        </div>
      </div>

      <!-- 3. Trophy Case -->
      <div class="card-panel" style="margin-top:14px">
        <h3 style="margin:0 0 10px">🏅 ตู้โชว์เหรียญตรา (${earnedCount}/${trophies.length})</h3>
        <div class="m1-days-grid" style="grid-template-columns:repeat(auto-fill, minmax(180px, 1fr))">
          ${trophies.map(t => `
            <div class="m1-day-card ${t.unlocked ? 'done' : ''}" style="${t.unlocked ? '' : 'opacity:0.55'}">
              <div style="font-size:28px;line-height:1.1">${t.icon}</div>
              <div style="font-weight:700;margin:6px 0 2px">${core.escapeHtml(t.title)}</div>
              <div class="m1-muted" style="font-size:12px">${core.escapeHtml(t.desc)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    host.querySelectorAll('[data-cal-day]').forEach(b => b.addEventListener('click', () => {
      selectedDate = b.dataset.calDay;
      render();
    }));
    host.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => core.speak(b.dataset.say)));
    host.querySelector('#an-fix-weak')?.addEventListener('click', () => {
      const act = diag.weakness.action;
      const back = () => renderAnalyticsTab(core, host);
      if (act === 'tone-coach') renderToneCoachRunner(core, host, back);
      else if (act === 'street') renderStreetListeningRunner(core, host, back);
      else if (act === 'blind') renderBlindDictationRunner(core, host, back);
      else if (act === 'fsrs') renderFsrsQuizGate(core, host, { onCleared: back, onExit: back });
      else renderWeaknessGrinder(core, host, back);
    });
  };

  render();
}
