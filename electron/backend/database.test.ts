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
