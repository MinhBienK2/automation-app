// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, test } from "vitest";
import { createAppPaths, initializeDatabase } from "./database";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("Electron database initialization", () => {
  test("creates project, environment, and subflow persistence tables", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-db-"));
    tempRoots.push(tempRoot);
    const paths = createAppPaths(tempRoot);

    const database = initializeDatabase(paths);
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    const workflowColumns = database
      .prepare("PRAGMA table_info(workflows)")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining(["projects", "browser_profiles", "subflows"]),
    );
    expect(workflowColumns).toEqual(
      expect.arrayContaining(["project_id", "browser_profile_id"]),
    );
    expect(indexSql(database, "idx_browser_profiles_project_default")).toBe(
      "CREATE INDEX idx_browser_profiles_project_default ON browser_profiles(project_id, is_default)",
    );
    expect(indexSql(database, "idx_workflows_project_updated_at")).toBe(
      "CREATE INDEX idx_workflows_project_updated_at ON workflows(project_id, updated_at DESC)",
    );
    expect(indexSql(database, "idx_subflows_project_updated_at")).toBe(
      "CREATE INDEX idx_subflows_project_updated_at ON subflows(project_id, updated_at DESC)",
    );

    database.close();
  });

  test("creates idempotent indexes for run and schedule lookup queries", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-db-"));
    tempRoots.push(tempRoot);
    const paths = createAppPaths(tempRoot);

    let database = initializeDatabase(paths);
    database.close();
    database = initializeDatabase(paths);

    expect(indexSql(database, "idx_runs_workflow_started_at")).toBe(
      "CREATE INDEX idx_runs_workflow_started_at ON runs(workflow_id, started_at DESC)",
    );
    expect(indexSql(database, "idx_runs_source_started_at")).toBe(
      "CREATE INDEX idx_runs_source_started_at ON runs(source, started_at DESC)",
    );
    expect(indexSql(database, "idx_run_steps_run_step_number")).toBe(
      "CREATE INDEX idx_run_steps_run_step_number ON run_steps(run_id, step_number)",
    );
    expect(indexSql(database, "idx_workflow_schedules_enabled_next_run_at")).toBe(
      "CREATE INDEX idx_workflow_schedules_enabled_next_run_at ON workflow_schedules(enabled, next_run_at)",
    );
    expect(indexSql(database, "idx_workflow_schedule_events_schedule_created_at")).toBe(
      "CREATE INDEX idx_workflow_schedule_events_schedule_created_at ON workflow_schedule_events(schedule_id, created_at DESC)",
    );
    expect(indexSql(database, "idx_workflow_schedule_events_workflow_created_at")).toBe(
      "CREATE INDEX idx_workflow_schedule_events_workflow_created_at ON workflow_schedule_events(workflow_id, created_at DESC)",
    );
    expect(indexSql(database, "idx_operational_attention_events_created_at")).toBe(
      "CREATE INDEX idx_operational_attention_events_created_at ON operational_attention_events(created_at DESC)",
    );
    expect(indexSql(database, "idx_operational_attention_events_workflow_created_at")).toBe(
      "CREATE INDEX idx_operational_attention_events_workflow_created_at ON operational_attention_events(workflow_id, created_at DESC)",
    );

    expect(queryPlan(database, "SELECT id FROM runs WHERE workflow_id = ? ORDER BY started_at DESC", [
      "workflow-1",
    ])).toContain("idx_runs_workflow_started_at");
    expect(queryPlan(database, "SELECT id FROM runs WHERE source = ? ORDER BY started_at DESC", [
      "schedule",
    ])).toContain("idx_runs_source_started_at");
    expect(
      queryPlan(database, "SELECT id FROM run_steps WHERE run_id = ? ORDER BY step_number", [
        "run-1",
      ]),
    ).toContain("idx_run_steps_run_step_number");
    expect(
      queryPlan(
        database,
        `SELECT id FROM workflow_schedules
         WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
         ORDER BY next_run_at ASC`,
        ["2026-05-24T00:00:00.000Z"],
      ),
    ).toContain("idx_workflow_schedules_enabled_next_run_at");
    expect(
      queryPlan(
        database,
        "SELECT id FROM workflow_schedule_events WHERE schedule_id = ? ORDER BY created_at DESC LIMIT 50",
        ["schedule-1"],
      ),
    ).toContain("idx_workflow_schedule_events_schedule_created_at");
    expect(
      queryPlan(
        database,
        "SELECT id FROM workflow_schedule_events WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 50",
        ["workflow-1"],
      ),
    ).toContain("idx_workflow_schedule_events_workflow_created_at");
    expect(
      queryPlan(
        database,
        "SELECT id FROM operational_attention_events ORDER BY created_at DESC LIMIT 50",
        [],
      ),
    ).toContain("idx_operational_attention_events_created_at");

    database.close();
  });

  test("migrates existing workflow tables to the current schema", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-db-"));
    tempRoots.push(tempRoot);
    const paths = createAppPaths(tempRoot);
    await fs.mkdir(paths.rootDir, { recursive: true });
    const legacy = new DatabaseSync(paths.databasePath);
    legacy.exec(`
      CREATE TABLE workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    legacy.close();

    const database = initializeDatabase(paths);
    const columns = database
      .prepare("PRAGMA table_info(workflows)")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual(
      expect.arrayContaining(["description", "tags_json", "settings_json"]),
    );
    expect(() =>
      database
        .prepare("INSERT INTO workflows (id, name, graph_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run("workflow-1", "Legacy", "{}", "1", "1"),
    ).not.toThrow();
    database.close();
  });

  test("migrates legacy run source provenance from schedule events and manual fallback", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-db-"));
    tempRoots.push(tempRoot);
    const paths = createAppPaths(tempRoot);
    await fs.mkdir(paths.rootDir, { recursive: true });
    const legacy = new DatabaseSync(paths.databasePath);
    legacy.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        graph_json TEXT NOT NULL,
        settings_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE runs (
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

      CREATE TABLE workflow_schedules (
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

      CREATE TABLE workflow_schedule_events (
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

      INSERT INTO workflows (id, name, graph_json, created_at, updated_at)
      VALUES ('workflow-1', 'Legacy', '{}', '2026-05-27T00:00:00.000Z', '2026-05-27T00:00:00.000Z');
      INSERT INTO runs (id, workflow_id, status, started_at)
      VALUES ('manual-run', 'workflow-1', 'success', '2026-05-27T01:00:00.000Z');
      INSERT INTO runs (id, workflow_id, status, started_at)
      VALUES ('scheduled-run', 'workflow-1', 'success', '2026-05-27T02:00:00.000Z');
      INSERT INTO workflow_schedules (id, workflow_id, name, enabled, kind_json, created_at, updated_at)
      VALUES ('schedule-1', 'workflow-1', 'Daily', 1, '{}', '2026-05-27T00:00:00.000Z', '2026-05-27T00:00:00.000Z');
      INSERT INTO workflow_schedule_events (
        id, schedule_id, workflow_id, event_type, run_id, scheduled_for, created_at
      ) VALUES (
        'event-1', 'schedule-1', 'workflow-1', 'started', 'scheduled-run',
        '2026-05-27T02:00:00.000Z', '2026-05-27T02:00:01.000Z'
      );
    `);
    legacy.close();

    const database = initializeDatabase(paths);
    const sources = database
      .prepare("SELECT id, source FROM runs ORDER BY id")
      .all() as Array<{ id: string; source: string }>;

    expect(sources).toEqual([
      { id: "manual-run", source: "manual" },
      { id: "scheduled-run", source: "schedule" },
    ]);
    expect(indexSql(database, "idx_runs_source_started_at")).toBe(
      "CREATE INDEX idx_runs_source_started_at ON runs(source, started_at DESC)",
    );
    database.close();
  });

  test("migrates legacy project_environments and workflows to browser_profiles", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-db-"));
    tempRoots.push(tempRoot);
    const paths = createAppPaths(tempRoot);
    await fs.mkdir(paths.rootDir, { recursive: true });
    const legacy = new DatabaseSync(paths.databasePath);
    legacy.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE project_environments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        browser_launch_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        environment_id TEXT,
        name TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO projects (id, name, created_at, updated_at) VALUES ('project-1', 'Main', '1', '1');
      INSERT INTO project_environments (id, project_id, name, browser_launch_json, created_at, updated_at)
      VALUES ('profile-1', 'project-1', 'Profile 1', '{}', '1', '1');
      INSERT INTO workflows (id, project_id, environment_id, name, graph_json, created_at, updated_at)
      VALUES ('workflow-1', 'project-1', 'profile-1', 'Workflow 1', '{}', '1', '1');
    `);
    legacy.close();

    const database = initializeDatabase(paths);
    const profiles = database
      .prepare("SELECT id, name FROM browser_profiles")
      .all() as Array<{ id: string; name: string }>;
    const workflows = database
      .prepare("SELECT id, browser_profile_id FROM workflows")
      .all() as Array<{ id: string; browser_profile_id: string }>;

    expect(profiles).toEqual([{ id: "profile-1", name: "Profile 1" }]);
    expect(workflows).toEqual([{ id: "workflow-1", browser_profile_id: "profile-1" }]);
    database.close();
  });
});

function indexSql(database: DatabaseSync, name: string): string | null {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(name) as { sql: string } | undefined;
  return row?.sql.replace(/\s+/g, " ").trim() ?? null;
}

function queryPlan(database: DatabaseSync, sql: string, params: string[]) {
  return database
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params)
    .map((row) => (row as { detail: string }).detail)
    .join("\n");
}
