import { getUser } from "@netlify/identity";
import { getDatabase } from "@netlify/database";

const MAX_TIER = 9; // 0=Bronze .. 9=Diamond
const GROUP_SIZE = 30;
const PROMOTE_TOP = 7;
const DEMOTE_BOTTOM = 5;
const NO_STORE = { "Cache-Control": "no-store" };

function getIsoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function ensureMemberWithRollover(db, userId, displayName, currentWeek) {
  const existing = await db.sql`
    SELECT user_id, display_name, tier, last_rolled_week
    FROM league_members
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!existing.length) {
    await db.sql`
      INSERT INTO league_members (user_id, display_name, tier, last_rolled_week, updated_at)
      VALUES (${userId}, ${displayName}, 0, ${currentWeek}, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;
    return { tier: 0, promoted: false, demoted: false };
  }

  let { tier, last_rolled_week: lastRolled } = existing[0];
  let promoted = false;
  let demoted = false;

  if (lastRolled && lastRolled < currentWeek) {
    // Lazily compute rollover from the user's most recent prior week
    const prevRows = await db.sql`
      SELECT week_key, tier, group_id
      FROM league_weekly_xp
      WHERE user_id = ${userId} AND week_key < ${currentWeek}
      ORDER BY week_key DESC
      LIMIT 1
    `;
    if (prevRows.length) {
      const prev = prevRows[0];
      const standings = await db.sql`
        SELECT user_id
        FROM league_weekly_xp
        WHERE week_key = ${prev.week_key} AND tier = ${prev.tier} AND group_id = ${prev.group_id}
        ORDER BY xp DESC, updated_at ASC
      `;
      const idx = standings.findIndex((r) => r.user_id === userId);
      const total = standings.length;
      if (idx >= 0) {
        if (idx < PROMOTE_TOP && tier < MAX_TIER) {
          tier = Math.min(MAX_TIER, tier + 1);
          promoted = true;
        } else if (total >= 8 && idx >= total - DEMOTE_BOTTOM && tier > 0) {
          tier = Math.max(0, tier - 1);
          demoted = true;
        }
      }
    }
    await db.sql`
      UPDATE league_members
      SET tier = ${tier}, display_name = ${displayName}, last_rolled_week = ${currentWeek}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } else if (existing[0].display_name !== displayName) {
    await db.sql`
      UPDATE league_members
      SET display_name = ${displayName}, updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  }

  return { tier, promoted, demoted };
}

async function ensureWeeklyEntry(db, userId, displayName, currentWeek, tier, xp = null) {
  const existing = await db.sql`
    SELECT group_id, xp FROM league_weekly_xp
    WHERE week_key = ${currentWeek} AND user_id = ${userId}
    LIMIT 1
  `;

  if (existing.length) {
    const groupId = existing[0].group_id;
    const nextXp = xp !== null ? Math.max(existing[0].xp, xp) : existing[0].xp;
    if (xp !== null) {
      await db.sql`
        UPDATE league_weekly_xp
        SET xp = ${nextXp}, display_name = ${displayName}, updated_at = NOW()
        WHERE week_key = ${currentWeek} AND user_id = ${userId}
      `;
    }
    return { groupId, xp: nextXp };
  }

  // Find a group in this week & tier with < GROUP_SIZE members
  const groups = await db.sql`
    SELECT group_id, COUNT(*)::int AS cnt
    FROM league_weekly_xp
    WHERE week_key = ${currentWeek} AND tier = ${tier}
    GROUP BY group_id
    ORDER BY group_id ASC
  `;

  let groupId = 0;
  let assigned = false;
  for (const g of groups) {
    if (g.cnt < GROUP_SIZE) {
      groupId = g.group_id;
      assigned = true;
      break;
    }
    groupId = g.group_id + 1;
  }
  if (!assigned && groups.length === 0) groupId = 0;

  const initXp = xp !== null ? xp : 0;
  await db.sql`
    INSERT INTO league_weekly_xp (week_key, user_id, group_id, tier, display_name, xp, updated_at)
    VALUES (${currentWeek}, ${userId}, ${groupId}, ${tier}, ${displayName}, ${initXp}, NOW())
    ON CONFLICT (week_key, user_id) DO UPDATE
    SET xp = GREATEST(league_weekly_xp.xp, EXCLUDED.xp),
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
  `;

  return { groupId, xp: initXp };
}

export default async (req) => {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: NO_STORE });
    }

    const user = await getUser();
    if (!user) {
      return Response.json(
        { ok: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งานลีกออนไลน์" },
        { status: 401, headers: NO_STORE }
      );
    }

    const db = getDatabase();
    const userId = String(user.id || user.sub || "").trim();
    const fallbackName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || "Learner").slice(0, 40);
    const currentWeek = getIsoWeekKey();

    let incomingXp = null;
    let displayName = fallbackName;

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return Response.json({ ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400, headers: NO_STORE });
      }
      if (body.xp !== undefined) {
        const parsed = Number(body.xp);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 500000) {
          return Response.json({ ok: false, error: "ค่า XP ไม่ถูกต้อง" }, { status: 400, headers: NO_STORE });
        }
        incomingXp = Math.floor(parsed);
      }
      if (typeof body.displayName === "string" && body.displayName.trim()) {
        displayName = body.displayName.trim().slice(0, 40);
      }
    }

    const { tier, promoted, demoted } = await ensureMemberWithRollover(db, userId, displayName, currentWeek);
    const { groupId, xp } = await ensureWeeklyEntry(db, userId, displayName, currentWeek, tier, incomingXp);

    const rows = await db.sql`
      SELECT user_id, display_name, xp
      FROM league_weekly_xp
      WHERE week_key = ${currentWeek} AND tier = ${tier} AND group_id = ${groupId}
      ORDER BY xp DESC, updated_at ASC
      LIMIT ${GROUP_SIZE}
    `;

    const members = rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.user_id,
      displayName: r.display_name,
      xp: Number(r.xp) || 0,
      isMe: r.user_id === userId
    }));

    return Response.json(
      {
        ok: true,
        weekKey: currentWeek,
        tier,
        groupId,
        myXp: xp,
        promoted,
        demoted,
        promoteTop: PROMOTE_TOP,
        demoteBottom: DEMOTE_BOTTOM,
        members
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[league] Error:", err);
    return Response.json(
      { ok: false, error: "ไม่สามารถเชื่อมต่อลีกได้ชั่วคราว" },
      { status: 500, headers: NO_STORE }
    );
  }
};

export const config = {
  path: "/api/league"
};
