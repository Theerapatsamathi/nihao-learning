import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";
import { DAILY_AI_LIMIT, DEFAULT_MODEL, isAiConfigured } from "./_lib/ai-helper.mjs";

export default async () => {
  let usage = null;
  try {
    const user = await getUser().catch(() => null);
    const userId = String(user?.id || user?.sub || "").trim();
    if (userId) {
      const db = getDatabase();
      const rows = await db.sql`
        SELECT request_count FROM ai_usage
        WHERE user_id = ${userId} AND usage_date = CURRENT_DATE
        LIMIT 1
      `;
      const used = Number(rows?.[0]?.request_count || 0);
      usage = {
        used,
        limit: DAILY_AI_LIMIT,
        remaining: Math.max(0, DAILY_AI_LIMIT - used)
      };
    }
  } catch (err) {
    console.error("[ai-status] Usage lookup skipped:", err?.message || err);
  }

  return Response.json(
    {
      ok: true,
      configured: isAiConfigured(),
      model: DEFAULT_MODEL,
      requiresAuth: true,
      dailyLimit: DAILY_AI_LIMIT,
      usage
    },
    { headers: { "Cache-Control": "no-store" } }
  );
};

export const config = {
  path: "/api/ai/status"
};
