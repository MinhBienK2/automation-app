import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  createElectronWatchOutputHandler,
  isSuccessfulElectronWatchBuild,
} from "./electron-dev-utils.mjs";

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
    const utilsSource = await readFile(path.join(currentDir, "electron-dev-utils.mjs"), "utf8");

    expect(source).toContain("let electronProcess = null;");
    expect(source).toContain("function restartElectron()");
    expect(source).toContain("function scheduleElectronRestart()");
    expect(source).toContain("const electronWatchOutput = createElectronWatchOutputHandler({");
    expect(source).toContain("onSuccessfulRebuild: () => {");
    expect(source).toContain("if (electronProcess) {");
    expect(source).toContain("scheduleElectronRestart();");
    expect(source).toContain("electronWatchOutput.handleStdoutChunk(chunk);");
    expect(utilsSource).toContain("Found 0 errors");
    expect(utilsSource).toContain("Watching for file changes");
  });

  test("launches the Electron binary directly so restarts do not leave npx wrapper children behind", async () => {
    const source = await readFile(path.join(currentDir, "electron-dev.mjs"), "utf8");

    expect(source).toContain('import electronPath from "electron";');
    expect(source).toContain("electronProcess = start(electronPath, [\".\"], {");
    expect(source).toContain("shell: false");
    expect(source).not.toContain('start("npx", ["electron", "."]');
  });

  test("detects successful Electron watch builds across stdout chunks", () => {
    const events = [];
    const output = createElectronWatchOutputHandler({
      onInitialReady: () => events.push("ready"),
      onSuccessfulRebuild: () => events.push("restart"),
    });

    output.handleStdoutChunk("12:00:00 AM - Found 0 errors. Watch");
    output.handleStdoutChunk("ing for file changes.\n");
    output.handleStdoutChunk("12:00:01 AM - File change detected. Starting incremental compilation...\n");
    output.handleStdoutChunk("12:00:02 AM - Found 0 errors. Watch");
    output.handleStdoutChunk("ing for file changes.\n");

    expect(events).toEqual(["ready", "restart"]);
  });

  test("recognizes TypeScript watch success lines with ANSI formatting", () => {
    expect(
      isSuccessfulElectronWatchBuild(
        "\u001b[32m12:00:00 AM - Found 0 errors. Watching for file changes.\u001b[39m",
      ),
    ).toBe(true);
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
