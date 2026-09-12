// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fingerprintFontsHash, clearFontsHashCache } from "./fonts";

const tempDirs: string[] = [];

afterEach(async () => {
  clearFontsHashCache();
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function createTempFontsDir() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "browser-fonts-test-"));
  tempDirs.push(rootDir);
  return rootDir;
}

describe("Fonts Hashing and Cache", () => {
  test("computes sha256 hash of font files in directory", async () => {
    const fontsDir = await createTempFontsDir();
    await fs.writeFile(path.join(fontsDir, "font1.ttf"), "font-content-1");
    await fs.writeFile(path.join(fontsDir, "font2.otf"), "font-content-2");
    await fs.writeFile(path.join(fontsDir, "ignored.txt"), "ignored-text");

    const hash = await fingerprintFontsHash(fontsDir);
    expect(hash).not.toBeNull();
    expect(hash).toHaveLength(64); // hex sha256
  });

  test("caches font hash and avoids subsequent disk reads", async () => {
    const fontsDir = await createTempFontsDir();
    await fs.writeFile(path.join(fontsDir, "font1.ttf"), "font-content-1");

    // First call - should read from disk
    const readdirSpy = vi.spyOn(fs, "readdir");
    const readFileSpy = vi.spyOn(fs, "readFile");

    const firstHash = await fingerprintFontsHash(fontsDir);
    expect(firstHash).not.toBeNull();
    expect(readdirSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledTimes(1);

    // Reset spy counters
    readdirSpy.mockClear();
    readFileSpy.mockClear();

    // Second call - should hit cache and NOT call fs methods
    const secondHash = await fingerprintFontsHash(fontsDir);
    expect(secondHash).toBe(firstHash);
    expect(readdirSpy).not.toHaveBeenCalled();
    expect(readFileSpy).not.toHaveBeenCalled();

    // Clear cache and call again - should read from disk again
    clearFontsHashCache();
    const thirdHash = await fingerprintFontsHash(fontsDir);
    expect(thirdHash).toBe(firstHash);
    expect(readdirSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledTimes(1);

    readdirSpy.mockRestore();
    readFileSpy.mockRestore();
  });

  test("returns null for empty or null inputs", async () => {
    expect(await fingerprintFontsHash(null)).toBeNull();
    expect(await fingerprintFontsHash(undefined)).toBeNull();
    expect(await fingerprintFontsHash("   ")).toBeNull();
  });
});
