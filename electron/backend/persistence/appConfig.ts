import path from "node:path";

export interface AppConfig {
  mode: "private" | "public";
  publicDatabaseUrl?: string;
}

export function getAppConfigPath(rootDir: string): string {
  return path.join(rootDir, "app-config.json");
}

export function loadAppConfig(_rootDir: string): AppConfig {
  if (process.env.DATABASE_URL) {
    return {
      mode: "public",
      publicDatabaseUrl: process.env.DATABASE_URL,
    };
  }
  return { mode: "private" };
}

export function saveAppConfig(_rootDir: string, _config: AppConfig): void {
  console.log("[appConfig] saveAppConfig is a no-op because database mode is repository-managed.");
}
