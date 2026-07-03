// @vitest-environment node

import { describe, expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SqliteConnection, translatePostgresSql, DatabaseWrapper } from "./dbClient";

describe("Database client SQL translator", () => {
  test("translates SQLite placeholders (?) to PostgreSQL placeholders ($1, $2)", () => {
    const input = "INSERT INTO users (id, name, age) VALUES (?, ?, ?)";
    const expected = "INSERT INTO users (id, name, age) VALUES ($1, $2, $3)";
    expect(translatePostgresSql(input)).toBe(expected);
  });

  test("translates SQLite PRAGMA table_info to PostgreSQL column information_schema", () => {
    const input = "PRAGMA table_info(workflows)";
    const expected = "SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'workflows' AND table_schema = 'public'";
    expect(translatePostgresSql(input)).toBe(expected);
  });

  test("translates SQLite sqlite_master to PostgreSQL tables", () => {
    const input = "SELECT name FROM sqlite_master WHERE type = 'table'";
    const expected = "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'";
    expect(translatePostgresSql(input)).toBe(expected);
  });

  test("translates SQLite conflict clauses", () => {
    const input1 = "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)";
    const expected1 = "INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value";
    expect(translatePostgresSql(input1)).toBe(expected1);

    const input2 = "INSERT OR IGNORE INTO browser_profiles (id, project_id) VALUES (?, ?)";
    const expected2 = "INSERT INTO browser_profiles (id, project_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING";
    expect(translatePostgresSql(input2)).toBe(expected2);
  });
});

describe("DatabaseWrapper", () => {
  test("wraps DatabaseConnection and executes queries through prepare/run/get/all syntax", async () => {
    const db = new DatabaseSync(":memory:");
    const conn = new SqliteConnection(db);
    const wrapper = new DatabaseWrapper(conn);

    await wrapper.exec(`
      CREATE TABLE test_table (
        id TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    const runRes = await wrapper.prepare("INSERT INTO test_table (id, value) VALUES (?, ?)").run("1", "hello");
    expect(runRes.changes).toBe(1);

    const getRes = await wrapper.prepare("SELECT * FROM test_table WHERE id = ?").get("1") as any;
    expect(getRes).toEqual({ id: "1", value: "hello" });

    const allRes = await wrapper.prepare("SELECT * FROM test_table").all();
    expect(allRes).toEqual([{ id: "1", value: "hello" }]);

    db.close();
  });
});

