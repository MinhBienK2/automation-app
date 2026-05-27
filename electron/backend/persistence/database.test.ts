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
