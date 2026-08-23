// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  areFontsAlreadySetup,
  setupCloakBrowserFonts,
} from "./setupFonts.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("setupFonts", () => {
  describe("areFontsAlreadySetup", () => {
    test("returns false if directory does not exist", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fonts-test-"));
      tempRoots.push(tempDir);
      
      const result = await areFontsAlreadySetup(tempDir);
      expect(result).toBe(false);
    });

    test("returns false if directory exists but has no font files", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fonts-test-"));
      tempRoots.push(tempDir);
      
      const linuxDir = path.join(tempDir, ".local", "cloakbrowser-fonts", "linux");
      await fs.mkdir(linuxDir, { recursive: true });
      await fs.writeFile(path.join(linuxDir, "README.md"), "hello");
      
      const result = await areFontsAlreadySetup(tempDir);
      expect(result).toBe(false);
    });

    test("returns true if directory contains ttf/otf/ttc files", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fonts-test-"));
      tempRoots.push(tempDir);
      
      const linuxDir = path.join(tempDir, ".local", "cloakbrowser-fonts", "linux");
      await fs.mkdir(linuxDir, { recursive: true });
      await fs.writeFile(path.join(linuxDir, "some-font.ttf"), "ttf content");
      
      const result = await areFontsAlreadySetup(tempDir);
      expect(result).toBe(true);
    });
  });

  describe("setupCloakBrowserFonts", () => {
    test("runs apt-get download and extracts packages successfully", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fonts-test-"));
      tempRoots.push(tempDir);

      const runner = vi.fn().mockImplementation(async (cmd) => {
        if (cmd.command === "apt-get") {
          // Simulate downloading a .deb package
          await fs.writeFile(path.join(cmd.cwd, "package1.deb"), "deb content");
        } else if (cmd.command === "dpkg-deb") {
          // Simulate extracting fonts to extractDir
          // cmd.args = ["-x", debPath, extractDir]
          const extractDir = cmd.args[2];
          const fontsDir = path.join(extractDir, "usr", "share", "fonts");
          await fs.mkdir(fontsDir, { recursive: true });
          await fs.writeFile(path.join(fontsDir, "font1.ttf"), "font content");
        }
        return Promise.resolve();
      });

      // Override process.platform during test if not on Linux to ensure it runs
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });

      try {
        await setupCloakBrowserFonts({
          repoRoot: tempDir,
          runner,
          log: () => {},
        });

        // Verify runner called for download, extract, and fc-cache
        expect(runner).toHaveBeenCalled();
        const linuxDir = path.join(tempDir, ".local", "cloakbrowser-fonts", "linux");
        const fontFileExists = await fs.stat(path.join(linuxDir, "font1.ttf")).then(() => true).catch(() => false);
        expect(fontFileExists).toBe(true);

        const readmeExists = await fs.stat(path.join(tempDir, ".local", "cloakbrowser-fonts", "README.md")).then(() => true).catch(() => false);
        expect(readmeExists).toBe(true);
      } finally {
        Object.defineProperty(process, "platform", {
          value: originalPlatform,
          configurable: true,
        });
      }
    });
  });
});
