const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const DB_DIR = path.join(ROOT, 'db');
const DB_FILE = path.join(DB_DIR, 'profiles.json');

// Lightweight .env loader (no external dependencies)
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // Ignore .env parse errors
  }
}
loadEnvFile();

function getGeminiConfig() {
  // Reload .env dynamically if key wasn't set at boot
  if (!process.env.GEMINI_API_KEY) loadEnvFile();
  return {
    apiKey: (process.env.GEMINI_API_KEY || '').trim(),
    model: (process.env.GEMINI_MODEL || 'gemini-4-hydrogen').trim()
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function writeDb(data) {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req, maxBytes = 262144) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Malformed JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Extract text from Gemini v1 Interactions API response
function extractInteractionText(interaction) {
  if (!interaction || typeof interaction !== 'object') return '';
  if (typeof interaction.output_text === 'string') return interaction.output_text;

  // v1 steps schema: gather text from trailing model_output steps
  if (Array.isArray(interaction.steps)) {
    const parts = [];
    for (let i = interaction.steps.length - 1; i >= 0; i--) {
      const st = interaction.steps[i];
      if (st && (st.type === 'model_output' || st.role === 'model')) {
        if (typeof st.text === 'string') parts.unshift(st.text);
        else if (Array.isArray(st.content)) {
          for (const c of st.content) {
            if (c && typeof c.text === 'string') parts.push(c.text);
          }
        } else if (Array.isArray(st.parts)) {
          for (const p of st.parts) {
            if (p && typeof p.text === 'string') parts.push(p.text);
          }
        }
      } else if (parts.length) {
        break;
      }
    }
    if (parts.length) return parts.join('');
  }

  // Fallback outputs array if present
  if (Array.isArray(interaction.outputs)) {
    const txt = interaction.outputs.map(o => (o && typeof o.text === 'string' ? o.text : '')).join('');
    if (txt) return txt;
  }
  return '';
}

async function callGeminiInteraction(payload) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const res = await fetch('https://generativelanguage.googleapis.com/v1/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({ model, ...payload })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Gemini API HTTP ${res.status}`;
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }

  return { id: json.id || null, text: extractInteractionText(json) };
}

async function handleAiApi(req, res, urlPath) {
  if (urlPath === '/api/ai/status' && req.method === 'GET') {
    const cfg = getGeminiConfig();
    sendJson(res, 200, { ok: true, configured: Boolean(cfg.apiKey), model: cfg.model });
    return;
  }

  if (urlPath === '/api/ai/tutor' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const message = String(body.message || '').trim();
      const prevId = body.previousInteractionId ? String(body.previousInteractionId) : undefined;
      if (!message) {
        sendJson(res, 400, { error: 'Message is required' });
        return;
      }

      const payload = {
        input: message,
        system_instruction:
          'You are a warm, encouraging Mandarin Chinese tutor for Thai beginners (Level 1 / HSK 1-2). ' +
          'Reply naturally in simple Simplified Chinese (1-2 short sentences using HSK 1-2 vocabulary), ' +
          'provide accurate tone-marked Pinyin, natural Thai translation, a brief helpful Thai grammar or pronunciation tip, ' +
          'and if the learner made a Chinese grammar/spelling mistake, gently provide a short Thai correction (otherwise empty string).',
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              hz: { type: 'string', description: 'Tutor reply in Simplified Chinese' },
              py: { type: 'string', description: 'Tone-marked Pinyin for hz' },
              th: { type: 'string', description: 'Natural Thai translation of hz' },
              tip: { type: 'string', description: 'Short Thai grammar or vocabulary tip' },
              correction: { type: 'string', description: 'Gentle Thai correction if user had a mistake, else empty string' }
            },
            required: ['hz', 'py', 'th', 'tip', 'correction']
          }
        }
      };
      if (prevId) payload.previous_interaction_id = prevId;

      const out = await callGeminiInteraction(payload);
      const data = JSON.parse(out.text);
      sendJson(res, 200, { ok: true, interactionId: out.id, reply: data });
    } catch (e) {
      sendJson(res, e.statusCode || 500, { error: e.message || 'AI Tutor error' });
    }
    return;
  }

  if (urlPath === '/api/ai/story' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const topic = String(body.topic || '').trim();
      if (!topic) {
        sendJson(res, 400, { error: 'Topic is required' });
        return;
      }

      const payload = {
        input: `สร้างเรื่องสั้นภาษาจีนระดับ HSK 1-2 จำนวน 4 ประโยค ในหัวข้อ: "${topic}" พร้อมคำถามจับใจความ 3 ข้อเป็นภาษาไทย`,
        system_instruction:
          'You create beginner Mandarin Chinese graded micro-readers (HSK 1-2) for Thai learners. ' +
          'Generate 4 short, natural Simplified Chinese sentences segmented word-by-word into tokens {hz, py, th}. ' +
          'For punctuation tokens like 。，！？ set py and th to empty string "". ' +
          'Also generate 3 multiple-choice comprehension questions in Thai with 4 options and 0-based answer index.',
        store: false,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Thai + Chinese title' },
              level: { type: 'string', description: 'e.g. AI HSK 1-2 · 4 ประโยค' },
              sentences: {
                type: 'array',
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      hz: { type: 'string' },
                      py: { type: 'string' },
                      th: { type: 'string' }
                    },
                    required: ['hz', 'py', 'th']
                  }
                }
              },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    q: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    answer: { type: 'integer' }
                  },
                  required: ['q', 'options', 'answer']
                }
              }
            },
            required: ['title', 'level', 'sentences', 'questions']
          }
        }
      };

      const out = await callGeminiInteraction(payload);
      const story = JSON.parse(out.text);
      story.id = 'ai_' + Date.now();
      sendJson(res, 200, { ok: true, story });
    } catch (e) {
      sendJson(res, e.statusCode || 500, { error: e.message || 'AI Story error' });
    }
    return;
  }

  if (urlPath === '/api/ai/vocab-story' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const words = Array.isArray(body.words) ? body.words.slice(0, 15) : [];
      if (!words.length) {
        sendJson(res, 400, { error: 'Words array is required' });
        return;
      }
      const listStr = words.map(w => `${w.hanzi} (${w.pinyin}: ${w.meaning})`).join(', ');
      const payload = {
        input: `แต่งนิทานหรือบทสนทนาสั้นๆ ภาษาจีนที่สนุกและเป็นธรรมชาติ จำนวน 5-6 ประโยค โดยใช้คำศัพท์ต่อไปนี้ให้มากที่สุด: ${listStr}`,
        system_instruction:
          'You are a fun Mandarin Chinese teacher for Thai learners. ' +
          'Write a short, engaging 5-6 sentence Chinese mini-story weaving in the provided vocabulary words naturally. ' +
          'Return JSON with title (Thai + Chinese) and lines array where each line has {hz, py, th, usedWords: string[]}.',
        store: false,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hz: { type: 'string' },
                    py: { type: 'string' },
                    th: { type: 'string' },
                    usedWords: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['hz', 'py', 'th', 'usedWords']
                }
              }
            },
            required: ['title', 'lines']
          }
        }
      };
      const out = await callGeminiInteraction(payload);
      const story = JSON.parse(out.text);
      sendJson(res, 200, { ok: true, story });
    } catch (e) {
      sendJson(res, e.statusCode || 500, { error: e.message || 'AI Vocab Story error' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Unknown AI endpoint' });
}

function handleProfileApi(req, res, urlPath) {
  const match = urlPath.match(/^\/api\/profile\/([a-zA-Z0-9_-]{2,40})$/);
  if (!match) {
    sendJson(res, 404, { error: 'Invalid profile endpoint or ID (use 2-40 letters/numbers/_/-)' });
    return;
  }

  const profileId = match[1].toLowerCase();

  if (req.method === 'GET') {
    const db = readDb();
    if (!db[profileId]) {
      sendJson(res, 404, { error: 'Profile not found' });
      return;
    }
    sendJson(res, 200, { ok: true, id: profileId, updatedAt: db[profileId].updatedAt, data: db[profileId].data });
    return;
  }

  if (req.method === 'POST') {
    readJsonBody(req)
      .then((parsed) => {
        if (!parsed || typeof parsed !== 'object') {
          sendJson(res, 400, { error: 'Invalid JSON payload' });
          return;
        }
        const db = readDb();
        const updatedAt = new Date().toISOString();
        db[profileId] = { updatedAt, data: parsed };
        writeDb(db);
        sendJson(res, 200, { ok: true, id: profileId, updatedAt });
      })
      .catch((e) => sendJson(res, 400, { error: e.message || 'Malformed JSON' }));
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

const ttsCache = new Map();
const TTS_CACHE_MAX = 300;

async function fetchTtsAudio(text, lang) {
  const gttsLang = lang.toLowerCase().startsWith('th') ? 'th' : (lang.toLowerCase().startsWith('en') ? 'en' : 'zh-CN');
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  const sources = [
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(gttsLang)}&q=${encodeURIComponent(text)}`
  ];
  if (gttsLang === 'zh-CN') {
    sources.push(`https://dict.youdao.com/dictvoice?le=zh&audio=${encodeURIComponent(text)}`);
  }

  for (const url of sources) {
    try {
      const r = await fetch(url, { headers });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (!r.ok || !ct.includes('audio')) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 200) return buf;
    } catch {
      // Try next TTS source
    }
  }
  return null;
}

async function handleTtsApi(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const urlObj = new URL(req.url || '/api/tts', 'http://127.0.0.1');
    const text = (urlObj.searchParams.get('text') || '').trim().slice(0, 200);
    const rawLang = (urlObj.searchParams.get('lang') || 'zh-CN').trim();
    const lang = /^(zh-CN|zh-TW|th|th-TH|en)$/i.test(rawLang) ? rawLang : 'zh-CN';
    if (!text) {
      sendJson(res, 400, { error: 'text query parameter is required' });
      return;
    }

    const cacheKey = `${lang.toLowerCase()}::${text}`;
    let audioBuf = ttsCache.get(cacheKey);
    if (!audioBuf) {
      audioBuf = await fetchTtsAudio(text, lang);
      if (!audioBuf) {
        sendJson(res, 502, { error: 'TTS upstream unavailable' });
        return;
      }
      if (ttsCache.size >= TTS_CACHE_MAX) {
        const oldestKey = ttsCache.keys().next().value;
        ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, audioBuf);
    }

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuf.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(audioBuf);
  } catch (e) {
    sendJson(res, 500, { error: e.message || 'TTS error' });
  }
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/tts') {
    handleTtsApi(req, res);
    return;
  }

  if (urlPath.startsWith('/api/ai/')) {
    handleAiApi(req, res, urlPath);
    return;
  }

  if (urlPath.startsWith('/api/profile/')) {
    handleProfileApi(req, res, urlPath);
    return;
  }

  const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relPath);

  if (
    !filePath.startsWith(ROOT) ||
    relPath.startsWith('db/') ||
    relPath === 'server.cjs' ||
    relPath.startsWith('.env')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const cfg = getGeminiConfig();
  console.log(`Nihao Learning Platform running at http://127.0.0.1:${PORT}`);
  console.log(`Gemini AI (${cfg.model}): ${cfg.apiKey ? 'ENABLED' : 'OFFLINE FALLBACK (set GEMINI_API_KEY in .env to enable)'}`);
});
