import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";

const MAX_BODY_BYTES = 256 * 1024; // 256 KB limit

export default async (req) => {
  try {
    const user = await getUser();
    if (!user) {
      return Response.json(
        { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const db = getDatabase();
    const userId = String(user.id || user.sub || "").trim();
    const email = String(user.email || "");
    const fullName = String(user.user_metadata?.full_name || user.email || "Learner");

    if (req.method === "GET") {
      const rows = await db.sql`
        SELECT progress, updated_at FROM user_progress WHERE user_id = ${userId} LIMIT 1
      `;
      const row = rows[0] || null;
      return Response.json(
        {
          ok: true,
          user: { id: userId, email, fullName },
          progress: row ? row.progress : null,
          updatedAt: row ? row.updated_at : null
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (req.method === "POST") {
      const contentLength = Number(req.headers.get("content-length") || 0);
      if (contentLength > MAX_BODY_BYTES) {
        return Response.json(
          { ok: false, error: "ข้อมูลมีขนาดใหญ่เกินกำหนด (สูงสุด 256 KB)" },
          { status: 413, headers: { "Cache-Control": "no-store" } }
        );
      }

      const rawText = await req.text().catch(() => null);
      if (!rawText) {
        return Response.json(
          { ok: false, error: "ข้อมูลไม่ถูกต้อง" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
        return Response.json(
          { ok: false, error: "ข้อมูลมีขนาดใหญ่เกินกำหนด (สูงสุด 256 KB)" },
          { status: 413, headers: { "Cache-Control": "no-store" } }
        );
      }

      let body = null;
      try {
        body = JSON.parse(rawText);
      } catch {
        return Response.json(
          { ok: false, error: "รูปแบบข้อมูล JSON ไม่ถูกต้อง" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return Response.json(
          { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      const progress =
        body.progress && typeof body.progress === "object" && !Array.isArray(body.progress)
          ? body.progress
          : body;

      const jsonStr = JSON.stringify(progress);
      if (Buffer.byteLength(jsonStr, "utf8") > MAX_BODY_BYTES) {
        return Response.json(
          { ok: false, error: "ข้อมูลความคืบหน้ามีขนาดใหญ่เกินกำหนด (สูงสุด 256 KB)" },
          { status: 413, headers: { "Cache-Control": "no-store" } }
        );
      }

      await db.sql`
        INSERT INTO user_progress (user_id, email, full_name, progress, updated_at)
        VALUES (${userId}, ${email}, ${fullName}, ${jsonStr}::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            progress = EXCLUDED.progress,
            updated_at = NOW()
      `;

      return Response.json(
        { ok: true, updatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  } catch (err) {
    console.error("[me-progress] Error:", err);
    return Response.json(
      { ok: false, error: "ไม่สามารถซิงก์ข้อมูลได้ชั่วคราว กรุณาลองใหม่ภายหลัง" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
};

export const config = {
  path: "/api/me/progress"
};
