import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import pg from "pg";
import { DatabaseSync } from "node:sqlite";
import { loadEnv } from "./lib/db-cli-helper.mjs";
import { PgDbAdapter } from "../dist-electron/electron/backend/db/dbAdapter.js";
import { TestDbAdapter } from "../dist-electron/electron/backend/db/testDbAdapter.js";
import { migrateAllGraphs } from "../dist-electron/electron/backend/db/migrations/migrateAllGraphs.js";

async function main() {
  loadEnv();

  try {
    if (process.env.DATABASE_URL) {
      console.log("[db-migrate-graphs] Connecting to PostgreSQL...");
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

      const pool = new pg.Pool({ connectionString, ssl });
      const adapter = new PgDbAdapter(pool);

      // Query all users to migrate graphs for each owner
      const users = await adapter.query("SELECT id, email FROM users");
      console.log(`[db-migrate-graphs] Found ${users.length} users in PostgreSQL.`);

      for (const user of users) {
        console.log(`[db-migrate-graphs] Migrating graphs for user ${user.email} (${user.id})...`);
        const userAdapter = new PgDbAdapter(pool, user.id);
        const report = await migrateAllGraphs(userAdapter);
        console.log(`[db-migrate-graphs] Migration report for ${user.email}:`, report);
      }

      await pool.end();
    } else {
      // Local SQLite
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

      const dbPath = path.join(appDataDir, "automation-app", "database.sqlite");
      if (!fs.existsSync(dbPath)) {
        console.log(`[db-migrate-graphs] SQLite database file not found at ${dbPath}. Skipping graph migration.`);
        process.exit(0);
      }

      console.log(`[db-migrate-graphs] Connecting to SQLite database at ${dbPath}...`);
      const rawDb = new DatabaseSync(dbPath);
      const adapter = new TestDbAdapter(rawDb);
      adapter.ownerId = "test-user-uuid";

      console.log(`[db-migrate-graphs] Migrating graphs for SQLite...`);
      const report = await migrateAllGraphs(adapter);
      console.log(`[db-migrate-graphs] Migration report:`, report);

      rawDb.close();
    }

    console.log("[db-migrate-graphs] Graph migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("[db-migrate-graphs] Graph migration failed:", error);
    process.exit(1);
  }
}

main();
