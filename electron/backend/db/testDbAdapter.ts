import { DatabaseSync } from "node:sqlite";
import type { DbAdapter } from "./dbAdapter.js";
import { migrations } from "./migrations/migrations.js";

/**
 * Translate PostgreSQL-style `$n` placeholders into anonymous `?` markers,
 * expanding reused numbers so the bound list matches placeholder occurrences
 * in order. node:sqlite rejects numbered `?n` markers bound positionally.
 */
type SqlParam = null | number | bigint | string | Uint8Array;

function isSqlParam(value: unknown): value is SqlParam {
  return (
    value === null ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "string" ||
    value instanceof Uint8Array
  );
}

function translatePgPlaceholders(sql: string, params: readonly unknown[]): { sql: string; bound: SqlParam[] } {
  const bound: SqlParam[] = [];
  let sawPlaceholder = false;
  const translated = sql.replace(/\$(\d+)/g, (_match, num: string) => {
    sawPlaceholder = true;
    const raw = params[Number(num) - 1];
    const value = raw === undefined ? null : raw;
    if (!isSqlParam(value)) {
      throw new TypeError(`Unsupported SQLite parameter at $${num}: ${typeof value}`);
    }
    bound.push(value);
    return "?";
  });
  if (!sawPlaceholder) {
    for (const raw of params) {
      const value = raw === undefined ? null : raw;
      if (!isSqlParam(value)) {
        throw new TypeError(`Unsupported SQLite parameter: ${typeof value}`);
      }
      bound.push(value);
    }
  }
  return { sql: translated, bound };
}

export class TestDbAdapter implements DbAdapter {
  private db: DatabaseSync;
  ownerId: string | null = "test-user-uuid";
  private inTransaction = false;

  constructor(db?: DatabaseSync) {
    this.db = db ?? new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  static async create(): Promise<TestDbAdapter> {
    const adapter = new TestDbAdapter();
    await adapter.initialize();
    return adapter;
  }

  private async initialize() {
    const conn = {
      type: "postgres" as const,
      query: async (sql: string, params?: unknown[]) => {
        const translated = await this.translateForSqlite(sql);
        return translated === null ? [] : this.query(translated, params);
      },
      async executeTransaction<T>(callback: (conn: any) => Promise<T>) {
        return callback(conn);
      },
    };
    for (const migration of migrations) {
      await migration.up(conn);
    }
    // Create default user so foreign keys are satisfied
    await this.query(
      `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
      ["test-user-uuid", "test@example.com", "hash", "user"]
    );
    // Seed default project for tests
    await this.query(
      `INSERT INTO projects (id, name, description, created_at, updated_at, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ["default-project-uuid", "Main", "Auto-generated default project", new Date().toISOString(), new Date().toISOString(), "test-user-uuid"]
    );
  }

  /**
   * Postgres forms the later migrations use that SQLite does not accept.
   * Returns null when the statement should be skipped entirely.
   */
  private async translateForSqlite(sql: string): Promise<string | null> {
    const trimmed = sql.trim();

    if (/^DROP TABLE IF EXISTS .+ CASCADE/i.test(trimmed)) {
      return trimmed.replace(/\s+CASCADE/i, "");
    }

    const addColumn = /^ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)([\s\S]*)$/i.exec(trimmed);
    if (addColumn) {
      const [, table, column, rest] = addColumn;
      const existing = (await this.query(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
      if (existing.some((entry) => entry.name === column)) return null;
      return `ALTER TABLE ${table} ADD COLUMN ${column}${rest}`;
    }

    return sql;
  }

  // Legacy SQLite compatibility methods for test assertions
  exec(sql: string): void {
    this.db.prepare(sql).run();
  }

  prepare(sql: string) {
    return {
      run: (...params: unknown[]) => {
        const { sql: translated, bound } = translatePgPlaceholders(sql, params);
        return this.db.prepare(translated).run(...bound);
      },
      get: (...params: unknown[]) => {
        const { sql: translated, bound } = translatePgPlaceholders(sql, params);
        return this.db.prepare(translated).get(...bound);
      },
      all: (...params: unknown[]) => {
        const { sql: translated, bound } = translatePgPlaceholders(sql, params);
        return this.db.prepare(translated).all(...bound);
      },
    };
  }

  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes("pg_tables")) {
      return [{ tablename: "migration_log" }] as T[];
    }

    const coalescedSql = sql.replace(
      /COALESCE\((started_at|finished_at),\s*(started_at|finished_at)\)/gi,
      "COALESCE($1, $2)",
    );
    const { sql: translatedSql, bound } = translatePgPlaceholders(coalescedSql, params);

    try {
      const stmt = this.db.prepare(translatedSql);
      const isSelect = /^\s*select/i.test(translatedSql);
      const isPragma = /^\s*pragma/i.test(translatedSql);
      const hasReturning = /returning\s+/i.test(translatedSql);
      if (isSelect || isPragma || hasReturning) {
        return stmt.all(...bound) as T[];
      } else {
        stmt.run(...bound);
        return [];
      }
    } catch (e) {
      console.error("[TestDbAdapter] Error running SQL query:", sql, params, e);
      throw e;
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const { sql: translatedSql, bound } = translatePgPlaceholders(sql, params);
    try {
      const stmt = this.db.prepare(translatedSql);
      const res = stmt.run(...bound);
      return { changes: Number(res.changes) };
    } catch (e) {
      console.error("[TestDbAdapter] Error executing SQL query:", sql, params, e);
      throw e;
    }
  }

  async queryOne<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async transaction<T>(callback: (tx: DbAdapter) => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      return await callback(this);
    }

    this.inTransaction = true;
    this.db.prepare("BEGIN TRANSACTION").run();
    try {
      const result = await callback(this);
      this.db.prepare("COMMIT").run();
      return result;
    } catch (e) {
      this.db.prepare("ROLLBACK").run();
      throw e;
    } finally {
      this.inTransaction = false;
    }
  }
}
