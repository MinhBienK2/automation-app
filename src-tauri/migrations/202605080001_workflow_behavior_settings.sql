ALTER TABLE workflow_settings
ADD COLUMN behavior_json TEXT NOT NULL DEFAULT '{}';
