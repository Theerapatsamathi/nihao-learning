import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";

const SHORT_PUBLIC_MAX_CHARS = 25; // Covers all HSK vocab words & short phrases
const MAX_TTS_CHARS = 200;
// 25,000 chars/day * 30 days = 750,000 chars/month max (safely under Google Cloud's 1M Free Tier)
const DAILY_CHAR_LIMIT = Math.max(1000, Number(process.env.TTS_DAILY_CHAR_LIMIT || 25000));

const VOICE_MAP = {
  "zh-CN": { languageCode: "cmn-CN", name: "cmn-CN-Wavenet-A" },
  th: { languageCode: "th-TH", name: "th-TH-Standard-A" },
  en: { languageCode: "en-US", name: "en-US-Standard-C" }
};

function makeCacheKey(lang, text) {
  const hash = crypto.createHash("sha256").update(`${lang}::${text}`).digest("hex");
  return `v1/${lang}/${hash}.mp3`;
}

async function consumeDailyTtsQuota(chars) {
  try {
    const db = getDatabase();
    const rows = await db.sql`
      INSERT INTO tts_daily_usage (usage_date, char_count, updated_at)
      VALUES (CURRENT_DATE, ${chars}, NOW())
      ON CONFLICT (usage_date) DO UPDATE
        SET char_count = tts_daily_usage.char_count + ${chars},
            updated_at = NOW()
        WHERE tts_daily_usage.char_count + ${chars} <= ${DAILY_CHAR_LIMIT}
      RETURNING char_count
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.error("[tts] Daily quota DB check failed:", err?.message || err);
    // Fail closed if DB check fails so we never accidentally overspend
    return false;
  }
}

async function synthesizeOfficialGoogleTts(text, lang, apiKey) {
  const voice = VOICE_MAP[lang] || VOICE_MAP["zh-CN"];
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: voice.languageCode,
          name: voice.name
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.95
        }
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google Cloud TTS HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data?.audioContent) {
    throw new Error("Empty audioContent from Google Cloud TTS");
  }
  return Buffer.from(data.audioContent, "base64");
}

export default async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const text = String(url.searchParams.get("text") || "").trim().slice(0, MAX_TTS_CHARS);
    const langParam = String(url.searchParams.get("lang") || "zh-CN").toLowerCase();
    if (!text) return new Response("Missing text", { status: 400 });

    const lang = langParam.startsWith("th") ? "th" : langParam.startsWith("en") ? "en" : "zh-CN";
    const cacheKey = makeCacheKey(lang, text);

    // 1. Check Netlify Blobs cache first (free & instant, no Google API call)
    let store = null;
    try {
      store = getStore("tts-audio-cache");
      const cached = await store.get(cacheKey, { type: "arrayBuffer" });
      if (cached && cached.byteLength > 200) {
        return new Response(cached, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-TTS-Cache": "HIT"
          }
        });
      }
    } catch (blobErr) {
      console.error("[tts] Blobs cache read failed:", blobErr?.message || blobErr);
    }

    // 2. Ensure official TTS API key is configured
    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    if (!apiKey) {
      return new Response("TTS provider not configured", {
        status: 501,
        headers: { "Cache-Control": "public, max-age=300" }
      });
    }

    // 3. Anti-abuse: long sentences (> 25 chars) require a logged-in user
    if (text.length > SHORT_PUBLIC_MAX_CHARS) {
      const user = await getUser().catch(() => null);
      if (!user) {
        return new Response("Login required for long TTS", {
          status: 401,
          headers: { "Cache-Control": "no-store" }
        });
      }
    }

    // 4. Enforce strict site-wide daily character cap to stay within Google Cloud Free Tier
    const allowed = await consumeDailyTtsQuota(text.length);
    if (!allowed) {
      return new Response("Daily TTS quota reached", {
        status: 429,
        headers: { "Cache-Control": "no-store" }
      });
    }

    // 5. Synthesize via official Google Cloud Text-to-Speech
    const audioBuf = await synthesizeOfficialGoogleTts(text, lang, apiKey);

    // 6. Persist to Netlify Blobs so the same phrase is never synthesized twice
    if (store) {
      try {
        await store.set(cacheKey, audioBuf, {
          metadata: { lang, chars: text.length }
        });
      } catch (blobErr) {
        console.error("[tts] Blobs cache write failed:", blobErr?.message || blobErr);
      }
    }

    return new Response(audioBuf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-TTS-Cache": "MISS"
      }
    });
  } catch (err) {
    console.error("[tts] Error:", err);
    return new Response("TTS service temporarily unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" }
    });
  }
};

export const config = {
  path: "/api/tts"
};
