CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
