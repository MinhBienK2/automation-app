export async function up(dbOrPgm: any): Promise<void> {
  const isPgm = typeof dbOrPgm.sql === "function";

  if (isPgm || dbOrPgm.type === "postgres") {
    const runQuery = async (sql: string) => {
      if (isPgm) {
        dbOrPgm.sql(sql);
      } else {
        await dbOrPgm.query(sql);
      }
    };
    await runQuery(`ALTER TABLE workflows ADD COLUMN IF NOT EXISTS automation_mode VARCHAR(50) NOT NULL DEFAULT 'web';`);
    await runQuery(`ALTER TABLE subflows ADD COLUMN IF NOT EXISTS automation_mode VARCHAR(50) NOT NULL DEFAULT 'web';`);
  } else {
    // SQLite
    const workflowCols = await tableInfo(dbOrPgm, "workflows");
    if (!workflowCols.has("automation_mode")) {
      await dbOrPgm.query("ALTER TABLE workflows ADD COLUMN automation_mode TEXT NOT NULL DEFAULT 'web'");
    }
    const subflowCols = await tableInfo(dbOrPgm, "subflows");
    if (!subflowCols.has("automation_mode")) {
      await dbOrPgm.query("ALTER TABLE subflows ADD COLUMN automation_mode TEXT NOT NULL DEFAULT 'web'");
    }
  }
}

export async function down(dbOrPgm: any): Promise<void> {
  const isPgm = typeof dbOrPgm.sql === "function";

  if (isPgm || dbOrPgm.type === "postgres") {
    const runQuery = async (sql: string) => {
      if (isPgm) {
        dbOrPgm.sql(sql);
      } else {
        await dbOrPgm.query(sql);
      }
    };
    await runQuery(`ALTER TABLE workflows DROP COLUMN IF EXISTS automation_mode;`);
    await runQuery(`ALTER TABLE subflows DROP COLUMN IF EXISTS automation_mode;`);
  } else {
    // SQLite: Try dropping the column, ignore errors if SQLite version is older and doesn't support DROP COLUMN
    try {
      await dbOrPgm.query("ALTER TABLE workflows DROP COLUMN automation_mode");
    } catch (e) {
      // Ignore
    }
    try {
      await dbOrPgm.query("ALTER TABLE subflows DROP COLUMN automation_mode");
    } catch (e) {
      // Ignore
    }
  }
}

async function tableInfo(db: any, table: string): Promise<Set<string>> {
  const rows = await db.query(`PRAGMA table_info(${table})`);
  return new Set(rows.map((row: any) => row.name));
}
