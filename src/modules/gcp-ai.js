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

