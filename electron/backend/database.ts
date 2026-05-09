import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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

export function ensureAppPaths(paths: AppPaths) {
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

export function initializeDatabase(paths: AppPaths) {
  ensureAppPaths(paths);
  const database = new DatabaseSync(paths.databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      graph_json TEXT NOT NULL,
      settings_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      settings_snapshot_json TEXT,
      graph_snapshot_json TEXT,
      outputs_json TEXT,
      error_json TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

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

  return database;
}
