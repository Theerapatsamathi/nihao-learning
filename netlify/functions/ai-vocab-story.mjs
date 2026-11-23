import {
  Type,
  generateStructuredJson,
  requireAuthAndRateLimit
} from "./_lib/ai-helper.mjs";

const MAX_WORDS = 15;
const MAX_FIELD_CHARS = 60;

const VOCAB_STORY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hz: { type: Type.STRING },
          py: { type: Type.STRING },
          th: { type: Type.STRING },
          usedWords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["hz", "py", "th", "usedWords"]
      }
    }
  },
  required: ["title", "lines"]
};

const SYSTEM_INSTRUCTION =
  "You are a fun Mandarin Chinese teacher for Thai learners. " +
  "Write a short, engaging 5-6 sentence Chinese mini-story weaving in the provided vocabulary words naturally.";

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const gate = await requireAuthAndRateLimit();
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => null);
    const rawWords = Array.isArray(body?.words) ? body.words.slice(0, MAX_WORDS) : [];
    const words = rawWords
      .filter((w) => w && typeof w === "object" && String(w.hanzi || "").trim())
      .map((w) => ({
        hanzi: String(w.hanzi || "").trim().slice(0, MAX_FIELD_CHARS),
        pinyin: String(w.pinyin || "").trim().slice(0, MAX_FIELD_CHARS),
        meaning: String(w.meaning || "").trim().slice(0, MAX_FIELD_CHARS)
      }));

    if (!words.length) {
      return Response.json({ ok: false, error: "กรุณาส่งรายการคำศัพท์อย่างน้อย 1 คำ" }, { status: 400 });
    }

    const listStr = words.map((w) => `${w.hanzi} (${w.pinyin}: ${w.meaning})`).join(", ");

    const { data: story, model } = await generateStructuredJson({
      contents: `แต่งนิทานหรือบทสนทนาสั้นๆ ภาษาจีนที่สนุกและเป็นธรรมชาติ จำนวน 5-6 ประโยค โดยใช้คำศัพท์ต่อไปนี้ให้มากที่สุด: ${listStr}`,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: VOCAB_STORY_SCHEMA,
      validate: (s) =>
        Boolean(s && typeof s.title === "string" && Array.isArray(s.lines) && s.lines.length > 0)
    });

    return Response.json(
      { ok: true, model, usage: gate.usage, story },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[ai-vocab-story] Error:", err);
    return Response.json(
      { ok: false, error: "ไม่สามารถสร้างนิทานด้วย AI ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/ai/vocab-story"
};
