import { DatabaseSync } from "node:sqlite";
import type { DbAdapter } from "./dbAdapter.js";
import { up } from "../../../migrations/001_initial_schema.js";

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
      query: async (sql: string, params?: any[]) => {
        return this.query(sql, params);
      },
      executeTransaction: async (callback: (conn: any) => Promise<any>) => {
        return callback(conn);
      },
    };
    await up(conn);
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

  // Legacy SQLite compatibility methods for test assertions
  exec(sql: string): void {
    this.db.prepare(sql).run();
  }

  /**
   * Translate Postgres-style `$n` placeholders to plain `?` markers. node:sqlite
   * rejects positional binding for numbered `?n` markers, and `$n` may repeat or
   * skip indices, so values are re-collected in marker order.
   */
  private translate(sql: string, params: any[]): { text: string; values: any[] } {
    const values: any[] = [];
    const text = sql.replace(/\$(\d+)/g, (_match, index: string) => {
      const value = params[Number(index) - 1];
      values.push(value === undefined ? null : value);
      return "?";
    });
    return { text, values };
  }

  prepare(sql: string) {
    const { text } = this.translate(sql, []);
    const stmt = this.db.prepare(text);
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

    const translated = this.translate(sql, params);
    let translatedSql = translated.text;
    translatedSql = translatedSql.replace(/COALESCE\((started_at|finished_at),\s*(started_at|finished_at)\)/gi, "COALESCE($1, $2)");

    const safeParams = translated.values;

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
    const { text: translatedSql, values: safeParams } = this.translate(sql, params);
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
