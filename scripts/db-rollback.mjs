import { getDbConnection } from "./lib/db-cli-helper.mjs";
import { migrations } from "../dist-electron/electron/backend/persistence/migrations.js";
import { rollbackMigrations } from "../dist-electron/electron/backend/persistence/migrationRunner.js";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    console.log("[db-rollback] Starting rollback of last migration...");
    await rollbackMigrations(dbInfo.connection, migrations);
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
