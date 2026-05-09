// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  ActionConfig,
  CompiledWorkflowGraph,
  WorkflowSettings,
} from "../../src/types/workflow";
import { defaultWorkflowSettings } from "./commands";
import { createAppPaths } from "./database";
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
  test("maps workflow browser and environment settings to CloakBrowser launch options", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const paths = await createTempAppPaths();
    const settings = makeSettings({
      browser: {
        profile_name: "qa-profile",
        headless: false,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        proxy_username: "agent",
        proxy_password: "secret",
        user_agent: "WorkflowBot/1.0",
        viewport_width: 1366,
        viewport_height: 768,
        mobile: true,
        touch: true,
      },
      environment: {
        geolocation: { latitude: 10.8, longitude: 106.7, accuracy: 15 },
        permissions: ["geolocation", "clipboard-read"],
        extra_http_headers: [{ name: "X-Lab", value: "owned" }],
        locale: "vi-VN",
        timezone: "Asia/Ho_Chi_Minh",
        download_directory: paths.downloadsDir,
      },
    });

    const runner = new BrowserWorkflowRunner({ appPaths: paths, driver });
    await runner.run({
      graph: { steps: [] },
      settings,
      mode: "run_workflow",
    });

    expect(driver.launches).toEqual([
      {
        kind: "persistent",
        options: expect.objectContaining({
          userDataDir: path.join(paths.browserProfilesDir, "qa-profile"),
          headless: false,
          humanize: true,
          proxy: {
            server: "http://proxy.local:8080",
            username: "agent",
            password: "secret",
          },
          userAgent: "WorkflowBot/1.0",
          viewport: { width: 1366, height: 768 },
          locale: "vi-VN",
          timezone: "Asia/Ho_Chi_Minh",
          contextOptions: expect.objectContaining({
            isMobile: true,
            hasTouch: true,
            geolocation: { latitude: 10.8, longitude: 106.7, accuracy: 15 },
            permissions: ["geolocation", "clipboard-read"],
            extraHTTPHeaders: { "X-Lab": "owned" },
            acceptDownloads: true,
          }),
        }),
      },
    ]);
    expect(context.closed).toBe(false);
  });

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
              typing_mode: "type",
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
      expect.objectContaining({ node_id: "open", action_type: "navigate", mode: "browser" }),
      expect.objectContaining({ node_id: "fill", action_type: "input_text", mode: "browser" }),
      expect.objectContaining({ node_id: "click", action_type: "click", mode: "browser" }),
      expect.objectContaining({ node_id: "extract", action_type: "extract_text", mode: "observer" }),
      expect.objectContaining({ node_id: "script", action_type: "execute_js", mode: "direct_dom" }),
    ]);
    expect(page.events).toEqual(
      expect.arrayContaining([
        "goto:https://owned.test",
        "locator://input[@name='q']",
        "fill://input[@name='q']:",
        "type://input[@name='q']:lab:0",
        "click://button[@id='go']",
      ]),
    );
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
      settings: makeSettings({ execution: { browser_retention: "close" } }),
      mode: "run_workflow",
      signal: cancellation.signal,
    });

    expect(result.status).toBe("stopped");
    expect(context.closed).toBe(true);
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
    browser?: Partial<WorkflowSettings["browser"]>;
    environment?: Partial<WorkflowSettings["environment"]>;
    execution?: Partial<WorkflowSettings["execution"]>;
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
    browser: { ...base.browser, ...overrides.browser },
    environment: { ...base.environment, ...overrides.environment },
    execution: { ...base.execution, ...overrides.execution },
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

  async addCookies() {}

  async grantPermissions() {}

  async setExtraHTTPHeaders() {}

  async route() {}
}

class FakePage implements BrowserDriverPage {
  events: string[] = [];
  urlValue = "about:blank";

  async goto(url: string) {
    this.urlValue = url.endsWith("/") ? url : `${url}/`;
    this.events.push(`goto:${url}`);
  }

  locator(selector: string) {
    this.events.push(`locator:${selector}`);
    return new FakeLocator(selector, this.events);
  }

  async waitForLoadState() {}

  async waitForURL() {}

  async waitForRequest() {
    return { url: () => this.urlValue };
  }

  async waitForResponse() {
    return { url: () => this.urlValue, status: () => 200 };
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
    if (typeof pageFunction === "string" && pageFunction.includes("window.location.href")) {
      return this.urlValue;
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

  keyboard = {
    press: async (key: string) => {
      this.events.push(`press:${key}`);
    },
    type: async (text: string) => {
      this.events.push(`keyboard:${text}`);
    },
  };

  mouse = {
    wheel: async (x: number, y: number) => {
      this.events.push(`wheel:${x}:${y}`);
    },
  };
}

class FakeLocator {
  constructor(
    private readonly selector: string,
    private readonly events: string[],
  ) {}

  async fill(value: string) {
    this.events.push(`fill:${this.selector}:${value}`);
  }

  async type(value: string, options?: { delay?: number }) {
    this.events.push(`type:${this.selector}:${value}:${options?.delay ?? 0}`);
  }

  async click() {
    this.events.push(`click:${this.selector}`);
  }

  async hover() {}

  async dblclick() {}

  async check() {}

  async uncheck() {}

  async selectOption() {}

  async setInputFiles() {}

  async press() {}

  async textContent() {
    return "Owned Fixture";
  }

  async getAttribute(attribute: string) {
    return `attr:${attribute}`;
  }

  async inputValue() {
    return "input";
  }

  async count() {
    return 1;
  }

  nth() {
    return this;
  }

  async isVisible() {
    return true;
  }
}
