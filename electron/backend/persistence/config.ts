import fs from "node:fs";
import path from "node:path";
import type { AppPaths } from "./database.js";

export type DbMode = "private" | "publish";

export interface AppConfig {
  dbMode: DbMode;
  postgresUrl: string;
}

export function readAppConfig(paths: AppPaths): AppConfig {
  const configPath = path.join(paths.rootDir, "config.json");
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        dbMode: parsed.dbMode === "publish" ? "publish" : "private",
        postgresUrl: typeof parsed.postgresUrl === "string" ? parsed.postgresUrl : "",
      };
    }
  } catch (error) {
    console.error("Failed to read config.json:", error);
  }
  return { dbMode: "private", postgresUrl: "" };
}

export function writeAppConfig(paths: AppPaths, config: AppConfig): void {
  const configPath = path.join(paths.rootDir, "config.json");
  try {
    fs.mkdirSync(paths.rootDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write config.json:", error);
  }
}
