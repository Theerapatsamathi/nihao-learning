import {
  Type,
  generateStructuredJson,
  requireAuthAndRateLimit
} from "./_lib/ai-helper.mjs";

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_TURNS = 10;
const MAX_FOCUS_WORDS = 5;

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

const BASE_SYSTEM_INSTRUCTION =
  "You are a warm, encouraging Mandarin Chinese tutor for Thai beginners (HSK 1-2). " +
  "Remember the conversation context and respond naturally in simple Simplified Chinese (1-2 short sentences). " +
  "Provide accurate tone-marked Pinyin, a natural Thai translation, a brief Thai grammar/pronunciation tip, " +
  "and a gentle Thai correction if the learner made a mistake (otherwise empty string).";

function buildSystemInstruction(rawFocusWords) {
  if (!Array.isArray(rawFocusWords) || rawFocusWords.length === 0) {
    return BASE_SYSTEM_INSTRUCTION;
  }
  const clean = rawFocusWords
    .slice(0, MAX_FOCUS_WORDS)
    .filter((w) => w && typeof w === "object" && String(w.hanzi || "").trim())
    .map((w) => {
      const hz = String(w.hanzi || "").trim().slice(0, 30);
      const py = String(w.pinyin || "").trim().slice(0, 40);
      const th = String(w.meaning || "").trim().slice(0, 50);
      return `${hz}${py ? ` (${py}` : ""}${th ? `: ${th}` : ""}${py ? ")" : ""}`;
    });
  if (!clean.length) return BASE_SYSTEM_INSTRUCTION;
  return (
    BASE_SYSTEM_INSTRUCTION +
    ` The learner is currently reviewing these target words: ${clean.join(", ")}. ` +
    "When natural, weave 1 of these target words into your reply or ask a simple follow-up question that encourages them to use one."
  );
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

    const contents = buildConversationContents(body?.history, message);
    const systemInstruction = buildSystemInstruction(body?.focusWords);

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
