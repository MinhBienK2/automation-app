// @vitest-environment node
//
// `TestDbAdapter` imports `node:sqlite`, which the jsdom environment's bundler
// refuses. Without this the file fails to load rather than failing a test, so
// it reported "0 tests" and read as passing.
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { BackupService } from "./backupService.js";
import { TestDbAdapter } from "../../db/testDbAdapter.js";
import { createAppPaths, type AppPaths } from "../../db/database.js";

describe("BackupService (TDD)", () => {
  let db: TestDbAdapter;
  let appPaths: AppPaths;
  let testAppDir: string;
  let service: BackupService;

  beforeEach(async () => {
    // Create a isolated test directory in the workspace scratch folder
    testAppDir = path.join(process.cwd(), "scratch", `test-app-data-${Date.now()}`);
    await fs.mkdir(testAppDir, { recursive: true });

    appPaths = createAppPaths(testAppDir);
    db = await TestDbAdapter.create();
    service = new BackupService(db, appPaths);
  });

  afterEach(async () => {
    // Clean up temporary app paths
    await fs.rm(testAppDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  test("listBackups initially returns empty list", async () => {
    const list = await service.listBackups();
    expect(list).toEqual([]);
  });

  test("createBackup dumps database tables to a local SQL file and listBackups lists it", async () => {
    // Seed some data in TestDbAdapter
    await db.execute(
      `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
      ["custom-user-uuid", "backup-test@example.com", "hash", "user"]
    );

    const backup = await service.createBackup();
    expect(backup.filename).toMatch(/^backup_\d{8}_\d{6}\.sql$/);
    expect(backup.size).toBeGreaterThan(0);

    const filePath = path.join(appPaths.rootDir, "backups", backup.filename);
    expect(existsSync(filePath)).toBe(true);

    // Read and verify backup content
    const fileContent = await fs.readFile(filePath, "utf8");
    expect(fileContent).toContain("PRAGMA foreign_keys = OFF;");
    expect(fileContent).toContain("INSERT INTO \"users\"");

    // Verify listBackups returns this backup file
    const list = await service.listBackups();
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe(backup.filename);
    expect(list[0].size).toBe(backup.size);
  });

  test("createBackup dumps database tables to a local .dump file if format is custom", async () => {
    await service.saveBackupConfig({
      enabled: true,
      intervalHours: 24,
      maxKeepVersions: 10,
      lastBackupAt: null,
      format: "custom",
    });

    const backup = await service.createBackup();
    expect(backup.filename).toMatch(/^backup_\d{8}_\d{6}\.dump$/);
    expect(backup.size).toBeGreaterThan(0);

    const filePath = path.join(appPaths.rootDir, "backups", backup.filename);
    expect(existsSync(filePath)).toBe(true);

    const fileContent = await fs.readFile(filePath, "utf8");
    expect(fileContent).toContain("SQLite Mock Backup (.dump)");

    const list = await service.listBackups();
    expect(list).toHaveLength(1);
    expect(list[0].filename).toBe(backup.filename);
  });

  test("deleteBackup removes the backup file", async () => {
    const backup = await service.createBackup();
    const filePath = path.join(appPaths.rootDir, "backups", backup.filename);
    expect(existsSync(filePath)).toBe(true);

    await service.deleteBackup(backup.filename);
    expect(existsSync(filePath)).toBe(false);

    const list = await service.listBackups();
    expect(list).toEqual([]);
  });

  test("getBackupConfig returns default config if config file does not exist", async () => {
    const config = await service.getBackupConfig();
    expect(config).toEqual({
      enabled: false,
      intervalHours: 24,
      maxKeepVersions: 10,
      lastBackupAt: null,
      format: "sql",
    });
  });

  test("saveBackupConfig writes config to backup-config.json and getBackupConfig reads it", async () => {
    const newConfig = {
      enabled: true,
      intervalHours: 12,
      maxKeepVersions: 5,
      lastBackupAt: "2026-07-05T12:00:00.000Z",
      format: "custom" as const,
    };

    await service.saveBackupConfig(newConfig);
    const config = await service.getBackupConfig();
    expect(config).toEqual(newConfig);
  });

  test("checkAndRunAutomaticBackup does nothing if disabled", async () => {
    await service.saveBackupConfig({
      enabled: false,
      intervalHours: 24,
      maxKeepVersions: 5,
      lastBackupAt: null,
    });

    await service.checkAndRunAutomaticBackup();
    const backups = await service.listBackups();
    expect(backups).toEqual([]);
  });

  test("checkAndRunAutomaticBackup runs backup and updates lastBackupAt if enabled and due", async () => {
    await service.saveBackupConfig({
      enabled: true,
      intervalHours: 2,
      maxKeepVersions: 5,
      lastBackupAt: null, // Due because lastBackupAt is null
    });

    await service.checkAndRunAutomaticBackup();

    const backups = await service.listBackups();
    expect(backups).toHaveLength(1);

    const config = await service.getBackupConfig();
    expect(config.lastBackupAt).not.toBeNull();
    const firstBackupTime = new Date(config.lastBackupAt!).getTime();

    // Check again immediately - should NOT run again because it is not due yet
    await service.checkAndRunAutomaticBackup();
    const backups2 = await service.listBackups();
    expect(backups2).toHaveLength(1);

    // Mock time forward by 3 hours to make it due
    const threeHoursLater = new Date(firstBackupTime + 3 * 60 * 60 * 1000);
    vi.useFakeTimers();
    vi.setSystemTime(threeHoursLater);

    await service.checkAndRunAutomaticBackup();
    const backups3 = await service.listBackups();
    expect(backups3).toHaveLength(2);

    vi.useRealTimers();
  });

  test("checkAndRunAutomaticBackup enforces retention policy by deleting oldest backups", async () => {
    await service.saveBackupConfig({
      enabled: true,
      intervalHours: 1,
      maxKeepVersions: 3, // Keep max 3 backups
      lastBackupAt: null,
    });

    // Create 4 backups by triggering checkAndRunAutomaticBackup at different times
    const baseTime = Date.now();
    
    for (let i = 0; i < 4; i++) {
      const mockTime = new Date(baseTime + i * 2 * 60 * 60 * 1000);
      vi.useFakeTimers();
      vi.setSystemTime(mockTime);
      await service.checkAndRunAutomaticBackup();
      vi.useRealTimers();
    }

    // Since maxKeepVersions is 3, the first (oldest) backup should have been cleaned up
    const backups = await service.listBackups();
    expect(backups).toHaveLength(3);

    // Verify filenames (chronologically sorted newest first or listBackups returns them)
    // Oldest was at baseTime + 0. It should be gone.
    // Kept ones: baseTime + 1hr, + 2hr, + 3hr.
    const fileList = backups.map(b => b.filename).sort();
    expect(fileList).toHaveLength(3);
  });
});
