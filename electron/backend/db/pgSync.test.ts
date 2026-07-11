// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from "vitest";
import { initializePgPool } from "./pgSync.js";
import { runMigrations } from "./migrations/migrationRunner.js";

vi.mock("pg", () => {
  const queryMock = vi.fn().mockResolvedValue({ rows: [] });
  const poolMock = {
    query: queryMock,
    end: vi.fn().mockResolvedValue(undefined),
  };
  class Pool {
    query = queryMock;
    end = poolMock.end;
  }
  return {
    default: {
      Pool,
    },
  };
});

vi.mock("./migrations/migrationRunner.js", () => {
  return {
    PostgresDbConnection: class {},
    runMigrations: vi.fn(),
  };
});

describe("pgSync initializePgPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initializePgPool should verify connection but NOT run migrations", async () => {
    const pool = await initializePgPool("postgresql://localhost:5432/test");

    expect(pool).toBeDefined();
    expect(pool.query).toHaveBeenCalledWith("SELECT 1");
    expect(runMigrations).not.toHaveBeenCalled();
  });
});
