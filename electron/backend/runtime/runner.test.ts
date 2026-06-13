// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  ActionConfig,
  CompiledWorkflowGraph,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow";
import { defaultWorkflowSettings } from "../commands";
import { createAppPaths } from "../persistence/database";
import {
  BrowserWorkflowRunner,
  createCloakBrowserDriver,
  type BrowserDriver,
  type BrowserDriverContext,
  type BrowserDriverPage,
} from "./runner";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("BrowserWorkflowRunner", () => {
  test("keeps evidence artifact path helpers outside the runner module", () => {
    const runnerSource = readFileSync(
      path.join(process.cwd(), "electron/backend/runtime/runner.ts"),
      "utf8",
    );

    expect(existsSync(path.join(process.cwd(), "electron/backend/evidence/artifacts.ts"))).toBe(
      true,
    );
    expect(runnerSource).toContain("./runnerEvidence.js");
    expect(runnerSource).not.toContain("../evidence/artifacts.js");
    expect(runnerSource).not.toContain("function resolveEvidenceArtifact");
    expect(runnerSource).not.toContain("function safeArtifactName");
  });

  test("maps workflow browser and environment settings to CloakBrowser launch options", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const paths = await createTempAppPaths();
    const fontsDir = path.join(paths.rootDir, "fingerprint-fonts");
    await fs.mkdir(fontsDir, { recursive: true });
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    const settings = makeSettings({
      browser_launch: {
        session_mode: "persistent_profile",
        profile_name: "QA Profile Display",
        identity_id: "bi_test_identity",
        display_name: "QA Profile Display",
        profile_dir: "bi_test_identity",
        fingerprint_seed: "38291",
        headless: false,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        proxy_username: "agent",
        proxy_password: "secret",
        proxy_bypass: ".internal.test",
        timezone: "America/New_York",
        locale: "en-US",
        geoip: false,
        fingerprint_fonts_dir: fontsDir,
        webrtc_policy: "auto_proxy_exit_ip",
        humanize: false,
        human_preset: "careful",
      } as Partial<WorkflowSettings["browser_launch"]> & Record<string, unknown>,
    });

    const runner = new BrowserWorkflowRunner({ appPaths: paths, driver });
    const result = await runner.run({
      graph: { steps: [] },
      settings,
      mode: "run_workflow",
      runId: "run-identity-1",
    });

    expect(driver.launches).toEqual([
      {
        kind: "persistent",
        options: expect.objectContaining({
          userDataDir: path.join(paths.browserProfilesDir, "bi_test_identity"),
          headless: false,
          humanize: false,
          humanPreset: "careful",
          timezone: "America/New_York",
          locale: "en-US",
          geoip: false,
          args: [
            "--fingerprint=38291",
            "--fingerprint-noise=false",
            "--fingerprint-storage-quota=500",
            "--fingerprint-platform=windows",
            `--fingerprint-fonts-dir=${fontsDir}`,
            "--fingerprint-webrtc-ip=auto",
          ],
          proxy: {
            server: "http://proxy.local:8080",
            bypass: ".internal.test",
            username: "agent",
            password: "secret",
          },
          contextOptions: expect.objectContaining({
            acceptDownloads: true,
            downloadsPath: paths.downloadsDir,
          }),
        }),
      },
    ]);
    expect(driver.launches[0]?.options).not.toHaveProperty("userAgent");
    expect(driver.launches[0]?.options).not.toHaveProperty("viewport");
    expect(driver.launches[0]?.options.args).not.toContain(
      `--window-size=${settings.browser_launch.persona.window.width},${settings.browser_launch.persona.window.height}`,
    );
    expect(result.outputs?.browser_identity).toMatchObject({
      run_id: "run-identity-1",
      identity_id: "bi_test_identity",
      display_name: "QA Profile Display",
      persona: expect.objectContaining({
        id: expect.any(String),
        viewport: settings.browser_launch.persona.viewport,
        window: settings.browser_launch.persona.window,
      }),
      profile_dir: "bi_test_identity",
      session_mode: "persistent_profile",
      fingerprint_seed_hash: expect.stringMatching(/^[a-f0-9]{16}$/),
      fingerprint_fonts_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      timezone: "America/New_York",
      timezone_source: "explicit",
      locale: "en-US",
      locale_source: "explicit",
      geoip: false,
      webrtc_policy: "auto_proxy_exit_ip",
      webrtc_ip: null,
      advanced_overrides: ["fingerprint_fonts_dir"],
      humanize: false,
      human_preset: "careful",
      cloakbrowser: {
        wrapper_version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        binary_version: expect.stringMatching(/^\d+/),
        binary_platform: expect.any(String),
        binary_installed: expect.any(Boolean),
      },
    });
    expect(context.closed).toBe(false);
  });

  test("maps supported WebRTC policies to launch args and browser identity evidence", async () => {
    const cases = [
      {
        policy: "default" as const,
        ip: null,
        expectedArg: null,
      },
      {
        policy: "auto_proxy_exit_ip" as const,
        ip: null,
        expectedArg: "--fingerprint-webrtc-ip=auto",
      },
      {
        policy: "explicit_ip" as const,
        ip: "203.0.113.10",
        expectedArg: "--fingerprint-webrtc-ip=203.0.113.10",
      },
    ];

    for (const testCase of cases) {
      const context = new FakeContext();
      const driver = createFakeDriver(context);
      const runner = new BrowserWorkflowRunner({
        appPaths: await createTempAppPaths(),
        driver,
      });

      const result = await runner.run({
        graph: { steps: [] },
        settings: makeSettings({
          browser_launch: {
            webrtc_policy: testCase.policy,
            webrtc_ip: testCase.ip,
          },
          run_policy: { browser_retention: "close" },
        }),
        mode: "run_workflow",
        runId: `run-webrtc-${testCase.policy}`,
      });

      const args = driver.launches[0].options.args as string[];
      if (testCase.expectedArg) {
        expect(args).toContain(testCase.expectedArg);
      } else {
        expect(args.some((arg) => arg.startsWith("--fingerprint-webrtc-ip="))).toBe(false);
      }
      expect(result.outputs?.browser_identity).toMatchObject({
        webrtc_policy: testCase.policy,
        webrtc_ip: testCase.policy === "explicit_ip" ? testCase.ip : null,
      });
    }
  });

  test("normalizes proxy URL credentials into Playwright proxy fields", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const settings = makeSettings({
      browser_launch: {
        proxy_enabled: true,
        proxy_server: "socks5://agent:secret@proxy.local:1080",
      },
      run_policy: { browser_retention: "close" },
    });

    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver,
    });
    await runner.run({
      graph: { steps: [] },
      settings,
      mode: "run_workflow",
    });

    expect(driver.launches[0]?.options.proxy).toEqual({
      server: "socks5://proxy.local:1080",
      username: "agent",
      password: "secret",
    });
  });

  test.skipIf(process.platform !== "linux")(
    "fails clearly before headed real CloakBrowser launches without a display",
    async () => {
      const previousDisplay = process.env.DISPLAY;
      const previousWaylandDisplay = process.env.WAYLAND_DISPLAY;
      delete process.env.DISPLAY;
      delete process.env.WAYLAND_DISPLAY;
      try {
        const runner = new BrowserWorkflowRunner({
          appPaths: await createTempAppPaths(),
        });
        await expect(
          runner.run({
            graph: { steps: [] },
            settings: makeSettings({ browser_launch: { headless: false } }),
            mode: "run_workflow",
          }),
        ).rejects.toThrow(
          "Headed CloakBrowser runs require DISPLAY or WAYLAND_DISPLAY on Linux",
        );
      } finally {
        if (previousDisplay === undefined) {
          delete process.env.DISPLAY;
        } else {
          process.env.DISPLAY = previousDisplay;
        }
        if (previousWaylandDisplay === undefined) {
          delete process.env.WAYLAND_DISPLAY;
        } else {
          process.env.WAYLAND_DISPLAY = previousWaylandDisplay;
        }
      }
    },
  );

  test("executes browser actions, stores outputs, and records action traces", async () => {
    const page = new FakePage();
    const context = new FakeContext(page);
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
      random: () => 0,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("open", "Open", { type: "navigate", config: { url: "https://owned.test" } }),
          step("fill", "Fill", {
            type: "input_text",
            config: {
              xpath: "//input[@name='q']",
              text: "lab",
              clear_before_input: true,
            },
          }),
          step("click", "Click", {
            type: "click",
            config: { xpath: "//button[@id='go']" },
          }),
          step("extract", "Extract", {
            type: "extract_text",
            config: { xpath: "//h1", output_name: "title" },
          }),
          step("script", "Script", {
            type: "execute_js",
            config: { script: "return window.location.href", output_name: "href" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.completed_step_ids).toEqual(["open", "fill", "click", "extract", "script"]);
    expect(result.outputs).toMatchObject({
      title: "Owned Fixture",
      href: "https://owned.test/",
    });
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "open",
        action_type: "navigate",
        mode: "browser",
      }),
      expect.objectContaining({
        node_id: "fill",
        action_type: "input_text",
        mode: "browser",
      }),
      expect.objectContaining({
        node_id: "click",
        action_type: "click",
        mode: "browser",
      }),
      expect.objectContaining({
        node_id: "extract",
        action_type: "extract_text",
        mode: "observer",
      }),
      expect.objectContaining({
        node_id: "script",
        action_type: "execute_js",
        mode: "direct_dom",
      }),
    ]);
    expect(page.events).toEqual(
      expect.arrayContaining([
        "goto:https://owned.test",
        "locator://input[@name='q']",
        "fill://input[@name='q']:",
        "fill://input[@name='q']:lab",
        "click://button[@id='go']",
      ]),
    );
  });

  test("advanced browser actions execute while CloakBrowser owns humanization globally", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("script", "Script", {
            type: "execute_js",
            config: { script: "return 1", output_name: "value", timeout_ms: 1000 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.value).toBeNull();
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "script",
        action_type: "execute_js",
        status: "success",
        audit_tags: ["direct_dom_script", "requires_review"],
      }),
    ]);
  });

  test("rejects execute_js when run policy disables direct JavaScript execution", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("script", "Script", {
            type: "execute_js",
            config: { script: "return 1", output_name: "value" },
          }),
        ],
      },
      settings: makeSettings({
        run_policy: { execute_js_enabled: false } as Partial<
          WorkflowSettings["run_policy"]
        >,
      }),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "script",
      action_type: "execute_js",
      reason: "Execute JavaScript is disabled by Run Policy",
    });
    expect(result.outputs?.value).toBeUndefined();
  });

  test("classifies, redacts, and limits evidence outputs without dropping traces", async () => {
    const page = new FakePage();
    page.evaluateResult = {
      api_token: "secret-token",
      visible_text: "x".repeat(5000),
    };
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("script", "Script", {
            type: "execute_js",
            config: {
              script: "return { api_token: 'secret-token', visible_text: 'x'.repeat(5000) }",
              output_name: "script_result",
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.outputs?.script_result).toMatchObject({
      api_token: "[REDACTED]",
      visible_text: expect.stringContaining("[TRUNCATED"),
    });
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "script",
        action_type: "execute_js",
        audit_tags: ["direct_dom_script", "requires_review"],
      }),
    ]);
    expect(result.outputs?.__evidence_model).toMatchObject({
      schema_version: 1,
      outputs: expect.arrayContaining([
        expect.objectContaining({
          key: "script_result",
          category: "page_observation",
          redacted: true,
          truncated: true,
        }),
        expect.objectContaining({
          key: "__action_traces",
          category: "action_trace",
          truncated: false,
        }),
      ]),
    });
  });

  test("times out execute_js when timeout_ms elapses before evaluation resolves", async () => {
    class SlowEvaluatePage extends FakePage {
      override async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
        if (typeof pageFunction === "string" && pageFunction.includes("__slow_execute_js__")) {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return "late";
        }
        return super.evaluate(pageFunction, arg);
      }
    }

    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(new SlowEvaluatePage())),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("script", "Script", {
            type: "execute_js",
            config: {
              script: "return '__slow_execute_js__'",
              output_name: "value",
              timeout_ms: 1,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "script",
      action_type: "execute_js",
      reason: "Execute JavaScript timed out after 1 ms",
    });
    expect(result.outputs?.value).toBeUndefined();
  });

  test("mock_response matches url_contains by substring before fulfilling a response", async () => {
    const context = new FakeContext();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("mock", "Mock API", {
            type: "mock_response",
            config: {
              url_contains: "/api/mock",
              status: 201,
              body: "{\"ok\":true}",
              content_type: "application/json",
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    const mockedResponse = await context.triggerRoute(
      "https://fixture.owned.test/api/mock?source=default",
    );

    expect(result.status).toBe("success");
    expect(mockedResponse).toEqual({
      status: 201,
      body: "{\"ok\":true}",
      contentType: "application/json",
    });
  });

  test("submits targeted forms through CloakBrowser locator input before DOM fallback", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("submit", "Submit", {
            type: "submit_form",
            config: { xpath: "//button[@type='submit']" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "locator://button[@type='submit']",
        "click://button[@type='submit']",
      ]),
    );
    expect(page.events).not.toContain("evaluate://button[@type='submit']");
  });

  test("selects radio targets through CloakBrowser check before DOM fallback", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("radio", "Radio", {
            type: "select_radio",
            config: { target: { locators: [{ kind: "test_id", value: "role-admin" }] } },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "getByTestId:role-admin",
        "check:testid=role-admin",
      ]),
    );
    expect(page.events).not.toContain("evaluate:testid=role-admin");
  });

  test("falls back to DOM radio selection only after native radio paths fail", async () => {
    const page = new NativeFailingActionPage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("radio", "Radio", {
            type: "select_radio",
            config: { xpath: "//label[@for='role-admin']" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "check-failed://label[@for='role-admin']",
        "click-failed://label[@for='role-admin']",
        "evaluate://label[@for='role-admin']",
      ]),
    );
  });

  test("uses custom human wheel chunks for page scroll because CloakBrowser does not patch wheel", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async () => {},
      random: () => 0.5,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: { direction: "down", pixels: 900 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events.filter((event) => event.startsWith("wheel:")).length).toBeGreaterThan(1);
    expect(page.events.filter((event) => event.startsWith("wheel:"))).not.toContain("wheel:0:900");
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "scroll",
        action_type: "scroll",
        mode: "assisted_browser",
      }),
    ]);
  });

  test("keeps page scroll decisive and monotonic while preserving requested distance", async () => {
    const page = new FakePage();
    const sleeps: number[] = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: { mode: "page", direction: "down", pixels: 900 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    const deltas = page.events
      .filter((event) => event.startsWith("wheel:"))
      .map((event) => Number(event.split(":")[2]));
    expect(deltas.some((delta) => delta > 0)).toBe(true);
    expect(deltas.some((delta) => delta < 0)).toBe(false);
    expect(deltas.length).toBeGreaterThanOrEqual(8);
    expect(deltas.length).toBeLessThanOrEqual(18);
    expect(Math.min(...deltas.map((delta) => Math.abs(delta)))).toBeGreaterThanOrEqual(30);
    expect(Math.max(...deltas.map((delta) => Math.abs(delta)))).toBeLessThanOrEqual(140);
    expect(deltas.reduce((sum, delta) => sum + delta, 0)).toBe(900);
    expect(sleeps.some((ms) => ms >= 18 && ms <= 55)).toBe(true);
    expect(sleeps.filter((ms) => ms >= 160).length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(320);
  });

  test("supports a smooth single-wheel page scroll style without human chunking", async () => {
    const page = new FakePage();
    const sleeps: number[] = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "page",
              direction: "down",
              pixels: 900,
              scroll_style: "smooth_single",
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events.filter((event) => event.startsWith("wheel:"))).toEqual(["wheel:0:900"]);
    expect(sleeps).toEqual([]);
  });

  test("scrolls element targets through a wheel-based human planner", async () => {
    const page = new HumanScrollPage({ targetDocumentY: 1400 });
    const sleeps: number[] = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "into_view",
              target: { locators: [{ kind: "test_id", value: "cta" }] },
              timeout_ms: 4500,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toContain("getByTestId:cta");
    expect(page.events.some((event) => event.startsWith("scrollIntoViewIfNeeded:"))).toBe(false);
    expect(page.events).not.toContain("evaluate:testid=cta");
    const wheelEvents = page.events.filter((event) => event.startsWith("wheel:"));
    expect(wheelEvents.length).toBeGreaterThan(1);
    const wheelDeltas = wheelEvents.map((event) => Number(event.split(":")[2]));
    expect(wheelDeltas.some((delta) => delta > 0)).toBe(true);
    expect(wheelDeltas.some((delta) => delta < 0)).toBe(false);
    expect(wheelDeltas.length).toBeGreaterThanOrEqual(8);
    expect(wheelDeltas.length).toBeLessThanOrEqual(20);
    expect(Math.max(...wheelDeltas.map((delta) => Math.abs(delta)))).toBeGreaterThanOrEqual(70);
    expect(Math.max(...wheelDeltas.map((delta) => Math.abs(delta)))).toBeLessThanOrEqual(160);
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.some((ms) => ms >= 18 && ms <= 55)).toBe(true);
    expect(sleeps.filter((ms) => ms >= 160).length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(360);
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "scroll",
        action_type: "scroll",
        mode: "assisted_browser",
      }),
    ]);
    expect(await page.targetLocator.boundingBox()).toMatchObject({
      y: expect.any(Number),
      height: 40,
    });
    const finalBox = await page.targetLocator.boundingBox();
    expect(finalBox?.y).toBeGreaterThanOrEqual(0);
    expect((finalBox?.y ?? 0) + (finalBox?.height ?? 0)).toBeLessThanOrEqual(page.viewport.height);
  });

  test("uses explicit Playwright XPath selectors for structured absolute XPath targets", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async () => {},
      random: () => 0.5,
      cloakHumanScroll: async () => true,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "into_view",
              target: { locators: [{ kind: "xpath", value: "/html/body/footer" }] },
              timeout_ms: 1000,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toContain("locator:xpath=/html/body/footer");
  });

  test("prefers CloakBrowser human scroll for element targets when available", async () => {
    const page = new HumanScrollPage({ targetDocumentY: 1400 });
    const cloakHumanScroll = vi.fn(async ({ locator, timeoutMs, preset }) => {
      const box = await locator.boundingBox?.();
      page.events.push(`cloakHumanScroll:${Math.round(box?.y ?? -1)}:${timeoutMs}:${preset}`);
      return true;
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async () => {},
      random: () => 0.5,
      cloakHumanScroll,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "into_view",
              target: { locators: [{ kind: "test_id", value: "cta" }] },
              timeout_ms: 4500,
            },
          }),
        ],
      },
      settings: makeSettings({ browser_launch: { human_preset: "careful" } }),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(cloakHumanScroll).toHaveBeenCalledTimes(1);
    expect(page.events).toContain("cloakHumanScroll:1400:4500:careful");
    expect(page.events.filter((event) => event.startsWith("wheel:"))).toEqual([]);
    expect(page.events).toEqual(
      expect.not.arrayContaining([
        expect.stringMatching(/^scrollIntoViewIfNeeded:/),
      ]),
    );
  });

  test("scrolls upward with distance-aware pacing when a target is above the viewport", async () => {
    const page = new HumanScrollPage({ targetDocumentY: 300, initialScrollY: 900 });
    const sleeps: number[] = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll-up", "Scroll Up", {
            type: "scroll",
            config: {
              mode: "into_view",
              target: { locators: [{ kind: "test_id", value: "cta" }] },
              timeout_ms: 4500,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    const wheelDeltas = page.events
      .filter((event) => event.startsWith("wheel:"))
      .map((event) => Number(event.split(":")[2]));
    expect(wheelDeltas.every((delta) => delta < 0)).toBe(true);
    expect(wheelDeltas.length).toBeGreaterThanOrEqual(8);
    expect(wheelDeltas.length).toBeLessThanOrEqual(20);
    expect(Math.min(...wheelDeltas.map((delta) => Math.abs(delta)))).toBeGreaterThanOrEqual(25);
    expect(Math.max(...wheelDeltas.map((delta) => Math.abs(delta)))).toBeLessThanOrEqual(140);
    expect(sleeps.some((ms) => ms >= 18 && ms <= 55)).toBe(true);
    expect(sleeps.filter((ms) => ms >= 160).length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(360);
    const finalBox = await page.targetLocator.boundingBox();
    expect(finalBox?.y).toBeGreaterThanOrEqual(0);
    expect((finalBox?.y ?? 0) + (finalBox?.height ?? 0)).toBeLessThanOrEqual(page.viewport.height);
  });

  test("fails scroll-to-element when lazy-loaded target is not in the DOM", async () => {
    const page = new MissingTargetPage();
    const cloakHumanScroll = vi.fn(async ({ locator }) => {
      const box = await locator.boundingBox?.();
      page.events.push(`cloakHumanScroll:${box ? "box" : "missing"}`);
      return false;
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async () => {},
      random: () => 0.5,
      cloakHumanScroll,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "into_view",
              target: { locators: [{ kind: "test_id", value: "lazy-cta" }] },
              timeout_ms: 100,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(cloakHumanScroll).toHaveBeenCalledTimes(1);
    expect(page.events).toContain("cloakHumanScroll:missing");
    expect(page.events.filter((event) => event.startsWith("wheel:"))).toEqual([]);
    expect(result.error).toMatchObject({
      step_id: "scroll",
      action_type: "scroll",
      reason: "Scroll target did not enter the viewport before max attempts",
    });
  });

  test("scrolls the page until a lazy-loaded target exists, then brings it into view", async () => {
    const page = new LazyLoadedTargetPage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async () => {},
      random: () => 0.5,
      cloakHumanScroll: async () => false,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "until_element_visible",
              target: { locators: [{ kind: "test_id", value: "lazy-cta" }] },
              direction: "down",
              pixels: 350,
              timeout_ms: 5000,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toContain("mount:lazy-cta");
    expect(page.events.filter((event) => event.startsWith("wheel:")).length).toBeGreaterThan(1);
    const finalBox = await page.lazyLocator.boundingBox();
    expect(finalBox?.y).toBeGreaterThanOrEqual(0);
    expect((finalBox?.y ?? 0) + (finalBox?.height ?? 0)).toBeLessThanOrEqual(page.viewport.height);
  });

  test("fails targeted scroll modes when no target is configured", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: { mode: "into_view", target: null, xpath: null, timeout_ms: 1000 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "scroll",
      action_type: "scroll",
      reason: "Element target is required",
    });
  });

  test("scrolls into view targets inside legacy iframe XPath", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("scroll", "Scroll", {
            type: "scroll",
            config: {
              mode: "into_view",
              xpath: "//h2[normalize-space(.)='Ready']",
              iframe_xpath: "//iframe[@id='main']",
              timeout_ms: 2500,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "frameLocator://iframe[@id='main']",
        "frameLocator.locator://h2[normalize-space(.)='Ready']",
      ]),
    );
    expect(page.events.some((event) => event.startsWith("scrollIntoViewIfNeeded:"))).toBe(false);
    expect(page.events.some((event) => event.startsWith("wheel:"))).toBe(false);
  });

  test("pastes clipboard content by focusing the target and pressing the platform paste shortcut", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("copy", "Copy", {
            type: "set_clipboard",
            config: { text: "token-123" },
          }),
          step("paste", "Paste", {
            type: "paste_clipboard",
            config: { xpath: "//textarea[@name='notes']" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "locator://textarea[@name='notes']",
        "clipboard:token-123",
        "click://textarea[@name='notes']",
        `press:${process.platform === "darwin" ? "Meta+V" : "Control+V"}`,
      ]),
    );
    expect(page.events).not.toContain("fill://textarea[@name='notes']:token-123");
  });

  test("falls back to DOM form submission only after native submit paths fail", async () => {
    const page = new NativeFailingActionPage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("submit", "Submit", {
            type: "submit_form",
            config: { xpath: "//form[@id='login']" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "click-failed://form[@id='login']",
        "locatorPress-failed://form[@id='login']:Enter",
        "evaluate://form[@id='login']",
      ]),
    );
  });

  test("uses custom key hold timing for untargeted key and hotkey actions", async () => {
    const page = new FakePage();
    const sleeps: number[] = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      random: () => 0,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("key", "Key", { type: "press_key", config: { key: "Enter" } }),
          step("hotkey", "Hotkey", {
            type: "hotkey",
            config: { keys: ["Control", "Shift", "P"] },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "down:Enter",
        "up:Enter",
        "down:Control",
        "down:Shift",
        "down:P",
        "up:P",
        "up:Shift",
        "up:Control",
      ]),
    );
    expect(page.events).not.toContain("press:Enter");
    expect(page.events).not.toContain("press:Control+Shift+P");
    expect(sleeps.length).toBeGreaterThanOrEqual(2);
  });

  test("keeps scroll runner free of debug console logging", () => {
    const runnerSource = readFileSync(
      path.join(process.cwd(), "electron/backend/runtime/runner.ts"),
      "utf8",
    );

    expect(runnerSource).not.toMatch(/console\.log\([^)]*scroll/i);
  });

  test("keeps obsolete native scroll helper names out of the Scroll action path", () => {
    const runnerSource = readFileSync(
      path.join(process.cwd(), "electron/backend/runtime/runner.ts"),
      "utf8",
    );

    expect(runnerSource).not.toContain("function scrollLocatorIntoView");
    expect(runnerSource).not.toContain("scroll requires driver support for locator.scrollIntoViewIfNeeded");
  });

  test("dispatches right-click targets through custom right-button mouse input", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("right", "Right Click", {
            type: "right_click",
            config: { target: { locators: [{ kind: "test_id", value: "menu-target" }] } },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "getByTestId:menu-target",
        "scrollIntoViewIfNeeded:testid=menu-target:none",
        "mouseDown:right",
        "mouseUp:right",
      ]),
    );
    expect(page.events).not.toContain("click:testid=menu-target:right");
    expect(page.events).not.toContain("evaluate:testid=menu-target");
  });

  test("extracts table outputs through locator DOM evaluation", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("table", "Extract Table", {
            type: "extract_table",
            config: { xpath: "//table[@id='summary']", output_name: "rows" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs.rows).toEqual([
      ["Name", "Status"],
      ["Fixture", "Ready"],
    ]);
    expect(page.events).toContain("evaluate://table[@id='summary']");
  });

  test("checks cancellation during waits and closes temporary contexts on stop", async () => {
    const context = new FakeContext();
    const cancellation = new AbortController();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
      sleep: async (_ms, signal) => {
        cancellation.abort();
        signal?.throwIfAborted();
      },
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("wait", "Wait", {
            type: "wait",
            config: { condition: "duration", duration_ms: 10_000 },
          }),
        ],
      },
      settings: makeSettings({ run_policy: { browser_retention: "close" } }),
      mode: "run_workflow",
      signal: cancellation.signal,
    });

    expect(result.status).toBe("stopped");
    expect(context.closed).toBe(true);
  });

  test("reports diagnostics for failed inlined subflow steps", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("call-login::assert-email", "Login subflow > Assert email", {
            type: "assert_output",
            config: { name: "email", match_mode: "equals", value: "ready" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toEqual(
      expect.objectContaining({
        step_id: "call-login::assert-email",
        step_name: "Login subflow > Assert email",
        action_type: "assert_output",
        reason: "Output email did not equal ready",
        diagnostics: {
          compiled_step_id: "call-login::assert-email",
          parent_step_id: "call-login",
          subflow_node_id: "assert-email",
          label_path: ["Login subflow", "Assert email"],
          action_summary: "Output email equals ready",
        },
      }),
    );
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "call-login::assert-email",
        label: "Login subflow > Assert email",
        action_type: "assert_output",
        status: "failed",
        action_summary: "Output email equals ready",
      }),
    ]);
  });

  test("summarizes failed click targets in runtime diagnostics", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(new NativeFailingActionPage())),
    });

    const result = await runner.run({
      graph: {
        steps: [
          {
            ...step("call-subflow::new-node", "Main > subflow-001 > Click", {
              type: "click",
              config: { xpath: "//button[hello]" },
            }),
            metadata: {
              subflow: {
                id: "subflow-001",
                name: "subflow-001",
                step_number: 2,
                step_count: 3,
              },
            },
          },
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "call-subflow::new-node",
      step_name: "Main > subflow-001 > Click",
      action_type: "click",
      diagnostics: {
        compiled_step_id: "call-subflow::new-node",
        parent_step_id: "call-subflow",
        subflow_node_id: "new-node",
        label_path: ["Main", "subflow-001", "Click"],
        action_summary: "XPath //button[hello]",
        subflow_id: "subflow-001",
        subflow_name: "subflow-001",
        subflow_step_number: 2,
        subflow_step_count: 3,
      },
    });
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "call-subflow::new-node",
        action_type: "click",
        status: "failed",
        action_summary: "XPath //button[hello]",
        subflow_name: "subflow-001",
        subflow_step_number: 2,
        subflow_step_count: 3,
      }),
    ]);
  });

  test("retains temporary browser sessions when run policy and terminal node do not request closure", async () => {
    const context = new FakeContext();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("end", "End Success", {
            type: "stop_workflow",
            config: { status: "success", reason: null, close_browser: false },
          }),
        ],
      },
      settings: makeSettings({ run_policy: { browser_retention: "retain" } }),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(context.closed).toBe(false);
  });

  test("reuses a retained persistent browser session for run-from-selected without relaunching", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver,
    });
    const settings = makeSettings({
      browser_launch: {
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
        identity_id: "bi_qa_profile",
        display_name: "QA profile",
        profile_dir: "bi_qa_profile",
        fingerprint_seed: "48123",
      },
      run_policy: { browser_retention: "retain" },
    });

    await runner.run({
      graph: {
        steps: [
          step("first", "First", {
            type: "wait",
            config: { condition: "duration", duration_ms: 1 },
          }),
        ],
      },
      settings,
      mode: "run_workflow",
      retainedSessionWorkflowId: "workflow-1",
    });
    expect(runner.hasReusableRetainedSession("workflow-1", "bi_qa_profile")).toBe(true);

    const result = await runner.run({
      graph: {
        steps: [
          step("second", "Second", {
            type: "wait",
            config: { condition: "duration", duration_ms: 1 },
          }),
        ],
      },
      settings,
      mode: "run_workflow",
      targetStepId: "second",
      reuseRetainedSession: true,
      retainedSessionWorkflowId: "workflow-1",
    });

    expect(result.status).toBe("success");
    expect(driver.launches).toHaveLength(1);
    expect(result.completed_step_ids).toEqual(["second"]);
    expect(context.closed).toBe(false);
  });

  test("retains browser sessions per workflow/profile instead of closing another workflow", async () => {
    const firstContext = new FakeContext();
    const secondContext = new FakeContext();
    const contexts = [firstContext, secondContext];
    const launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }> = [];
    const driver: BrowserDriver = {
      async launch(options) {
        launches.push({ kind: "temporary", options });
        return contexts[launches.length - 1];
      },
      async launchPersistent(options) {
        launches.push({ kind: "persistent", options });
        return contexts[launches.length - 1];
      },
    };
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver,
    });
    const firstSettings = makeSettings({
      browser_launch: {
        session_mode: "persistent_profile",
        profile_dir: "profile-a",
        profile_name: "profile-a",
      },
      run_policy: { browser_retention: "retain" },
    });
    const secondSettings: WorkflowSettings = {
      ...makeSettings({
        browser_launch: {
          session_mode: "persistent_profile",
          profile_dir: "profile-b",
          profile_name: "profile-b",
        },
        run_policy: { browser_retention: "retain" },
      }),
      workflow_id: "workflow-2",
    };

    await runner.run({
      graph: { steps: [] },
      settings: firstSettings,
      mode: "run_workflow",
      retainedSessionWorkflowId: "workflow-1",
    });
    await runner.run({
      graph: { steps: [] },
      settings: secondSettings,
      mode: "run_workflow",
      retainedSessionWorkflowId: "workflow-2",
    });

    expect(firstContext.closed).toBe(false);
    expect(secondContext.closed).toBe(false);
    expect(runner.hasReusableRetainedSession("workflow-1", "profile-a")).toBe(true);
    expect(runner.hasReusableRetainedSession("workflow-2", "profile-b")).toBe(true);
  });

  test("continues after the selected node when reusing a retained browser session", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver,
    });
    const settings = makeSettings({
      browser_launch: {
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
      },
      run_policy: { browser_retention: "retain" },
    });

    await runner.run({
      graph: {
        steps: [
          step("first", "First", {
            type: "wait",
            config: { condition: "duration", duration_ms: 1 },
          }),
        ],
      },
      settings,
      mode: "run_workflow",
      retainedSessionWorkflowId: "workflow-1",
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("second", "Second", {
            type: "set_variable",
            config: { name: "second", value: "done", value_type: "text" },
          }),
          step("third", "Third", {
            type: "set_variable",
            config: { name: "third", value: "done", value_type: "text" },
          }),
        ],
      },
      settings,
      mode: "run_workflow",
      targetStepId: "second",
      reuseRetainedSession: true,
      retainedSessionWorkflowId: "workflow-1",
    });

    expect(result.status).toBe("success");
    expect(result.completed_step_ids).toEqual(["second", "third"]);
    expect(result.outputs).toMatchObject({ second: "done", third: "done" });
  });

  test("clears stale retained session state when the retained browser was closed manually", async () => {
    const context = new FakeContext();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });
    const settings = makeSettings({
      browser_launch: {
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
      },
      run_policy: { browser_retention: "retain" },
    });

    await runner.run({
      graph: {
        steps: [
          step("first", "First", {
            type: "wait",
            config: { condition: "duration", duration_ms: 1 },
          }),
        ],
      },
      settings,
      mode: "run_workflow",
      retainedSessionWorkflowId: "workflow-1",
    });
    context.closed = true;

    expect(runner.hasReusableRetainedSession("workflow-1", "qa-profile")).toBe(false);
    await expect(
      runner.run({
        graph: { steps: [] },
        settings,
        mode: "run_workflow",
        reuseRetainedSession: true,
        retainedSessionWorkflowId: "workflow-1",
      }),
    ).rejects.toThrow("No reusable browser session is available");
  });

  test("waits for element states using Playwright locator wait semantics", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("visible", "Visible", {
            type: "wait",
            config: { condition: "element_visible", xpath: "#ready", timeout_ms: 500 },
          }),
          step("hidden", "Hidden", {
            type: "wait",
            config: { condition: "element_hidden", xpath: "#spinner", timeout_ms: 600 },
          }),
          step("attached", "Attached", {
            type: "wait",
            config: { condition: "element_attached", xpath: "#panel", timeout_ms: 700 },
          }),
          step("text", "Text", {
            type: "wait",
            config: { condition: "text_visible", text: "Ready", timeout_ms: 750 },
          }),
          step("detached", "Detached", {
            type: "wait",
            config: { condition: "element_detached", xpath: "#toast", timeout_ms: 800 },
          }),
          step("enabled", "Enabled", {
            type: "wait",
            config: { condition: "element_enabled", xpath: "#submit", timeout_ms: 900 },
          }),
          step("disabled", "Disabled", {
            type: "wait",
            config: { condition: "element_disabled", xpath: "#blocked", timeout_ms: 1000 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "waitFor:#ready:visible:500",
        "waitFor:#spinner:hidden:600",
        "waitFor:#panel:attached:700",
        "waitFor:text=Ready:visible:750",
        "waitFor:#toast:detached:800",
        "waitFor:#submit:visible:900",
        "isEnabled:#submit",
        "isEnabled:#blocked",
      ]),
    );
  });

  test("asserts element states using visibility, attachment, and enabled checks", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("visible", "Visible", {
            type: "assert_element",
            config: { xpath: "#ready", state: "visible", timeout_ms: 500 },
          }),
          step("hidden", "Hidden", {
            type: "assert_element",
            config: { xpath: "#hidden", state: "hidden", timeout_ms: 600 },
          }),
          step("attached", "Attached", {
            type: "assert_element",
            config: { xpath: "#panel", state: "attached", timeout_ms: 700 },
          }),
          step("enabled", "Enabled", {
            type: "assert_element",
            config: { xpath: "#submit", state: "enabled", timeout_ms: 800 },
          }),
          step("disabled", "Disabled", {
            type: "assert_element",
            config: { xpath: "#blocked", state: "disabled", timeout_ms: 900 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "waitFor:#ready:visible:500",
        "isVisible:#ready",
        "waitFor:#hidden:hidden:600",
        "isVisible:#hidden",
        "waitFor:#panel:attached:700",
        "count:#panel",
        "waitFor:#submit:visible:800",
        "isEnabled:#submit",
        "waitFor:#blocked:visible:900",
        "isEnabled:#blocked",
      ]),
    );
  });

  test("fails assert_element when the requested state is false", async () => {
    const cases: Array<{
      state: "attached" | "visible" | "hidden" | "enabled" | "disabled";
      xpath: string;
      reason: string;
    }> = [
      { state: "visible", xpath: "#hidden", reason: "Element is not visible" },
      { state: "hidden", xpath: "#ready", reason: "Element is not hidden" },
      { state: "attached", xpath: "#missing", reason: "Element is not attached" },
      { state: "enabled", xpath: "#blocked", reason: "Element is not enabled" },
      { state: "disabled", xpath: "#submit", reason: "Element is not disabled" },
    ];

    for (const testCase of cases) {
      const runner = new BrowserWorkflowRunner({
        appPaths: await createTempAppPaths(),
        driver: createFakeDriver(new FakeContext(new FakePage())),
      });

      const result = await runner.run({
        graph: {
          steps: [
            step("assert", "Assert", {
              type: "assert_element",
              config: { xpath: testCase.xpath, state: testCase.state, timeout_ms: 500 },
            }),
          ],
        },
        settings: makeSettings(),
        mode: "run_workflow",
      });

      expect(result.status, testCase.state).toBe("failed");
      expect(result.error).toMatchObject({
        step_id: "assert",
        action_type: "assert_element",
        reason: testCase.reason,
      });
    }
  });

  test("fails malformed enum fields defensively if invalid configs reach the runner", async () => {
    const cases: Array<{
      label: string;
      config: ActionConfig;
      reason: string;
    }> = [
      {
        label: "wait_until",
        config: { type: "click", config: { xpath: "#button", wait_until: "ready" as never } },
        reason: "Wait until must be attached, visible, enabled, or clickable",
      },
      {
        label: "match_by",
        config: { type: "select_option", config: { xpath: "#country", match_by: "index" as never, value: "1" } },
        reason: "Match by must be label or value",
      },
      {
        label: "assert_text_match",
        config: { type: "assert_text", config: { xpath: "#status", text: "Ready", match_mode: "regex" as never } },
        reason: "Match mode must be contains or equals",
      },
      {
        label: "assert_output_match",
        config: { type: "assert_output", config: { name: "status", match_mode: "regex" as never, value: "Ready" } },
        reason: "Match mode must be contains or equals",
      },
    ];

    for (const testCase of cases) {
      const runner = new BrowserWorkflowRunner({
        appPaths: await createTempAppPaths(),
        driver: createFakeDriver(new FakeContext(new FakePage())),
      });

      const result = await runner.run({
        graph: { steps: [step(testCase.label, testCase.label, testCase.config)] },
        settings: makeSettings(),
        mode: "run_workflow",
      });

      expect(result.status, testCase.label).toBe("failed");
      expect(result.error).toMatchObject({
        step_id: testCase.label,
        reason: testCase.reason,
      });
    }
  });

  test("writes local and session storage actions into the browser page", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("local", "Local storage", {
            type: "set_local_storage",
            config: { key: "token", value: "abc" },
          }),
          step("session", "Session storage", {
            type: "set_session_storage",
            config: { key: "nonce", value: "123" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "localStorage:token:abc",
        "sessionStorage:nonce:123",
      ]),
    );
  });

  test("flattens JSON variables and exposes object fields inside for-each loops", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("set-user", "Set user", {
            type: "set_variable",
            config: {
              variables: [
                {
                  name: "user",
                  value_type: "json",
                  value: "{\"name\":\"Ada\",\"roles\":[\"qa\"]}",
                },
              ],
            },
          }),
          step("set-json", "Set JSON", {
            type: "set_json_variables",
            config: {
              json: "{\"feature\":{\"enabled\":true},\"items\":[{\"name\":\"A\"},{\"name\":\"B\"}]}",
            },
          }),
          step("loop", "Loop items", {
            type: "repeat_for_each",
            config: {
              item_name: "item",
              array_variable: "items",
              items: [],
              steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "last_item", value_type: "text", value: "{{item.name}}" },
                    ],
                  },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs).toMatchObject({
      "user.name": "Ada",
      "user.roles": ["qa"],
      "feature.enabled": true,
      items: [{ name: "A" }, { name: "B" }],
      item: { name: "B" },
      "item.name": "B",
      last_item: "B",
    });
  });

  test("keeps break and continue scoped to the current loop", async () => {
    const progress: Array<Partial<RunState>> = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("loop", "Loop", {
            type: "repeat_for_each",
            config: {
              item_name: "item",
              items: ["skip", "stop", "later"],
              steps: [
                {
                  type: "if_condition",
                  config: {
                    condition: { kind: "output_equals", name: "item", value: "skip" },
                    then_steps: [{ type: "continue_loop", graph_node_id: "continue-node", config: {} }],
                    else_steps: [],
                  },
                },
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "visited", value_type: "text", value: "{{item}}" },
                    ],
                  },
                },
                {
                  type: "if_condition",
                  config: {
                    condition: { kind: "output_equals", name: "item", value: "stop" },
                    then_steps: [{ type: "break_loop", graph_node_id: "break-node", config: {} }],
                    else_steps: [],
                  },
                },
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "after_break", value_type: "text", value: "bad" },
                    ],
                  },
                },
              ],
            },
          }),
          step("after", "After loop", {
            type: "set_variable",
            config: {
              variables: [{ name: "after_loop", value_type: "text", value: "done" }],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
      onProgress: (state) => progress.push(state),
    });

    expect(result.status).toBe("success");
    expect(result.completed_step_ids).toEqual(["loop", "after"]);
    expect(result.outputs?.visited).toBe("stop");
    expect(result.outputs?.after_break).toBeUndefined();
    expect(result.outputs?.after_loop).toBe("done");
    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ current_step_id: "continue-node" }),
        expect.objectContaining({ current_step_id: "break-node" }),
        expect.objectContaining({ current_step_id: "loop" }),
        expect.objectContaining({ current_step_id: "after" }),
      ]),
    );
    expect(result.current_step_id).toBeNull();
  });

  test("evaluates browser-backed conditions and runs repeat-until timeout steps", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("open", "Open", {
            type: "navigate",
            config: { url: "https://owned.test/ready" },
          }),
          step("branch", "Branch", {
            type: "if_condition",
            config: {
              condition: { kind: "url_contains", value: "/ready" },
              then_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "url_branch", value_type: "text", value: "matched" },
                    ],
                  },
                },
              ],
              else_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "url_branch", value_type: "text", value: "missed" },
                    ],
                  },
                },
              ],
            },
          }),
          step("until", "Until", {
            type: "repeat_until",
            config: {
              condition: { kind: "output_equals", name: "ready", value: "yes" },
              max_attempts: 1,
              steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "ready", value_type: "text", value: "not-yet" },
                    ],
                  },
                },
              ],
              timeout_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "until_timeout", value_type: "text", value: "ran" },
                    ],
                  },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs).toMatchObject({
      url_branch: "matched",
      ready: "not-yet",
      until_timeout: "ran",
    });
  });

  test("treats a missing current URL as a non-match for login-style URL conditions", async () => {
    class MissingHrefPage extends FakePage {
      override async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
        if (typeof pageFunction === "string" && pageFunction.includes("window.location.href")) {
          return undefined;
        }
        return super.evaluate(pageFunction, arg);
      }
    }

    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(new MissingHrefPage())),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("login-branch", "Login detected", {
            type: "if_condition",
            config: {
              condition: { kind: "url_contains", value: "/login" },
              then_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "login_branch", value_type: "text", value: "matched" },
                    ],
                  },
                },
              ],
              else_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "login_branch", value_type: "text", value: "missed" },
                    ],
                  },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.login_branch).toBe("missed");
  });

  test("matches login-style URL conditions against the live browser href expression", async () => {
    class BrowserExpressionPage extends FakePage {
      override async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
        if (pageFunction === "() => window.location.href") {
          return undefined;
        }
        if (pageFunction === "window.location.href") {
          return this.urlValue;
        }
        return super.evaluate(pageFunction, arg);
      }
    }

    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(new BrowserExpressionPage())),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("open", "Open", {
            type: "navigate",
            config: { url: "http://localhost:8327/management.html#/login" },
          }),
          step("login-branch", "Login detected", {
            type: "if_condition",
            config: {
              condition: { kind: "url_contains", value: "/management.html#/login" },
              then_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "login_branch", value_type: "text", value: "matched" },
                    ],
                  },
                },
              ],
              else_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "login_branch", value_type: "text", value: "missed" },
                    ],
                  },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.outputs?.login_branch).toBe("matched");
  });

  test("reports nested If branch graph nodes before continuing the top-level run", async () => {
    const progress: string[] = [];
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    await runner.run({
      graph: {
        steps: [
          step("branch", "Branch", {
            type: "if_condition",
            config: {
              condition: { kind: "url_contains", value: "about:blank" },
              then_steps: [
                {
                  graph_node_id: "true-node",
                  graph_label: "True Node",
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "branch_state", value_type: "text", value: "true" },
                    ],
                  },
                },
              ],
              else_steps: [],
            },
          }),
          step("done", "Done", {
            type: "set_variable",
            config: {
              variables: [
                { name: "done_state", value_type: "text", value: "continued" },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
      onProgress(state) {
        if (state.current_step_id) progress.push(state.current_step_id);
      },
    });

    expect(progress).toContain("true-node");
    expect(progress.indexOf("true-node")).toBeLessThan(progress.lastIndexOf("done"));
  });

  test("runs Router first matching case and then continues after the router step", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("seed", "Seed", {
            type: "set_variable",
            config: {
              variables: [{ name: "state", value_type: "text", value: "challenge-visible" }],
            },
          }),
          step("router", "Router", {
            type: "router_condition",
            config: {
              mode: "first_match",
              cases: [
                {
                  id: "expired",
                  label: "Expired",
                  condition: { kind: "output_equals", name: "state", value: "expired" },
                  steps: [
                    {
                      type: "set_variable",
                      config: {
                        variables: [{ name: "branch", value_type: "text", value: "expired" }],
                      },
                    },
                  ],
                },
                {
                  id: "challenge",
                  label: "Challenge",
                  condition: { kind: "output_contains", name: "state", value: "challenge" },
                  steps: [
                    {
                      type: "set_variable",
                      config: {
                        variables: [{ name: "branch", value_type: "text", value: "challenge" }],
                      },
                    },
                  ],
                },
              ],
              default_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [{ name: "branch", value_type: "text", value: "default" }],
                  },
                },
              ],
            },
          }),
          step("done", "Done", {
            type: "set_variable",
            config: {
              variables: [{ name: "after_router", value_type: "text", value: "continued" }],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs).toMatchObject({
      branch: "challenge",
      after_router: "continued",
    });
  });

  test("runs Router default steps when no case matches", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("router", "Router", {
            type: "router_condition",
            config: {
              mode: "first_match",
              cases: [
                {
                  id: "expired",
                  label: "Expired",
                  condition: { kind: "output_equals", name: "state", value: "expired" },
                  steps: [
                    {
                      type: "set_variable",
                      config: {
                        variables: [{ name: "branch", value_type: "text", value: "expired" }],
                      },
                    },
                  ],
                },
              ],
              default_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [{ name: "branch", value_type: "text", value: "default" }],
                  },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.branch).toBe("default");
  });

  test("runs weighted Random Choice branch and stores the selected choice id", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
      random: () => 0.8,
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("random", "Random Choice", {
            type: "random_choice",
            config: {
              output_name: "selected_action",
              choices: [
                {
                  id: "like",
                  label: "Like",
                  weight: 3,
                  steps: [
                    {
                      type: "set_variable",
                      config: {
                        variables: [{ name: "branch", value_type: "text", value: "like" }],
                      },
                    },
                  ],
                },
                {
                  id: "comment",
                  label: "Comment",
                  weight: 1,
                  steps: [
                    {
                      type: "set_variable",
                      config: {
                        variables: [{ name: "branch", value_type: "text", value: "comment" }],
                      },
                    },
                  ],
                },
              ],
            },
          } as ActionConfig),
          step("done", "Done", {
            type: "set_variable",
            config: {
              variables: [{ name: "after_random", value_type: "text", value: "continued" }],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs).toMatchObject({
      selected_action: "comment",
      branch: "comment",
      after_random: "continued",
    });
  });

  test("records nested branch traces with parent and sequence metadata", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("seed", "Seed", {
            type: "set_variable",
            config: {
              variables: [{ name: "state", value_type: "text", value: "ready" }],
            },
          }),
          step("if", "If", {
            type: "if_condition",
            config: {
              condition: { kind: "output_equals", name: "state", value: "ready" },
              then_steps: [
                {
                  type: "set_variable",
                  graph_node_id: "then-a",
                  graph_label: "Then A",
                  config: {
                    variables: [{ name: "branch.first", value_type: "text", value: "a" }],
                  },
                },
                {
                  type: "set_variable",
                  graph_node_id: "then-b",
                  graph_label: "Then B",
                  config: {
                    variables: [{ name: "branch.second", value_type: "text", value: "b" }],
                  },
                },
              ],
              else_steps: [],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.__action_traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "then-a",
          label: "Then A",
          action_type: "set_variable",
          parent_node_id: "if",
          trace_sequence: 1,
          output_summary: {
            added_keys: ["branch.first"],
            changed_keys: [],
            removed_keys: [],
          },
          status: "success",
        }),
        expect.objectContaining({
          node_id: "then-b",
          label: "Then B",
          action_type: "set_variable",
          parent_node_id: "if",
          trace_sequence: 2,
          output_summary: {
            added_keys: ["branch.second"],
            changed_keys: [],
            removed_keys: [],
          },
          status: "success",
        }),
        expect.objectContaining({
          node_id: "if",
          action_type: "if_condition",
          trace_sequence: 3,
          status: "success",
        }),
      ]),
    );
  });

  test("populates output_values in action trace with delta variable values", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("first", "First Step", {
            type: "set_variable",
            config: {
              variables: [
                { name: "var1", value_type: "text", value: "hello" },
                { name: "var2", value_type: "number", value: "42" },
              ],
            },
          }),
          step("second", "Second Step", {
            type: "set_variable",
            config: {
              variables: [
                { name: "var1", value_type: "text", value: "world" },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    const traces = result.outputs?.__action_traces as Array<Record<string, any>>;

    const firstTrace = traces.find(t => t.node_id === "first");
    expect(firstTrace).toBeDefined();
    expect(firstTrace?.output_summary).toEqual({
      added_keys: ["var1", "var2"],
      changed_keys: [],
      removed_keys: [],
    });
    expect(firstTrace?.output_values).toEqual({
      var1: "hello",
      var2: 42,
    });

    const secondTrace = traces.find(t => t.node_id === "second");
    expect(secondTrace).toBeDefined();
    expect(secondTrace?.output_summary).toEqual({
      added_keys: [],
      changed_keys: ["var1"],
      removed_keys: [],
    });
    expect(secondTrace?.output_values).toEqual({
      var1: "world",
    });
  });

  test("records repeated loop body traces with stable sequence metadata", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("seed", "Seed", {
            type: "set_variable",
            config: {
              variables: [{ name: "keep_going", value_type: "text", value: "yes" }],
            },
          }),
          step("while", "While", {
            type: "while_loop",
            config: {
              condition: { kind: "output_equals", name: "keep_going", value: "yes" },
              max_attempts: 2,
              timeout_ms: null,
              steps: [
                {
                  type: "set_variable",
                  graph_node_id: "loop-body",
                  graph_label: "Loop Body",
                  config: {
                    variables: [{ name: "last_loop", value_type: "text", value: "ran" }],
                  },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });
    const traces = result.outputs?.__action_traces as Array<Record<string, unknown>>;

    expect(result.status).toBe("success");
    expect(result.completed_step_ids.filter((stepId) => stepId === "loop-body"))
      .toEqual(["loop-body", "loop-body"]);
    expect(
      traces.filter((trace) => trace.node_id === "loop-body").map((trace) => ({
        parent_node_id: trace.parent_node_id,
        trace_sequence: trace.trace_sequence,
        status: trace.status,
      })),
    ).toEqual([
      { parent_node_id: "while", trace_sequence: 1, status: "success" },
      { parent_node_id: "while", trace_sequence: 2, status: "success" },
    ]);
  });

  test("records retry attempt traces and final control-node status", async () => {
    class RetryPage extends FakePage {
      attempts = 0;

      override async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
        if (typeof pageFunction === "string" && pageFunction.includes("__retry_value__")) {
          this.attempts += 1;
          return this.attempts === 1 ? "not-ready" : "ready";
        }
        return super.evaluate(pageFunction, arg);
      }
    }
    const page = new RetryPage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
      sleep: async () => {},
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("retry", "Retry", {
            type: "retry_block",
            config: {
              max_attempts: 2,
              delay_ms: 1,
              steps: [
                {
                  type: "execute_js",
                  graph_node_id: "retry-script",
                  graph_label: "Retry Script",
                  config: {
                    script: "return '__retry_value__'",
                    output_name: "retry_value",
                    timeout_ms: 1000,
                  },
                },
                {
                  type: "assert_output",
                  graph_node_id: "retry-assert",
                  graph_label: "Retry Assert",
                  config: {
                    name: "retry_value",
                    match_mode: "equals",
                    value: "ready",
                  },
                },
              ],
              failed_steps: [],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });
    const traces = result.outputs?.__action_traces as Array<Record<string, unknown>>;

    expect(result.status).toBe("success");
    expect(
      traces.map((trace) => ({
        node_id: trace.node_id,
        parent_node_id: trace.parent_node_id,
        trace_sequence: trace.trace_sequence,
        status: trace.status,
      })),
    ).toEqual([
      { node_id: "retry-script", parent_node_id: "retry", trace_sequence: 0, status: "success" },
      { node_id: "retry-assert", parent_node_id: "retry", trace_sequence: 1, status: "failed" },
      { node_id: "retry-script", parent_node_id: "retry", trace_sequence: 2, status: "success" },
      { node_id: "retry-assert", parent_node_id: "retry", trace_sequence: 3, status: "success" },
      { node_id: "retry", parent_node_id: undefined, trace_sequence: 4, status: "success" },
    ]);
    expect(traces[0]).toMatchObject({
      output_summary: {
        added_keys: ["retry_value"],
        changed_keys: [],
        removed_keys: [],
      },
    });
    expect(traces[2]).toMatchObject({
      output_summary: {
        added_keys: [],
        changed_keys: ["retry_value"],
        removed_keys: [],
      },
    });
  });

  test("fails run when a compiled step has an unknown action type", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("unknown", "Unknown", {
            type: "mystery_action",
            config: {},
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "unknown",
      action_type: "mystery_action",
      reason: "Unsupported action type: mystery_action",
    });
  });

  test("fails run when a compiled condition has an unknown kind", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("if", "If", {
            type: "if_condition",
            config: {
              condition: { kind: "fingerprint_score", name: "score", value: "low" },
              then_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [{ name: "branch", value_type: "text", value: "then" }],
                  },
                },
              ],
              else_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [{ name: "branch", value_type: "text", value: "else" }],
                  },
                },
              ],
            },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "if",
      action_type: "if_condition",
      reason: "Unsupported condition kind: fingerprint_score",
    });
    expect(result.outputs?.branch).toBeUndefined();
  });

  test("executes graph no-op actions without changing browser state or outputs", async () => {
    const context = new FakeContext();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("merge", "Merge", {
            type: "graph_noop",
            config: { kind: "merge" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs).not.toHaveProperty("merge");
    expect(context.pages()[0].events).toEqual([]);
  });

  test("honors loop timeout semantics", async () => {
    let sleepCalls = 0;
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
      sleep: async () => {
        sleepCalls += 1;
      },
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("repeat-timeout", "Repeat timeout", {
            type: "repeat_until",
            config: {
              condition: { kind: "output_equals", name: "done", value: "yes" },
              max_attempts: 100,
              timeout_ms: 1,
              steps: [
                { type: "wait", config: { condition: "duration", duration_ms: 2 } },
              ],
              timeout_steps: [
                {
                  type: "set_variable",
                  config: { name: "timed_out", value_type: "text", value: "yes" },
                },
              ],
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs).toMatchObject({ timed_out: "yes" });
    expect(sleepCalls).toBeGreaterThan(0);
  });

  test("fails set-json variables when the rendered JSON root is not an object", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("json", "JSON", {
            type: "set_json_variables",
            config: { json: "[1,2,3]" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error?.reason).toBe("JSON variables must be an object");
  });

  test("enforces domain allowlist against the current page hostname", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const allowed = await runner.run({
      graph: {
        steps: [
          step("open", "Open", {
            type: "navigate",
            config: { url: "https://sub.owned.test/path" },
          }),
          step("allow", "Allow", {
            type: "domain_allowlist",
            config: { domains: ["owned.test"] },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(allowed.status).toBe("success");

    const blocked = await runner.run({
      graph: {
        steps: [
          step("open", "Open", {
            type: "navigate",
            config: { url: "https://unowned.test/path" },
          }),
          step("allow", "Allow", {
            type: "domain_allowlist",
            config: { domains: ["owned.test"] },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(blocked.status).toBe("failed");
    expect(blocked.error).toMatchObject({
      step_id: "allow",
      reason: "Current domain unowned.test is not in the allowlist",
    });
  });

  test("enforces run domain policy before navigation side effects", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const blocked = await runner.run({
      graph: {
        domain_policy: { allowed_domains: ["owned.test"] },
        steps: [
          step("seed", "Seed", {
            type: "set_variable",
            config: { name: "host", value_type: "text", value: "evil.test" },
          }),
          step("blocked", "Blocked", {
            type: "navigate",
            config: { url: "https://{{host}}/login" },
          }),
        ],
      } as CompiledWorkflowGraph & { domain_policy: { allowed_domains: string[] } },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(blocked.status).toBe("failed");
    expect(blocked.error).toMatchObject({
      step_id: "blocked",
      action_type: "navigate",
      reason: expect.stringContaining("Navigation to evil.test is not in the allowlist"),
    });
    expect(page.events).not.toContain("goto:https://evil.test/login");

    const allowed = await runner.run({
      graph: {
        domain_policy: { allowed_domains: ["owned.test"] },
        steps: [
          step("open-tab", "Open tab", {
            type: "open_new_tab",
            config: { url: "https://app.owned.test/dashboard" },
          }),
        ],
      } as CompiledWorkflowGraph & { domain_policy: { allowed_domains: string[] } },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(allowed.status).toBe("success");
    expect(page.events).toContain("goto:https://app.owned.test/dashboard");
  });

  test("fails when switching to a missing tab index", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("switch-missing", "Switch missing", {
            type: "switch_tab",
            config: { index: 2 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "switch-missing",
      action_type: "switch_tab",
      reason: "Tab index 2 does not exist",
    });
  });

  test("fails when closing a missing tab index", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("close-missing", "Close missing", {
            type: "close_tab",
            config: { index: 3 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "close-missing",
      action_type: "close_tab",
      reason: "Tab index 3 does not exist",
    });
  });

  test("rejects screenshot paths outside run evidence", async () => {
    const appPaths = await createTempAppPaths();
    const runner = new BrowserWorkflowRunner({
      appPaths,
      driver: createFakeDriver(new FakeContext()),
    });

    for (const unsafePath of [
      path.join(appPaths.rootDir, "outside.png"),
      `file://${path.join(appPaths.rootDir, "outside.png")}`,
      "../outside.png",
    ]) {
      const result = await runner.run({
        runId: `run-${unsafePath.length}`,
        graph: {
          steps: [
            step("shot", "Shot", {
              type: "take_screenshot",
              config: {
                path: unsafePath,
                output_name: "shot",
                full_page: true,
              },
            }),
          ],
        },
        settings: makeSettings(),
        mode: "run_workflow",
      });

      expect(result.status).toBe("failed");
      expect(result.error).toMatchObject({
        step_id: "shot",
        reason: expect.stringContaining("Screenshot path must be a safe artifact name"),
      });
    }
  });

  test("writes screenshots to run-scoped evidence and records metadata", async () => {
    const appPaths = await createTempAppPaths();
    const runner = new BrowserWorkflowRunner({
      appPaths,
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      runId: "run-evidence-1",
      graph: {
        steps: [
          step("shot", "Shot", {
            type: "take_screenshot",
            config: {
              path: "checkout receipt.png",
              output_name: "shot",
              full_page: true,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.shot).toBe(
      "runs/run-evidence-1/screenshots/001-shot-checkout-receipt.png",
    );
    expect(result.outputs?.__evidence).toEqual([
      expect.objectContaining({
        run_id: "run-evidence-1",
        node_id: "shot",
        step_number: 1,
        action_type: "take_screenshot",
        artifact_kind: "screenshot",
        path: "runs/run-evidence-1/screenshots/001-shot-checkout-receipt.png",
      }),
    ]);
    expect(result.outputs?.__action_traces).toEqual([
      expect.objectContaining({
        node_id: "shot",
        evidence_summary: [
          {
            artifact_kind: "screenshot",
            path: "runs/run-evidence-1/screenshots/001-shot-checkout-receipt.png",
          },
        ],
        output_summary: {
          added_keys: ["shot"],
          changed_keys: [],
          removed_keys: [],
        },
      }),
    ]);
    await expect(
      fs.stat(path.join(appPaths.evidenceDir, String(result.outputs?.shot))),
    ).resolves.toMatchObject({ size: 3 });
  });

  test("failure screenshots use distinct run-scoped evidence paths", async () => {
    const appPaths = await createTempAppPaths();
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths,
      driver: createFakeDriver(new FakeContext(page)),
    });
    const failingGraph = {
      steps: [
        step("blocked", "Blocked", {
          type: "assert_text",
          config: { text: "Missing", match_mode: "contains" },
        }),
      ],
    };

    const first = await runner.run({
      runId: "failed-run-1",
      graph: failingGraph,
      settings: makeSettings(),
      mode: "run_workflow",
    });
    const second = await runner.run({
      runId: "failed-run-2",
      graph: failingGraph,
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(first.status).toBe("failed");
    expect(second.status).toBe("failed");
    expect(first.outputs?.failure_screenshot).toBe(
      "runs/failed-run-1/screenshots/001-blocked-failure.png",
    );
    expect(second.outputs?.failure_screenshot).toBe(
      "runs/failed-run-2/screenshots/001-blocked-failure.png",
    );
    await expect(
      fs.stat(path.join(appPaths.evidenceDir, String(first.outputs?.failure_screenshot))),
    ).resolves.toMatchObject({ size: 3 });
    await expect(
      fs.stat(path.join(appPaths.evidenceDir, String(second.outputs?.failure_screenshot))),
    ).resolves.toMatchObject({ size: 3 });
  });

  test("applies runtime browser context actions through driver APIs", async () => {
    const page = new FakePage();
    const context = new FakeContext(page);
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("headers", "Headers", {
            type: "set_extra_headers",
            config: { headers: [{ name: "X-Owned", value: "yes" }] },
          }),
          step("permission", "Permission", {
            type: "grant_permission",
            config: { origin: "https://owned.test", permissions: ["geolocation"] },
          }),
          step("cookie", "Cookie", {
            type: "set_cookie",
            config: { name: "sid", value: "123", domain: "owned.test", path: "/" },
          }),
          step("geo", "Geolocation", {
            type: "set_geolocation",
            config: { latitude: 10.5, longitude: 20.5, accuracy: 9 },
          }),
          step("viewport", "Viewport", {
            type: "set_viewport",
            config: {
              width: 390,
              height: 844,
              device_scale_factor: 1,
              mobile: false,
              touch: false,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(context.events).toEqual([
      "headers:{\"X-Owned\":\"yes\"}",
      "permissions:https://owned.test:geolocation",
      "cookies:sid=123",
      "geolocation:10.5:20.5:9",
    ]);
    expect(page.events).toContain("viewport:390:844");
  });

  test("infers the current page host for set_cookie when domain is blank", async () => {
    const page = new FakePage();
    const context = new FakeContext(page);
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("open", "Open", {
            type: "navigate",
            config: { url: "https://owned.test/account" },
          }),
          step("cookie", "Cookie", {
            type: "set_cookie",
            config: { name: "sid", value: "123", domain: null, path: "/" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(context.addedCookies).toContainEqual(
      expect.objectContaining({
        name: "sid",
        value: "123",
        domain: "owned.test",
        path: "/",
      }),
    );
  });

  test("sets runtime viewport width and height", async () => {
    const page = new FakePage();
    const context = new FakeContext(page);
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(context),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("viewport", "Viewport", {
            type: "set_viewport",
            config: { width: 390, height: 844 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toContain("viewport:390:844");
  });

  test("executes drag and drop through the driver instead of hover-only success", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("drag", "Drag", {
            type: "drag_and_drop",
            config: {
              source_xpath: "#source",
              target_xpath: "#target",
              wait_until: null,
              timeout_ms: null,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining(["dragTo:#source:#target"]),
    );
  });

  test("drags to a percentage inside the target element when target position is configured", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("drag", "Drag", {
            type: "drag_and_drop",
            config: {
              source_xpath: "#thumb",
              target_xpath: "#track",
              target_position: { mode: "percent", x_percent: 82, y_percent: 50 },
              wait_until: null,
              timeout_ms: null,
            },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "move:60:40",
        "mouseDown:left",
        "move:92:40",
        "mouseUp:left",
      ]),
    );
    expect(page.events).not.toContain("dragTo:#thumb:#track");
  });

  test("drags source and target elements resolved from runtime refs", async () => {
    const page = new RankedElementPage({
      ".drag-card": [
        { x: 30, y: 40, width: 120, height: 48 },
        { x: 560, y: 300, width: 120, height: 48 },
      ],
      ".drop-lane": [
        { x: 20, y: -300, width: 220, height: 160 },
        { x: 620, y: 260, width: 220, height: 160 },
      ],
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-source", "Find Source", {
            type: "find_element",
            config: {
              output_name: "current_card",
              target: {
                locators: [{ kind: "css", value: ".drag-card" }],
                constraints: { visible: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("find-target", "Find Target", {
            type: "find_element",
            config: {
              output_name: "current_lane",
              target: {
                locators: [{ kind: "css", value: ".drop-lane" }],
                constraints: { visible: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("drag", "Drag", {
            type: "drag_and_drop",
            config: {
              source_ref: "current_card",
              target_ref: "current_lane",
              wait_until: null,
              timeout_ms: null,
            },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.current_card).toMatchObject({
      kind: "element_ref",
      locator: ".drag-card",
      index: 1,
    });
    expect(result.outputs?.current_lane).toMatchObject({
      kind: "element_ref",
      locator: ".drop-lane",
      index: 1,
    });
    expect(page.events).toEqual(
      expect.arrayContaining([
        "nth:.drag-card:1",
        "nth:.drop-lane:1",
        "dragTo:.drag-card >> nth=1:.drop-lane >> nth=1",
      ]),
    );
  });

  test("registers dialog actions through one-shot page handlers", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("accept", "Accept", {
            type: "accept_dialog",
            config: { prompt_text: "approved" },
          }),
          step("dismiss", "Dismiss", { type: "dismiss_dialog", config: {} }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual([
      "dialog-once",
      "dialog-accept:approved",
      "dialog-once",
      "dialog-dismiss",
    ]);
  });

  test("waits for downloads and stores them under run evidence", async () => {
    const appPaths = await createTempAppPaths();
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths,
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      runId: "download-run",
      graph: {
        steps: [
          step("download", "Download", {
            type: "wait_for_download",
            config: { output_name: "download_path", timeout_ms: 500 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.download_path).toBe(
      "runs/download-run/downloads/001-download-owned-report.csv",
    );
    expect(result.outputs?.__evidence).toEqual([
      expect.objectContaining({
        run_id: "download-run",
        node_id: "download",
        artifact_kind: "download",
        path: "runs/download-run/downloads/001-download-owned-report.csv",
      }),
    ]);
    await expect(
      fs.readFile(path.join(appPaths.evidenceDir, String(result.outputs?.download_path)), "utf8"),
    ).resolves.toBe("download");
  });

  test("fails when a selected action requires an unsupported driver method", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(new MinimalMethodPage())),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("type", "Type", {
            type: "type_sequence",
            config: { xpath: "#field", text: "abc" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({
      step_id: "type",
      action_type: "type_sequence",
      reason: "type_sequence requires driver support for locator.type",
    });
  });

  test("resolves structured element targets with ordered locators and constraints", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("click", "Click", {
            type: "click",
            config: {
              xpath: "#legacy",
              target: {
                locators: [
                  { kind: "css", value: "#hidden" },
                  { kind: "text", value: "Continue" },
                ],
                constraints: { visible: true, enabled: true },
              },
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "locator:#hidden",
        "isVisible:#hidden",
        "getByText:Continue",
        "isVisible:text=Continue",
        "isEnabled:text=Continue",
        "click:text=Continue",
      ]),
    );
  });

  test("finds a viewport-ranked element and clicks it by runtime ref", async () => {
    const page = new RankedElementPage({
      "article button[aria-label^=\"Like video\"][aria-pressed=\"false\"]": [
        { x: 20, y: -420, width: 52, height: 52 },
        { x: 620, y: 338, width: 52, height: 52 },
        { x: 620, y: 1020, width: 52, height: 52 },
      ],
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-like", "Find Like", {
            type: "find_element",
            config: {
              output_name: "current_like",
              target: {
                locators: [
                  {
                    kind: "css",
                    value: 'article button[aria-label^="Like video"][aria-pressed="false"]',
                  },
                ],
                constraints: { visible: true, enabled: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("click-like", "Click Like", {
            type: "click",
            config: { target_ref: "current_like" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.current_like).toMatchObject({
      kind: "element_ref",
      ref_id: expect.any(String),
      locator: 'article button[aria-label^="Like video"][aria-pressed="false"]',
      index: 1,
      rank: "nearest_viewport_center",
    });
    expect(page.events).toEqual(
      expect.arrayContaining([
        'locator:article button[aria-label^="Like video"][aria-pressed="false"]',
        'boundingBox:article button[aria-label^="Like video"][aria-pressed="false"] >> nth=1:1:338',
        'nth:article button[aria-label^="Like video"][aria-pressed="false"]:1',
        'click:article button[aria-label^="Like video"][aria-pressed="false"] >> nth=1',
      ]),
    );
  });

  test("uses runtime element refs as Custom Select triggers", async () => {
    const page = new RankedElementPage({
      ".custom-trigger": [
        { x: 20, y: -220, width: 120, height: 40 },
        { x: 640, y: 340, width: 120, height: 40 },
      ],
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-trigger", "Find Trigger", {
            type: "find_element",
            config: {
              output_name: "current_dropdown",
              target: {
                locators: [{ kind: "css", value: ".custom-trigger" }],
                constraints: { visible: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("select-hd", "Select HD", {
            type: "select_custom_option",
            config: { trigger_ref: "current_dropdown", option_text: "HD" },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "nth:.custom-trigger:1",
        "click:.custom-trigger >> nth=1",
        "locator:text=HD",
        "click:text=HD",
      ]),
    );
  });

  test("element-visible logic conditions consume runtime element refs", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-panel", "Find Panel", {
            type: "find_element",
            config: {
              output_name: "hidden_panel",
              target: { locators: [{ kind: "css", value: "#hidden" }] },
              rank: "first",
            },
          }),
          step("branch", "Branch", {
            type: "if_condition",
            config: {
              condition: { kind: "element_visible", target_ref: "hidden_panel" },
              then_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "visible_result", value_type: "text", value: "yes" },
                    ],
                  },
                },
              ],
              else_steps: [
                {
                  type: "set_variable",
                  config: {
                    variables: [
                      { name: "visible_result", value_type: "text", value: "no" },
                    ],
                  },
                },
              ],
            },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.visible_result).toBe("no");
    expect(page.events).toEqual(expect.arrayContaining(["isVisible:#hidden"]));
    expect(page.events).not.toContain("isVisible:body");
  });

  test("blurs the element resolved from a runtime ref", async () => {
    const page = new RankedElementPage({
      ".focus-field": [
        { x: 10, y: -100, width: 180, height: 36 },
        { x: 500, y: 300, width: 180, height: 36 },
      ],
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-field", "Find Field", {
            type: "find_element",
            config: {
              output_name: "current_field",
              target: {
                locators: [{ kind: "css", value: ".focus-field" }],
                constraints: { visible: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("blur-field", "Blur Field", {
            type: "blur_element",
            config: { target_ref: "current_field" },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "nth:.focus-field:1",
        "evaluate:.focus-field >> nth=1",
      ]),
    );
    expect(page.events).not.toContain("press:Tab");
  });

  test("lets data capture actions consume runtime element refs", async () => {
    const page = new RankedElementPage({
      ".owned-card": [
        { x: 10, y: 20, width: 120, height: 40 },
        { x: 420, y: 300, width: 180, height: 80 },
      ],
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-card", "Find Card", {
            type: "find_element",
            config: {
              output_name: "current_card",
              target: {
                locators: [{ kind: "css", value: ".owned-card" }],
                constraints: { visible: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("extract-card", "Extract Card", {
            type: "extract_text",
            config: { target_ref: "current_card", output_name: "card_text" },
          } as ActionConfig),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(result.outputs?.card_text).toBe("Owned Fixture");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "nth:.owned-card:1",
        "boundingBox:.owned-card >> nth=1:1:300",
      ]),
    );
  });

  test("submits forms through runtime element refs", async () => {
    const page = new RankedElementPage({
      ".submit-button": [
        { x: 30, y: 40, width: 120, height: 44 },
        { x: 500, y: 260, width: 120, height: 44 },
      ],
    });
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("find-submit", "Find Submit", {
            type: "find_element",
            config: {
              output_name: "current_submit",
              target: {
                locators: [{ kind: "css", value: ".submit-button" }],
                constraints: { visible: true },
              },
              filter: { in_viewport: true },
              rank: "nearest_viewport_center",
            },
          }),
          step("submit", "Submit", {
            type: "submit_form",
            config: { target_ref: "current_submit" },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "nth:.submit-button:1",
        "click:.submit-button >> nth=1",
      ]),
    );
    expect(page.events).not.toContain("press:Enter");
  });

  test("supports target locator kinds and iframe targets", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("test-id", "Test id", {
            type: "click",
            config: {
              xpath: "#legacy",
              target: { locators: [{ kind: "test_id", value: "submit" }] },
            },
          }),
          step("role", "Role", {
            type: "click",
            config: {
              xpath: "#legacy",
              target: { locators: [{ kind: "role", role: "button", value: "Pay" }] },
            },
          }),
          step("label", "Label", {
            type: "input_text",
            config: {
              xpath: "#legacy",
              text: "ada@example.test",
              clear_before_input: false,
              target: { locators: [{ kind: "label", value: "Email" }] },
            },
          }),
          step("placeholder", "Placeholder", {
            type: "input_text",
            config: {
              xpath: "#legacy",
              text: "Ada",
              clear_before_input: false,
              target: { locators: [{ kind: "placeholder", value: "Full name" }] },
            },
          }),
          step("attribute", "Attribute", {
            type: "click",
            config: {
              xpath: "#legacy",
              target: {
                locators: [{ kind: "attribute", attribute: "data-owned", value: "yes" }],
              },
            },
          }),
          step("iframe", "Iframe", {
            type: "click",
            config: {
              xpath: "#legacy",
              target: {
                iframe: { locators: [{ kind: "css", value: "iframe#checkout" }] },
                locators: [{ kind: "css", value: "#pay" }],
              },
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "getByTestId:submit",
        "getByRole:button:Pay",
        "getByLabel:Email",
        "getByPlaceholder:Full name",
        "locator:[data-owned=\"yes\"]",
        "frameLocator:iframe#checkout",
        "frameLocator.locator:#pay",
      ]),
    );
  });

  test("honors element action readiness waits before performing actions", async () => {
    const page = new FakePage();
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext(page)),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("click", "Click", {
            type: "click",
            config: {
              xpath: "#submit",
              wait_until: "clickable",
              timeout_ms: 1200,
            },
          }),
          step("input", "Input", {
            type: "input_text",
            config: {
              xpath: "#email",
              text: "ada@example.test",
              clear_before_input: false,
              wait_until: "enabled",
              timeout_ms: 1300,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toEqual(
      expect.arrayContaining([
        "waitFor:#submit:visible:1200",
        "isEnabled:#submit",
        "click:#submit",
        "waitFor:#email:visible:1300",
        "isEnabled:#email",
        "fill:#email:ada@example.test",
      ]),
    );
  });
});

test("createCloakBrowserDriver launches through cloakbrowser with humanize enabled", async () => {
  const launchContext = vi.fn(async () => new FakeContext());
  const launchPersistentContext = vi.fn(async () => new FakeContext());
  const driver = createCloakBrowserDriver({ launchContext, launchPersistentContext });

  await driver.launch({ headless: true, humanize: true });
  await driver.launchPersistent({ userDataDir: "/tmp/profile", headless: false, humanize: true });

  expect(launchContext).toHaveBeenCalledWith({ headless: true, humanize: true });
  expect(launchPersistentContext).toHaveBeenCalledWith({
    userDataDir: "/tmp/profile",
    headless: false,
    humanize: true,
  });
});

function step(nodeId: string, label: string, config: ActionConfig) {
  return { node_id: nodeId, label, config };
}

function makeSettings(
  overrides: {
    browser_launch?: Partial<WorkflowSettings["browser_launch"]>;
    environment?: Partial<WorkflowSettings["environment"]>;
    run_policy?: Partial<WorkflowSettings["run_policy"]>;
  } = {},
): WorkflowSettings {
  const base = defaultWorkflowSettings({
    id: "workflow-1",
    name: "Fixture",
    step_count: 0,
    created_at: "2026-05-09T00:00:00.000Z",
    updated_at: "2026-05-09T00:00:00.000Z",
  });
  return {
    ...base,
    browser_launch: { ...base.browser_launch, ...overrides.browser_launch },
    environment: { ...base.environment, ...overrides.environment },
    run_policy: { ...base.run_policy, ...overrides.run_policy },
  };
}

async function createTempAppPaths() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-runner-"));
  tempRoots.push(tempRoot);
  return createAppPaths(tempRoot);
}

function createFakeDriver(context: FakeContext) {
  const driver: BrowserDriver & {
    launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }>;
  } = {
    launches: [],
    async launch(options) {
      driver.launches.push({ kind: "temporary", options });
      return context;
    },
    async launchPersistent(options) {
      driver.launches.push({ kind: "persistent", options });
      return context;
    },
  };
  return driver;
}

class FakeContext implements BrowserDriverContext {
  closed = false;
  events: string[] = [];
  addedCookies: Array<Record<string, unknown>> = [];
  routes: Array<{
    matcher: string | RegExp | ((url: URL) => boolean);
    handler: (route: FakeRoute) => Promise<void> | void;
  }> = [];
  readonly page: FakePage;

  constructor(page = new FakePage()) {
    this.page = page;
  }

  pages() {
    return [this.page];
  }

  async newPage() {
    return this.page;
  }

  async close() {
    this.closed = true;
  }

  async addCookies(cookies: Array<Record<string, unknown>>) {
    this.addedCookies.push(...cookies);
    this.events.push(
      `cookies:${cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(",")}`,
    );
  }

  async grantPermissions(permissions: string[], options?: { origin?: string }) {
    this.events.push(`permissions:${options?.origin ?? "any"}:${permissions.join(",")}`);
  }

  async setExtraHTTPHeaders(headers: Record<string, string>) {
    this.events.push(`headers:${JSON.stringify(headers)}`);
  }

  async setGeolocation(geolocation: Record<string, unknown>) {
    this.events.push(
      `geolocation:${geolocation.latitude}:${geolocation.longitude}:${geolocation.accuracy}`,
    );
  }

  async route(
    matcher: string | RegExp | ((url: URL) => boolean),
    handler: (route: FakeRoute) => Promise<void> | void,
  ) {
    this.routes.push({ matcher, handler });
  }

  async triggerRoute(url: string) {
    const matchedRoute = this.routes.find((route) => {
      if (typeof route.matcher === "function") return route.matcher(new URL(url));
      if (typeof route.matcher === "string") return route.matcher === url;
      return route.matcher.test(url);
    });
    if (!matchedRoute) return null;

    const route = new FakeRoute();
    await matchedRoute.handler(route);
    return route.fulfilledResponse;
  }
}

class FakeRoute {
  fulfilledResponse: Record<string, unknown> | null = null;

  async abort() {}

  async fulfill(response: Record<string, unknown>) {
    this.fulfilledResponse = response;
  }

  async continue() {}
}

class FakePage implements BrowserDriverPage {
  events: string[] = [];
  urlValue = "about:blank";
  evaluateResult: unknown = null;

  async goto(url: string) {
    this.urlValue = url.endsWith("/") ? url : `${url}/`;
    this.events.push(`goto:${url}`);
  }

  locator(selector: string) {
    this.events.push(`locator:${selector}`);
    return new FakeLocator(selector, this.events);
  }

  getByTestId(testId: string) {
    this.events.push(`getByTestId:${testId}`);
    return new FakeLocator(`testid=${testId}`, this.events);
  }

  getByRole(role: string, options?: { name?: string }) {
    this.events.push(`getByRole:${role}:${options?.name ?? ""}`);
    return new FakeLocator(`role=${role}:${options?.name ?? ""}`, this.events);
  }

  getByLabel(label: string) {
    this.events.push(`getByLabel:${label}`);
    return new FakeLocator(`label=${label}`, this.events);
  }

  getByPlaceholder(placeholder: string) {
    this.events.push(`getByPlaceholder:${placeholder}`);
    return new FakeLocator(`placeholder=${placeholder}`, this.events);
  }

  getByText(text: string) {
    this.events.push(`getByText:${text}`);
    return new FakeLocator(`text=${text}`, this.events);
  }

  frameLocator(selector: string) {
    this.events.push(`frameLocator:${selector}`);
    return new FakeFrameLocator(this.events);
  }

  async waitForLoadState() {}

  async waitForURL() {}

  async waitForRequest() {
    return { url: () => this.urlValue };
  }

  async waitForResponse() {
    return { url: () => this.urlValue, status: () => 200 };
  }

  once(_eventName: "dialog", handler: (dialog: FakeDialog) => void) {
    this.events.push("dialog-once");
    handler(new FakeDialog(this.events));
  }

  async waitForEvent(eventName: "download") {
    this.events.push(`waitForEvent:${eventName}`);
    return new FakeDownload(this.events);
  }

  async goBack() {}

  async goForward() {}

  async reload() {}

  async bringToFront() {}

  async close() {}

  async screenshot() {
    return Buffer.from("png");
  }

  async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
    if (this.evaluateResult != null) {
      this.events.push("evaluate:custom");
      return this.evaluateResult;
    }
    if (typeof pageFunction === "string" && pageFunction.includes("window.location.href")) {
      return this.urlValue;
    }
    if (isScrollEvaluationArg(arg)) {
      this.events.push(`scrollBy:${arg.deltaX}:${arg.deltaY}`);
      return null;
    }
    if (isClipboardEvaluationArg(arg)) {
      this.events.push(`clipboard:${arg.text}`);
      return null;
    }
    if (isStorageEvaluationArg(arg)) {
      this.events.push(`${arg.storage}Storage:${arg.key}:${arg.value}`);
      return null;
    }
    if (typeof pageFunction === "function") {
      return pageFunction(arg);
    }
    return null;
  }

  async evaluateHandle() {
    return {};
  }

  async addInitScript() {}

  async setViewportSize(viewport: { width: number; height: number }) {
    this.events.push(`viewport:${viewport.width}:${viewport.height}`);
  }

  keyboard = {
    press: async (key: string) => {
      this.events.push(`press:${key}`);
    },
    down: async (key: string) => {
      this.events.push(`down:${key}`);
    },
    up: async (key: string) => {
      this.events.push(`up:${key}`);
    },
    type: async (text: string) => {
      this.events.push(`keyboard:${text}`);
    },
  };

  mouse = {
    move: async (x: number, y: number) => {
      this.events.push(`move:${x}:${y}`);
    },
    down: async (options?: { button?: string }) => {
      this.events.push(`mouseDown:${options?.button ?? "left"}`);
    },
    up: async (options?: { button?: string }) => {
      this.events.push(`mouseUp:${options?.button ?? "left"}`);
    },
    wheel: async (x: number, y: number) => {
      this.events.push(`wheel:${x}:${y}`);
    },
  };
}

class HumanScrollPage extends FakePage {
  readonly viewport = { width: 800, height: 600 };
  readonly targetLocator: HumanScrollLocator;
  scrollY = 0;

  constructor(private readonly options: { targetDocumentY: number; initialScrollY?: number }) {
    super();
    this.scrollY = options.initialScrollY ?? 0;
    this.targetLocator = new HumanScrollLocator("testid=cta", this);
  }

  override getByTestId(testId: string) {
    this.events.push(`getByTestId:${testId}`);
    return this.targetLocator;
  }

  override async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
    if (typeof pageFunction === "function" && pageFunction.toString().includes("innerWidth")) {
      return this.viewport;
    }
    return super.evaluate(pageFunction, arg);
  }

  override mouse = {
    move: async (x: number, y: number) => {
      this.events.push(`move:${x}:${y}`);
    },
    down: async (options?: { button?: string }) => {
      this.events.push(`mouseDown:${options?.button ?? "left"}`);
    },
    up: async (options?: { button?: string }) => {
      this.events.push(`mouseUp:${options?.button ?? "left"}`);
    },
    wheel: async (x: number, y: number) => {
      this.scrollY += y;
      this.events.push(`wheel:${x}:${y}`);
    },
  };

  targetBox() {
    return {
      x: 100,
      y: this.options.targetDocumentY - this.scrollY,
      width: 120,
      height: 40,
    };
  }
}

class FakeLocator {
  constructor(
    protected readonly selector: string,
    protected readonly events: string[],
  ) {}

  async fill(value: string) {
    this.events.push(`fill:${this.selector}:${value}`);
  }

  async type(value: string, options?: { delay?: number }) {
    this.events.push(`type:${this.selector}:${value}:${options?.delay ?? 0}`);
  }

  async click(options?: {
    button?: string;
    clickCount?: number;
    position?: { x: number; y: number };
  }) {
    if (options?.position || options?.clickCount) {
      this.events.push(
        `click:${this.selector}:${options.button ?? "left"}:${options.clickCount ?? 1}:${options.position?.x ?? "center"}:${options.position?.y ?? "center"}`,
      );
      return;
    }
    this.events.push(
      options?.button ? `click:${this.selector}:${options.button}` : `click:${this.selector}`,
    );
  }

  async evaluate(_pageFunction?: unknown, arg?: unknown) {
    if (isScrollIntoViewArg(arg)) {
      this.events.push(`scrollIntoView:${this.selector}:${arg.block}:${arg.inline}`);
      return null;
    }
    this.events.push(`evaluate:${this.selector}`);
    if (this.selector.includes("table")) {
      return [
        ["Name", "Status"],
        ["Fixture", "Ready"],
      ];
    }
    return null;
  }

  async hover() {
    this.events.push(`hover:${this.selector}`);
  }

  async dblclick() {
    this.events.push(`dblclick:${this.selector}`);
  }

  async check() {
    this.events.push(`check:${this.selector}`);
  }

  async uncheck() {
    this.events.push(`uncheck:${this.selector}`);
  }

  async selectOption() {
    this.events.push(`selectOption:${this.selector}`);
  }

  async setInputFiles() {
    this.events.push(`setInputFiles:${this.selector}`);
  }

  async press(key?: string) {
    this.events.push(`locatorPress:${this.selector}:${key ?? ""}`);
  }

  async textContent() {
    return "Owned Fixture";
  }

  async getAttribute(attribute: string) {
    return `attr:${attribute}`;
  }

  async inputValue() {
    return "input";
  }

  async boundingBox() {
    return { x: 10, y: 20, width: 100, height: 40 };
  }

  async count() {
    this.events.push(`count:${this.selector}`);
    return this.selector === "#missing" ? 0 : 1;
  }

  nth() {
    return this;
  }

  async isVisible() {
    this.events.push(`isVisible:${this.selector}`);
    return this.selector !== "#hidden";
  }

  async isEnabled() {
    this.events.push(`isEnabled:${this.selector}`);
    return this.selector !== "#blocked";
  }

  async waitFor(options?: { state?: string; timeout?: number }) {
    this.events.push(
      `waitFor:${this.selector}:${options?.state ?? "visible"}:${options?.timeout ?? "none"}`,
    );
  }

  async scrollIntoViewIfNeeded(options?: { timeout?: number }) {
    this.events.push(
      `scrollIntoViewIfNeeded:${this.selector}:${options?.timeout ?? "none"}`,
    );
  }

  async dragTo(target: FakeLocator) {
    this.events.push(`dragTo:${this.selector}:${target.selector}`);
  }
}

class HumanScrollLocator extends FakeLocator {
  constructor(
    selector: string,
    private readonly page: HumanScrollPage,
  ) {
    super(selector, page.events);
  }

  override async boundingBox() {
    const box = this.page.targetBox();
    this.events.push(`boundingBox:${this.selector}:${Math.round(box.y)}`);
    return box;
  }

  override async isVisible() {
    const box = this.page.targetBox();
    this.events.push(`isVisible:${this.selector}`);
    return box.y >= 0 && box.y + box.height <= this.page.viewport.height;
  }
}

class RankedElementPage extends FakePage {
  constructor(
    private readonly boxesBySelector: Record<
      string,
      Array<{ x: number; y: number; width: number; height: number }>
    >,
  ) {
    super();
  }

  override locator(selector: string) {
    this.events.push(`locator:${selector}`);
    const boxes = this.boxesBySelector[selector];
    if (boxes) return new RankedElementLocator(selector, this.events, boxes);
    return super.locator(selector);
  }

  override async evaluate(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown) {
    if (typeof pageFunction === "function" && pageFunction.toString().includes("innerWidth")) {
      return { width: 1280, height: 720 };
    }
    return super.evaluate(pageFunction, arg);
  }
}

class RankedElementLocator extends FakeLocator {
  constructor(
    selector: string,
    events: string[],
    private readonly boxes: Array<{ x: number; y: number; width: number; height: number }>,
    private readonly selectedIndex: number | null = null,
  ) {
    super(selector, events);
  }

  override async count() {
    this.events.push(`count:${this.selector}`);
    return this.selectedIndex == null ? this.boxes.length : 1;
  }

  override nth(index: number) {
    this.events.push(`nth:${this.selector}:${index}`);
    return new RankedElementLocator(
      `${this.selector} >> nth=${index}`,
      this.events,
      this.boxes,
      index,
    );
  }

  override async boundingBox() {
    const index = this.selectedIndex ?? 0;
    const box = this.boxes[index] ?? null;
    this.events.push(`boundingBox:${this.selector}:${index}:${box?.y ?? "null"}`);
    return box;
  }
}

class MissingTargetPage extends FakePage {
  readonly missingLocator = new MissingTargetLocator("testid=lazy-cta", this.events);

  override getByTestId(testId: string) {
    this.events.push(`getByTestId:${testId}`);
    return this.missingLocator;
  }
}

class MissingTargetLocator extends FakeLocator {
  override async boundingBox() {
    this.events.push(`boundingBox:${this.selector}:missing`);
    return null;
  }

  override async waitFor(options?: { state?: string; timeout?: number }) {
    this.events.push(
      `waitFor:${this.selector}:${options?.state ?? "visible"}:${options?.timeout ?? "none"}`,
    );
    throw new Error("Element did not become visible");
  }

  override async isVisible() {
    this.events.push(`isVisible:${this.selector}`);
    return false;
  }
}

class LazyLoadedTargetPage extends HumanScrollPage {
  readonly lazyLocator: LazyLoadedTargetLocator;
  private mounted = false;

  constructor() {
    super({ targetDocumentY: 1200 });
    this.lazyLocator = new LazyLoadedTargetLocator("testid=lazy-cta", this);
  }

  override getByTestId(testId: string) {
    this.events.push(`getByTestId:${testId}`);
    return this.lazyLocator;
  }

  override mouse = {
    move: async (x: number, y: number) => {
      this.events.push(`move:${x}:${y}`);
    },
    down: async (options?: { button?: string }) => {
      this.events.push(`mouseDown:${options?.button ?? "left"}`);
    },
    up: async (options?: { button?: string }) => {
      this.events.push(`mouseUp:${options?.button ?? "left"}`);
    },
    wheel: async (x: number, y: number) => {
      this.scrollY += y;
      this.events.push(`wheel:${x}:${y}`);
      if (!this.mounted && this.scrollY > 400) {
        this.mounted = true;
        this.events.push("mount:lazy-cta");
      }
    },
  };

  isMounted() {
    return this.mounted;
  }
}

class LazyLoadedTargetLocator extends HumanScrollLocator {
  constructor(
    selector: string,
    private readonly lazyPage: LazyLoadedTargetPage,
  ) {
    super(selector, lazyPage);
  }

  override async boundingBox() {
    if (!this.lazyPage.isMounted()) {
      this.events.push(`boundingBox:${this.selector}:missing`);
      return null;
    }
    return super.boundingBox();
  }

  override async isVisible() {
    if (!this.lazyPage.isMounted()) {
      this.events.push(`isVisible:${this.selector}:missing`);
      return false;
    }
    return super.isVisible();
  }
}

class FakeFrameLocator {
  constructor(private readonly events: string[]) {}

  locator(selector: string) {
    this.events.push(`frameLocator.locator:${selector}`);
    return new FakeLocator(selector, this.events);
  }
}

class MinimalMethodPage extends FakePage {
  override locator(selector: string) {
    this.events.push(`locator:${selector}`);
    return new MinimalMethodLocator(selector, this.events);
  }
}

class NativeFailingActionPage extends FakePage {
  override locator(selector: string) {
    this.events.push(`locator:${selector}`);
    return new NativeFailingActionLocator(selector, this.events);
  }
}

class MinimalMethodLocator {
  constructor(
    private readonly selector: string,
    private readonly events: string[],
  ) {}

  async fill(value: string) {
    this.events.push(`fill:${this.selector}:${value}`);
  }

  async click(options?: { button?: string }) {
    this.events.push(
      options?.button ? `click:${this.selector}:${options.button}` : `click:${this.selector}`,
    );
  }
}

class NativeFailingActionLocator extends FakeLocator {
  override async click() {
    this.events.push(`click-failed:${this.selector}`);
    throw new Error("native click failed");
  }

  override async check() {
    this.events.push(`check-failed:${this.selector}`);
    throw new Error("native check failed");
  }

  override async press(key?: string) {
    this.events.push(`locatorPress-failed:${this.selector}:${key ?? ""}`);
    throw new Error("native press failed");
  }
}

class FakeDialog {
  constructor(private readonly events: string[]) {}

  async accept(promptText?: string) {
    this.events.push(`dialog-accept:${promptText ?? ""}`);
  }

  async dismiss() {
    this.events.push("dialog-dismiss");
  }
}

class FakeDownload {
  constructor(private readonly events: string[]) {}

  suggestedFilename() {
    return "owned report.csv";
  }

  async saveAs(filePath: string) {
    this.events.push(`download-save:${filePath}`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "download");
  }
}

function isStorageEvaluationArg(
  value: unknown,
): value is { storage: "local" | "session"; key: string; value: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "storage" in value &&
      "key" in value &&
      "value" in value,
  );
}

function isScrollEvaluationArg(value: unknown): value is { deltaX: number; deltaY: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "deltaX" in value &&
      "deltaY" in value,
  );
}

function isClipboardEvaluationArg(value: unknown): value is { text: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "text" in value &&
      typeof (value as { text?: unknown }).text === "string",
  );
}

function isScrollIntoViewArg(
  value: unknown,
): value is { block: string; inline: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "block" in value &&
      "inline" in value,
  );
}
