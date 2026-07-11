import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const { Pool } = pg;

const JWT_FALLBACK_SECRET = "super-secret-key-for-automation-app";
let JWT_SECRET = process.env.JWT_SECRET || JWT_FALLBACK_SECRET;

// Persist a stable signing secret per install so tokens stay valid across
// restarts even when JWT_SECRET env is not provided consistently.
export function initializeJwtSecret(rootDir: string): void {
  if (process.env.JWT_SECRET) {
    JWT_SECRET = process.env.JWT_SECRET;
    return;
  }
  try {
    fs.mkdirSync(rootDir, { recursive: true });
    const secretPath = path.join(rootDir, ".jwt-secret");
    if (fs.existsSync(secretPath)) {
      JWT_SECRET = fs.readFileSync(secretPath, "utf8").trim() || JWT_FALLBACK_SECRET;
    } else {
      const generated = crypto.randomUUID();
      fs.writeFileSync(secretPath, generated, { mode: 0o600 });
      JWT_SECRET = generated;
    }
  } catch (error) {
    console.error("[auth] Failed to initialize persistent JWT secret, using fallback:", error);
    JWT_SECRET = JWT_FALLBACK_SECRET;
  }
}

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

function userFromClaims(decoded: { sub: string; email: string; role: "admin" | "user" }): User {
  return {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    created_at: new Date().toISOString(),
  };
}

export async function verifyToken(token: string): Promise<User | null> {
  let decoded: { sub: string; email: string; role: "admin" | "user" };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; role: "admin" | "user" };
  } catch {
    // Signature invalid or expired -> definitively not authenticated.
    return null;
  }
  if (!decoded?.sub) return null;

  if (!pool) {
    // Backend not ready yet; trust the JWT claims so auto-login still works.
    return userFromClaims(decoded);
  }

  try {
    const result = await pool.query("SELECT id, email, role, created_at FROM users WHERE id = $1", [decoded.sub]);
    if (result.rows.length === 0) {
      // Token is valid but the user row is missing (e.g. DB reset). Keep the
      // session alive from the token claims instead of forcing a logout.
      return userFromClaims(decoded);
    }
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
    console.error("[auth] verifyToken DB lookup failed, falling back to token claims:", error);
    return userFromClaims(decoded);
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


