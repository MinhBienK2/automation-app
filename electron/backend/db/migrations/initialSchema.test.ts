// @vitest-environment node

import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import { SqliteDbConnection, runMigrations, rollbackMigrations } from "./migrationRunner.js";
import * as initialSchema from "../../../../migrations/001_initial_schema.js";

describe("001_initial_schema migration", () => {
  test("creates all SQLite tables on up, and drops them on down", async () => {
    const rawDb = new DatabaseSync(":memory:");
    const db = new SqliteDbConnection(rawDb);

    const migrations = [
      {
        name: "001_initial_schema.js",
        up: initialSchema.up,
        down: initialSchema.down
      }
    ];

    // 1. Run UP
    await runMigrations(db, migrations);

    // Verify some tables exist
    const tables = rawDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as any[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "projects",
        "browser_profiles",
        "workflows",
        "subflows",
        "runs",
        "run_steps",
        "workflow_schedules",
        "workflow_schedule_events",
        "operational_attention_events",
        "workflow_nodes",
        "workflow_edges",
        "subflow_nodes",
        "subflow_edges",
        "workflow_revisions",
        "subflow_revisions"
      ])
    );

    // 2. Run DOWN (rollback)
    await rollbackMigrations(db, migrations);

    const tablesAfter = rawDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as any[];
    const tableNamesAfter = tablesAfter.map(t => t.name);
    // Should only have sqlite_sequence and migration_history (or nothing if dropped)
    expect(tableNamesAfter).not.toContain("projects");
    expect(tableNamesAfter).not.toContain("workflows");

    rawDb.close();
  });
});
