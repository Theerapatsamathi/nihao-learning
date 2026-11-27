// Lightweight GCP Metadata Server token + Firestore REST + Cloud Storage Cache
// + Cloud TTS (Chirp 3 HD) + Cloud STT V2 (Chirp 2) + Vertex AI Imagen 3
// + Cloud Vision OCR + Cloud Translation v3 + Secret Manager + Firebase ID Token verification.
// Zero external npm dependencies; falls back gracefully when running locally outside GCP.

import crypto from 'node:crypto';

let cachedToken = null;
let cachedTokenExp = 0;

let cachedFirebaseCerts = null;
let cachedFirebaseCertsExp = 0;

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

export function getProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID || '';
}

export function getGcpLocation() {
  return process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
}

export function getCacheBucket() {
  return String(process.env.GCS_CACHE_BUCKET || '').trim();
}

export function sha256Hex(str) {
  return crypto.createHash('sha256').update(String(str || '')).digest('hex');
}

async function getFirebasePublicCerts() {
  if (cachedFirebaseCerts && Date.now() < cachedFirebaseCertsExp) return cachedFirebaseCerts;
  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return null;
    const cc = String(res.headers.get('cache-control') || '');
    const m = cc.match(/max-age=(\d+)/);
    const maxAgeSec = m ? Math.max(60, Number(m[1])) : 3600;
    cachedFirebaseCerts = await res.json();
    cachedFirebaseCertsExp = Date.now() + maxAgeSec * 1000;
    return cachedFirebaseCerts;
  } catch {
    return null;
  }
}

function decodeJwtPart(b64url) {
  const txt = Buffer.from(String(b64url || ''), 'base64url').toString('utf8');
  return JSON.parse(txt);
}

/**
 * Verifies a Firebase Auth ID token (RS256) against Google's public x509 certs.
 * Returns `{ uid, email, name }` when valid, or `null` when invalid/expired.
 */
export async function verifyFirebaseIdToken(idToken) {
  try {
    const raw = String(idToken || '').trim();
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    if (payload.exp && Number(payload.exp) < nowSec - 30) return null;
    if (payload.iat && Number(payload.iat) > nowSec + 300) return null;

    const expectedProject = getProjectId();
    if (expectedProject) {
      if (payload.aud !== expectedProject) return null;
      if (payload.iss !== `https://securetoken.google.com/${expectedProject}`) return null;
    } else if (!String(payload.iss || '').startsWith('https://securetoken.google.com/')) {
      return null;
    }

    const certs = await getFirebasePublicCerts();
    const certPem = certs?.[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const sigBuf = Buffer.from(parts[2], 'base64url');
    const valid = verifier.verify(certPem, sigBuf);
    if (!valid) return null;

    return {
      uid: payload.sub.slice(0, 120),
      email: String(payload.email || ''),
      name: String(payload.name || '')
    };
  } catch {
    return null;
  }
}

// ---- Cloud Firestore REST helpers ----

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

export async function firestoreList(collection, pageSize = 50) {
  const project = getProjectId();
  if (!project) return [];
  const token = await getGcpAccessToken();
  if (!token) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encodeURIComponent(collection)}?pageSize=${pageSize}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3500) });
    if (!res.ok) return [];
    const data = await res.json();
    const docs = Array.isArray(data.documents) ? data.documents : [];
    const out = [];
    for (const d of docs) {
      const jsonStr = d?.fields?.payload?.stringValue;
      if (jsonStr) {
        try { out.push(JSON.parse(jsonStr)); } catch { /* ignore */ }
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ---- Cloud Storage (GCS) Audio & Image Cache ----

export async function gcsGet(objectPath) {
  const bucket = getCacheBucket();
  if (!bucket) return null;
  const token = await getGcpAccessToken();
  if (!token) return null;
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function gcsPut(objectPath, buffer, contentType = 'application/octet-stream') {
  const bucket = getCacheBucket();
  if (!bucket || !buffer) return false;
  const token = await getGcpAccessToken();
  if (!token) return false;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType
      },
      body: buffer,
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Cloud Text-to-Speech (Chirp 3: HD Voices with Wavenet/Neural2 fallback + GCS Cache) ----

export async function synthesizeCloudTts(text, lang = 'zh-CN', rate = null, voiceGender = 'female') {
  const isThai = String(lang).toLowerCase().startsWith('th');
  const isMale = String(voiceGender).toLowerCase() === 'male';
  const primaryVoice = isThai
    ? { languageCode: 'th-TH', name: isMale ? 'th-TH-Chirp3-HD-Charon' : (process.env.GCP_TTS_VOICE_TH || 'th-TH-Chirp3-HD-Aoede') }
    : { languageCode: 'cmn-CN', name: isMale ? 'cmn-CN-Chirp3-HD-Charon' : (process.env.GCP_TTS_VOICE_ZH || 'cmn-CN-Chirp3-HD-Aoede') };
  const fallbackVoice = isThai
    ? { languageCode: 'th-TH', name: 'th-TH-Neural2-C' }
    : { languageCode: 'cmn-CN', name: isMale ? 'cmn-CN-Wavenet-B' : 'cmn-CN-Wavenet-A' };

  const clampedRate = rate ? Math.max(0.5, Math.min(1.5, Number(rate) || 1.0)) : null;
  const rateTag = clampedRate ? `r${clampedRate.toFixed(2)}` : 'rdef';
  const cacheObj = `tts/${primaryVoice.name}_${rateTag}_${sha256Hex(`${lang}:${text}`)}.mp3`;
  const cached = await gcsGet(cacheObj);
  if (cached) return { buffer: cached, source: 'gcs-cache' };

  const token = await getGcpAccessToken();
  if (!token) return null;

  for (const voice of [primaryVoice, fallbackVoice]) {
    try {
      const speakingRate = clampedRate || (voice.name.includes('Chirp3') ? 1.0 : 0.95);
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice,
          audioConfig: { audioEncoding: 'MP3', speakingRate }
        }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.audioContent) continue;
      const buf = Buffer.from(data.audioContent, 'base64');
      // Fire-and-forget write to GCS cache to save credits on repeated words
      gcsPut(cacheObj, buf, 'audio/mpeg').catch(() => {});
      return { buffer: buf, source: voice.name };
    } catch {
      continue;
    }
  }
  return null;
}

// ---- Cloud Speech-to-Text V2 (Chirp 2) for Speak Studio & Tone Coach ----

export async function transcribeCloudStt(audioBase64, languageCode = 'cmn-Hans-CN') {
  const project = getProjectId();
  const token = await getGcpAccessToken();
  if (!project || !token || !audioBase64) return null;

  const sttLocation = process.env.GCP_STT_LOCATION || 'us-central1';
  const v2Url = `https://${sttLocation}-speech.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(sttLocation)}/recognizers/_:recognize`;

  try {
    const res = await fetch(v2Url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          languageCodes: [languageCode],
          model: 'chirp_2',
          features: {
            enableAutomaticPunctuation: true,
            enableWordConfidence: true,
            enableWordTimeOffsets: true
          }
        },
        content: audioBase64
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (res.ok) {
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const bestAlts = results.map(r => r?.alternatives?.[0]).filter(Boolean);
      const transcript = bestAlts.map(a => a.transcript || '').join('').trim();
      const confidences = bestAlts.map(a => Number(a.confidence || 0)).filter(n => n > 0);
      const avgConf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.85;
      const words = bestAlts.flatMap(a => Array.isArray(a.words) ? a.words : []).map(w => ({
        word: String(w.word || ''),
        confidence: Number(w.confidence || avgConf)
      }));
      return { transcript, confidence: Math.round(avgConf * 100), words, engine: 'chirp-2' };
    }
  } catch {
    // Fall through to STT V1 fallback
  }

  // Fallback to Cloud Speech-to-Text V1
  try {
    const v1Res = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          languageCode: languageCode === 'cmn-Hans-CN' ? 'zh' : languageCode,
          enableAutomaticPunctuation: true,
          enableWordConfidence: true
        },
        audio: { content: audioBase64 }
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!v1Res.ok) return null;
    const data = await v1Res.json();
    const alts = (data.results || []).map(r => r?.alternatives?.[0]).filter(Boolean);
    const transcript = alts.map(a => a.transcript || '').join('').trim();
    const avgConf = alts[0]?.confidence ? Number(alts[0].confidence) : 0.8;
    return { transcript, confidence: Math.round(avgConf * 100), words: [], engine: 'stt-v1' };
  } catch {
    return null;
  }
}

// ---- Vertex AI Imagen 3 (Flashcard & Story Illustration Generator + GCS Cache) ----

export async function generateVertexImagen(prompt, aspectRatio = '16:9') {
  const project = getProjectId();
  const location = getGcpLocation();
  const cleanPrompt = String(prompt || '').trim().slice(0, 400);
  if (!cleanPrompt) return null;

  const cacheObj = `imagen/${sha256Hex(`${aspectRatio}:${cleanPrompt}`)}.png`;
  const cached = await gcsGet(cacheObj);
  if (cached) {
    return {
      imageUrl: `data:image/png;base64,${cached.toString('base64')}`,
      cached: true,
      model: 'imagen-3.0-generate-002'
    };
  }

  const token = await getGcpAccessToken();
  if (!project || !token) return null;

  const model = process.env.VERTEX_IMAGEN_MODEL || 'imagen-3.0-generate-002';
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:predict`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: cleanPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          personGeneration: 'allow_adult',
          safetySetting: 'block_medium_and_above',
          addWatermark: false
        }
      }),
      signal: AbortSignal.timeout(18000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    const mime = data?.predictions?.[0]?.mimeType || 'image/png';
    if (!b64) return null;
    const buf = Buffer.from(b64, 'base64');
    gcsPut(cacheObj, buf, mime).catch(() => {});
    return {
      imageUrl: `data:${mime};base64,${b64}`,
      cached: false,
      model
    };
  } catch {
    return null;
  }
}

// ---- Cloud Vision API (OCR / Handwriting Pre-extraction) ----

export async function detectCloudVisionText(imageBase64) {
  const token = await getGcpAccessToken();
  if (!token || !imageBase64) return null;
  try {
    const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            imageContext: { languageHints: ['zh-Hans', 'zh', 'th', 'en'] }
          }
        ]
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const fullText = String(data?.responses?.[0]?.fullTextAnnotation?.text || '').trim();
    return fullText || null;
  } catch {
    return null;
  }
}

// ---- Cloud Translation API v3 (Fast, Low-Cost Instant Lookup) ----

export async function translateCloudText(text, targetLang = 'th', sourceLang = '') {
  const project = getProjectId();
  const token = await getGcpAccessToken();
  if (!project || !token || !text) return null;

  const url = `https://translation.googleapis.com/v3/projects/${encodeURIComponent(project)}/locations/global:translateText`;
  const payload = {
    contents: [String(text).slice(0, 500)],
    mimeType: 'text/plain',
    targetLanguageCode: targetLang
  };
  if (sourceLang) payload.sourceLanguageCode = sourceLang;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const translatedText = data?.translations?.[0]?.translatedText;
    const detectedLanguageCode = data?.translations?.[0]?.detectedLanguageCode || sourceLang || '';
    if (!translatedText) return null;
    return { translatedText, detectedLanguageCode, engine: 'cloud-translate-v3' };
  } catch {
    return null;
  }
}

// ---- Secret Manager Helper ----

export async function getGcpSecret(secretName, version = 'latest') {
  const project = getProjectId();
  const token = await getGcpAccessToken();
  if (!project || !token || !secretName) return null;
  const url = `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(secretName)}/versions/${encodeURIComponent(version)}:access`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data?.payload?.data;
    return b64 ? Buffer.from(b64, 'base64').toString('utf8').trim() : null;
  } catch {
    return null;
  }
}

// ---- BigQuery Streaming Analytics Helper ----

export async function bigqueryInsertEvent(row) {
  const project = getProjectId();
  const dataset = String(process.env.BQ_DATASET || '').trim();
  const table = String(process.env.BQ_TABLE || 'learning_events').trim();
  if (!project || !dataset) return false;
  const token = await getGcpAccessToken();
  if (!token) return false;
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(project)}/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}/insertAll`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [{ insertId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, json: row }]
      }),
      signal: AbortSignal.timeout(3000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Vertex AI Veo Short Video Scene Generator (with GCS Cache) ----

export async function startVertexVeoScene(prompt) {
  const project = getProjectId();
  const location = getGcpLocation();
  const bucket = getCacheBucket();
  const token = await getGcpAccessToken();
  const cleanPrompt = String(prompt || '').trim().slice(0, 320);
  if (!project || !token || !cleanPrompt) return null;

  const model = process.env.VERTEX_VEO_MODEL || 'veo-2.0-generate-001';
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:predictLongRunning`;
  const parameters = { aspectRatio: '16:9', durationSeconds: 5, sampleCount: 1 };
  if (bucket) parameters.storageUri = `gs://${bucket}/veo/`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt: cleanPrompt }], parameters }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { operationName: data?.name || null, model };
  } catch {
    return null;
  }
}
