// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { defaultWorkflowSettings } from "./commands";
import { createAppPaths } from "./database";
import { BrowserWorkflowRunner } from "./runner";

const tempRoots: string[] = [];
const describeSmoke = process.env.RUN_CLOAKBROWSER_SMOKE === "1" ? describe : describe.skip;

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describeSmoke("CloakBrowser smoke", () => {
  test(
    "launches headless and executes a local fixture workflow",
    async () => {
      const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-smoke-"));
      tempRoots.push(tempRoot);
      const appPaths = createAppPaths(tempRoot);
      const runner = new BrowserWorkflowRunner({ appPaths });
      const fixtureUrl =
        "data:text/html," +
        encodeURIComponent("<title>Owned Fixture</title><h1 id='title'>Owned Fixture</h1>");
      const settings = defaultWorkflowSettings({
        id: "workflow-smoke",
        name: "Smoke",
        step_count: 0,
        created_at: "2026-05-09T00:00:00.000Z",
        updated_at: "2026-05-09T00:00:00.000Z",
      });

      const result = await runner.run({
        graph: {
          steps: [
            {
              node_id: "open",
              label: "Open fixture",
              config: { type: "navigate", config: { url: fixtureUrl } },
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
              node_id: "webdriver",
              label: "Check webdriver",
              config: {
                type: "execute_js",
                config: {
                  script: "return navigator.webdriver",
                  output_name: "webdriver",
                  timeout_ms: 1000,
                },
              },
            },
          ],
        },
        settings: {
          ...settings,
          run_policy: { ...settings.run_policy, browser_retention: "close" },
          browser_launch: { ...settings.browser_launch, headless: true },
        },
        mode: "run_workflow",
      });

      expect(result.status).toBe("success");
      expect(result.outputs?.title).toBe("Owned Fixture");
      expect(result.outputs?.webdriver).toBe(false);
    },
    60_000,
  );
});
