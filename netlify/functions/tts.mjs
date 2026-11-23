import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const VOICE_MAP = {
  "zh-CN": { languageCode: "cmn-CN", name: "cmn-CN-Wavenet-A" },
  th: { languageCode: "th-TH", name: "th-TH-Standard-A" },
  en: { languageCode: "en-US", name: "en-US-Standard-C" }
};

function makeCacheKey(lang, text) {
  const hash = crypto.createHash("sha256").update(`${lang}::${text}`).digest("hex");
  return `v1/${lang}/${hash}.mp3`;
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
    const text = String(url.searchParams.get("text") || "").trim().slice(0, 200);
    const langParam = String(url.searchParams.get("lang") || "zh-CN").toLowerCase();
    if (!text) return new Response("Missing text", { status: 400 });

    const lang = langParam.startsWith("th") ? "th" : langParam.startsWith("en") ? "en" : "zh-CN";
    const cacheKey = makeCacheKey(lang, text);

    // 1. Check Netlify Blobs cache first (HSK vocab words are finite and reused often)
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

    // 2. Call official Google Cloud Text-to-Speech API if configured
    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    if (!apiKey) {
      // Signal client to fall back to Web Speech API immediately (no unofficial endpoints)
      return new Response("TTS provider not configured", {
        status: 501,
        headers: { "Cache-Control": "public, max-age=300" }
      });
    }

    const audioBuf = await synthesizeOfficialGoogleTts(text, lang, apiKey);

    // 3. Persist generated MP3 to Netlify Blobs so the same word is never synthesized twice
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
