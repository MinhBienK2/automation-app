// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createWorkflowCommandHandlers } from "./commands";
import { createAppPaths, initializeDatabase } from "./database";
import {
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  validateActionConfig,
} from "./graphCompiler";
import type {
  ActionConfig,
  GraphNode,
  GraphNodeType,
  GraphPort,
  WorkflowCondition,
  WorkflowGraph,
  WorkflowSettings,
} from "../../src/types/workflow";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("TypeScript graph compiler parity", () => {
  test("validates structural graph issues and loop-control context", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("draft", "action", { config: null }),
        graphNode("break", "break_loop"),
        graphNode("orphan", "action", { config: waitAction(100) }),
      ],
      [
        edge("start", "out", "draft", "in", "edge-start-draft"),
        edge("start", "out", "break", "in", "edge-start-break"),
        edge("draft", "out", "break", "in", "edge-draft-break"),
      ],
    );

    const messages = handlers.validateWorkflowGraph(graph).map((issue) => issue.message);

    expect(messages).toEqual(
      expect.arrayContaining([
        "Only one edge can leave an output port",
        "Only one edge can enter an input port",
        "Choose an action type before running this node",
        "Node Orphan is unreachable",
        "Break Loop can only be used inside a loop body",
      ]),
    );
  });

  test("compiles branch, loop, retry, variable, and terminal graph nodes", async () => {
    const { handlers } = await createTestHandlers();
    const condition: WorkflowCondition = {
      kind: "output_equals",
      name: "status",
      value: "ready",
    };
    const click = clickAction("//button");
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", { config: { condition } }),
        graphNode("click", "action", { config: click }),
        graphNode("loop", "repeat_for_each", {
          config: { item_name: "row", items: ["a", "b"] },
        }),
        graphNode("set-var", "set_variable", {
          config: {
            variables: [{ name: "row.status", value_type: "text", value: "done" }],
          },
        }),
        graphNode("retry", "retry", { config: { max_attempts: 3, delay_ms: 50 } }),
        graphNode("retry-click", "action", { config: clickAction("//retry") }),
        graphNode("stop", "stop_workflow", {
          config: { status: "failure", reason: "blocked", close_browser: true },
        }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "click", "in"),
        edge("if-node", "done", "loop", "in"),
        edge("loop", "loop", "set-var", "in"),
        edge("loop", "done", "retry", "in"),
        edge("retry", "try", "retry-click", "in"),
        edge("retry", "success", "stop", "in"),
      ],
    );

    expect(handlers.compileWorkflowGraph(graph).steps).toEqual([
      {
        node_id: "if-node",
        label: "If Node",
        config: {
          type: "if_condition",
          config: {
            condition,
            then_steps: [
              {
                ...click,
                graph_node_id: "click",
                graph_label: "Click",
              },
            ],
            else_steps: [],
          },
        },
      },
      {
        node_id: "loop",
        label: "Loop",
        config: {
          type: "repeat_for_each",
          config: {
            item_name: "row",
            array_variable: null,
            items: ["a", "b"],
            steps: [
              {
                type: "set_variable",
                graph_node_id: "set-var",
                graph_label: "Set Var",
                config: {
                  name: null,
                  value: null,
                  value_type: null,
                  variables: [
                    { name: "row.status", value_type: "text", value: "done" },
                  ],
                },
              },
            ],
          },
        },
      },
      {
        node_id: "retry",
        label: "Retry",
        config: {
          type: "retry_block",
          config: {
            max_attempts: 3,
            delay_ms: 50,
            steps: [
              {
                ...clickAction("//retry"),
                graph_node_id: "retry-click",
                graph_label: "Retry Click",
              },
            ],
            failed_steps: [],
          },
        },
      },
      {
        node_id: "stop",
        label: "Stop",
        config: {
          type: "stop_workflow",
          config: {
            status: "failure",
            reason: "blocked",
            close_browser: true,
          },
        },
      },
    ]);
  });

  test("compiles a run plan from a selected main-path node through the end", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("first", "action", { config: waitAction(100) }),
        graphNode("second", "action", { config: clickAction("//continue") }),
        graphNode("third", "action", { config: waitAction(200) }),
      ],
      [
        edge("start", "out", "first", "in"),
        edge("first", "out", "second", "in"),
        edge("second", "out", "third", "in"),
      ],
    );

    const plan = compileWorkflowGraphFromNode(graph, "second");

    expect(plan.steps.map((step) => step.node_id)).toEqual(["second", "third"]);
  });

  test("rejects selected nodes inside nested branch bodies", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", { config: { condition: outputEqualsCondition() } }),
        graphNode("branch-step", "action", { config: clickAction("//branch") }),
        graphNode("after-if", "action", { config: clickAction("//after") }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "branch-step", "in"),
        edge("if-node", "done", "after-if", "in"),
      ],
    );

    expect(() => compileWorkflowGraphFromNode(graph, "branch-step")).toThrow(
      "Run from selected is only supported for main path nodes",
    );
  });

  test("blocks launch-time browser identity actions in workflow graphs", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("proxy", "action", {
          config: { type: "use_proxy", config: { server: "http://proxy.test:8080" } },
        }),
      ],
      [edge("start", "out", "proxy", "in")],
    );

    const issues = handlers.validateWorkflowGraph(graph);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "proxy",
          level: "error",
          message:
            "Node Proxy uses a launch-time browser identity setting. Configure it in Workflow Settings before launch.",
        }),
      ]),
    );
    expect(() => handlers.compileWorkflowGraph(graph)).toThrow(
      "Node Proxy uses a launch-time browser identity setting",
    );
  });

  test("preserves graph node identity for nested If branch actions", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", {
          config: {
            condition: { kind: "url_contains", value: "/dashboard" },
          },
        }),
        graphNode("true-node", "action", { config: clickAction("//button[@id='continue']") }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "true-node", "in"),
      ],
    );

    const branch = handlers.compileWorkflowGraph(graph).steps[0]?.config;

    expect(branch).toMatchObject({
      type: "if_condition",
      config: {
        then_steps: [
          expect.objectContaining({
            graph_node_id: "true-node",
            graph_label: "True Node",
            type: "click",
          }),
        ],
      },
    });
  });

  test("accepts repeat-for-each manual lists when array variable is null", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("loop", "repeat_for_each", {
          config: { item_name: "row", array_variable: null, items: ["a", "b"] },
        }),
        graphNode("wait", "action", { config: waitAction(100) }),
      ],
      [
        edge("start", "out", "loop", "in"),
        edge("loop", "loop", "wait", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph)).not.toContainEqual(
      expect.objectContaining({ message: "Array variable name is required" }),
    );
    expect(handlers.compileWorkflowGraph(graph).steps).toContainEqual(
      expect.objectContaining({
        node_id: "loop",
        config: expect.objectContaining({
          type: "repeat_for_each",
          config: expect.objectContaining({
            array_variable: null,
            items: ["a", "b"],
          }),
        }),
      }),
    );
  });

  test("rejects branch paths that also reach an explicit continuation path", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", { config: { condition: outputEqualsCondition() } }),
        graphNode("branch-step", "action", { config: waitAction(100) }),
        graphNode("after-if", "action", { config: clickAction("//after") }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "branch-step", "in"),
        edge("branch-step", "out", "after-if", "in"),
        edge("if-node", "done", "after-if", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph)).toContainEqual(
      expect.objectContaining({
        level: "error",
        node_id: "after-if",
        message: "Node After If is reachable from both a branch path and an explicit continuation path",
      }),
    );
    expect(() => handlers.compileWorkflowGraph(graph)).toThrow(
      "Node After If is reachable from both a branch path and an explicit continuation path",
    );
  });

  test("compiles a branch body followed by an explicit done continuation", async () => {
    const { handlers } = await createTestHandlers();
    const branchAction = clickAction("//branch");
    const continuationAction = clickAction("//after");
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", { config: { condition: outputEqualsCondition() } }),
        graphNode("branch-step", "action", { config: branchAction }),
        graphNode("after-if", "action", { config: continuationAction }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "branch-step", "in"),
        edge("if-node", "done", "after-if", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph).filter((issue) => issue.level === "error")).toEqual([]);
    expect(handlers.compileWorkflowGraph(graph).steps).toEqual([
      {
        node_id: "if-node",
        label: "If Node",
        config: {
          type: "if_condition",
          config: {
            condition: outputEqualsCondition(),
            then_steps: [
              {
                ...branchAction,
                graph_node_id: "branch-step",
                graph_label: "Branch Step",
              },
            ],
            else_steps: [],
          },
        },
      },
      {
        node_id: "after-if",
        label: "After If",
        config: continuationAction,
      },
    ]);
  });

  test("rejects switch edges from stale case ports beyond the configured cases", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("switch-node", "switch", {
          config: { expression: "{{status}}", cases: ["ready"] },
          ports: [
            inputPort("in", "In"),
            outputPort("case_1", "Ready"),
            outputPort("case_2", "Removed"),
            outputPort("default", "Default"),
            outputPort("done", "Done"),
          ],
        }),
        graphNode("stale-case", "action", { config: waitAction(100) }),
      ],
      [
        edge("start", "out", "switch-node", "in"),
        edge("switch-node", "case_2", "stale-case", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph)).toContainEqual(
      expect.objectContaining({
        level: "error",
        node_id: "switch-node",
        edge_id: "edge-switch-node-case_2-stale-case-in",
        message: "Switch case_2 no longer matches a configured case",
      }),
    );
    expect(() => handlers.compileWorkflowGraph(graph)).toThrow(
      "Switch case_2 no longer matches a configured case",
    );
  });

  test("compiles environment variables without legacy owned test gate preflight", () => {
    const input = inputTextAction("//input", "hello");
    const click = clickAction("//button");
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("input", "action", { config: input }),
        graphNode("click", "action", { config: click }),
      ],
      [
        edge("start", "out", "input", "in"),
        edge("input", "out", "click", "in"),
      ],
    );
    const settings = {
      ...workflowSettings({
        environment: {
          initial_variables: [{ name: "user.name", value_type: "text", value: "Ada" }],
        },
      }),
      owned_test_gates: {
        fingerprint_preflight_enabled: true,
        fingerprint_probe_url: "https://owned.example.test/fingerprint",
        fingerprint_profile_id: "owned-profile",
        fingerprint_allowed_origins: ["https://owned.example.test"],
      },
    } as WorkflowSettings;

    const plan = compileWorkflowRunPlan(graph, settings);

    expect(plan.steps.map((step) => step.node_id)).toContain("__settings:inputs:variables");
    expect(plan.steps.map((step) => step.node_id))
      .not.toContain("__settings:browser:fingerprint-preflight:navigate");
    expect(plan.steps.map((step) => step.node_id))
      .not.toContain("__settings:browser:fingerprint-preflight:verdict");
    expect(plan.steps.map((step) => step.node_id)).not.toContain("__settings:execution:wait-between-nodes:1");
    expect(plan.steps.map((step) => step.node_id)).not.toContain("__settings:environment:headers");
    expect(JSON.stringify(plan.steps)).not.toContain("fingerprint_preflight");
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        node_id: "input",
        config: {
          type: "input_text",
          config: expect.objectContaining({
            target: {
              locators: [{ kind: "xpath", value: "//input" }],
            },
            text: "hello",
          }),
        },
      }),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        node_id: "click",
        config: {
          type: "click",
          config: {
            target: {
              locators: [{ kind: "xpath", value: "//button" }],
            },
          },
        },
      }),
    );
  });

  test("promotes domain allowlist graph nodes into run domain policy", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("allow", "domain_allowlist", {
          config: { domains: ["owned.test", "staging.test"] },
        }),
        graphNode("visit", "action", {
          config: { type: "navigate", config: { url: "https://owned.test" } },
        }),
      ],
      [
        edge("start", "out", "allow", "in"),
        edge("allow", "out", "visit", "in"),
      ],
    );

    const plan = compileWorkflowRunPlan(graph, workflowSettings());

    expect(plan.domain_policy).toEqual({
      allowed_domains: ["owned.test", "staging.test"],
    });
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "allow",
          config: { type: "domain_allowlist", config: { domains: ["owned.test", "staging.test"] } },
        }),
      ]),
    );
  });

  test("keeps upstream domain allowlist policy when compiling from a selected node", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("allow", "domain_allowlist", {
          config: { domains: ["owned.test"] },
        }),
        graphNode("visit", "action", {
          config: { type: "navigate", config: { url: "https://owned.test" } },
        }),
        graphNode("after", "action", { config: waitAction(100) }),
      ],
      [
        edge("start", "out", "allow", "in"),
        edge("allow", "out", "visit", "in"),
        edge("visit", "out", "after", "in"),
      ],
    );

    const plan = compileWorkflowGraphFromNode(graph, "visit");

    expect(plan.steps.map((step) => step.node_id)).toEqual(["visit", "after"]);
    expect(plan.domain_policy).toEqual({
      allowed_domains: ["owned.test"],
    });
  });

  test("validates invalid configs across visible action groups", () => {
    const target = elementTarget();
    const invalidCases: Array<{
      config: ActionConfig;
      field: string;
      message: string;
    }> = [
      {
        config: { type: "hover", config: { xpath: "", target: null, iframe_xpath: null } },
        field: "xpath",
        message: "Element target is required",
      },
      {
        config: {
          type: "drag_and_drop",
          config: {
            source_xpath: "",
            source_target: null,
            target_xpath: "//drop",
            target_target: null,
          },
        },
        field: "source_xpath",
        message: "Source element target is required",
      },
      {
        config: {
          type: "select_option",
          config: { xpath: "//select", target, iframe_xpath: null, match_by: "label", value: "" },
        },
        field: "value",
        message: "Option value is required",
      },
      {
        config: {
          type: "upload_file",
          config: { xpath: "//input", target, iframe_xpath: null, files: [] },
        },
        field: "files",
        message: "Upload files are required",
      },
      {
        config: {
          type: "extract_attribute",
          config: {
            xpath: "//a",
            target,
            iframe_xpath: null,
            attribute: "",
            output_name: "href",
          },
        },
        field: "attribute",
        message: "Attribute is required",
      },
      {
        config: { type: "take_screenshot", config: { path: "../secret.png", full_page: true } },
        field: "path",
        message: "Screenshot path must be a safe artifact name",
      },
      {
        config: { type: "wait_for_download", config: { output_name: "", timeout_ms: 1000 } },
        field: "output_name",
        message: "Download output name is required",
      },
      {
        config: {
          type: "assert_text",
          config: { xpath: "//body", target, iframe_xpath: null, text: "", match_mode: "contains" },
        },
        field: "text",
        message: "Assertion text is required",
      },
      {
        config: { type: "set_viewport", config: { width: 0, height: 720, mobile: false, touch: false } },
        field: "width",
        message: "Viewport width must be greater than 0",
      },
      {
        config: { type: "set_geolocation", config: { latitude: 91, longitude: 0, accuracy: 10 } },
        field: "latitude",
        message: "Latitude must be between -90 and 90",
      },
      {
        config: { type: "set_extra_headers", config: { headers: [{ name: "", value: "1" }] } },
        field: "headers",
        message: "Header name is required",
      },
      {
        config: { type: "grant_permission", config: { origin: null, permissions: [] } },
        field: "permissions",
        message: "Permissions are required",
      },
      {
        config: { type: "execute_js", config: { script: "", output_name: "result", timeout_ms: 1000 } },
        field: "script",
        message: "Script is required",
      },
      {
        config: { type: "wait_for_response", config: { url_contains: "/api", status: 700 } },
        field: "status",
        message: "Response status must be between 100 and 599",
      },
      {
        config: { type: "block_request", config: { url_patterns: [] } },
        field: "url_patterns",
        message: "URL pattern is required",
      },
      {
        config: { type: "set_local_storage", config: { key: "", value: "value" } },
        field: "key",
        message: "Storage key is required",
      },
    ];

    for (const invalidCase of invalidCases) {
      expect(validateActionConfig(invalidCase.config)).toMatchObject({
        field: invalidCase.field,
        message: invalidCase.message,
      });
    }
  });

  test("validates nested action configs recursively", () => {
    const validation = validateActionConfig({
      type: "if_condition",
      config: {
        condition: outputEqualsCondition(),
        then_steps: [{ type: "navigate", config: { url: "" } }],
        else_steps: [],
      },
    });

    expect(validation).toEqual({
      field: "then_steps[0].url",
      message: "URL is required",
    });
  });
});

async function createTestHandlers() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-app-"));
  tempRoots.push(tempRoot);
  const appPaths = createAppPaths(tempRoot);
  const database = initializeDatabase(appPaths);
  return {
    handlers: createWorkflowCommandHandlers({ appPaths, database }),
  };
}

function graphOf(nodes: GraphNode[], edges: ReturnType<typeof edge>[]): WorkflowGraph {
  return {
    version: 1,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function graphNode(
  id: string,
  nodeType: GraphNodeType,
  options: { config?: unknown; ports?: GraphPort[] } = {},
): GraphNode {
  return {
    id,
    node_type: nodeType,
    label: title(id),
    position: { x: 0, y: 0 },
    config: Object.prototype.hasOwnProperty.call(options, "config")
      ? options.config
      : {},
    ports: options.ports ?? portsFor(nodeType),
    group_id: null,
  };
}

function edge(
  source_node_id: string,
  source_port: string,
  target_node_id: string,
  target_port: string,
  id = `edge-${source_node_id}-${source_port}-${target_node_id}-${target_port}`,
) {
  return {
    id,
    source_node_id,
    source_port,
    target_node_id,
    target_port,
    label: null,
    condition: null,
  };
}

function portsFor(nodeType: GraphNodeType): GraphPort[] {
  switch (nodeType) {
    case "start":
      return [outputPort("out", "Out")];
    case "end_success":
    case "end_failure":
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
      return [inputPort("in", "In")];
    case "if":
      return [
        inputPort("in", "In"),
        outputPort("true", "True"),
        outputPort("false", "False"),
        outputPort("done", "Done"),
      ];
    case "repeat_for_each":
      return [inputPort("in", "In"), outputPort("loop", "Loop"), outputPort("done", "Done")];
    case "retry":
      return [
        inputPort("in", "In"),
        outputPort("try", "Try"),
        outputPort("success", "Success"),
        outputPort("failed", "Failed"),
      ];
    default:
      return [inputPort("in", "In"), outputPort("out", "Out")];
  }
}

function inputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "input" };
}

function outputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "output" };
}

function clickAction(xpath: string): ActionConfig {
  return {
    type: "click",
    config: {
      target: {
        locators: [{ kind: "xpath", value: xpath }],
      },
    },
  };
}

function inputTextAction(xpath: string, text: string): ActionConfig {
  return {
    type: "input_text",
    config: {
      xpath,
      target: null,
      iframe_xpath: null,
      text,
      clear_before_input: true,
      typing_mode: null,
      delay_ms: null,
      wait_until: null,
      timeout_ms: null,
    },
  };
}

function waitAction(duration_ms: number): ActionConfig {
  return {
    type: "wait",
    config: {
      condition: "duration",
      duration_ms,
    },
  };
}

function outputEqualsCondition(): WorkflowCondition {
  return {
    kind: "output_equals",
    name: "status",
    value: "ready",
  };
}

function elementTarget() {
  return {
    locators: [{ kind: "test_id" as const, value: "target" }],
    constraints: null,
    iframe: null,
  };
}

function title(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workflowSettings(
  overrides: {
    run_policy?: Partial<WorkflowSettings["run_policy"]>;
    browser_launch?: Partial<WorkflowSettings["browser_launch"]>;
    environment?: Partial<WorkflowSettings["environment"]>;
  } = {},
): WorkflowSettings {
  return {
    workflow_id: "workflow-1",
    version: 2,
    general: {
      name: "Run plan",
      description: "",
      tags: [],
      notes: "",
      created_at: "1",
      updated_at: "1",
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
      ...overrides.run_policy,
    },
    browser_launch: {
      session_mode: "temporary",
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      headless: false,
      ...overrides.browser_launch,
    },
    environment: {
      initial_variables: [],
      ...overrides.environment,
    },
    migration_notes: [],
    created_at: "1",
    updated_at: "1",
  };
}
