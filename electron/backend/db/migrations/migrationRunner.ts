import type { DatabaseSync } from "node:sqlite";
import type pg from "pg";

export interface DbConnection {
  type: "sqlite" | "postgres";
  query(sql: string, params?: any[]): Promise<any>;
  executeTransaction(fn: (db: DbConnection) => Promise<void>): Promise<void>;
}

export class SqliteDbConnection implements DbConnection {
  type = "sqlite" as const;

  constructor(private db: DatabaseSync) {}

  async query(sql: string, params: any[] = []): Promise<any> {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA")) {
      return this.db.prepare(sql).all(...params);
    } else {
      const stmt = this.db.prepare(sql);
      const res = stmt.run(...params);
      return res;
    }
  }

  async executeTransaction(fn: (db: DbConnection) => Promise<void>): Promise<void> {
    this.db.prepare("BEGIN TRANSACTION").run();
    try {
      await fn(this);
      this.db.prepare("COMMIT").run();
    } catch (err) {
      this.db.prepare("ROLLBACK").run();
      throw err;
    }
  }
}

export class PostgresDbConnection implements DbConnection {
  type = "postgres" as const;

  constructor(private pool: pg.Pool | pg.Client | pg.PoolClient) {}

  async query(sql: string, params: any[] = []): Promise<any> {
    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  async executeTransaction(fn: (db: DbConnection) => Promise<void>): Promise<void> {
    // If it's a Client, we can run inside the client directly.
    // If it's a Pool, we must acquire a client from the pool to run the transaction.
    const isPool = "connect" in this.pool && typeof this.pool.connect === "function";
    if (isPool) {
      const client = await (this.pool as pg.Pool).connect();
      try {
        await client.query("BEGIN");
        const clientConn = new PostgresDbConnection(client);
        await fn(clientConn);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      const client = this.pool as pg.Client;
      await client.query("BEGIN");
      try {
        await fn(this);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  }
}

export interface Migration {
  name: string;
  up(db: DbConnection): Promise<void>;
  down(db: DbConnection): Promise<void>;
}

export async function runMigrations(db: DbConnection, migrations: Migration[]): Promise<void> {
  // Ensure migration_history table exists
  if (db.type === "sqlite") {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  } else {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Get applied migrations
  const rows = await db.query("SELECT name FROM migration_history ORDER BY id ASC");
  const applied = new Set<string>(rows.map((row: any) => row.name));

  // Run pending migrations
  for (const m of migrations) {
    if (!applied.has(m.name)) {
      console.log(`[migration] Applying migration: ${m.name}`);
      await db.executeTransaction(async (tx) => {
        await m.up(tx);
        if (db.type === "sqlite") {
          await tx.query(
            "INSERT INTO migration_history (name, applied_at) VALUES (?, ?)",
            [m.name, new Date().toISOString()]
          );
        } else {
          await tx.query(
            "INSERT INTO migration_history (name, applied_at) VALUES ($1, DEFAULT)",
            [m.name]
          );
        }
      });
      console.log(`[migration] Applied migration: ${m.name}`);
    }
  }
}

export async function rollbackMigrations(db: DbConnection, migrations: Migration[]): Promise<void> {
  // Ensure migration_history table exists
  const checkTableSql = db.type === "sqlite"
    ? "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_history'"
    : "SELECT tablename FROM pg_tables WHERE tablename='migration_history'";

  const tableRows = await db.query(checkTableSql);
  if (tableRows.length === 0) {
    console.log("[migration] No migration history found. Nothing to rollback.");
    return;
  }

  // Get the last applied migration
  const rows = await db.query("SELECT name FROM migration_history ORDER BY id DESC LIMIT 1");
  if (rows.length === 0) {
    console.log("[migration] No migrations applied to rollback.");
    return;
  }

  const lastName = rows[0].name;
  const m = migrations.find(x => x.name === lastName);
  if (!m) {
    throw new Error(`[migration] Applied migration '${lastName}' not found in the registry`);
  }

  console.log(`[migration] Rolling back migration: ${m.name}`);
  await db.executeTransaction(async (tx) => {
    await m.down(tx);
    if (db.type === "sqlite") {
      await tx.query("DELETE FROM migration_history WHERE name = ?", [m.name]);
    } else {
      await tx.query("DELETE FROM migration_history WHERE name = $1", [m.name]);
    }
  });
  console.log(`[migration] Rolled back migration: ${m.name}`);
}

export async function checkMigrationsPending(db: DbConnection, migrations: Migration[]): Promise<string[]> {
  const checkTableSql = db.type === "sqlite"
    ? "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_history'"
    : "SELECT tablename FROM pg_tables WHERE tablename='migration_history'";

  const tableRows = await db.query(checkTableSql);
  if (tableRows.length === 0) {
    // If migration_history does not exist, all migrations are pending
    return migrations.map(m => m.name);
  }

  // Get applied migrations
  const rows = await db.query("SELECT name FROM migration_history ORDER BY id ASC");
  const applied = new Set<string>(rows.map((row: any) => row.name));

  // Determine pending migrations
  const pending: string[] = [];
  for (const m of migrations) {
    if (!applied.has(m.name)) {
      pending.push(m.name);
    }
  }

  return pending;
}
