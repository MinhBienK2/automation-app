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
    await runQuery(`DROP INDEX IF EXISTS idx_run_steps_run_step_number`);
    await runQuery(`DROP TABLE IF EXISTS run_steps CASCADE`);
  } else {
    await dbOrPgm.query(`DROP INDEX IF EXISTS idx_run_steps_run_step_number`);
    await dbOrPgm.query(`DROP TABLE IF EXISTS run_steps`);
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
    await runQuery(`
      CREATE TABLE IF NOT EXISTS run_steps (
        id VARCHAR(255) PRIMARY KEY,
        run_id VARCHAR(255) NOT NULL,
        node_id VARCHAR(255),
        step_number INTEGER NOT NULL,
        action_type VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        started_at VARCHAR(255),
        finished_at VARCHAR(255),
        trace_json TEXT,
        error_json TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await runQuery("CREATE INDEX IF NOT EXISTS idx_run_steps_run_step_number ON run_steps(run_id, step_number)");
  } else {
    await dbOrPgm.query(`
      CREATE TABLE IF NOT EXISTS run_steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT,
        step_number INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT,
        trace_json TEXT,
        error_json TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
      );
    `);
    await dbOrPgm.query("CREATE INDEX IF NOT EXISTS idx_run_steps_run_step_number ON run_steps(run_id, step_number)");
  }
}
