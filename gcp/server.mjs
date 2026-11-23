// Google Cloud Run production server for 你好 Nihao
// Serves Vite dist/ + all /api/* endpoints using @google/genai (Gemini API or Vertex AI).
// Zero extra npm dependencies beyond what is already in package.json.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8080);

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash'
].filter((m, i, a) => Boolean(m) && a.indexOf(m) === i);

const DAILY_AI_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT || 50));

// In-memory stores (for Cloud Run single-instance / quick start; swap with Firestore/Cloud SQL for multi-instance)
const progressStore = new Map();
const aiUsageStore = new Map();
const leagueStore = new Map();
const friendsStore = new Map();
const ttsCache = new Map();

function isAiConfigured() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' && process.env.GOOGLE_CLOUD_PROJECT)
  );
}

function createGenAiClient() {
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
    });
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
}

async function generateStructuredJson({ contents, systemInstruction, responseSchema }) {
  const ai = createGenAiClient();
  let lastErr = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const config = { systemInstruction, responseMimeType: 'application/json' };
      if (responseSchema) config.responseSchema = responseSchema;
      const res = await ai.models.generateContent({ model, contents, config });
      const raw = String(res.text || '').trim();
      if (!raw) throw new Error('Empty model response');
      return { data: JSON.parse(raw), model };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

function getClientUserId(req) {
  // Supports Cloud IAP header, custom user header, or IP-based fallback
  const iap = req.headers['x-goog-authenticated-user-id'];
  if (iap) return String(iap).slice(0, 120);
  const custom = req.headers['x-nihao-user'];
  if (custom) return String(custom).slice(0, 120);
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon').split(',')[0].trim();
  return `guest:${ip}`;
}

function checkAiQuota(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}:${today}`;
  const used = (aiUsageStore.get(key) || 0) + 1;
  if (used > DAILY_AI_LIMIT) {
    return { ok: false, used: DAILY_AI_LIMIT, limit: DAILY_AI_LIMIT, remaining: 0 };
  }
  aiUsageStore.set(key, used);
  return { ok: true, used, limit: DAILY_AI_LIMIT, remaining: Math.max(0, DAILY_AI_LIMIT - used) };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const txt = Buffer.concat(chunks).toString('utf8');
        resolve(txt ? JSON.parse(txt) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg'
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try { rel = decodeURIComponent(rel); } catch { /* ignore */ }
  const safePath = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
  if (rel.startsWith('/assets/') || rel.startsWith('/vendor/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (rel === '/sw.js') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  } else if (rel.startsWith('/data/')) {
    headers['Cache-Control'] = 'public, max-age=604800';
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, urlObj) {
  const p = urlObj.pathname;
  const userId = getClientUserId(req);

  if (p === '/api/health') {
    return sendJson(res, 200, { ok: true, runtime: 'gcp-cloud-run', aiConfigured: isAiConfigured() });
  }

  if (p === '/api/ai/status') {
    const today = new Date().toISOString().slice(0, 10);
    const used = aiUsageStore.get(`${userId}:${today}`) || 0;
    return sendJson(res, 200, {
      ok: true,
      configured: isAiConfigured(),
      model: MODEL_CANDIDATES[0],
      usage: { used, limit: DAILY_AI_LIMIT, remaining: Math.max(0, DAILY_AI_LIMIT - used) }
    });
  }

  if (p === '/api/me/progress') {
    if (req.method === 'GET') {
      const rec = progressStore.get(userId) || null;
      return sendJson(res, 200, {
        ok: true,
        user: { id: userId, email: '', fullName: 'Learner' },
        progress: rec ? rec.progress : null,
        updatedAt: rec ? rec.updatedAt : null
      });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const progress = body.progress && typeof body.progress === 'object' ? body.progress : body;
      const updatedAt = new Date().toISOString();
      progressStore.set(userId, { progress, updatedAt });
      return sendJson(res, 200, { ok: true, updatedAt });
    }
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (p === '/api/tts') {
    const text = String(urlObj.searchParams.get('text') || '').trim().slice(0, 160);
    const lang = String(urlObj.searchParams.get('lang') || 'zh-CN').trim();
    if (!text) return sendJson(res, 400, { ok: false, error: 'Missing text' });
    const cacheKey = `${lang}:${text}`;
    if (ttsCache.has(cacheKey)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800' });
      return res.end(ttsCache.get(cacheKey));
    }
    try {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
      const upstream = await fetch(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!upstream.ok) return sendJson(res, 502, { ok: false, error: 'TTS upstream failed' });
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (ttsCache.size > 400) ttsCache.clear();
      ttsCache.set(cacheKey, buf);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=604800' });
      return res.end(buf);
    } catch {
      return sendJson(res, 502, { ok: false, error: 'TTS fetch error' });
    }
  }

  if (p === '/api/league') {
    if (req.method === 'GET') {
      const members = [...leagueStore.values()].sort((a, b) => b.xp - a.xp).slice(0, 30);
      return sendJson(res, 200, { ok: true, tier: 'Bronze', members });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      leagueStore.set(userId, {
        userId,
        name: String(body.name || 'ผู้เรียน').slice(0, 40),
        xp: Math.max(0, Number(body.xp || 0))
      });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (p === '/api/friends') {
    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, code: userId.slice(-8).toUpperCase(), friends: friendsStore.get(userId) || [] });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const list = friendsStore.get(userId) || [];
      if (body.code) list.push({ code: String(body.code).slice(0, 20), addedAt: new Date().toISOString() });
      friendsStore.set(userId, list.slice(-50));
      return sendJson(res, 200, { ok: true, friends: list });
    }
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  // AI Endpoints (/api/ai/tutor, /api/ai/speak, /api/ai/story, /api/ai/vocab-story)
  if (p.startsWith('/api/ai/') && req.method === 'POST') {
    if (!isAiConfigured()) {
      return sendJson(res, 503, { ok: false, error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือ Vertex AI บน Cloud Run' });
    }
    const quota = checkAiQuota(userId);
    if (!quota.ok) {
      return sendJson(res, 429, { ok: false, code: 'RATE_LIMITED', error: `ครบโควตา AI วันนี้แล้ว (${DAILY_AI_LIMIT} ครั้ง/วัน)` });
    }
    const body = await readJsonBody(req);
    const usage = { used: quota.used, limit: quota.limit, remaining: quota.remaining };

    if (p === '/api/ai/speak') {
      const mode = String(body.mode || 'roleplay');
      if (mode === 'translate') {
        const thai = String(body.thai || '').trim().slice(0, 240);
        const { data, model } = await generateStructuredJson({
          contents: `Translate this Thai intent to natural beginner Mandarin Chinese: "${thai}"`,
          systemInstruction: 'You are a Mandarin Chinese teacher for Thai beginners. Return JSON {hz, py, th, note}.',
          responseSchema: {
            type: Type.OBJECT,
            properties: { hz: { type: Type.STRING }, py: { type: Type.STRING }, th: { type: Type.STRING }, note: { type: Type.STRING } },
            required: ['hz', 'py', 'th', 'note']
          }
        });
        return sendJson(res, 200, { ok: true, model, usage, result: data });
      }
      if (mode === 'feedback') {
        const transcript = JSON.stringify(body.transcript || []).slice(0, 3000);
        const { data, model } = await generateStructuredJson({
          contents: `Evaluate this learner Chinese conversation transcript: ${transcript}`,
          systemInstruction: 'Return JSON {fluency:0-100, accuracy:0-100, vocab:0-100, summary:Thai, items:[{said, better, py, note}]}.',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fluency: { type: Type.INTEGER }, accuracy: { type: Type.INTEGER }, vocab: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { said: { type: Type.STRING }, better: { type: Type.STRING }, py: { type: Type.STRING }, note: { type: Type.STRING } },
                  required: ['said', 'better', 'py', 'note']
                }
              }
            },
            required: ['fluency', 'accuracy', 'vocab', 'summary', 'items']
          }
        });
        return sendJson(res, 200, { ok: true, model, usage, report: data });
      }
      // Default: roleplay
      const msg = String(body.message || '').trim().slice(0, 500);
      const { data, model } = await generateStructuredJson({
        contents: `Scenario: ${JSON.stringify(body.scenario || {}).slice(0, 600)}\nLearner said: "${msg}"`,
        systemInstruction: 'You are a Mandarin Chinese roleplay partner for Thai beginners. Stay in character, reply in 1-2 simple sentences, check completed goal indices, and provide a 3-level hint.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hz: { type: Type.STRING }, py: { type: Type.STRING }, th: { type: Type.STRING },
            correction: { type: Type.STRING },
            goalsCompleted: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            hint: {
              type: Type.OBJECT,
              properties: { keywords: { type: Type.STRING }, py: { type: Type.STRING }, hz: { type: Type.STRING } },
              required: ['keywords', 'py', 'hz']
            }
          },
          required: ['hz', 'py', 'th', 'correction', 'goalsCompleted', 'hint']
        }
      });
      return sendJson(res, 200, { ok: true, model, usage, reply: data });
    }

    // Default /api/ai/tutor
    const msg = String(body.message || body.sentence || '').trim().slice(0, 500);
    const { data, model } = await generateStructuredJson({
      contents: `Learner message: "${msg}"`,
      systemInstruction: 'Warm Mandarin Chinese tutor for Thai beginners. Reply in 1-2 short Simplified Chinese sentences with tone-marked Pinyin, Thai translation, tip, and gentle correction.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hz: { type: Type.STRING }, py: { type: Type.STRING }, th: { type: Type.STRING },
          tip: { type: Type.STRING }, correction: { type: Type.STRING }
        },
        required: ['hz', 'py', 'th', 'tip', 'correction']
      }
    });
    return sendJson(res, 200, { ok: true, model, usage, reply: data });
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (urlObj.pathname.startsWith('/api/')) {
      return await handleApi(req, res, urlObj);
    }
    serveStatic(req, res, urlObj.pathname);
  } catch (err) {
    console.error('[gcp-server]', err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Internal server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[nihao-gcp] Listening on http://0.0.0.0:${PORT} (AI configured: ${isAiConfigured()})`);
});
