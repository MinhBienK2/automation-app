// @vitest-environment node

import { describe, expect, test } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAppPaths } from "./database";
import { readAppConfig, writeAppConfig } from "./config";

describe("App Config", () => {
  test("reads default config if file does not exist", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
    const paths = createAppPaths(tempRoot);
    const config = readAppConfig(paths);
    expect(config).toEqual({ dbMode: "private", postgresUrl: "" });
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test("writes and reads config correctly", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "app-config-test-"));
    const paths = createAppPaths(tempRoot);
    
    writeAppConfig(paths, { dbMode: "publish", postgresUrl: "postgresql://localhost:5432/mydb" });
    const config = readAppConfig(paths);
    expect(config).toEqual({ dbMode: "publish", postgresUrl: "postgresql://localhost:5432/mydb" });
    
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
});
