import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe("Electron main process", () => {
  test("keeps GPU compositing available while disabling old VAAPI paths on Linux", async () => {
    const source = await readFile(path.join(currentDir, "main.ts"), "utf8");

    expect(source).toContain("configureLinuxGraphicsWorkarounds()");
    expect(source).toContain("disable-features");
    expect(source).toContain("VaapiVideoDecoder,VaapiVideoEncoder");
    expect(source).toContain("disable-accelerated-video-decode");
    expect(source).toContain("disable-accelerated-video-encode");
    expect(source).not.toContain("disableHardwareAcceleration()");
  });

  test("does not open DevTools by default in development", async () => {
    const source = await readFile(path.join(currentDir, "main.ts"), "utf8");

    expect(source).toContain('process.env.ELECTRON_OPEN_DEVTOOLS === "1"');
    expect(source).toContain("mainWindow.webContents.openDevTools");
  });
});
