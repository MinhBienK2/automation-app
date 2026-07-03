import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import { SqliteDbConnection, PostgresDbConnection } from "../../dist-electron/electron/backend/persistence/migrationRunner.js";

export function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

export async function getDbConnection() {
  loadEnv();
  
  if (process.env.DATABASE_URL) {
    console.log("[db-cli] Connecting to PostgreSQL database...");
    let connectionString = process.env.DATABASE_URL;
    let ssl = { rejectUnauthorized: false };

    try {
      const parsed = new URL(process.env.DATABASE_URL);
      const sslmode = parsed.searchParams.get("sslmode");
      const sslParam = parsed.searchParams.get("ssl");

      parsed.searchParams.delete("sslmode");
      parsed.searchParams.delete("ssl");
      connectionString = parsed.toString();

      if (sslmode === "disable" || sslParam === "false") {
        ssl = false;
      }
    } catch (e) {
      if (process.env.DATABASE_URL.includes("sslmode=disable") || process.env.DATABASE_URL.includes("ssl=false")) {
        ssl = false;
      }
    }

    const pool = new pg.Pool({
      connectionString,
      ssl
    });
    await pool.query("SELECT 1");
    return {
      connection: new PostgresDbConnection(pool),
      close: async () => { await pool.end(); }
    };
  } else {
    // Determine local SQLite path
    let appDataDir = "";
    if (process.platform === "win32") {
      appDataDir = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    } else if (process.platform === "darwin") {
      appDataDir = path.join(os.homedir(), "Library", "Application Support");
    } else {
      appDataDir = path.join(os.homedir(), ".config");
    }
    
    if (process.env.AUTOMATION_APP_DATA_DIR) {
      appDataDir = process.env.AUTOMATION_APP_DATA_DIR;
    }
    
    const dbDir = path.join(appDataDir, "automation-app");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, "database.sqlite");
    console.log(`[db-cli] Connecting to SQLite database at ${dbPath}...`);
    
    const rawDb = new DatabaseSync(dbPath);
    rawDb.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
    
    return {
      connection: new SqliteDbConnection(rawDb),
      close: async () => { rawDb.close(); }
    };
  }
}
