CREATE TABLE workflow_settings (
  workflow_id TEXT PRIMARY KEY NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  general_json TEXT NOT NULL,
  execution_json TEXT NOT NULL,
  browser_json TEXT NOT NULL,
  environment_json TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  triggers_json TEXT NOT NULL,
  advanced_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
