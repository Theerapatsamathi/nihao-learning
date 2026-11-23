-- Weekly League standings and tier progression
CREATE TABLE IF NOT EXISTS league_members (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Learner',
  tier INTEGER NOT NULL DEFAULT 0,
  last_rolled_week TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_weekly_xp (
  week_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  group_id INTEGER NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL DEFAULT 'Learner',
  xp INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (week_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_weekly_group
  ON league_weekly_xp (week_key, tier, group_id, xp DESC);

CREATE INDEX IF NOT EXISTS idx_league_weekly_user
  ON league_weekly_xp (user_id, week_key DESC);
