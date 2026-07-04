import type pg from "pg";

export interface DbAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number }>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  transaction<T>(fn: (db: DbAdapter) => Promise<T>): Promise<T>;
  ownerId: string | null;
}

export class PgDbAdapter implements DbAdapter {
  public ownerId: string | null = null;

  constructor(
    private readonly pool: pg.Pool | pg.PoolClient | pg.Client,
    ownerId?: string | null,
  ) {
    this.ownerId = ownerId ?? null;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
    const res = await this.pool.query(sql, params);
    return { changes: res.rowCount ?? 0 };
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const res = await this.pool.query(sql, params);
    return res.rows[0] ?? null;
  }

  async transaction<T>(fn: (db: DbAdapter) => Promise<T>): Promise<T> {
    const isPool = "connect" in this.pool && typeof this.pool.connect === "function";
    if (isPool) {
      const client = await (this.pool as pg.Pool).connect();
      try {
        await client.query("BEGIN");
        const clientAdapter = new PgDbAdapter(client, this.ownerId);
        const result = await fn(clientAdapter);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      const client = this.pool as pg.Client | pg.PoolClient;
      await client.query("BEGIN");
      try {
        const result = await fn(this);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  }
}
