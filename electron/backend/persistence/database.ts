import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, StatementSync } from "node:sqlite";
import { syncPushWrite } from "./pgSync.js";
import { SqliteDbConnection, runMigrations } from "./migrationRunner.js";
import { migrations } from "./migrations.js";

export class DatabaseSyncWrapper extends DatabaseSync {
  public ownerId: string | null = null;

  prepare(sql: string): StatementSync {
    const stmt = super.prepare(sql);
    const self = this;
    return new Proxy(stmt, {
      get(target, prop, receiver) {
        if (prop === "run") {
          return function(this: any, ...args: any[]) {
            const result = target.run(...args);
            if (self.ownerId) {
              void syncPushWrite(sql, args, self.ownerId);
            }
            return result;
          };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      }
    }) as unknown as StatementSync;
  }
}

export type AppPaths = {
  rootDir: string;
  databasePath: string;
  browserProfilesDir: string;
  evidenceDir: string;
  downloadsDir: string;
  screenshotsDir: string;
};

export function createAppPaths(appDataDir: string): AppPaths {
  const rootDir = path.join(appDataDir, "automation-app");

  return {
    rootDir,
    databasePath: path.join(rootDir, "database.sqlite"),
    browserProfilesDir: path.join(rootDir, "browser-profiles"),
    evidenceDir: path.join(rootDir, "evidence"),
    downloadsDir: path.join(rootDir, "downloads"),
    screenshotsDir: path.join(rootDir, "screenshots"),
  };
}

function ensureAppPaths(paths: AppPaths) {
  for (const directory of [
    paths.rootDir,
    paths.browserProfilesDir,
    paths.evidenceDir,
    paths.downloadsDir,
    paths.screenshotsDir,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export async function initializeDatabase(paths: AppPaths) {
  ensureAppPaths(paths);
  const database = new DatabaseSyncWrapper(paths.databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  await runMigrations(new SqliteDbConnection(database), migrations);
  return database;
}

/**
 * Drop the legacy graph_json column from workflows and subflows.
 * Must be called AFTER backfillGraphTables has populated the normalized tables.
 * Safe to call multiple times — no-op if the column is already gone.
 */
export function dropGraphJsonColumn(database: DatabaseSync) {
  const workflowColumns = new Set(
    database
      .prepare("PRAGMA table_info(workflows)")
      .all()
      .map((row) => (row as { name: string }).name),
  );
  if (workflowColumns.has("graph_json")) {
    database.exec("ALTER TABLE workflows DROP COLUMN graph_json");
  }

  const subflowColumns = new Set(
    database
      .prepare("PRAGMA table_info(subflows)")
      .all()
      .map((row) => (row as { name: string }).name),
  );
  if (subflowColumns.has("graph_json")) {
    database.exec("ALTER TABLE subflows DROP COLUMN graph_json");
  }
}

