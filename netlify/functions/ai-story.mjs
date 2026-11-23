import {
  Type,
  generateStructuredJson,
  requireAuthAndRateLimit
} from "./_lib/ai-helper.mjs";

const MAX_TOPIC_CHARS = 200;

const STORY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    level: { type: Type.STRING },
    sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            hz: { type: Type.STRING },
            py: { type: Type.STRING },
            th: { type: Type.STRING }
          },
          required: ["hz", "py", "th"]
        }
      }
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          q: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          answer: { type: Type.INTEGER }
        },
        required: ["q", "options", "answer"]
      }
    }
  },
  required: ["title", "level", "sentences", "questions"]
};

const SYSTEM_INSTRUCTION =
  "You create beginner Mandarin Chinese graded micro-readers (HSK 1-2) for Thai learners. " +
  "Generate 4 short, natural Simplified Chinese sentences segmented word-by-word into tokens {hz, py, th}. " +
  'For punctuation tokens like 。，！？ set py and th to "". ' +
  "Also generate 3 multiple-choice comprehension questions in Thai with 4 options each and 0-based integer answer.";

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const gate = await requireAuthAndRateLimit();
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => null);
    const topic = String(body?.topic || "").trim();
    if (!topic) {
      return Response.json({ ok: false, error: "กรุณาระบุหัวข้อเรื่องสั้น" }, { status: 400 });
    }
    if (topic.length > MAX_TOPIC_CHARS) {
      return Response.json(
        { ok: false, error: `หัวข้อยาวเกินไป (สูงสุด ${MAX_TOPIC_CHARS} ตัวอักษร)` },
        { status: 400 }
      );
    }

    const { data: story, model } = await generateStructuredJson({
      contents: `สร้างเรื่องสั้นภาษาจีนระดับ HSK 1-2 จำนวน 4 ประโยค ในหัวข้อ: "${topic}" พร้อมคำถามจับใจความ 3 ข้อเป็นภาษาไทย`,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseSchema: STORY_RESPONSE_SCHEMA,
      validate: (s) =>
        Boolean(
          s &&
            typeof s.title === "string" &&
            Array.isArray(s.sentences) &&
            s.sentences.length > 0 &&
            Array.isArray(s.questions) &&
            s.questions.length > 0
        )
    });

    story.id = "ai_" + Date.now();
    return Response.json(
      { ok: true, model, usage: gate.usage, story },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[ai-story] Error:", err);
    return Response.json(
      { ok: false, error: "ไม่สามารถสร้างเรื่องสั้นด้วย AI ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/ai/story"
};
