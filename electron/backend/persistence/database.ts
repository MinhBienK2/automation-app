import fs from "node:fs";
import path from "node:path";

export type AppPaths = {
  rootDir: string;
  databasePath: string; // Left for compatibility, but not used for SQLite
  browserProfilesDir: string;
  evidenceDir: string;
  downloadsDir: string;
  screenshotsDir: string;
};

export function createAppPaths(appDataDir: string): AppPaths {
  const rootDir = path.join(appDataDir, "automation-app");

  const paths = {
    rootDir,
    databasePath: path.join(rootDir, "database.sqlite"),
    browserProfilesDir: path.join(rootDir, "browser-profiles"),
    evidenceDir: path.join(rootDir, "evidence"),
    downloadsDir: path.join(rootDir, "downloads"),
    screenshotsDir: path.join(rootDir, "screenshots"),
  };

  ensureAppPaths(paths);
  return paths;
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
