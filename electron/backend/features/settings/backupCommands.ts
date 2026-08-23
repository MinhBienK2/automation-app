import path from "node:path";
import { BackupService, type BackupConfig, type BackupFile } from "../settings/backupService.js";
import type { BackupCommandsDeps } from "../types.js";

export function createBackupCommands(deps: BackupCommandsDeps) {
  const service = new BackupService(deps.context.database, deps.context.appPaths);

  return {
    async listBackups(): Promise<BackupFile[]> {
      return await service.listBackups();
    },

    async createBackup(format?: "sql" | "custom"): Promise<BackupFile> {
      return await service.createBackup(format);
    },

    async deleteBackup(filename: string): Promise<{ ok: boolean }> {
      await service.deleteBackup(filename);
      return { ok: true };
    },

    async getBackupConfig(): Promise<BackupConfig> {
      return await service.getBackupConfig();
    },

    async saveBackupConfig(config: BackupConfig): Promise<{ ok: boolean }> {
      await service.saveBackupConfig(config);
      return { ok: true };
    },

    async openBackupsFolder(): Promise<{ ok: boolean }> {
      const backupsDir = path.join(deps.context.appPaths.rootDir, "backups");
      if (deps.context.openPath) {
        await deps.context.openPath(backupsDir);
      }
      return { ok: true };
    },

    async checkAndRunAutomaticBackup(): Promise<void> {
      await service.checkAndRunAutomaticBackup();
    }
  };
}
