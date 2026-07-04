import { getDbConnection } from "./lib/db-cli-helper.mjs";
import { migrations } from "../dist-electron/electron/backend/persistence/migrations.js";
import { rollbackMigrations } from "../dist-electron/electron/backend/persistence/migrationRunner.js";
import { runner as pgMigrateRunner } from "node-pg-migrate";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    console.log("[db-rollback] Starting rollback of last migration...");
    
    if (dbInfo.connection.type === "postgres") {
      console.log("[db-rollback] Running PostgreSQL rollback via node-pg-migrate...");
      
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
      
      await pgMigrateRunner({
        databaseUrl: {
          connectionString,
          ssl,
        },
        dir: "dist-electron/migrations",
        direction: "down",
        count: 1,
        migrationsTable: "pgmigrations",
        verbose: true,
      });
    } else {
      console.log("[db-rollback] Running SQLite rollback via custom runner...");
      await rollbackMigrations(dbInfo.connection, migrations);
    }
    
    console.log("[db-rollback] Rollback completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("[db-rollback] Rollback failed:", error);
    process.exit(1);
  } finally {
    if (dbInfo && dbInfo.close) {
      await dbInfo.close();
    }
  }
}

main();
