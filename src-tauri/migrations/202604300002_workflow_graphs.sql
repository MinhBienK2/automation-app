CREATE TABLE workflow_graphs (
  workflow_id TEXT PRIMARY KEY,
  graph_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
