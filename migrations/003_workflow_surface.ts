/**
 * A workflow belongs to exactly one Execution Surface.
 *
 * Every workflow that exists today drives a browser, so `web` is the default
 * and the backfill is the default — there is no ambiguous row to interpret.
 * The column is what lets the palette offer desktop actions only where they
 * can run: see ADR-0001 and `docs/domain/desktop/action-family.md`.
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
    await runQuery(
      `ALTER TABLE workflows ADD COLUMN IF NOT EXISTS surface VARCHAR(16) NOT NULL DEFAULT 'web'`,
    );
  } else {
    // SQLite has no ADD COLUMN IF NOT EXISTS; a repeated run must not fail.
    const columns = (await dbOrPgm.query(`PRAGMA table_info(workflows)`)) as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "surface")) {
      await dbOrPgm.query(
        `ALTER TABLE workflows ADD COLUMN surface TEXT NOT NULL DEFAULT 'web'`,
      );
    }
  }
}

export async function down(dbOrPgm: any): Promise<void> {
  const isPgm = typeof dbOrPgm.sql === "function";

  if (isPgm || dbOrPgm.type === "postgres") {
    if (isPgm) {
      dbOrPgm.sql(`ALTER TABLE workflows DROP COLUMN IF EXISTS surface`);
    } else {
      await dbOrPgm.query(`ALTER TABLE workflows DROP COLUMN IF EXISTS surface`);
    }
  } else {
    // SQLite gained DROP COLUMN in 3.35; better-sqlite3 ships well past that.
    await dbOrPgm.query(`ALTER TABLE workflows DROP COLUMN surface`);
  }
}
