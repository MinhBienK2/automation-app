// @vitest-environment node

import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Electron main process", () => {
  test("keeps GPU compositing available while disabling old VAAPI paths on Linux", async () => {
    const source = await readMainSource();

    expect(source).toContain("configureLinuxGraphicsWorkarounds()");
    expect(source).toContain("disable-features");
    expect(source).toContain("VaapiVideoDecoder,VaapiVideoEncoder");
    expect(source).toContain("disable-accelerated-video-decode");
    expect(source).toContain("disable-accelerated-video-encode");
    expect(source).not.toContain("disableHardwareAcceleration()");
  });

  test("does not open DevTools by default in development", async () => {
    const source = await readMainSource();

    expect(source).toContain('process.env.ELECTRON_OPEN_DEVTOOLS === "1"');
    expect(source).toContain("mainWindow.webContents.openDevTools");
  });

  test("keeps renderer sandbox enabled with isolated preload bridge", async () => {
    const source = await readMainSource();

    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("sandbox: true");
    expect(source).toContain('path.join(currentDir, "preload.cjs")');
  });

  test("uses the app logo for the Electron window icon in dev and production", async () => {
    const source = await readMainSource();

    expect(source).toContain("function getAppIconPath()");
    expect(source).toContain('path.join(app.getAppPath(), "public/app-logo.png")');
    expect(source).toContain('path.join(app.getAppPath(), "dist/app-logo.png")');
    expect(source).toContain("app.isPackaged");
    expect(source).toContain("icon: getAppIconPath()");
  });

  test("blocks unexpected renderer navigation and new windows", async () => {
    const source = await readMainSource();

    expect(source).toContain("setWindowOpenHandler");
    expect(source).toContain('action: "deny"');
    expect(source).toContain('"will-navigate"');
    expect(source).toContain("preventDefault()");
  });

  test("declares a renderer content security policy", async () => {
    const source = await fs.readFile(path.join(process.cwd(), "index.html"), "utf8");

    expect(source).toContain('http-equiv="Content-Security-Policy"');
    expect(source).toContain("default-src 'self'");
    expect(source).toContain("object-src 'none'");
  });
});

function readMainSource() {
  return fs.readFile(path.join(process.cwd(), "electron/main.ts"), "utf8");
}
