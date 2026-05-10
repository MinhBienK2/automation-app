import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe("electron dev script", () => {
  test("builds Electron main once before starting dev watchers", async () => {
    const source = await readFile(path.join(currentDir, "electron-dev.mjs"), "utf8");

    const buildIndex = source.indexOf("await runInitialElectronBuild();");
    const tscWatchIndex = source.indexOf(
      'start("npx", ["tsc", "-p", "tsconfig.electron.json", "--watch", "--preserveWatchOutput"])',
    );
    const viteIndex = source.indexOf('start("npx", ["vite", "--host", "127.0.0.1"])');

    expect(buildIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeLessThan(tscWatchIndex);
    expect(buildIndex).toBeLessThan(viteIndex);
  });
});
