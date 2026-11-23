import {
  Type,
  generateStructuredJson,
  requireAuthAndRateLimit
} from "./_lib/ai-helper.mjs";

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_TURNS = 10;
const MAX_FOCUS_WORDS = 5;

const ROLEPLAY_SCENARIOS = {
  restaurant:
    "Roleplay scenario: You are a friendly waiter/barista at a Chinese restaurant & bubble tea shop in Shanghai. " +
    "Help the Thai customer order food, adjust sweetness/ice, and pay. Stay in character!",
  shopping:
    "Roleplay scenario: You are a friendly shopkeeper at a night market in Beijing. " +
    "Let the Thai tourist ask prices, bargain politely, and pay with Alipay/WeChat Pay. Stay in character!",
  taxi:
    "Roleplay scenario: You are a helpful taxi driver in China. " +
    "Ask the Thai passenger where they want to go, confirm directions, and mention the fare. Stay in character!",
  hotel:
    "Roleplay scenario: You are a polite hotel front-desk receptionist in China. " +
    "Help the Thai guest check in, ask for passport, explain breakfast & Wi-Fi. Stay in character!"
};

const TUTOR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hz: { type: Type.STRING, description: "Natural Simplified Chinese reply (1-2 short sentences)." },
    py: { type: Type.STRING, description: "Accurate tone-marked Pinyin for hz." },
    th: { type: Type.STRING, description: "Natural Thai translation of hz." },
    tip: { type: Type.STRING, description: "Brief Thai grammar or pronunciation tip." },
    correction: { type: Type.STRING, description: "Gentle Thai correction if the learner made a mistake, otherwise empty string." }
  },
  required: ["hz", "py", "th", "tip", "correction"]
};

const PRONUNCIATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "Estimated pronunciation accuracy score from 0 to 100." },
    summary: { type: Type.STRING, description: "Short, encouraging Thai assessment comparing target vs heard." },
    mouthTip: { type: Type.STRING, description: "Concrete Thai tongue/lip/tone coaching tip for Thai speakers." },
    drill: { type: Type.STRING, description: "A short 1-line practice cue (e.g. Pinyin breakdown with tone hints)." }
  },
  required: ["score", "summary", "mouthTip", "drill"]
};

const BASE_SYSTEM_INSTRUCTION =
  "You are a warm, encouraging Mandarin Chinese tutor for Thai beginners (HSK 1-2). " +
  "Remember the conversation context and respond naturally in simple Simplified Chinese (1-2 short sentences). " +
  "Provide accurate tone-marked Pinyin, a natural Thai translation, a brief Thai grammar/pronunciation tip, " +
  "and a gentle Thai correction if the learner made a mistake (otherwise empty string).";

function buildSystemInstruction(rawFocusWords, scenarioId) {
  let instruction = BASE_SYSTEM_INSTRUCTION;

  if (scenarioId && ROLEPLAY_SCENARIOS[scenarioId]) {
    instruction += " " + ROLEPLAY_SCENARIOS[scenarioId];
  }

  if (Array.isArray(rawFocusWords) && rawFocusWords.length > 0) {
    const clean = rawFocusWords
      .slice(0, MAX_FOCUS_WORDS)
      .filter((w) => w && typeof w === "object" && String(w.hanzi || "").trim())
      .map((w) => {
        const hz = String(w.hanzi || "").trim().slice(0, 30);
        const py = String(w.pinyin || "").trim().slice(0, 40);
        const th = String(w.meaning || "").trim().slice(0, 50);
        return `${hz}${py ? ` (${py}` : ""}${th ? `: ${th}` : ""}${py ? ")" : ""}`;
      });
    if (clean.length) {
      instruction +=
        ` The learner is currently reviewing these target words: ${clean.join(", ")}. ` +
        "When natural, weave 1 of these target words into your reply or ask a simple follow-up question that encourages them to use one.";
    }
  }

  return instruction;
}

function buildConversationContents(history, message) {
  const contents = [];

  if (Array.isArray(history)) {
    const recent = history.slice(-MAX_HISTORY_TURNS);
    for (const turn of recent) {
      if (!turn || typeof turn !== "object") continue;
      const role = turn.role === "model" ? "model" : "user";
      const text = String(turn.text || "").trim().slice(0, MAX_MESSAGE_CHARS);
      if (!text) continue;

      if (contents.length === 0 && role !== "user") continue;
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += "\n" + text;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }
  }

  if (contents.length > 0 && contents[contents.length - 1].role === "user") {
    contents[contents.length - 1].parts[0].text += "\n" + message;
  } else {
    contents.push({ role: "user", parts: [{ text: message }] });
  }

  return contents;
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const gate = await requireAuthAndRateLimit();
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => null);

    // Mode 1: AI Pronunciation Coach
    if (body?.mode === "pronunciation") {
      const targetHz = String(body?.targetHz || "").trim().slice(0, 80);
      const targetPy = String(body?.targetPy || "").trim().slice(0, 120);
      const heardHz = String(body?.heardHz || "").trim().slice(0, 80);
      if (!targetHz || !heardHz) {
        return Response.json({ ok: false, error: "ข้อมูลคำเป้าหมายหรือเสียงที่ได้ยินไม่ครบ" }, { status: 400 });
      }

      const pronInstruction =
        "You are a Mandarin Chinese pronunciation coach specializing in Thai native speakers. " +
        "Compare the target Chinese phrase with what Chinese speech recognition heard. " +
        "Identify likely consonant (e.g. zh/ch/sh vs z/c/s, j/q/x, r), vowel (e.g. ü), or tone issues, " +
        "and give practical, encouraging tongue/lip/tone tips in clear Thai.";

      const { data: coaching, model } = await generateStructuredJson({
        contents: `Target: "${targetHz}" (Pinyin: ${targetPy || "N/A"})\nSpeech recognition heard: "${heardHz}"\nAnalyze the pronunciation for a Thai learner.`,
        systemInstruction: pronInstruction,
        responseSchema: PRONUNCIATION_RESPONSE_SCHEMA,
        validate: (c) => Boolean(c && typeof c === "object" && typeof c.summary === "string" && typeof c.mouthTip === "string")
      });

      return Response.json(
        { ok: true, model, usage: gate.usage, coaching },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Mode 2: Multi-turn Tutor / Roleplay Chat
    const message = String(body?.message || "").trim();
    if (!message) {
      return Response.json({ ok: false, error: "กรุณาพิมพ์ข้อความก่อนส่ง" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return Response.json(
        { ok: false, error: `ข้อความยาวเกินไป (สูงสุด ${MAX_MESSAGE_CHARS} ตัวอักษร)` },
        { status: 400 }
      );
    }

    const scenarioId = typeof body?.scenario === "string" ? body.scenario.trim() : "";
    const contents = buildConversationContents(body?.history, message);
    const systemInstruction = buildSystemInstruction(body?.focusWords, scenarioId);

    const { data: reply, model } = await generateStructuredJson({
      contents,
      systemInstruction,
      responseSchema: TUTOR_RESPONSE_SCHEMA,
      validate: (r) =>
        Boolean(r && typeof r === "object" && typeof r.hz === "string" && r.hz.trim().length > 0)
    });

    return Response.json(
      { ok: true, model, usage: gate.usage, reply },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[ai-tutor] Error:", err);
    return Response.json(
      { ok: false, error: "ครู AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/ai/tutor"
};
