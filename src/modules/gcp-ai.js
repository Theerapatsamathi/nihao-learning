// Frontend client helpers for Google Cloud Platform AI & Cache APIs
// (Chirp 2 STT, Vertex AI Imagen 3, Cloud Translation v3, GCP Capabilities)

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function fetchGcpCapabilities() {
  try {
    const res = await fetch('/api/gcp/capabilities');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function transcribeAudioWithChirp2(audioBlob, lang = 'cmn-Hans-CN') {
  const audio = await blobToBase64(audioBlob);
  const res = await fetch('/api/ai/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Chirp 2 STT unavailable');
  }
  return data;
}

export async function generateStudyIllustration({ prompt, topic, vocab, style, aspectRatio = '16:9' } = {}) {
  const res = await fetch('/api/ai/imagen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, topic, vocab, style, aspectRatio })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Imagen 3 unavailable');
  }
  return data;
}

export async function translateInstant(text, target = 'th', source = '') {
  const res = await fetch('/api/ai/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target, source })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Translation unavailable');
  }
  return data;
}

export async function evaluateSpeakingAudio({ audioBlob, targetHz = '', targetPy = '', targetTh = '', context = '', mode = 'coach', lang = 'th' } = {}) {
  const audio = await blobToBase64(audioBlob);
  const res = await fetch('/api/ai/speak-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nihao-Lang': lang },
    body: JSON.stringify({ audio, targetHz, targetPy, targetTh, context, mode, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Audio coach unavailable');
  }
  return data;
}

export async function generatePersonalPodcast({ words = [], topic = 'ชีวิตประจำวันในจีน', level = 'HSK 1-2', lang = 'th' } = {}) {
  const res = await fetch('/api/ai/podcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nihao-Lang': lang },
    body: JSON.stringify({ words, topic, level, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Podcast generator unavailable');
  return data;
}

export async function generateVisualMnemonic({ hz, py = '', th = '', lang = 'th' } = {}) {
  const res = await fetch('/api/ai/mnemonic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nihao-Lang': lang },
    body: JSON.stringify({ hz, py, th, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Mnemonic generator unavailable');
  return data;
}

export async function generateWeaknessDrill({ mistakes = [], weakTones = [], lang = 'th' } = {}) {
  const res = await fetch('/api/ai/weakness-drill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nihao-Lang': lang },
    body: JSON.stringify({ mistakes, weakTones, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Weakness drill unavailable');
  return data;
}

export async function fetchChinaNewsToday({ topic = 'เทรนด์และข่าวสนุกๆ ในจีนวันนี้', level = 'HSK 1-3', lang = 'th' } = {}) {
  const res = await fetch('/api/ai/china-news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nihao-Lang': lang },
    body: JSON.stringify({ topic, level, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'China News unavailable');
  return data;
}

export async function generateVocabRap({ topic = 'อาหารและเครื่องดื่มจีน', lang = 'th' } = {}) {
  const res = await fetch('/api/ai/vocab-rap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nihao-Lang': lang },
    body: JSON.stringify({ topic, lang })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Vocab Rap unavailable');
  return data;
}

export async function generateVideoScene({ prompt = '' } = {}) {
  const res = await fetch('/api/ai/video-scene', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Video scene unavailable');
  return data;
}

export function trackBigQueryEvent(eventType, detail = '', score = 0) {
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, detail, score })
  }).catch(() => {});
}

/**
 * Renders a 1080x1350 Spotify-Wrapped-style Shareable Chinese Level Card on Canvas and returns its data URL.
 */
export function buildShareableLevelCardDataUrl({
  name = 'ผู้เรียนภาษาจีน',
  avatar = '🐼',
  levelTitle = 'HSK 1–2 Explorer',
  streak = 0,
  totalXp = 0,
  masteredWords = 0,
  toneScore = 92
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');

  // Rich emerald-jade to deep navy gradient
  const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.55, '#134e4a');
  grad.addColorStop(1, '#064e3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1350);

  // Decorative glow circles
  ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
  ctx.beginPath();
  ctx.arc(900, 220, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.12)';
  ctx.beginPath();
  ctx.arc(160, 1140, 300, 0, Math.PI * 2);
  ctx.fill();

  // Header badge
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('你好 NIHAO · CHINESE POWER CARD', 540, 120);

  // Avatar & Name
  ctx.font = '140px system-ui, sans-serif';
  ctx.fillText(avatar, 540, 310);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(String(name).slice(0, 22), 540, 415);
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '600 38px system-ui, sans-serif';
  ctx.fillText(String(levelTitle).slice(0, 32), 540, 475);

  // 2x2 Stat Cards
  const stats = [
    { label: 'STREAK ต่อเนื่อง', val: `${streak} วัน`, emoji: '🔥', x: 90, y: 560 },
    { label: 'พลัง XP รวม', val: `${Number(totalXp).toLocaleString()} XP`, emoji: '⚡', x: 560, y: 560 },
    { label: 'คำศัพท์ที่จำได้', val: `${masteredWords} คำ`, emoji: '📚', x: 90, y: 840 },
    { label: 'ความแม่นวรรณยุกต์', val: `${toneScore}%`, emoji: '🎯', x: 560, y: 840 }
  ];
  for (const s of stats) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, 430, 230, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '56px system-ui, sans-serif';
    ctx.fillText(s.emoji, s.x + 36, s.y + 82);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(s.val, s.x + 36, s.y + 154);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.fillText(s.label, s.x + 36, s.y + 198);
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.fillText('เรียนจีนทุกวันกับ 你好 Nihao · Powered by Google Cloud AI', 540, 1230);

  return canvas.toDataURL('image/png');
}


