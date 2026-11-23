// #40 Word of the Day (deterministic by date + 1080x1920 PNG share card + #tab-plan widget)

import { pickWordOfTheDay } from './logic.js';

export function initWordOfTheDay(core) {
  function getWordPool() {
    if (Array.isArray(core.allVocabWords) && core.allVocabWords.length > 0) {
      return core.allVocabWords;
    }
    if (Array.isArray(core.data?.L2?.HSK1_WORDS) && core.data.L2.HSK1_WORDS.length > 0) {
      return core.data.L2.HSK1_WORDS;
    }
    return [
      { zh: '你好', py: 'nǐ hǎo', th: 'สวัสดี', exZh: '你好！很高兴认识你。', exPy: 'Nǐ hǎo! Hěn gāoxìng rènshi nǐ.', exTh: 'สวัสดี! ยินดีที่ได้รู้จักคุณ' }
    ];
  }

  function getTodayWord() {
    return pickWordOfTheDay(getWordPool(), core.todayKey());
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  async function renderSharePngBlob(word) {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e3a8a');
    grad.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Soft decorative circles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.arc(900, 260, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(160, 1660, 320, 0, Math.PI * 2);
    ctx.fill();

    // Header badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(80, 110, 420, 68, 34);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 32px "Noto Sans Thai", "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('คำศัพท์ประจำวัน · Word of the Day', 114, 155);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = '500 30px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(word.dateKey || core.todayKey(), W - 80, 155);

    // Center card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.roundRect(80, 310, W - 160, 1220, 48);
    ctx.fill();

    // Level pill inside card
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 110, 380, 220, 56, 28);
    ctx.fill();
    ctx.fillStyle = '#0369a1';
    ctx.font = '700 28px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(word.level || 'HSK 1'), W / 2, 418);

    // Hanzi
    const hanziSize = word.hanzi.length <= 2 ? 220 : word.hanzi.length <= 4 ? 156 : 112;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${hanziSize}px "Noto Sans SC", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(word.hanzi, W / 2, 700);

    // Pinyin
    ctx.fillStyle = '#007aff';
    ctx.font = '600 62px "Inter", sans-serif';
    ctx.fillText(word.pinyin, W / 2, 820);

    // Divider
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, 900);
    ctx.lineTo(W - 200, 900);
    ctx.stroke();

    // Thai meaning
    ctx.fillStyle = '#1e293b';
    ctx.font = '600 54px "Noto Sans Thai", sans-serif';
    const thLines = wrapCanvasText(ctx, word.thai, W - 260);
    let y = 1000;
    for (const line of thLines.slice(0, 3)) {
      ctx.fillText(line, W / 2, y);
      y += 72;
    }

    // Example sentence (if available)
    if (word.exampleZh) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(130, 1180, W - 260, 260, 28);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 40px "Noto Sans SC", sans-serif';
      ctx.fillText(word.exampleZh, W / 2, 1255);
      if (word.examplePy) {
        ctx.fillStyle = '#0369a1';
        ctx.font = '500 30px "Inter", sans-serif';
        ctx.fillText(word.examplePy, W / 2, 1315);
      }
      if (word.exampleTh) {
        ctx.fillStyle = '#475569';
        ctx.font = '500 32px "Noto Sans Thai", sans-serif';
        ctx.fillText(word.exampleTh, W / 2, 1380);
      }
    }

    // Footer branding
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px "Noto Sans SC", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('你好 Nihao · แพลตฟอร์มเรียนจีนสำหรับคนไทย', W / 2, 1730);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = '500 28px "Noto Sans Thai", sans-serif';
    ctx.fillText('ฝึกพินอิน · คำศัพท์ HSK · ฟัง-พูด-อ่าน-เขียน', W / 2, 1790);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('ไม่สามารถสร้างรูปภาพได้'));
      }, 'image/png');
    });
  }

  async function shareWordCard(word) {
    const target = word || getTodayWord();
    if (!target) return;
    try {
      const blob = await renderSharePngBlob(target);
      const filename = `nihao-wotd-${target.dateKey || core.todayKey()}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `คำศัพท์จีนประจำวัน: ${target.hanzi}`,
          text: `${target.hanzi} (${target.pinyin}) = ${target.thai} · เรียนจีนกับ 你好 Nihao`,
          files: [file]
        });
        core.showToast('แชร์การ์ดคำศัพท์เรียบร้อยแล้ว');
        return;
      }

      // Fallback: direct PNG download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      core.showToast('ดาวน์โหลดการ์ดคำศัพท์ (1080×1920 PNG) แล้ว');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      core.showToast('ไม่สามารถแชร์การ์ดได้ในขณะนี้');
    }
  }

  // Inject a compact dismissible Word of the Day widget after #tab-plan .page-head
  function injectPlanWidget() {
    const today = core.todayKey();
    const ext = core.getExt('platform') || {};
    if (ext.wotdDismissedDate === today) return;
    if (document.getElementById('pf-plan-wotd')) return;

    const planHead = document.querySelector('#tab-plan .page-head');
    if (!planHead || !planHead.parentNode) return;

    const word = getTodayWord();
    if (!word) return;

    const widget = document.createElement('div');
    widget.id = 'pf-plan-wotd';
    widget.className = 'pf-wotd-banner card-panel';
    widget.innerHTML = `
      <div class="pf-wotd-banner-main">
        <span class="pf-wotd-tag">✨ คำศัพท์ประจำวัน</span>
        <div class="pf-wotd-inline">
          <strong class="pf-wotd-hz hanzi-font" data-pf-role="hanzi">${core.escapeHtml(word.hanzi)}</strong>
          <span class="pf-wotd-py" data-pf-role="pinyin">${core.escapeHtml(word.pinyin)}</span>
          <span class="pf-wotd-th">${core.escapeHtml(word.thai)}</span>
        </div>
      </div>
      <div class="pf-wotd-banner-actions">
        <button type="button" class="btn-secondary pf-btn-sm" data-pf-wotd="speak" aria-label="ฟังเสียงคำศัพท์ประจำวัน">🔊 ฟัง</button>
        <button type="button" class="btn-secondary pf-btn-sm" data-pf-wotd="share" aria-label="แชร์การ์ดคำศัพท์">📤 แชร์</button>
        <button type="button" class="pf-icon-dismiss" data-pf-wotd="dismiss" aria-label="ซ่อนคำศัพท์ประจำวันสำหรับวันนี้" title="ซ่อนวันนี้">✕</button>
      </div>
    `;

    widget.querySelector('[data-pf-wotd="speak"]')?.addEventListener('click', () => {
      core.speak(word.hanzi);
    });
    widget.querySelector('[data-pf-wotd="share"]')?.addEventListener('click', () => {
      shareWordCard(word);
    });
    widget.querySelector('[data-pf-wotd="dismiss"]')?.addEventListener('click', () => {
      widget.remove();
      core.setExt('platform', { wotdDismissedDate: today }, { save: true, reason: 'wotd-dismiss' });
    });

    planHead.insertAdjacentElement('afterend', widget);
  }

  injectPlanWidget();

  return {
    getTodayWord,
    shareWordCard,
    injectPlanWidget
  };
}
