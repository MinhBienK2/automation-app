import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { PostgresDbConnection, runMigrations } from "./migrationRunner.js";
import { migrations } from "./migrations.js";

const { Pool } = pg;

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-automation-app";

export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
}

let pool: pg.Pool | null = null;

export async function initializePgPool(dbUrl: string): Promise<pg.Pool> {
  if (pool) {
    await pool.end().catch(() => {});
  }

  let connectionString = dbUrl;
  let ssl: any = { rejectUnauthorized: false };

  try {
    const parsed = new URL(dbUrl);
    const sslmode = parsed.searchParams.get("sslmode");
    const sslParam = parsed.searchParams.get("ssl");

    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("ssl");
    connectionString = parsed.toString();

    if (sslmode === "disable" || sslParam === "false") {
      ssl = false;
    }
  } catch (e) {
    if (dbUrl.includes("sslmode=disable")) {
      ssl = false;
    }
  }

  pool = new Pool({
    connectionString,
    ssl
  });

  // Verify connection
  await pool.query("SELECT 1");

  // Run migrations
  console.log("[pgSync] Running PostgreSQL migrations...");
  const conn = new PostgresDbConnection(pool);
  await runMigrations(conn, migrations);
  console.log("[pgSync] PostgreSQL migrations completed.");

  return pool;
}

export function getPgPool(): pg.Pool | null {
  return pool;
}


export async function authenticateUser(email: string, passwordPlain: string): Promise<{ token: string; user: User } | null> {
  if (!pool) throw new Error("PostgreSQL pool not initialized");

  const result = await pool.query("SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1", [email]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const isValid = bcrypt.compareSync(passwordPlain, row.password_hash);
  if (!isValid) return null;

  const createdAtStr = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : typeof row.created_at === "string"
      ? new Date(row.created_at).toISOString()
      : String(row.created_at || new Date().toISOString());

  const user: User = {
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: createdAtStr
  };

  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });

  return { token, user };
}

export async function verifyToken(token: string): Promise<User | null> {
  if (!pool) throw new Error("PostgreSQL pool not initialized");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; role: "admin" | "user" };
    const result = await pool.query("SELECT id, email, role, created_at FROM users WHERE id = $1", [decoded.sub]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    
    const createdAtStr = row.created_at instanceof Date
      ? row.created_at.toISOString()
      : typeof row.created_at === "string"
        ? new Date(row.created_at).toISOString()
        : String(row.created_at || new Date().toISOString());

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      created_at: createdAtStr
    };
  } catch (error) {
    return null;
  }
}

// User management (admin only)
export async function listUsers(): Promise<User[]> {
  if (!pool) throw new Error("PostgreSQL pool not initialized");
  const result = await pool.query("SELECT id, email, role, created_at FROM users ORDER BY created_at ASC");
  return result.rows.map(row => ({
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: row.created_at.toISOString()
  }));
}

export async function createUser(email: string, passwordPlain: string, role: "admin" | "user"): Promise<User> {
  if (!pool) throw new Error("PostgreSQL pool not initialized");
  const passwordHash = bcrypt.hashSync(passwordPlain, 10);
  const id = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, created_at`,
    [id, email, passwordHash, role]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: row.created_at.toISOString()
  };
}

export async function deleteUser(id: string): Promise<void> {
  if (!pool) throw new Error("PostgreSQL pool not initialized");
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}

// Pull replication: PG -> SQLite
export async function syncPullAll(sqliteDb: DatabaseSync, userId: string): Promise<void> {
  if (!pool) throw new Error("PostgreSQL pool not initialized");

  sqliteDb.exec("PRAGMA foreign_keys = OFF");
  try {
    const tables = [
      "projects", "browser_profiles", "workflows", "subflows",
      "workflow_nodes", "workflow_edges", "subflow_nodes", "subflow_edges",
      "runs", "run_steps", "workflow_schedules", "workflow_schedule_events",
      "operational_attention_events", "workflow_revisions", "subflow_revisions"
    ];

    // Truncate all SQLite user tables
    for (const table of tables) {
      sqliteDb.exec(`DELETE FROM ${table}`);
    }

    // Pull from PostgreSQL and insert into SQLite
    for (const table of tables) {
      const pgResult = await pool.query(`SELECT * FROM ${table} WHERE owner_id = $1`, [userId]);
      if (pgResult.rows.length === 0) continue;

      const columns = Object.keys(pgResult.rows[0]).filter(col => col !== "owner_id");
      const placeholders = columns.map(() => "?").join(", ");
      const insertSql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

      const stmt = sqliteDb.prepare(insertSql);
      for (const row of pgResult.rows) {
        const values = columns.map(col => {
          const val = row[col];
          // Boolean mapping or object mapping
          if (typeof val === "object" && val !== null && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          if (val instanceof Date) {
            return val.toISOString();
          }
          return val;
        });
        stmt.run(...values);
      }
    }
  } finally {
    sqliteDb.exec("PRAGMA foreign_keys = ON");
  }
}

// Push replication: SQLite -> PG
export async function syncPushWrite(sql: string, params: any[], userId: string): Promise<void> {
  if (!pool) return; // Silent no-op if PG is not configured

  // Parse SQL to determine tableName and operation
  const normalizedSql = sql.trim().replace(/\s+/g, " ");
  const insertMatch = normalizedSql.match(/^INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  const updateMatch = normalizedSql.match(/^UPDATE (\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
  const deleteMatch = normalizedSql.match(/^DELETE FROM (\w+)\s+WHERE\s+(.+)$/i);

  if (insertMatch) {
    const tableName = insertMatch[1].toLowerCase();
    if (tableName === "migration_log" || tableName === "app_meta") return;

    const colsStr = insertMatch[2];
    const columns = colsStr.split(",").map(c => c.trim());
    
    // Add owner_id
    const pgColumns = [...columns, "owner_id"];
    const pgParams = [...params, userId];
    const placeholders = pgColumns.map((_, i) => `$${i + 1}`).join(", ");
    
    const pgSql = `INSERT INTO ${tableName} (${pgColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
    await pool.query(pgSql, pgParams).catch(err => {
      console.error(`[pgSync] Error inserting into PG table ${tableName}:`, err);
    });
  } else if (updateMatch) {
    const tableName = updateMatch[1].toLowerCase();
    if (tableName === "migration_log" || tableName === "app_meta") return;

    const setClause = updateMatch[2];
    const whereClause = updateMatch[3];

    // Reconstruct SET clause using pg placeholders $1, $2...
    // SQLite: SET name = ?, description = ? WHERE id = ?
    let paramIndex = 0;
    const pgSet = setClause.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });
    
    // Reconstruct WHERE clause
    const pgWhere = whereClause.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });

    const pgParams = [...params, userId];
    const pgSql = `UPDATE ${tableName} SET ${pgSet} WHERE ${pgWhere} AND owner_id = $${paramIndex + 1}`;
    await pool.query(pgSql, pgParams).catch(err => {
      console.error(`[pgSync] Error updating PG table ${tableName}:`, err);
    });
  } else if (deleteMatch) {
    const tableName = deleteMatch[1].toLowerCase();
    if (tableName === "migration_log" || tableName === "app_meta") return;

    const whereClause = deleteMatch[2];
    let paramIndex = 0;
    const pgWhere = whereClause.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });

    const pgParams = [...params, userId];
    const pgSql = `DELETE FROM ${tableName} WHERE ${pgWhere} AND owner_id = $${paramIndex + 1}`;
    await pool.query(pgSql, pgParams).catch(err => {
      console.error(`[pgSync] Error deleting from PG table ${tableName}:`, err);
    });
  }
}
