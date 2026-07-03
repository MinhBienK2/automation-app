// @vitest-environment node

import { describe, expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { PostgresSyncService } from "./postgresSync";

describe("PostgresSyncService settings validation", () => {
  test("returns not enabled by default", () => {
    const service = new PostgresSyncService({
      dbMode: "private",
      postgresUrl: "",
    });
    expect(service.isEnabled()).toBe(false);
  });

  test("returns enabled when dbMode is publish and url is configured", () => {
    const service = new PostgresSyncService({
      dbMode: "publish",
      postgresUrl: "postgresql://localhost:5432/test",
    });
    expect(service.isEnabled()).toBe(true);
  });
});

describe("PostgresSyncService operations", () => {
  test("publishes entity with correct SQL and variables", async () => {
    const service = new PostgresSyncService({
      dbMode: "publish",
      postgresUrl: "postgresql://localhost:5432/test",
    });

    const queries: { sql: string; vals: any[] }[] = [];
    (service as any).client = {
      query: async (sql: string, vals: any[]) => {
        queries.push({ sql, vals });
        return { rows: [], rowCount: 1 };
      },
    };

    await service.publishEntity("projects", ["id"], {
      id: "proj-1",
      name: "My project",
      description: "Desc",
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toBe(
      "INSERT INTO projects (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, description = $3"
    );
    expect(queries[0].vals).toEqual(["proj-1", "My project", "Desc"]);
  });

  test("deletes entity with correct SQL and variables", async () => {
    const service = new PostgresSyncService({
      dbMode: "publish",
      postgresUrl: "postgresql://localhost:5432/test",
    });

    const queries: { sql: string; vals: any[] }[] = [];
    (service as any).client = {
      query: async (sql: string, vals: any[]) => {
        queries.push({ sql, vals });
        return { rows: [], rowCount: 1 };
      },
    };

    await service.deleteEntity("projects", ["id"], ["proj-1"]);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toBe("DELETE FROM projects WHERE id = $1");
    expect(queries[0].vals).toEqual(["proj-1"]);
  });
});

import { createSyncInterceptor } from "./postgresSync";

describe("createSyncInterceptor", () => {
  test("intercepts database writes and sends them to Postgres client", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE tbl (id TEXT, val TEXT)");

    const service = new PostgresSyncService({
      dbMode: "publish",
      postgresUrl: "postgresql://localhost:5432/test",
    });
    const queries: { sql: string; vals: any[] }[] = [];
    (service as any).client = {
      query: async (sql: string, vals: any[]) => {
        queries.push({ sql, vals });
        return { rows: [] };
      },
    };

    const intercepted = createSyncInterceptor(db, service);

    // Write operation
    intercepted.prepare("INSERT INTO tbl (id, val) VALUES (?, ?)").run("1", "hello");
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toBe("INSERT INTO tbl (id, val) VALUES ($1, $2)");
    expect(queries[0].vals).toEqual(["1", "hello"]);

    // Read operation (should not be replicated)
    intercepted.prepare("SELECT * FROM tbl WHERE id = ?").all("1");
    expect(queries).toHaveLength(1); // Still 1

    db.close();
  });
});


