// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createWorkflowCommandHandlers } from "./commands";
import { createAppPaths, initializeDatabase } from "./database";
import { compileWorkflowRunPlan } from "./graphCompiler";
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
            then_steps: [click],
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
            steps: [clickAction("//retry")],
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

  test("compiles settings prelude, execution defaults, and wait-between-nodes", () => {
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
    const settings = workflowSettings({
      execution: {
        default_action_timeout_ms: 5000,
        interaction_fidelity: "high",
        timing_profile: "slow_realistic",
        wait_between_nodes_enabled: true,
        wait_between_nodes_ms: 250,
      },
      browser: {
        fingerprint_preflight_enabled: true,
        fingerprint_probe_url: "https://owned.example.test/fingerprint",
        fingerprint_profile_id: "owned-profile",
      },
      environment: {
        geolocation: { latitude: 10, longitude: 20, accuracy: 5 },
        permissions: ["geolocation"],
        extra_http_headers: [{ name: "X-Test", value: "1" }],
        download_directory: "/tmp/downloads",
        cookies: [{ name: "sid", value: "123", domain: "owned.example.test" }],
        local_storage: [{ key: "token", value: "abc" }],
        session_storage: [{ key: "state", value: "xyz" }],
      },
      inputs: {
        initial_variables: [{ name: "user.name", value_type: "text", value: "Ada" }],
      },
    });

    const plan = compileWorkflowRunPlan(graph, settings);

    expect(plan.steps.map((step) => step.node_id)).toEqual(
      expect.arrayContaining([
        "__settings:environment:geolocation",
        "__settings:environment:permissions",
        "__settings:environment:headers",
        "__settings:environment:downloads",
        "__settings:environment:cookie:0",
        "__settings:environment:local-storage:0",
        "__settings:environment:session-storage:0",
        "__settings:browser:fingerprint-preflight:navigate",
        "__settings:browser:fingerprint-preflight:verdict",
        "__settings:inputs:variables",
        "__settings:execution:wait-between-nodes:1",
      ]),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        node_id: "__settings:browser:fingerprint-preflight:verdict",
        config: expect.objectContaining({
          type: "execute_js",
          config: expect.objectContaining({
            script: expect.stringContaining("window.__wamOutputs.fingerprint_preflight = evidence"),
          }),
        }),
      }),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        node_id: "input",
        config: {
          type: "input_text",
          config: expect.objectContaining({
            xpath: "//input",
            text: "hello",
            timeout_ms: 5000,
            typing_mode: "type",
            delay_ms: 90,
          }),
        },
      }),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        node_id: "__settings:execution:wait-between-nodes:1",
        config: {
          type: "wait",
          config: { condition: "duration", duration_ms: 250 },
        },
      }),
    );
    expect(plan.steps).toContainEqual(
      expect.objectContaining({
        node_id: "click",
        config: {
          type: "click",
          config: expect.objectContaining({ xpath: "//button", timeout_ms: 5000 }),
        },
      }),
    );
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
      xpath,
      target: null,
      iframe_xpath: null,
      mode: null,
      button: null,
      click_count: null,
      scroll_into_view: null,
      block: null,
      inline: null,
      position: null,
      offset_x: null,
      offset_y: null,
      wait_until: null,
      timeout_ms: null,
      retry_interval_ms: null,
      post_click_wait_ms: null,
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

function title(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workflowSettings(
  overrides: {
    execution?: Partial<WorkflowSettings["execution"]>;
    browser?: Partial<WorkflowSettings["browser"]>;
    environment?: Partial<WorkflowSettings["environment"]>;
    inputs?: Partial<WorkflowSettings["inputs"]>;
  } = {},
): WorkflowSettings {
  return {
    workflow_id: "workflow-1",
    version: 1,
    general: {
      name: "Run plan",
      description: "",
      tags: [],
      notes: "",
      created_at: "1",
      updated_at: "1",
    },
    execution: {
      default_action_timeout_ms: null,
      default_retry_attempts: null,
      default_retry_interval_ms: null,
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      failure_policy: "stop_on_first_failure",
      interaction_fidelity: "standard",
      direct_dom_fallback: "explicit",
      timing_profile: "balanced",
      wait_between_nodes_enabled: false,
      wait_between_nodes_random: false,
      wait_between_nodes_ms: null,
      wait_between_nodes_min_ms: null,
      wait_between_nodes_max_ms: null,
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
      output_retention_days: null,
      ...overrides.execution,
    },
    browser: {
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      user_agent: null,
      viewport_width: null,
      viewport_height: null,
      mobile: false,
      touch: false,
      challenge_policy: "none",
      headless: false,
      fingerprint_preflight_enabled: false,
      fingerprint_probe_url: null,
      fingerprint_profile_id: null,
      fingerprint_allowed_origins: [],
      fingerprint_proxy_label: null,
      fingerprint_proxy_region: null,
      ...overrides.browser,
    },
    environment: {
      geolocation: null,
      permissions: [],
      extra_http_headers: [],
      locale: null,
      timezone: null,
      download_directory: null,
      cookies: [],
      local_storage: [],
      session_storage: [],
      session_restore_ref: null,
      ...overrides.environment,
    },
    inputs: {
      input_schema: [],
      initial_variables: [],
      batch_mapping: [],
      ...overrides.inputs,
    },
    triggers: {
      enabled: false,
      mode: "manual",
      interval_seconds: null,
      once_at: null,
      input_source: null,
      batch_source_ref: null,
      missed_run_policy: "skip",
      concurrency_policy: "skip_if_running",
      last_run_at: null,
      next_run_at: null,
    },
    advanced: {
      compatibility_warnings: [],
      debug_logging_level: "off",
      experimental_flags: [],
    },
    created_at: "1",
    updated_at: "1",
  };
}
