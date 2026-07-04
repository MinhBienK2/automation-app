// @vitest-environment node

import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import { SqliteDbConnection, runMigrations, rollbackMigrations, checkMigrationsPending } from "./migrationRunner.js";

describe("Database Migration Runner (SQLite)", () => {
  test("runs migrations sequentially and registers them in history", async () => {
    const rawDb = new DatabaseSync(":memory:");
    const db = new SqliteDbConnection(rawDb);

    const testMigrations = [
      {
        name: "001_create_users.js",
        up: async (conn: any) => {
          await conn.query("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)");
        },
        down: async (conn: any) => {
          await conn.query("DROP TABLE users");
        }
      },
      {
        name: "002_add_role.js",
        up: async (conn: any) => {
          await conn.query("ALTER TABLE users ADD COLUMN role TEXT");
        },
        down: async (conn: any) => {
          await conn.query("ALTER TABLE users DROP COLUMN role");
        }
      }
    ];

    // 1. Run migrations
    await runMigrations(db, testMigrations);

    // Verify migration_history table
    const history = rawDb.prepare("SELECT name FROM migration_history ORDER BY id ASC").all() as any[];
    expect(history).toHaveLength(2);
    expect(history[0].name).toBe("001_create_users.js");
    expect(history[1].name).toBe("002_add_role.js");

    // Verify user table has the role column
    const columns = rawDb.prepare("PRAGMA table_info(users)").all() as any[];
    const names = columns.map(c => c.name);
    expect(names).toContain("email");
    expect(names).toContain("role");

    // 2. Rollback migrations
    await rollbackMigrations(db, testMigrations);

    // Verify only first migration is left
    const historyAfterRollback = rawDb.prepare("SELECT name FROM migration_history ORDER BY id ASC").all() as any[];
    expect(historyAfterRollback).toHaveLength(1);
    expect(historyAfterRollback[0].name).toBe("001_create_users.js");

    const columnsAfterRollback = rawDb.prepare("PRAGMA table_info(users)").all() as any[];
    const namesAfterRollback = columnsAfterRollback.map(c => c.name);
    expect(namesAfterRollback).toContain("email");
    expect(namesAfterRollback).not.toContain("role");

    rawDb.close();
  });

  test("checks pending migrations correctly", async () => {
    const rawDb = new DatabaseSync(":memory:");
    const db = new SqliteDbConnection(rawDb);

    const testMigrations = [
      {
        name: "001_create_users.js",
        up: async (conn: any) => {
          await conn.query("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)");
        },
        down: async (conn: any) => {
          await conn.query("DROP TABLE users");
        }
      },
      {
        name: "002_add_role.js",
        up: async (conn: any) => {
          await conn.query("ALTER TABLE users ADD COLUMN role TEXT");
        },
        down: async (conn: any) => {
          await conn.query("ALTER TABLE users DROP COLUMN role");
        }
      }
    ];

    // 1. Fresh database: should return all migrations as pending
    const pendingFresh = await checkMigrationsPending(db, testMigrations);
    expect(pendingFresh).toEqual(["001_create_users.js", "002_add_role.js"]);

    // 2. Apply first migration
    await runMigrations(db, [testMigrations[0]]);

    // Should return only the second migration as pending
    const pendingPartial = await checkMigrationsPending(db, testMigrations);
    expect(pendingPartial).toEqual(["002_add_role.js"]);

    // 3. Apply second migration
    await runMigrations(db, [testMigrations[1]]);

    // Should return no pending migrations
    const pendingFull = await checkMigrationsPending(db, testMigrations);
    expect(pendingFull).toEqual([]);

    rawDb.close();
  });
});
