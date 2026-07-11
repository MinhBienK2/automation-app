import { getDbConnection } from "./lib/db-cli-helper.mjs";
import { migrations } from "../dist-electron/electron/backend/db/migrations/migrations.js";
import { runMigrations } from "../dist-electron/electron/backend/db/migrations/migrationRunner.js";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    console.log("[db-migrate] Starting migrations...");
    
    console.log(`[db-migrate] Running ${dbInfo.connection.type} migrations via custom runner...`);
    await runMigrations(dbInfo.connection, migrations);
    
    console.log("[db-migrate] Migrations completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("[db-migrate] Migration failed:", error);
    process.exit(1);
  } finally {
    if (dbInfo && dbInfo.close) {
      await dbInfo.close();
    }
  }
}

main();
