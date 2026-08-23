/**
 * Desktop Targets: the project-owned description of an application a desktop
 * workflow drives.
 *
 * Shaped after `browser_profiles`, because it is the same relationship to a
 * project — and deliberately *not* named a profile. A Desktop Target owns no
 * storage: desktop applications do not accept a private profile directory, so
 * there is no directory column and never will be. See
 * `docs/domain/desktop/desktop-target.md`.
 *
 * `pid` and `window_id` are absent for the same reason: they are a Window
 * Binding, resolved fresh every run, and storing them would invite a workflow
 * to act on last week's window.
 */

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
    await runQuery(`
      CREATE TABLE IF NOT EXISTS desktop_targets (
        id VARCHAR(255) PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        launch_json TEXT NOT NULL,
        window_json TEXT NOT NULL DEFAULT '{}',
        accessibility_json TEXT,
        observed_tier VARCHAR(16),
        created_at VARCHAR(255) NOT NULL,
        updated_at VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await runQuery(
      `CREATE INDEX IF NOT EXISTS idx_desktop_targets_project ON desktop_targets (project_id, owner_id)`,
    );
    await runQuery(
      `ALTER TABLE workflows ADD COLUMN IF NOT EXISTS desktop_target_id VARCHAR(255)`,
    );
    return;
  }

  await dbOrPgm.query(`
    CREATE TABLE IF NOT EXISTS desktop_targets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      launch_json TEXT NOT NULL,
      window_json TEXT NOT NULL DEFAULT '{}',
      accessibility_json TEXT,
      observed_tier TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  await dbOrPgm.query(
    `CREATE INDEX IF NOT EXISTS idx_desktop_targets_project ON desktop_targets (project_id)`,
  );

  // SQLite has no ADD COLUMN IF NOT EXISTS; a repeated run must not fail.
  const columns = (await dbOrPgm.query(`PRAGMA table_info(workflows)`)) as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "desktop_target_id")) {
    await dbOrPgm.query(`ALTER TABLE workflows ADD COLUMN desktop_target_id TEXT`);
  }
}

export async function down(dbOrPgm: any): Promise<void> {
  const isPgm = typeof dbOrPgm.sql === "function";

  if (isPgm || dbOrPgm.type === "postgres") {
    const runQuery = (sql: string) => (isPgm ? dbOrPgm.sql(sql) : dbOrPgm.query(sql));
    await runQuery(`ALTER TABLE workflows DROP COLUMN IF EXISTS desktop_target_id`);
    await runQuery(`DROP TABLE IF EXISTS desktop_targets`);
    return;
  }

  await dbOrPgm.query(`ALTER TABLE workflows DROP COLUMN desktop_target_id`);
  await dbOrPgm.query(`DROP TABLE IF EXISTS desktop_targets`);
}
