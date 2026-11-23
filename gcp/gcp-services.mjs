// Lightweight GCP Metadata Server token + Firestore REST + Cloud TTS (Neural2/Wavenet) helpers
// Zero external npm dependencies; falls back gracefully when running locally outside GCP.

let cachedToken = null;
let cachedTokenExp = 0;

export async function getGcpAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExp - 60_000) return cachedToken;
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(1500) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    cachedToken = data.access_token || null;
    cachedTokenExp = Date.now() + (Number(data.expires_in || 300) * 1000);
    return cachedToken;
  } catch {
    return null;
  }
}

function getProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '';
}

export async function firestoreGet(collection, docId) {
  const project = getProjectId();
  if (!project) return null;
  const token = await getGcpAccessToken();
  if (!token) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const doc = await res.json();
    const jsonStr = doc?.fields?.payload?.stringValue;
    return jsonStr ? JSON.parse(jsonStr) : null;
  } catch {
    return null;
  }
}

export async function firestoreSet(collection, docId, payloadObj) {
  const project = getProjectId();
  if (!project) return false;
  const token = await getGcpAccessToken();
  if (!token) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(payloadObj) },
          updatedAt: { stringValue: new Date().toISOString() }
        }
      }),
      signal: AbortSignal.timeout(3500)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function synthesizeCloudTts(text, lang = 'zh-CN') {
  const token = await getGcpAccessToken();
  if (!token) return null;
  const isThai = String(lang).toLowerCase().startsWith('th');
  const voice = isThai
    ? { languageCode: 'th-TH', name: 'th-TH-Neural2-C' }
    : { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-A' };
  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 }
      }),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.audioContent) return null;
    return Buffer.from(data.audioContent, 'base64');
  } catch {
    return null;
  }
}
