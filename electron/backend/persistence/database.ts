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

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS browser_profiles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      browser_launch_json TEXT NOT NULL,
      environment_json TEXT NOT NULL DEFAULT '{"variables":[]}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      browser_profile_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      graph_json TEXT NOT NULL,
      settings_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (browser_profile_id) REFERENCES browser_profiles(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS subflows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      graph_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'schedule')),
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

    CREATE INDEX IF NOT EXISTS idx_browser_profiles_project_default
      ON browser_profiles(project_id, is_default);

    CREATE INDEX IF NOT EXISTS idx_subflows_project_updated_at
      ON subflows(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS migration_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_table TEXT NOT NULL,
      target_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      from_version INTEGER,
      to_version INTEGER,
      applied_json TEXT NOT NULL,
      failure_json TEXT
    );

    CREATE TABLE IF NOT EXISTS workflow_nodes (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      action_type TEXT,
      config_version INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      label TEXT,
      notes TEXT,
      subflow_ref TEXT,
      ports_json TEXT NOT NULL DEFAULT '[]',
      ordinal INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (subflow_ref) REFERENCES subflows(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow
      ON workflow_nodes(workflow_id, ordinal);
    CREATE INDEX IF NOT EXISTS idx_workflow_nodes_action_type
      ON workflow_nodes(action_type);
    CREATE INDEX IF NOT EXISTS idx_workflow_nodes_subflow_ref
      ON workflow_nodes(subflow_ref);

    CREATE TABLE IF NOT EXISTS workflow_edges (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      source_handle TEXT,
      target_node_id TEXT NOT NULL,
      target_handle TEXT,
      edge_kind TEXT NOT NULL DEFAULT 'flow',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      ordinal INTEGER NOT NULL,
      FOREIGN KEY (workflow_id)    REFERENCES workflows(id)       ON DELETE CASCADE,
      FOREIGN KEY (source_node_id) REFERENCES workflow_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_node_id) REFERENCES workflow_nodes(id)  ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow
      ON workflow_edges(workflow_id, ordinal);
    CREATE INDEX IF NOT EXISTS idx_workflow_edges_source
      ON workflow_edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_edges_target
      ON workflow_edges(target_node_id);

    CREATE TABLE IF NOT EXISTS subflow_nodes (
      id TEXT PRIMARY KEY,
      subflow_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      action_type TEXT,
      config_version INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      label TEXT,
      notes TEXT,
      subflow_ref TEXT,
      ports_json TEXT NOT NULL DEFAULT '[]',
      ordinal INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (subflow_id) REFERENCES subflows(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_subflow_nodes_subflow
      ON subflow_nodes(subflow_id, ordinal);

    CREATE TABLE IF NOT EXISTS subflow_edges (
      id TEXT PRIMARY KEY,
      subflow_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      source_handle TEXT,
      target_node_id TEXT NOT NULL,
      target_handle TEXT,
      edge_kind TEXT NOT NULL DEFAULT 'flow',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      ordinal INTEGER NOT NULL,
      FOREIGN KEY (subflow_id)      REFERENCES subflows(id)       ON DELETE CASCADE,
      FOREIGN KEY (source_node_id)  REFERENCES subflow_nodes(id)  ON DELETE CASCADE,
      FOREIGN KEY (target_node_id)  REFERENCES subflow_nodes(id)  ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_subflow_edges_subflow
      ON subflow_edges(subflow_id, ordinal);
  `);
  migrateWorkflowSchema(database);
  migrateRunSchema(database);
  migrateBrowserProfileSchema(database);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_workflows_project_updated_at
      ON workflows(project_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_runs_source_started_at
      ON runs(source, started_at DESC);
  `);

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
  if (!columns.has("project_id")) {
    database.exec("ALTER TABLE workflows ADD COLUMN project_id TEXT");
  }
  if (!columns.has("graph_version")) {
    database.exec("ALTER TABLE workflows ADD COLUMN graph_version INTEGER");
  }
  if (!columns.has("viewport_json")) {
    database.exec("ALTER TABLE workflows ADD COLUMN viewport_json TEXT");
  }
  if (!columns.has("migration_notes_json")) {
    database.exec("ALTER TABLE workflows ADD COLUMN migration_notes_json TEXT NOT NULL DEFAULT '[]'");
  }
}

function migrateRunSchema(database: DatabaseSync) {
  const columns = new Set(
    database
      .prepare("PRAGMA table_info(runs)")
      .all()
      .map((row) => (row as { name: string }).name),
  );
  if (!columns.has("source")) {
    database.exec("ALTER TABLE runs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
    database.exec(`
      UPDATE runs
      SET source = 'schedule'
      WHERE id IN (
        SELECT DISTINCT run_id
        FROM workflow_schedule_events
        WHERE event_type = 'started'
          AND run_id IS NOT NULL
      )
    `);
  }
}

function migrateBrowserProfileSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS browser_profiles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      browser_launch_json TEXT NOT NULL,
      environment_json TEXT NOT NULL DEFAULT '{"variables":[]}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  const columns = new Set(
    database
      .prepare("PRAGMA table_info(browser_profiles)")
      .all()
      .map((row) => (row as { name: string }).name),
  );

  if (!columns.has("environment_json")) {
    database.exec("ALTER TABLE browser_profiles ADD COLUMN environment_json TEXT NOT NULL DEFAULT '{\"variables\":[]}'");
  }

  const tables = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => (row as { name: string }).name),
  );

  if (tables.has("project_environments")) {
    database.exec(`
      INSERT OR IGNORE INTO browser_profiles (id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at)
      SELECT id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at
      FROM project_environments;
      DROP TABLE project_environments;
    `);
  }

  const workflowColumns = new Set(
    database
      .prepare("PRAGMA table_info(workflows)")
      .all()
      .map((row) => (row as { name: string }).name),
  );

  if (!workflowColumns.has("browser_profile_id")) {
    database.exec("ALTER TABLE workflows ADD COLUMN browser_profile_id TEXT");
  }

  if (workflowColumns.has("environment_id")) {
    database.exec(`
      UPDATE workflows
      SET browser_profile_id = environment_id
      WHERE browser_profile_id IS NULL AND environment_id IS NOT NULL;
    `);
  }
}
