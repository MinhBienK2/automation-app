CREATE TABLE workflow_browser_configs (
  workflow_id TEXT PRIMARY KEY NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  profile_name TEXT,
  proxy_enabled INTEGER NOT NULL DEFAULT 0,
  proxy_server TEXT,
  proxy_username TEXT,
  proxy_password TEXT,
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  mobile INTEGER NOT NULL DEFAULT 0,
  touch INTEGER NOT NULL DEFAULT 0,
  challenge_policy TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
