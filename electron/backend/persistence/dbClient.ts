import { DatabaseSync } from "node:sqlite";
import pg from "pg";

export interface QueryResult {
  rows: any[];
  changes?: number;
}

export interface DatabaseConnection {
  exec(sql: string): Promise<void>;
  query(sql: string, params?: any[]): Promise<QueryResult>;
  close(): Promise<void>;
}

export class SqliteConnection implements DatabaseConnection {
  constructor(private readonly db: DatabaseSync) {}

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    // Check if query is read/write
    const isPragmaInfo = sql.trim().startsWith("PRAGMA table_info");
    const isPragma = sql.trim().toUpperCase().startsWith("PRAGMA ");
    const isSelect = sql.trim().toUpperCase().startsWith("SELECT") || isPragmaInfo;
    
    const stmt = this.db.prepare(sql);
    if (isSelect) {
      const rows = stmt.all(...params);
      return { rows };
    } else {
      if (isPragma) {
        stmt.run(...params);
        return { rows: [] };
      }
      const result = stmt.run(...params);
      return {
        rows: [],
        changes: typeof result.changes === "bigint" ? Number(result.changes) : result.changes,
      };

    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class PostgresConnection implements DatabaseConnection {
  private client: pg.Client;

  constructor(connectionString: string) {
    this.client = new pg.Client({ connectionString });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async exec(sql: string): Promise<void> {
    const translated = translatePostgresSql(sql);
    await this.client.query(translated);
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const translated = translatePostgresSql(sql);
    
    // Normalize params: PostgreSQL expects boolean for tinyint, etc.
    // If table checks or special queries, handle here if needed.
    const res = await this.client.query(translated, params);
    return {
      rows: res.rows,
      changes: res.rowCount ?? undefined,
    };
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

export function translatePostgresSql(sql: string): string {
  let translated = sql;

  // 1. Translate BEGIN IMMEDIATE to BEGIN
  if (translated.trim().toUpperCase() === "BEGIN IMMEDIATE") {
    return "BEGIN";
  }

  // 2. Translate SQLite conflict clauses to PostgreSQL compatibility
  if (translated.includes("INSERT OR REPLACE INTO app_meta")) {
    translated = translated.replace(
      /INSERT OR REPLACE INTO app_meta\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i,
      "INSERT INTO app_meta ($1) VALUES ($2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
    );
  }

  if (translated.includes("INSERT OR IGNORE INTO browser_profiles")) {
    translated = translated.replace(
      /INSERT OR IGNORE INTO browser_profiles\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i,
      "INSERT INTO browser_profiles ($1) VALUES ($2) ON CONFLICT (id) DO NOTHING"
    );
  }

  // 3. PRAGMA table_info(tableName) -> Postgres columns query
  if (translated.trim().startsWith("PRAGMA table_info")) {
    const match = translated.match(/PRAGMA table_info\((.*?)\)/i);
    if (match && match[1]) {
      const tableName = match[1].trim();
      return `SELECT column_name AS name FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public'`;
    }
  }

  // 4. sqlite_master -> pg tables information schema
  if (translated.includes("FROM sqlite_master")) {
    translated = translated.replace(
      /SELECT name FROM sqlite_master WHERE type\s*=\s*'table'/gi,
      "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'"
    );
  }

  // 5. INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY
  translated = translated.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");

  // 6. Translate placeholders: ? to $1, $2...
  let paramIndex = 1;
  translated = translated.replace(/\?/g, () => `$${paramIndex++}`);

  return translated;
}

export class DatabaseWrapper {
  constructor(private readonly connection: DatabaseConnection) {}

  async exec(sql: string): Promise<void> {
    await this.connection.exec(sql);
  }

  prepare(sql: string) {
    return {
      run: async (...params: any[]) => {
        const result = await this.connection.query(sql, params);
        return {
          changes: result.changes ?? 0,
        };
      },
      get: async (...params: any[]) => {
        const result = await this.connection.query(sql, params);
        return result.rows[0] ?? null;
      },
      all: async (...params: any[]) => {
        const result = await this.connection.query(sql, params);
        return result.rows;
      },
    };
  }
}

