// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
                    then_steps: [{ type: "continue_loop", config: {} }],
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
                    then_steps: [{ type: "break_loop", config: {} }],
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
    });

    expect(result.status).toBe("success");
    expect(result.completed_step_ids).toEqual(["loop", "after"]);
    expect(result.outputs?.visited).toBe("stop");
    expect(result.outputs?.after_break).toBeUndefined();
    expect(result.outputs?.after_loop).toBe("done");
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

  test("writes screenshot evidence to file URLs", async () => {
    const appPaths = await createTempAppPaths();
    const screenshotPath = path.join(appPaths.evidenceDir, "shot.png");
    const runner = new BrowserWorkflowRunner({
      appPaths,
      driver: createFakeDriver(new FakeContext()),
    });

    const result = await runner.run({
      graph: {
        steps: [
          step("shot", "Shot", {
            type: "take_screenshot",
            config: {
              path: pathToFileURL(screenshotPath).href,
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
    expect(result.outputs?.shot).toBe(screenshotPath);
    await expect(fs.stat(screenshotPath)).resolves.toMatchObject({ size: 3 });
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
              device_scale_factor: 2,
              mobile: true,
              touch: true,
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
  events: string[] = [];
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

  async isEnabled() {
    this.events.push(`isEnabled:${this.selector}`);
    return this.selector !== "#blocked";
  }

  async waitFor(options?: { state?: string; timeout?: number }) {
    this.events.push(
      `waitFor:${this.selector}:${options?.state ?? "visible"}:${options?.timeout ?? "none"}`,
    );
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
