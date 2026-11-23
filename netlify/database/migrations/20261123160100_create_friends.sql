-- Friends system: friend codes, friendships, and weekly stats
CREATE TABLE IF NOT EXISTS user_friend_codes (
  user_id TEXT PRIMARY KEY,
  friend_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Learner',
  weekly_xp INTEGER NOT NULL DEFAULT 0,
  weekly_key TEXT NOT NULL DEFAULT '',
  streak INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  user_id TEXT NOT NULL,
  friend_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friend_codes_code
  ON user_friend_codes (friend_code);

CREATE INDEX IF NOT EXISTS idx_friendships_user
  ON friendships (user_id, created_at DESC);
