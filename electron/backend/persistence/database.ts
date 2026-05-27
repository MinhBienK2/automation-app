import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type AppPaths = {
  rootDir: string;
  databasePath: string;
  browserProfilesDir: string;
  evidenceDir: string;
  downloadsDir: string;
  screenshotsDir: string;
};

export function createAppPaths(appDataDir: string): AppPaths {
  const rootDir = path.join(appDataDir, "automation-app");

  return {
    rootDir,
    databasePath: path.join(rootDir, "database.sqlite"),
    browserProfilesDir: path.join(rootDir, "browser-profiles"),
    evidenceDir: path.join(rootDir, "evidence"),
    downloadsDir: path.join(rootDir, "downloads"),
    screenshotsDir: path.join(rootDir, "screenshots"),
  };
}

function ensureAppPaths(paths: AppPaths) {
  for (const directory of [
    paths.rootDir,
    paths.browserProfilesDir,
    paths.evidenceDir,
    paths.downloadsDir,
    paths.screenshotsDir,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function initializeDatabase(paths: AppPaths) {
  ensureAppPaths(paths);
  const database = new DatabaseSync(paths.databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      graph_json TEXT NOT NULL,
      settings_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      settings_snapshot_json TEXT,
      graph_snapshot_json TEXT,
      outputs_json TEXT,
      error_json TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS run_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      node_id TEXT,
      step_number INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      trace_json TEXT,
      error_json TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_schedules (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      kind_json TEXT NOT NULL,
      next_run_at TEXT,
      last_event_at TEXT,
      last_status TEXT,
      last_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_schedule_events (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      workflow_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      run_id TEXT,
      scheduled_for TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reason TEXT,
      details_json TEXT,
      FOREIGN KEY (schedule_id) REFERENCES workflow_schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operational_attention_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL,
      workflow_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      severity TEXT NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_runs_workflow_started_at
      ON runs(workflow_id, started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_run_steps_run_step_number
      ON run_steps(run_id, step_number);

    CREATE INDEX IF NOT EXISTS idx_workflow_schedules_enabled_next_run_at
      ON workflow_schedules(enabled, next_run_at);

    CREATE INDEX IF NOT EXISTS idx_workflow_schedule_events_schedule_created_at
      ON workflow_schedule_events(schedule_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_workflow_schedule_events_workflow_created_at
      ON workflow_schedule_events(workflow_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_operational_attention_events_created_at
      ON operational_attention_events(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_operational_attention_events_workflow_created_at
      ON operational_attention_events(workflow_id, created_at DESC);
  `);
  migrateWorkflowSchema(database);

  return database;
}

function migrateWorkflowSchema(database: DatabaseSync) {
  const columns = new Set(
    database
      .prepare("PRAGMA table_info(workflows)")
      .all()
      .map((row) => (row as { name: string }).name),
  );
  if (!columns.has("description")) {
    database.exec("ALTER TABLE workflows ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("tags_json")) {
    database.exec("ALTER TABLE workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.has("settings_json")) {
    database.exec("ALTER TABLE workflows ADD COLUMN settings_json TEXT");
  }
}
