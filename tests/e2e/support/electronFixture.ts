import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { startFixtureServer, type FixtureServer } from "./fixtureServer";

type DesktopFixtures = {
  appDataDir: string;
  electronApp: ElectronApplication;
  appWindow: Page;
  fixtureServer: FixtureServer;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const rendererUrl = process.env.E2E_RENDERER_URL ?? "http://127.0.0.1:1430";

export const test = base.extend<DesktopFixtures>({
  appDataDir: async ({}, use, testInfo) => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), `automation-app-e2e-${testInfo.workerIndex}-`),
    );
    await use(directory);
    await fs.rm(directory, { recursive: true, force: true });
  },

  fixtureServer: async ({}, use) => {
    const server = await startFixtureServer();
    await use(server);
    await server.close();
  },

  electronApp: async ({ appDataDir }, use) => {
    const app = await electron.launch({
      args: [".", "--no-sandbox"],
      cwd: repoRoot,
      env: {
        ...process.env,
        AUTOMATION_APP_DATA_DIR: appDataDir,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
        VITE_DEV_SERVER_URL: rendererUrl,
      },
    });
    await use(app);
    await app.close();
  },

  appWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    const mainNavigation = window.getByRole("navigation", { name: "Main navigation" });
    await expect(mainNavigation).toBeVisible();
    await expect(mainNavigation.getByRole("button", { name: "Workflows", exact: true })).toBeVisible();
    await use(window);
  },
});

export { expect };
