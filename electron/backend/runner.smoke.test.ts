// @vitest-environment node

import fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { defaultWorkflowSettings } from "./commands";
import { createAppPaths } from "./database";
import { BrowserWorkflowRunner } from "./runner";

const tempRoots: string[] = [];
const describeSmoke = process.env.RUN_CLOAKBROWSER_SMOKE === "1" ? describe : describe.skip;
const headedDisplayAvailable =
  process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describeSmoke("CloakBrowser smoke", () => {
  test(
    "launches headless with stealth signals and persistent identity storage",
    async () => {
      const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-smoke-"));
      tempRoots.push(tempRoot);
      const appPaths = createAppPaths(tempRoot);
      const runner = new BrowserWorkflowRunner({ appPaths });
      const { server, url: fixtureUrl } = await createFixtureServer();
      const settings = defaultWorkflowSettings({
        id: "workflow-smoke",
        name: "Smoke",
        step_count: 0,
        created_at: "2026-05-09T00:00:00.000Z",
        updated_at: "2026-05-09T00:00:00.000Z",
      });
      const smokeSettings = {
        ...settings,
        run_policy: { ...settings.run_policy, browser_retention: "close" as const },
        browser_launch: {
          ...settings.browser_launch,
          headless: true,
          profile_dir: "smoke-identity",
          profile_name: "smoke-identity",
          fingerprint_seed: "38291",
          timezone: "America/New_York",
          locale: "en-US",
          viewport_width: 1280,
          viewport_height: 720,
          device_scale_factor: 1,
        },
      };

      try {
        const firstResult = await runner.run({
          graph: {
            steps: [
              {
                node_id: "open",
                label: "Open fixture",
                config: { type: "navigate", config: { url: fixtureUrl } },
              },
              {
                node_id: "persist",
                label: "Persist storage",
                config: {
                  type: "set_local_storage",
                  config: { key: "smoke-key", value: "persisted" },
                },
              },
              {
                node_id: "extract",
                label: "Extract heading",
                config: {
                  type: "extract_text",
                  config: { xpath: "#title", output_name: "title" },
                },
              },
              {
                node_id: "probe",
                label: "Probe browser signals",
                config: {
                  type: "execute_js",
                  config: {
                    script: browserProbeScript(),
                    output_name: "probe",
                    timeout_ms: 1000,
                  },
                },
              },
            ],
          },
          settings: smokeSettings,
          mode: "run_workflow",
        });

        const secondResult = await runner.run({
          graph: {
            steps: [
              {
                node_id: "open",
                label: "Open fixture",
                config: { type: "navigate", config: { url: fixtureUrl } },
              },
              {
                node_id: "probe",
                label: "Probe browser signals",
                config: {
                  type: "execute_js",
                  config: {
                    script: browserProbeScript(),
                    output_name: "probe",
                    timeout_ms: 1000,
                  },
                },
              },
            ],
          },
          settings: smokeSettings,
          mode: "run_workflow",
        });

        const firstProbe = firstResult.outputs?.probe as BrowserProbe;
        const secondProbe = secondResult.outputs?.probe as BrowserProbe;
        expect(firstResult.status).toBe("success");
        expect(secondResult.status).toBe("success");
        expect(firstResult.outputs?.title).toBe("Owned Fixture");
        expect(secondProbe.storage).toBe("persisted");
        expect(secondProbe.webdriver).toBe(false);
        expect(secondProbe.userAgent).not.toContain("HeadlessChrome");
        expect(secondProbe.hasChrome).toBe(true);
        expect(secondProbe.pluginsLength).toBeGreaterThan(0);
        expect(secondProbe.timezone).toBe("America/New_York");
        expect(secondProbe.language).toBe("en-US");
        expect(secondProbe.innerWidth).toBe(1280);
        expect(secondProbe.innerHeight).toBe(720);
        expect(secondProbe.devicePixelRatio).toBe(1);
        expect(secondProbe.screenWidth).toBeGreaterThanOrEqual(secondProbe.innerWidth);
        expect(secondProbe.screenHeight).toBeGreaterThanOrEqual(secondProbe.innerHeight);
        expect(secondProbe.canvasSignature).toBe(firstProbe.canvasSignature);
        expect(secondResult.outputs?.browser_identity).toMatchObject({
          fingerprint_seed_hash: expect.stringMatching(/^[a-f0-9]{16}$/),
          timezone: "America/New_York",
          locale: "en-US",
          cloakbrowser: {
            wrapper_version: expect.stringMatching(/^\d+\.\d+\.\d+/),
            binary_version: expect.stringMatching(/^\d+/),
            binary_installed: true,
          },
        });
      } finally {
        await closeServer(server);
      }
    },
    60_000,
  );

  test.skipIf(!headedDisplayAvailable)(
    "launches headed when a display is available",
    async () => {
      const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-smoke-headed-"));
      tempRoots.push(tempRoot);
      const appPaths = createAppPaths(tempRoot);
      const runner = new BrowserWorkflowRunner({ appPaths });
      const { server, url: fixtureUrl } = await createFixtureServer();
      const settings = defaultWorkflowSettings({
        id: "workflow-smoke-headed",
        name: "Smoke Headed",
        step_count: 0,
        created_at: "2026-05-09T00:00:00.000Z",
        updated_at: "2026-05-09T00:00:00.000Z",
      });

      try {
        const result = await runner.run({
          graph: {
            steps: [
              {
                node_id: "open",
                label: "Open fixture",
                config: { type: "navigate", config: { url: fixtureUrl } },
              },
              {
                node_id: "probe",
                label: "Probe browser signals",
                config: {
                  type: "execute_js",
                  config: {
                    script: "return { webdriver: navigator.webdriver, userAgent: navigator.userAgent };",
                    output_name: "probe",
                    timeout_ms: 1000,
                  },
                },
              },
            ],
          },
          settings: {
            ...settings,
            run_policy: { ...settings.run_policy, browser_retention: "close" as const },
            browser_launch: {
              ...settings.browser_launch,
              headless: false,
              profile_dir: "smoke-headed-identity",
              profile_name: "smoke-headed-identity",
              fingerprint_seed: "48391",
            },
          },
          mode: "run_workflow",
        });

        expect(result.status).toBe("success");
        expect(result.outputs?.probe).toMatchObject({
          webdriver: false,
        });
      } finally {
        await closeServer(server);
      }
    },
    60_000,
  );
});

type BrowserProbe = {
  webdriver: boolean;
  userAgent: string;
  hasChrome: boolean;
  pluginsLength: number;
  storage: string | null;
  timezone: string;
  language: string;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  canvasSignature: string;
};

async function createFixtureServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<title>Owned Fixture</title><h1 id='title'>Owned Fixture</h1>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to bind smoke fixture server");
  }
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function browserProbeScript() {
  return `
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "16px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 120, 30);
      ctx.fillStyle = "#069";
      ctx.fillText("cloak-smoke", 4, 6);
    }
    return {
      webdriver: navigator.webdriver,
      userAgent: navigator.userAgent,
      hasChrome: Boolean(window.chrome),
      pluginsLength: navigator.plugins.length,
      storage: window.localStorage.getItem("smoke-key"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      canvasSignature: canvas.toDataURL().slice(0, 96),
    };
  `;
}
