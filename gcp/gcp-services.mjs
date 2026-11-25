// Lightweight GCP Metadata Server token + Firestore REST + Cloud TTS + Firebase ID Token verification helpers
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
