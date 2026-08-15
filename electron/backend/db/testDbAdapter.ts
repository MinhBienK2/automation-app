import { DatabaseSync } from "node:sqlite";
import type { DbAdapter } from "./dbAdapter.js";
import { migrations } from "./migrations/migrations.js";

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
    // Reports postgres because that is the branch whose schema these tests are
    // written against — the SQLite branch of the initial migration is the older
    // local shape and has no users table. `translateForSqlite` covers the few
    // postgres-only forms the later migrations use.
    const conn = {
      type: "postgres" as const,
      query: async (sql: string, params?: any[]) => {
        const translated = await this.translateForSqlite(sql);
        return translated === null ? [] : this.query(translated, params);
      },
      executeTransaction: async (callback: (conn: any) => Promise<any>) => {
        return callback(conn);
      },
    };
    // Every migration, not just the initial schema: a test database that
    // stops at 001 lets a column added later look optional, and the failure
    // shows up as a query error deep inside an unrelated test.
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
    let translatedSql = sql.replace(/\$(\d+)/g, "?$1");
    // Also map "?" placeholders if they are used
    const stmt = this.db.prepare(translatedSql);
    return {
      run: (...params: any[]) => {
        const safeParams = params.map((p) => (p === undefined ? null : p));
        return stmt.run(...safeParams);
      },
      get: (...params: any[]) => {
        const safeParams = params.map((p) => (p === undefined ? null : p));
        return stmt.get(...safeParams);
      },
      all: (...params: any[]) => {
        const safeParams = params.map((p) => (p === undefined ? null : p));
        return stmt.all(...safeParams);
      },
    };
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (sql.includes("pg_tables")) {
      return [{ tablename: "migration_log" }];
    }

    let translatedSql = sql.replace(/\$(\d+)/g, "?$1");
    translatedSql = translatedSql.replace(/COALESCE\((started_at|finished_at),\s*(started_at|finished_at)\)/gi, "COALESCE($1, $2)");

    const safeParams = params.map((p) => (p === undefined ? null : p));

    try {
      const stmt = this.db.prepare(translatedSql);
      const isSelect = /^\s*select/i.test(translatedSql);
      const isPragma = /^\s*pragma/i.test(translatedSql);
      const hasReturning = /returning\s+/i.test(translatedSql);
      if (isSelect || isPragma || hasReturning) {
        return stmt.all(...safeParams);
      } else {
        stmt.run(...safeParams);
        return [];
      }
    } catch (e: any) {
      console.error("[TestDbAdapter] Error running SQL query:", sql, params, e);
      throw e;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
    let translatedSql = sql.replace(/\$(\d+)/g, "?$1");
    const safeParams = params.map((p) => (p === undefined ? null : p));
    try {
      const stmt = this.db.prepare(translatedSql);
      const res = stmt.run(...safeParams);
      return { changes: Number(res.changes) };
    } catch (e: any) {
      console.error("[TestDbAdapter] Error executing SQL query:", sql, params, e);
      throw e;
    }
  }

  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const rows = await this.query(sql, params);
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
