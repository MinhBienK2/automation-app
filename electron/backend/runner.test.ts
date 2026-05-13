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
      browser_launch: {
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
        headless: false,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        proxy_username: "agent",
        proxy_password: "secret",
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
          contextOptions: expect.objectContaining({
            acceptDownloads: true,
            downloadsPath: paths.downloadsDir,
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

  test("submits targeted forms through locator DOM evaluation", async () => {
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
        "evaluate://button[@type='submit']",
      ]),
    );
    expect(page.events).not.toContain("click://button[@type='submit']");
  });

  test("selects radio targets through locator DOM evaluation", async () => {
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
        "evaluate:testid=role-admin",
      ]),
    );
    expect(page.events).not.toContain("click:testid=role-admin");
  });

  test("scrolls pages through browser-side DOM evaluation", async () => {
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
            config: { direction: "down", pixels: 900 },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(result.status).toBe("success");
    expect(page.events).toContain("scrollBy:0:900");
  });

  test("dispatches right-click targets through locator DOM evaluation", async () => {
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
        "evaluate:testid=menu-target",
      ]),
    );
    expect(page.events).not.toContain("click:testid=menu-target");
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

  test("honors loop timeout and resume condition polling semantics", async () => {
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
          step("resume", "Resume", {
            type: "resume_when_condition",
            config: {
              condition: { kind: "output_equals", name: "timed_out", value: "yes" },
              timeout_ms: 50,
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

    const timeoutResult = await runner.run({
      graph: {
        steps: [
          step("resume-timeout", "Resume timeout", {
            type: "resume_when_condition",
            config: {
              condition: { kind: "output_equals", name: "missing", value: "yes" },
              timeout_ms: 1,
            },
          }),
        ],
      },
      settings: makeSettings(),
      mode: "run_workflow",
    });

    expect(timeoutResult.status).toBe("failed");
    expect(timeoutResult.error).toMatchObject({
      step_id: "resume-timeout",
      action_type: "resume_when_condition",
      reason: "Resume condition timed out after 1 ms",
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

  test("fails stubbed or launch-time actions with explicit unsupported errors", async () => {
    const runner = new BrowserWorkflowRunner({
      appPaths: await createTempAppPaths(),
      driver: createFakeDriver(new FakeContext()),
    });

    for (const config of [
      { type: "use_proxy", config: { server: "http://proxy.test:8080" } },
      { type: "set_user_agent", config: { user_agent: "Agent/1.0" } },
      { type: "run_subworkflow", config: { workflow_id: "child", input_mapping: [], output_mapping: [] } },
      { type: "detect_challenge", config: { output_name: "challenge", patterns: [] } },
      { type: "pause_for_human", config: { reason: "manual checkpoint" } },
      { type: "checkpoint", config: { name: "checkpoint", screenshot_path: null } },
      { type: "set_download_directory", config: { path: "/tmp/downloads" } },
    ] as ActionConfig[]) {
      const result = await runner.run({
        graph: { steps: [step(config.type, config.type, config)] },
        settings: makeSettings(),
        mode: "run_workflow",
      });

      expect(result.status).toBe("failed");
      expect(result.error).toMatchObject({
        step_id: config.type,
        action_type: config.type,
        reason: expect.stringContaining("is not supported as an in-run action"),
      });
    }
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
              retry_interval_ms: 25,
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
    if (typeof pageFunction === "string" && pageFunction.includes("window.location.href")) {
      return this.urlValue;
    }
    if (isScrollEvaluationArg(arg)) {
      this.events.push(`scrollBy:${arg.deltaX}:${arg.deltaY}`);
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

  async evaluate() {
    this.events.push(`evaluate:${this.selector}`);
    if (this.selector.includes("table")) {
      return [
        ["Name", "Status"],
        ["Fixture", "Ready"],
      ];
    }
    return null;
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

  async dragTo(target: FakeLocator) {
    this.events.push(`dragTo:${this.selector}:${target.selector}`);
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

class MinimalMethodLocator {
  constructor(
    private readonly selector: string,
    private readonly events: string[],
  ) {}

  async fill(value: string) {
    this.events.push(`fill:${this.selector}:${value}`);
  }

  async click() {
    this.events.push(`click:${this.selector}`);
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
