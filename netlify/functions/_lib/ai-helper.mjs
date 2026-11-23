import { GoogleGenAI, Type } from "@google/genai";
import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";

export { Type };

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

export const DAILY_AI_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT || 30));

export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_BASE_URL);
}

/**
 * Verifies Netlify Identity session and atomically enforces daily per-user AI rate limit.
 */
export async function requireAuthAndRateLimit() {
  const user = await getUser().catch(() => null);
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          error: "กรุณาเข้าสู่ระบบก่อนใช้งานฟีเจอร์ AI"
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  const userId = String(user.id || user.sub || "").trim();
  if (!userId) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, code: "AUTH_REQUIRED", error: "ไม่พบข้อมูลบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    };
  }

  try {
    const db = getDatabase();
    const rows = await db.sql`
      INSERT INTO ai_usage (user_id, usage_date, request_count, updated_at)
      VALUES (${userId}, CURRENT_DATE, 1, NOW())
      ON CONFLICT (user_id, usage_date) DO UPDATE
        SET request_count = ai_usage.request_count + 1,
            updated_at = NOW()
        WHERE ai_usage.request_count < ${DAILY_AI_LIMIT}
      RETURNING request_count
    `;

    if (!rows || rows.length === 0) {
      return {
        ok: false,
        response: Response.json(
          {
            ok: false,
            code: "RATE_LIMITED",
            error: `ใช้งาน AI ครบโควตาประจำวันแล้ว (${DAILY_AI_LIMIT} ครั้ง/วัน) กรุณาลองใหม่พรุ่งนี้`,
            limit: DAILY_AI_LIMIT,
            remaining: 0
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        )
      };
    }

    const used = Number(rows[0].request_count || 1);
    return {
      ok: true,
      user: { id: userId, email: String(user.email || "") },
      usage: {
        used,
        limit: DAILY_AI_LIMIT,
        remaining: Math.max(0, DAILY_AI_LIMIT - used)
      }
    };
  } catch (err) {
    console.error("[ai-helper] Rate limit DB check failed:", err);
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "ระบบตรวจสอบโควตา AI ขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      )
    };
  }
}

/**
 * Calls Gemini via Netlify AI Gateway with structured responseSchema and model fallback.
 */
export async function generateStructuredJson({ contents, systemInstruction, responseSchema, validate }) {
  const ai = new GoogleGenAI({});
  let lastErr = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const config = {
        systemInstruction,
        responseMimeType: "application/json"
      };
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const res = await ai.models.generateContent({
        model,
        contents,
        config
      });

      const rawText = (res.text || "").trim();
      if (!rawText) {
        throw new Error("Empty model response");
      }

      const parsed = JSON.parse(rawText);
      if (typeof validate === "function" && !validate(parsed)) {
        throw new Error("Response failed schema validation");
      }

      return { data: parsed, model };
    } catch (err) {
      console.error(`[ai-helper] Model ${model} failed:`, err?.message || err);
      lastErr = err;
    }
  }

  throw lastErr || new Error("All AI models failed");
}
