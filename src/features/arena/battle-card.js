// Shareable 9:16 Battle Card PNG Generator (1080x1920) for IG Story / LINE
// Draws player avatar, duel score, rank, room invite code (?duel=CODE), and scannable-style invite badge,
// then triggers Web Share API (`navigator.share` with File) or instant PNG download.

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCodeMatrixPattern(ctx, codeStr, x, y, size) {
  const cells = 11;
  const cell = size / cells;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x - 12, y - 12, size + 24, size + 24, 18);
  ctx.fill();

  let hash = 2166136261;
  for (let i = 0; i < codeStr.length; i++) {
    hash ^= codeStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r, c) =>
    (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3);

  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (isFinder(r, c)) {
        ctx.fillRect(x + c * cell, y + r * cell, cell - 1, cell - 1);
      } else {
        hash ^= (r * 31 + c * 17);
        hash = Math.imul(hash, 16777619);
        if ((hash >>> 0) % 2 === 0) {
          ctx.fillRect(x + c * cell, y + r * cell, cell - 1.5, cell - 1.5);
        }
      }
    }
  }
}

export async function generateAndShareBattleCard({
  playerName = 'ผู้เรียน',
  avatar = '🐼',
  title = 'เซียนภาษาจีน',
  score = 1000,
  roomCode = 'NIHAO1',
  topicLabel = '1v1 Chinese Duel',
  rankLabel = '🥇 อันดับที่ 1',
  shareUrl = window.location.origin
} = {}, core) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Deep vibrant gradient background
  const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.48, '#1e1b4b');
  grad.addColorStop(1, '#311042');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Decorative glowing orbs
  const orb1 = ctx.createRadialGradient(200, 300, 20, 200, 300, 420);
  orb1.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
  orb1.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = orb1;
  ctx.fillRect(0, 0, 1080, 900);

  const orb2 = ctx.createRadialGradient(880, 1500, 20, 880, 1500, 480);
  orb2.addColorStop(0, 'rgba(236, 72, 153, 0.32)');
  orb2.addColorStop(1, 'rgba(236, 72, 153, 0)');
  ctx.fillStyle = orb2;
  ctx.fillRect(200, 900, 880, 1020);

  // Header brand
  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 38px "Inter", "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('你好 NIHAO · MULTIPLAYER ARENA', 540, 150);

  // Main glass card
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 84, 220, 912, 1460, 48);
  ctx.fill();
  ctx.stroke();

  // Rank pill
  ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
  drawRoundedRect(ctx, 330, 285, 420, 74, 37);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 36px "Noto Sans Thai", sans-serif';
  ctx.fillText(rankLabel, 540, 335);

  // Avatar circle
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(540, 520, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '130px sans-serif';
  ctx.fillText(avatar, 540, 565);

  // Player Name & Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px "Noto Sans Thai", "Inter", sans-serif';
  ctx.fillText(playerName, 540, 725);

  ctx.fillStyle = '#c4b5fd';
  ctx.font = '600 34px "Noto Sans Thai", sans-serif';
  ctx.fillText(`「 ${title} 」`, 540, 785);

  // Big Score Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  drawRoundedRect(ctx, 160, 850, 760, 290, 36);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 32px "Noto Sans Thai", sans-serif';
  ctx.fillText(`คะแนนดวลโหมด ${topicLabel}`, 540, 920);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 132px "Inter", sans-serif';
  ctx.fillText(`${Number(score || 0).toLocaleString()}`, 540, 1065);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 30px "Noto Sans Thai", sans-serif';
  ctx.fillText('แต้มความไว + ความแม่นยำ!', 540, 1115);

  // Challenge section + Room Code + Visual Matrix
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px "Noto Sans Thai", sans-serif';
  ctx.fillText('🔥 กล้ามาล้มสถิติเราไหม?', 540, 1235);

  drawCodeMatrixPattern(ctx, shareUrl, 200, 1300, 180);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 28px "Noto Sans Thai", sans-serif';
  ctx.fillText('เข้าเว็บแล้วกรอกรหัสห้อง 6 หลัก:', 430, 1345);

  ctx.fillStyle = '#facc15';
  ctx.font = '800 74px monospace';
  ctx.fillText(roomCode, 430, 1430);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 26px "Inter", sans-serif';
  ctx.fillText(shareUrl.replace(/^https?:\/\//, ''), 430, 1480);

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 28px "Noto Sans Thai", sans-serif';
  ctx.fillText('แชร์ลง IG Story / LINE ท้าเพื่อนดวลโจทย์ชุดเดียวกันได้เลย!', 540, 1785);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const fileName = `nihao-duel-${roomCode}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `ท้าดวลภาษาจีน! เราได้ ${score} แต้ม (ห้อง ${roomCode})`,
        text: `มาแข่งภาษาจีนโจทย์ชุดเดียวกันในห้อง ${roomCode} กัน! ${shareUrl}`,
        files: [file]
      });
      core?.showToast?.('แชร์การ์ดผลดวลเรียบร้อย! 🎉');
      return;
    } catch {
      // User cancelled share sheet or unsupported; fall through to download
    }
  }

  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = dlUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(dlUrl), 5000);
  core?.showToast?.('ดาวน์โหลดการ์ด PNG (1080×1920) พร้อมอัปลง IG Story / LINE แล้ว! 📸');
}
