import crypto from "node:crypto";
import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_FRIENDS = 50;
const QUEST_TARGET_XP = 500;

function getIsoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function generateFriendCode(userId) {
  const hash = crypto.createHash("sha256").update(`nihao-friend:${userId}`).digest("hex");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "NH";
  for (let i = 0; i < 6; i++) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    out += alphabet[byte % alphabet.length];
  }
  return out;
}

async function ensureUserProfile(db, userId, displayName, currentWeek) {
  const rows = await db.sql`
    SELECT user_id, friend_code, display_name, weekly_xp, weekly_key, streak
    FROM user_friend_codes
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length) {
    return rows[0];
  }
  const code = generateFriendCode(userId);
  await db.sql`
    INSERT INTO user_friend_codes (user_id, friend_code, display_name, weekly_xp, weekly_key, streak, updated_at)
    VALUES (${userId}, ${code}, ${displayName}, 0, ${currentWeek}, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING
  `;
  const created = await db.sql`
    SELECT user_id, friend_code, display_name, weekly_xp, weekly_key, streak
    FROM user_friend_codes
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  return created[0];
}

async function buildFriendsPayload(db, userId, currentWeek) {
  const meRows = await db.sql`
    SELECT user_id, friend_code, display_name, weekly_xp, weekly_key, streak
    FROM user_friend_codes
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const me = meRows[0];
  const myWeeklyXp = me && me.weekly_key === currentWeek ? Number(me.weekly_xp) || 0 : 0;

  const friendRows = await db.sql`
    SELECT u.user_id, u.friend_code, u.display_name, u.weekly_xp, u.weekly_key, u.streak
    FROM friendships f
    JOIN user_friend_codes u ON u.user_id = f.friend_user_id
    WHERE f.user_id = ${userId}
    ORDER BY u.weekly_xp DESC, u.display_name ASC
    LIMIT ${MAX_FRIENDS}
  `;

  const friends = friendRows.map((r) => ({
    userId: r.user_id,
    friendCode: r.friend_code,
    displayName: r.display_name,
    weeklyXp: r.weekly_key === currentWeek ? Number(r.weekly_xp) || 0 : 0,
    streak: Number(r.streak) || 0
  }));

  const friendsWeeklySum = friends.reduce((s, f) => s + f.weeklyXp, 0);
  const combinedXp = myWeeklyXp + friendsWeeklySum;

  return {
    ok: true,
    weekKey: currentWeek,
    me: {
      userId,
      friendCode: me?.friend_code || "",
      displayName: me?.display_name || "Learner",
      weeklyXp: myWeeklyXp,
      streak: Number(me?.streak) || 0
    },
    friends,
    quest: {
      targetXp: QUEST_TARGET_XP,
      combinedXp,
      completed: friends.length > 0 && combinedXp >= QUEST_TARGET_XP
    }
  };
}

export default async (req) => {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: NO_STORE });
    }

    const user = await getUser();
    if (!user) {
      return Response.json(
        { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งานระบบเพื่อน" },
        { status: 401, headers: NO_STORE }
      );
    }

    const db = getDatabase();
    const userId = String(user.id || user.sub || "").trim();
    const fallbackName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || "Learner").slice(0, 40);
    const currentWeek = getIsoWeekKey();

    await ensureUserProfile(db, userId, fallbackName, currentWeek);

    if (req.method === "GET") {
      const payload = await buildFriendsPayload(db, userId, currentWeek);
      return Response.json(payload, { headers: NO_STORE });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400, headers: NO_STORE });
    }

    const action = String(body.action || "").trim();

    if (action === "sync") {
      const weeklyXp = Math.max(0, Math.min(500000, Math.floor(Number(body.weeklyXp) || 0)));
      const streak = Math.max(0, Math.min(5000, Math.floor(Number(body.streak) || 0)));
      const displayName =
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName.trim().slice(0, 40)
          : fallbackName;

      await db.sql`
        UPDATE user_friend_codes
        SET display_name = ${displayName},
            weekly_xp = ${weeklyXp},
            weekly_key = ${currentWeek},
            streak = ${streak},
            updated_at = NOW()
        WHERE user_id = ${userId}
      `;

      const payload = await buildFriendsPayload(db, userId, currentWeek);
      return Response.json(payload, { headers: NO_STORE });
    }

    if (action === "add") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{4,16}$/.test(code)) {
        return Response.json({ ok: false, error: "รหัสเพื่อนไม่ถูกต้อง" }, { status: 400, headers: NO_STORE });
      }

      const targetRows = await db.sql`
        SELECT user_id, display_name FROM user_friend_codes
        WHERE friend_code = ${code}
        LIMIT 1
      `;
      if (!targetRows.length) {
        return Response.json({ ok: false, error: "ไม่พบรหัสเพื่อนนี้ในระบบ" }, { status: 404, headers: NO_STORE });
      }
      const target = targetRows[0];
      if (target.user_id === userId) {
        return Response.json({ ok: false, error: "ไม่สามารถเพิ่มรหัสของตัวเองได้" }, { status: 400, headers: NO_STORE });
      }

      const countRows = await db.sql`
        SELECT COUNT(*)::int AS cnt FROM friendships WHERE user_id = ${userId}
      `;
      if ((countRows[0]?.cnt || 0) >= MAX_FRIENDS) {
        return Response.json({ ok: false, error: "รายชื่อเพื่อนเต็มแล้ว (สูงสุด 50 คน)" }, { status: 400, headers: NO_STORE });
      }

      await db.sql`
        INSERT INTO friendships (user_id, friend_user_id)
        VALUES (${userId}, ${target.user_id}), (${target.user_id}, ${userId})
        ON CONFLICT DO NOTHING
      `;

      const payload = await buildFriendsPayload(db, userId, currentWeek);
      return Response.json({ ...payload, addedName: target.display_name }, { headers: NO_STORE });
    }

    if (action === "remove") {
      const friendUserId = String(body.friendUserId || "").trim();
      if (!friendUserId) {
        return Response.json({ ok: false, error: "ระบุเพื่อนที่ต้องการลบไม่ถูกต้อง" }, { status: 400, headers: NO_STORE });
      }
      await db.sql`
        DELETE FROM friendships
        WHERE (user_id = ${userId} AND friend_user_id = ${friendUserId})
           OR (user_id = ${friendUserId} AND friend_user_id = ${userId})
      `;
      const payload = await buildFriendsPayload(db, userId, currentWeek);
      return Response.json(payload, { headers: NO_STORE });
    }

    return Response.json({ ok: false, error: "ไม่รองรับคำสั่งนี้" }, { status: 400, headers: NO_STORE });
  } catch (err) {
    console.error("[friends] Error:", err);
    return Response.json(
      { ok: false, error: "ไม่สามารถเชื่อมต่อระบบเพื่อนได้ชั่วคราว" },
      { status: 500, headers: NO_STORE }
    );
  }
};

export const config = {
  path: "/api/friends"
};
