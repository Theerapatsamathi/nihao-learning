// #33 AI Study Plan, #34 Weakness Dashboard, #29 Milestone Certificates, #30 Monthly Recap ("Wrapped")
import {
  analyzeWeaknesses,
  buildActivityHeatmap,
  generateRuleBasedStudyPlan,
  computeMonthlyRecap,
  evaluateMilestoneCertificates
} from './logic.js';
import { collectUnifiedMistakes } from './view-mistakes-notebook.js';

function downloadCanvasPng(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function generateMilestoneCertificatePng(cert, learnerName, stats) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 620;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f5f7';
  ctx.fillRect(0, 0, 1000, 620);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(36, 36, 928, 548, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,60,67,0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const grad = ctx.createLinearGradient(36, 36, 964, 36);
  grad.addColorStop(0, cert.accent[0]);
  grad.addColorStop(1, cert.accent[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(36, 36, 928, 14, [28, 28, 0, 0]);
  ctx.fill();

  ctx.fillStyle = cert.accent[0];
  ctx.font = '700 18px Inter, sans-serif';
  ctx.fillText(`NIHAO LEARNING PLATFORM · ${cert.subtitle.toUpperCase()}`, 76, 104);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '700 40px "Noto Sans Thai", Inter, sans-serif';
  ctx.fillText(`ใบประกาศนียบัตร: ${cert.title}`, 76, 162);

  ctx.fillStyle = '#6e6e73';
  ctx.font = '500 20px "Noto Sans Thai", Inter, sans-serif';
  ctx.fillText('ขอมอบให้แก่', 76, 224);

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '700 46px "Noto Sans Thai", Inter, sans-serif';
  ctx.fillText(learnerName || 'ผู้เรียน Nihao', 76, 282);

  ctx.fillStyle = '#6e6e73';
  ctx.font = '500 20px "Noto Sans Thai", Inter, sans-serif';
  ctx.fillText(`ระดับ Level ${stats.level || 1} · ${(stats.xp || 0).toLocaleString()} XP · สตรีค ${stats.streak || 0} วัน`, 76, 344);

  // Badge on right
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(750, 110, 170, 170, 28);
  ctx.fill();
  ctx.font = '72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cert.emoji, 835, 215);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#86868b';
  ctx.font = '500 16px "Noto Sans Thai", Inter, sans-serif';
  const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillText(`ออกให้เมื่อวันที่ ${dateStr} · 你好 Nihao`, 76, 530);

  downloadCanvasPng(canvas, `nihao-cert-${cert.id}.png`);
}

function generateWrappedPng(recap, learnerName) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 720, 1080);
  grad.addColorStop(0, '#007aff');
  grad.addColorStop(0.5, '#5856d6');
  grad.addColorStop(1, '#1d1d1f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 1080);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 22px Inter, sans-serif';
  ctx.fillText(`NIHAO WRAPPED · ${recap.monthLabel}`, 56, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 48px "Noto Sans Thai", Inter, sans-serif';
  ctx.fillText('สรุปการเรียนประจำเดือน', 56, 158);
  ctx.font = '600 28px "Noto Sans Thai", Inter, sans-serif';
  ctx.fillText(learnerName || 'ผู้เรียน Nihao', 56, 206);

  const cards = [
    ['⏱️ เวลาเรียนโดยประมาณ', `${recap.estMinutes} นาที (${recap.activeDays} วัน)`],
    ['📚 คำศัพท์ที่เรียนเดือนนี้', `${recap.wordsThisMonth} คำ (สะสม ${recap.totalWords} คำ)`],
    ['🔥 สตรีคต่อเนื่อง', `${recap.bestStreak} วัน`],
    ['⭐ กิจกรรมที่โดดเด่น', recap.favoriteActivity],
    ['🎯 คำที่ต้องทบทวนบ่อย', recap.mostMissed.length ? recap.mostMissed.join(' · ') : 'ไม่มีคำผิดค้าง!']
  ];

  let y = 280;
  for (const [label, val] of cards) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(56, y, 608, 118, 22);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '600 20px "Noto Sans Thai", Inter, sans-serif';
    ctx.fillText(label, 84, y + 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px "Noto Sans Thai", "Noto Sans SC", Inter, sans-serif';
    ctx.fillText(val, 84, y + 90);
    y += 140;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '600 18px Inter, sans-serif';
  ctx.fillText('你好 Nihao · Mandarin Learning Platform', 56, 1020);

  downloadCanvasPng(canvas, `nihao-wrapped-${recap.monthLabel.replace('/', '-')}.png`);
}

export function renderInsightsView(host, core) {
  let aiTipText = '';
  let aiLoading = false;
  let wrappedIdx = 0;

  function render() {
    const p = core.state.progress;
    const stats = core.computeGameStats();
    const todayStr = core.todayKey(0);
    const plan = generateRuleBasedStudyPlan(p, stats, todayStr);
    const mistakes = collectUnifiedMistakes(core);
    const weak = analyzeWeaknesses(mistakes);
    const heatmap = buildActivityHeatmap(p.activity, p.frozenDays, core.todayKey, 12);
    const certs = evaluateMilestoneCertificates(p, stats, core.getExt('lesson-path') || {});
    const recap = computeMonthlyRecap(p, stats, new Map(), new Date());
    const user = core.getUser?.();
    const learnerName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ผู้เรียน Nihao';

    const maxTone = Math.max(1, ...Object.values(weak.toneCounts));
    const canAiEnrich = Boolean(core.aiStatus?.configured && core.isSignedIn());

    const wrappedSlides = [
      { emoji: '⏱️', title: 'เวลาเรียนเดือนนี้', big: `${recap.estMinutes} นาที`, sub: `เรียนทั้งหมด ${recap.activeDays} วัน (${recap.monthUnits} กิจกรรม)` },
      { emoji: '📚', title: 'คำศัพท์ที่เรียนรู้', big: `${recap.wordsThisMonth} คำ`, sub: `คลังคำศัพท์สะสมทั้งหมด ${recap.totalWords.toLocaleString()} คำ` },
      { emoji: '🔥', title: 'สตรีค & เลเวล', big: `${recap.bestStreak} วัน`, sub: `Level ${recap.level} · ${recap.xp.toLocaleString()} XP` },
      { emoji: '⭐', title: 'ทักษะเด่น & จุดที่ต้องย้ำ', big: recap.favoriteActivity, sub: recap.mostMissed.length ? `คำที่พลาดบ่อย: ${recap.mostMissed.join(', ')}` : 'ยอดเยี่ยม! ไม่มีคำผิดค้างอยู่' }
    ];
    const curSlide = wrappedSlides[wrappedIdx % wrappedSlides.length];

    host.innerHTML = `
      <!-- #33 AI Study Plan -->
      <div class="card-panel">
        <div class="mo-section-head">
          <div>
            <h3>🧠 แผนการเรียนวันนี้ (AI Study Plan)</h3>
            <p class="mo-muted">จัดตารางอัตโนมัติจากจุดอ่อน คำผิด และคำศัพท์ที่ครบกำหนดทบทวน</p>
          </div>
          ${canAiEnrich ? `
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-ai-enrich" ${aiLoading ? 'disabled' : ''}>
              ${aiLoading ? 'กำลังวิเคราะห์...' : '✨ ขอคำแนะนำจาก AI'}
            </button>
          ` : ''}
        </div>
        <div class="mo-plan-list">
          ${plan.map((t, i) => `
            <div class="mo-plan-item">
              <div class="mo-plan-num">${i + 1}</div>
              <div class="mo-plan-body">
                <strong>${core.escapeHtml(t.title)}</strong>
                <div class="mo-muted mo-small">${core.escapeHtml(t.reason)} · ~${t.minutes} นาที</div>
              </div>
              <button type="button" class="btn-secondary mo-btn-sm" data-go-tab="${core.escapeHtml(t.tab)}">เริ่มเลย</button>
            </div>
          `).join('')}
        </div>
        ${aiTipText ? `<div class="mo-ai-box mo-mt"><strong>✨ คำแนะนำจากครู AI:</strong><p>${core.escapeHtml(aiTipText)}</p></div>` : ''}
      </div>

      <!-- #34 Weakness Dashboard -->
      <div class="card-panel mo-mt">
        <h3>📊 แดชบอร์ดจุดอ่อน & ปฏิทินการเรียน (Weakness Dashboard)</h3>
        <div class="mo-weak-grid">
          <div>
            <h4>ความถี่คำผิดตามวรรณยุกต์ (เสียง 1–5)</h4>
            <div class="mo-tone-bars">
              ${[1, 2, 3, 4, 5].map((t) => {
                const cnt = weak.toneCounts[t] || 0;
                const pct = Math.round((cnt / maxTone) * 100);
                return `
                  <div class="mo-tone-row">
                    <span>เสียง ${t === 5 ? 'เบา' : t}</span>
                    <div class="mo-progress-track"><div class="mo-progress-fill mo-tone-fill" style="width:${pct}%"></div></div>
                    <span class="mo-muted mo-small">${cnt}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div>
            <h4>พยัญชนะต้นที่ผิดบ่อย</h4>
            ${weak.topInitials.length === 0 ? '<p class="mo-muted mo-small">ยังไม่มีข้อมูลคำผิดเพียงพอ</p>' : `
              <div class="mo-chip-wrap">
                ${weak.topInitials.map((x) => `<span class="mo-badge mo-badge-warn">${core.escapeHtml(x.initial)} (${x.count})</span>`).join('')}
              </div>
              <button type="button" class="btn-secondary mo-btn-sm mo-mt" data-go-tab="initials">ฝึกออกเสียงพยัญชนะ →</button>
            `}
          </div>
        </div>

        <h4 class="mo-mt">ปฏิทินการเรียน 12 สัปดาห์ล่าสุด</h4>
        <div class="mo-heatmap" role="grid" aria-label="ปฏิทินความสม่ำเสมอ 12 สัปดาห์">
          ${heatmap.map((c) => `
            <span class="mo-hm-cell lv-${c.level} ${c.isFrozen ? 'frozen' : ''}" title="${c.key}: ${c.units} กิจกรรม${c.isFrozen ? ' (Freeze)' : ''}"></span>
          `).join('')}
        </div>
      </div>

      <div class="mo-card-grid mo-mt">
        <!-- #30 Monthly Recap ("Wrapped") -->
        <div class="card-panel mo-wrapped-card">
          <div class="mo-section-head">
            <h3>🎬 สรุปรายเดือน (Wrapped ${core.escapeHtml(recap.monthLabel)})</h3>
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-dl-wrapped">📸 บันทึก PNG</button>
          </div>
          <div class="mo-story-stage">
            <div class="mo-story-emoji">${curSlide.emoji}</div>
            <div class="mo-story-title">${core.escapeHtml(curSlide.title)}</div>
            <div class="mo-story-big">${core.escapeHtml(curSlide.big)}</div>
            <div class="mo-story-sub">${core.escapeHtml(curSlide.sub)}</div>
          </div>
          <div class="mo-story-nav">
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-story-prev">◀ ก่อนหน้า</button>
            <span class="mo-muted mo-small">${wrappedIdx + 1} / ${wrappedSlides.length}</span>
            <button type="button" class="btn-secondary mo-btn-sm" id="mo-story-next">ถัดไป ▶</button>
          </div>
        </div>

        <!-- #29 Milestone Certificates -->
        <div class="card-panel">
          <h3>🏅 ใบประกาศนียบัตรความสำเร็จ</h3>
          <p class="mo-muted">ปลดล็อกและดาวน์โหลดเป็นภาพ PNG เก็บไว้เป็นที่ระลึก</p>
          <div class="mo-list mo-mt">
            ${certs.map((c) => `
              <div class="mo-cert-row ${c.unlocked ? 'unlocked' : 'locked'}">
                <span class="mo-cert-emoji">${c.emoji}</span>
                <div class="mo-cert-info">
                  <strong>${core.escapeHtml(c.title)}</strong>
                  <div class="mo-muted mo-small">${core.escapeHtml(c.progressText)}</div>
                </div>
                <button type="button" class="btn-primary mo-btn-sm" data-dl-cert="${c.id}" ${c.unlocked ? '' : 'disabled'}>
                  ${c.unlocked ? '⬇️ PNG' : '🔒 ล็อกอยู่'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-go-tab]').forEach((btn) => {
      btn.addEventListener('click', () => core.switchTab(btn.dataset.goTab));
    });

    host.querySelector('#mo-story-prev')?.addEventListener('click', () => {
      wrappedIdx = (wrappedIdx - 1 + wrappedSlides.length) % wrappedSlides.length;
      render();
    });
    host.querySelector('#mo-story-next')?.addEventListener('click', () => {
      wrappedIdx = (wrappedIdx + 1) % wrappedSlides.length;
      render();
    });
    host.querySelector('#mo-dl-wrapped')?.addEventListener('click', () => {
      generateWrappedPng(recap, learnerName);
      core.showToast('ดาวน์โหลดภาพสรุปรายเดือนแล้ว');
    });

    host.querySelectorAll('[data-dl-cert]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cert = certs.find((c) => c.id === btn.dataset.dlCert);
        if (cert && cert.unlocked) {
          generateMilestoneCertificatePng(cert, learnerName, stats);
          core.showToast(`ดาวน์โหลดใบประกาศฯ ${cert.title} แล้ว`);
        }
      });
    });

    host.querySelector('#mo-ai-enrich')?.addEventListener('click', async () => {
      aiLoading = true;
      render();
      try {
        const prompt = `ฉันกำลังเรียนภาษาจีน (Level ${stats.level}, สตรีค ${stats.streak} วัน, คำผิดค้าง ${mistakes.length} ข้อ) ช่วยให้คำแนะนำการฝึกวันนี้สั้นๆ 2-3 ประโยคเป็นภาษาไทย`;
        const res = await core.api('/api/ai/tutor', { mode: 'chat', message: prompt }, 'POST');
        if (res.status === 401) {
          core.openAuthModal();
        } else if (res.status === 429) {
          core.showToast('ใช้งาน AI ครบโควต้าชั่วคราว กรุณาลองใหม่ภายหลัง');
        } else if (res.ok && (res.data?.reply || res.data?.text || res.data?.message)) {
          aiTipText = res.data.reply || res.data.text || res.data.message;
        } else {
          core.showToast('ไม่สามารถเรียกคำแนะนำจาก AI ได้ในขณะนี้');
        }
      } catch {
        core.showToast('ไม่สามารถเชื่อมต่อ AI ได้');
      } finally {
        aiLoading = false;
        render();
      }
    });
  }

  render();
}
