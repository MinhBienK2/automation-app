import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe("electron dev script", () => {
  test("builds Electron main once before starting dev watchers", async () => {
    const source = await readFile(path.join(currentDir, "electron-dev.mjs"), "utf8");

    const buildIndex = source.indexOf("await runInitialElectronBuild();");
    const tscWatchIndex = source.indexOf("const tscWatch = start(");
    const viteIndex = source.indexOf('start("npx", ["vite", "--host", "127.0.0.1"');

    expect(buildIndex).toBeGreaterThan(-1);
    expect(tscWatchIndex).toBeGreaterThan(-1);
    expect(viteIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeLessThan(tscWatchIndex);
    expect(buildIndex).toBeLessThan(viteIndex);
  });

  test("restarts Electron after Electron main or preload rebuilds", async () => {
    const source = await readFile(path.join(currentDir, "electron-dev.mjs"), "utf8");

    expect(source).toContain("let electronProcess = null;");
    expect(source).toContain("function restartElectron()");
    expect(source).toContain("function scheduleElectronRestart()");
    expect(source).toContain("let electronWatchReady = false;");
    expect(source).toContain("Found 0 errors. Watching for file changes.");
  });

  test("uses an available renderer port instead of binding to a possibly stale dev server", async () => {
    const source = await readFile(path.join(currentDir, "electron-dev.mjs"), "utf8");

    expect(source).toContain('import net from "node:net";');
    expect(source).toContain("async function findAvailablePort");
    expect(source).toContain("const rendererPort = await findAvailablePort(1420);");
    expect(source).toContain(
      '["vite", "--host", "127.0.0.1", "--port", String(rendererPort), "--strictPort"]',
    );
  });
});
