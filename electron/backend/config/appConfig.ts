import path from "node:path";

export interface AppConfig {
  mode: "public";
  publicDatabaseUrl?: string;
}

export function getAppConfigPath(rootDir: string): string {
  return path.join(rootDir, "app-config.json");
}

export function loadAppConfig(_rootDir: string): AppConfig {
  return {
    mode: "public",
    publicDatabaseUrl: process.env.DATABASE_URL,
  };
}

export function saveAppConfig(_rootDir: string, _config: AppConfig): void {
  console.log("[appConfig] saveAppConfig is a no-op because database mode is repository-managed.");
}
