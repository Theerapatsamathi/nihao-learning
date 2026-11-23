import {
  Type,
  generateStructuredJson,
  requireAuthAndRateLimit
} from "./_lib/ai-helper.mjs";

const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_TURNS = 12;
const MAX_TRANSCRIPT_ITEMS = 30;
const MAX_THAI_CHARS = 300;

const ROLEPLAY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hz: { type: Type.STRING, description: "Natural Simplified Chinese reply in character (1-2 short sentences)." },
    py: { type: Type.STRING, description: "Accurate tone-marked Pinyin for hz." },
    th: { type: Type.STRING, description: "Natural Thai translation of hz." },
    goalsCompleted: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "0-based indices of mission goals the learner has achieved so far."
    },
    hint: {
      type: Type.OBJECT,
      properties: {
        keywords: { type: Type.STRING, description: "Level 1 hint: 2-3 useful Chinese keywords with Pinyin & Thai." },
        py: { type: Type.STRING, description: "Level 2 hint: tone-marked Pinyin of a suggested learner reply." },
        hz: { type: Type.STRING, description: "Level 3 hint: full suggested Simplified Chinese reply." }
      },
      required: ["keywords", "py", "hz"]
    },
    correction: {
      type: Type.STRING,
      description: "Gentle Thai correction if the learner made a mistake, otherwise empty string."
    }
  },
  required: ["hz", "py", "th", "goalsCompleted", "hint", "correction"]
};

const FEEDBACK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fluency: { type: Type.INTEGER, description: "Fluency score 0-100." },
    accuracy: { type: Type.INTEGER, description: "Grammar & word accuracy score 0-100." },
    vocab: { type: Type.INTEGER, description: "Vocabulary range & naturalness score 0-100." },
    summary: { type: Type.STRING, description: "Encouraging 1-2 sentence Thai summary." },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          said: { type: Type.STRING, description: "What the learner said." },
          corrected: { type: Type.STRING, description: "Corrected Simplified Chinese version." },
          py: { type: Type.STRING, description: "Accurate tone-marked Pinyin for corrected." },
          th: { type: Type.STRING, description: "Natural Thai meaning of corrected." },
          betterChoice: { type: Type.STRING, description: "More natural or native-like phrasing in Chinese + Pinyin." },
          note: { type: Type.STRING, description: "Brief Thai explanation of what was improved." }
        },
        required: ["said", "corrected", "py", "th", "betterChoice", "note"]
      }
    }
  },
  required: ["fluency", "accuracy", "vocab", "summary", "items"]
};

const TRANSLATE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hz: { type: Type.STRING, description: "Natural spoken Simplified Chinese sentence." },
    py: { type: Type.STRING, description: "Accurate tone-marked Pinyin for hz." },
    th: { type: Type.STRING, description: "Natural Thai meaning / back-translation." },
    note: { type: Type.STRING, description: "Concise Thai usage, politeness, or pronunciation tip." }
  },
  required: ["hz", "py", "th", "note"]
};

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
    const mode = String(body?.mode || "roleplay").trim();

    // Mode 1: Roleplay (also used by Free Talk when scenario is free-talk)
    if (mode === "roleplay") {
      const message = String(body?.message || "").trim();
      if (!message) {
        return Response.json({ ok: false, error: "กรุณาพูดหรือพิมพ์ข้อความก่อนส่ง" }, { status: 400 });
      }
      if (message.length > MAX_MESSAGE_CHARS) {
        return Response.json(
          { ok: false, error: `ข้อความยาวเกินไป (สูงสุด ${MAX_MESSAGE_CHARS} ตัวอักษร)` },
          { status: 400 }
        );
      }

      const scenario = body?.scenario && typeof body.scenario === "object" ? body.scenario : {};
      const title = String(scenario.title || "สนทนาภาษาจีนทั่วไป").slice(0, 120);
      const aiRole = String(scenario.aiRole || "เพื่อนชาวจีนที่เป็นมิตร").slice(0, 160);
      const brief = String(scenario.brief || "คุยภาษาจีนพื้นฐานอย่างเป็นธรรมชาติ").slice(0, 300);
      const goals = Array.isArray(scenario.goals)
        ? scenario.goals.slice(0, 5).map((g, i) => `${i}: ${String(g?.text || g || "").slice(0, 120)}`)
        : [];

      const systemInstruction =
        `You are a friendly Mandarin Chinese conversation partner for a Thai beginner (HSK 1-2). ` +
        `Scenario: "${title}". Your character: ${aiRole}. Context: ${brief}. ` +
        (goals.length
          ? `Mission goals for the learner: [${goals.join(" | ")}]. ` +
            `Return goalsCompleted as an array of 0-based indices for EVERY goal the learner has achieved across the conversation so far. `
          : `Return goalsCompleted as an empty array []. `) +
        `Stay in character! Reply in 1-2 short natural Simplified Chinese sentences with accurate tone-marked Pinyin and natural Thai translation. ` +
        `Always provide a helpful next-turn hint object (keywords, py, hz) for what the learner could say next, and a gentle Thai correction if needed (else empty string).`;

      const contents = buildConversationContents(body?.history, message);
      const { data: reply, model } = await generateStructuredJson({
        contents,
        systemInstruction,
        responseSchema: ROLEPLAY_RESPONSE_SCHEMA,
        validate: (r) => Boolean(r && typeof r === "object" && typeof r.hz === "string" && r.hz.trim())
      });

      const validGoals = Array.isArray(reply.goalsCompleted)
        ? reply.goalsCompleted.filter((n) => Number.isInteger(n) && n >= 0 && n < Math.max(goals.length, 5))
        : [];

      return Response.json(
        { ok: true, model, usage: gate.usage, reply: { ...reply, goalsCompleted: validGoals } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Mode 2: Post-conversation Feedback Report
    if (mode === "feedback") {
      const rawTranscript = Array.isArray(body?.transcript) ? body.transcript : [];
      const cleanTranscript = rawTranscript
        .slice(-MAX_TRANSCRIPT_ITEMS)
        .filter((t) => t && typeof t === "object" && String(t.text || "").trim())
        .map((t) => `${t.role === "model" ? "AI" : "Learner"}: ${String(t.text).trim().slice(0, MAX_MESSAGE_CHARS)}`);

      if (cleanTranscript.length === 0) {
        return Response.json({ ok: false, error: "ยังไม่มีบทสนทนาสำหรับวิเคราะห์" }, { status: 400 });
      }

      const scenarioTitle = String(body?.scenarioTitle || "การสนทนาภาษาจีน").slice(0, 120);
      const systemInstruction =
        "You are an encouraging Mandarin Chinese speaking coach for Thai learners. " +
        "Review the learner's turns from the conversation transcript. " +
        "Score fluency, accuracy, and vocab (0-100). Write a concise encouraging Thai summary. " +
        "For up to 6 learner sentences, provide the corrected Simplified Chinese, tone-marked Pinyin, Thai meaning, a more natural native phrasing (betterChoice), and a short Thai note.";

      const { data: report, model } = await generateStructuredJson({
        contents: `Scenario: ${scenarioTitle}\nTranscript:\n${cleanTranscript.join("\n")}`,
        systemInstruction,
        responseSchema: FEEDBACK_RESPONSE_SCHEMA,
        validate: (r) => Boolean(r && typeof r === "object" && typeof r.summary === "string" && Array.isArray(r.items))
      });

      return Response.json(
        { ok: true, model, usage: gate.usage, report },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Mode 3: "Ask the teacher" (Thai -> natural spoken Mandarin)
    if (mode === "translate") {
      const text = String(body?.text || "").trim();
      if (!text) {
        return Response.json({ ok: false, error: "กรุณาพิมพ์หรือพูดภาษาไทยที่ต้องการถามครู" }, { status: 400 });
      }
      if (text.length > MAX_THAI_CHARS) {
        return Response.json(
          { ok: false, error: `ข้อความยาวเกินไป (สูงสุด ${MAX_THAI_CHARS} ตัวอักษร)` },
          { status: 400 }
        );
      }

      const systemInstruction =
        "You are a friendly Mandarin Chinese teacher for Thai learners. " +
        "Translate what the learner wants to say in Thai into natural, everyday spoken Simplified Chinese. " +
        "Provide accurate tone-marked Pinyin, natural Thai back-translation, and a short practical Thai tip on usage or pronunciation.";

      const { data: result, model } = await generateStructuredJson({
        contents: `นักเรียนไทยอยากพูดเป็นภาษาจีนว่า: "${text}"`,
        systemInstruction,
        responseSchema: TRANSLATE_RESPONSE_SCHEMA,
        validate: (r) => Boolean(r && typeof r === "object" && typeof r.hz === "string" && r.hz.trim())
      });

      return Response.json(
        { ok: true, model, usage: gate.usage, result },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json({ ok: false, error: "Invalid mode" }, { status: 400 });
  } catch (err) {
    console.error("[ai-speak] Error:", err);
    return Response.json(
      { ok: false, error: "ระบบ AI Speak Studio ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/ai/speak"
};
