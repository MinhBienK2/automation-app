import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe("vite config", () => {
  test("uses the product title in the renderer shell", async () => {
    const source = await readFile(path.join(currentDir, "index.html"), "utf8");

    expect(source).toContain("<title>Automation App</title>");
  });

  test("ignores generated output directories during dev watch", async () => {
    const source = await readFile(path.join(currentDir, "vite.config.ts"), "utf8");

    expect(source).toContain('normalized.includes("/src-tauri/")');
    expect(source).toContain('normalized.includes("/.worktrees/")');
    expect(source).toContain('normalized.includes("/dist/")');
    expect(source).toContain('normalized.includes("/dist-electron/")');
    expect(source).toContain('normalized.includes("/release/")');
  });

  test("excludes local agent worktrees from Vitest discovery", async () => {
    const source = await readFile(path.join(currentDir, "vite.config.ts"), "utf8");

    expect(source).toContain('"**/.worktrees/**"');
  });

  test("builds renderer assets with relative paths for Electron file loading", async () => {
    const source = await readFile(path.join(currentDir, "vite.config.ts"), "utf8");

    expect(source).toContain('base: "./"');
  });
});
