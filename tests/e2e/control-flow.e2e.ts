import { test, expect } from "./support/electronFixture";
import { createAndRunGraph } from "./support/workflows";
import type {
  ActionConfig,
  GraphNode,
  GraphNodeType,
  GraphPort,
  WorkflowGraph,
} from "../../src/types/workflow";

test.describe("desktop graph variable and control-flow node execution", () => {
  test("runs graph-native variables, branches, loops, and retry nodes", async ({
    appWindow,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "none" },
      {
        type: "nodes",
        description:
          "set_variable, set_json_variables, if, switch, repeat_times, repeat_for_each, while, repeat_until, retry, end_success",
      },
      {
        type: "desktop depth",
        description:
          "Verifies visible graph logic nodes through graph compilation, IPC, SQLite persistence, and runner execution.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "E2E graph control flow",
      controlFlowGraph(),
    );

    expect(state.outputs.mode).toBe("yes");
    expect(state.outputs.if_result).toBe("then");
    expect(state.outputs.switch_result).toBe("beta");
    expect(state.outputs.repeat_count).toBe(3);
    expect(state.outputs.item_seen).toBe("blue");
    expect(state.outputs.while_result).toBe("ran");
    expect(state.outputs.until_result).toBe("ran");
    expect(state.outputs.retry_count).toBe(2);
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining([
        "seed-mode",
        "seed-json",
        "if-node",
        "if-then",
        "switch-node",
        "switch-beta",
        "repeat-times",
        "repeat-counter",
        "repeat-each",
        "each-value",
        "while-node",
        "while-body",
        "until-node",
        "until-body",
        "retry-node",
        "retry-attempt",
      ]),
    );
  });
});

function controlFlowGraph(): WorkflowGraph {
  const nodes = [
    node("start", "start", "Start", null),
    node("seed-mode", "set_variable", "Seed Mode", {
      variables: [{ name: "mode", value_type: "text", value: "yes" }],
    }),
    node("seed-json", "set_json_variables", "Seed JSON", {
      json: JSON.stringify({
        items: ["red", "blue"],
        switch_key: "beta",
        until_done: "no",
        while_go: "yes",
      }),
    }),
    node("if-node", "if", "If Mode", {
      condition: { kind: "output_equals", name: "mode", value: "yes" },
    }),
    node("if-then", "set_variable", "Set If Result", {
      variables: [{ name: "if_result", value_type: "text", value: "then" }],
    }),
    node("switch-node", "switch", "Switch Result", {
      expression: "switch_key",
      cases: ["alpha", "beta"],
    }),
    node("switch-beta", "set_variable", "Set Switch Result", {
      variables: [{ name: "switch_result", value_type: "text", value: "beta" }],
    }),
    node("repeat-times", "repeat_times", "Repeat Times", { times: 3 }),
    actionNode("repeat-counter", "Increment Repeat Count", {
      type: "execute_js",
      config: {
        script: "window.__repeatCount = (window.__repeatCount || 0) + 1; return window.__repeatCount;",
        output_name: "repeat_count",
      },
    }),
    node("repeat-each", "repeat_for_each", "Repeat Each", {
      item_name: "item",
      array_variable: "items",
      items: [],
    }),
    node("each-value", "set_variable", "Set Each Value", {
      variables: [{ name: "item_seen", value_type: "text", value: "{{item}}" }],
    }),
    node("while-node", "while", "While Once", {
      condition: { kind: "output_equals", name: "while_go", value: "yes" },
      max_attempts: 3,
      timeout_ms: null,
    }),
    node("while-body", "set_variable", "Set While Result", {
      variables: [
        { name: "while_go", value_type: "text", value: "no" },
        { name: "while_result", value_type: "text", value: "ran" },
      ],
    }),
    node("until-node", "repeat_until", "Repeat Until", {
      condition: { kind: "output_equals", name: "until_done", value: "yes" },
      max_attempts: 3,
      timeout_ms: null,
    }),
    node("until-body", "set_variable", "Set Until Result", {
      variables: [
        { name: "until_done", value_type: "text", value: "yes" },
        { name: "until_result", value_type: "text", value: "ran" },
      ],
    }),
    node("retry-node", "retry", "Retry Once", { max_attempts: 2, delay_ms: 10 }),
    actionNode("retry-attempt", "Retry Attempt", {
      type: "execute_js",
      config: {
        script: `
          window.__retryCount = (window.__retryCount || 0) + 1;
          if (window.__retryCount < 2) throw new Error('retry once');
          return window.__retryCount;
        `,
        output_name: "retry_count",
      },
    }),
    node("end-success", "end_success", "End Success", { close_browser: false }),
  ];

  return {
    version: 2,
    nodes,
    edges: [
      edge("start", "out", "seed-mode"),
      edge("seed-mode", "out", "seed-json"),
      edge("seed-json", "out", "if-node"),
      edge("if-node", "true", "if-then"),
      edge("if-node", "done", "switch-node"),
      edge("switch-node", "case_2", "switch-beta"),
      edge("switch-node", "done", "repeat-times"),
      edge("repeat-times", "loop", "repeat-counter"),
      edge("repeat-times", "done", "repeat-each"),
      edge("repeat-each", "loop", "each-value"),
      edge("repeat-each", "done", "while-node"),
      edge("while-node", "loop", "while-body"),
      edge("while-node", "done", "until-node"),
      edge("until-node", "loop", "until-body"),
      edge("until-node", "done", "retry-node"),
      edge("retry-node", "try", "retry-attempt"),
      edge("retry-node", "success", "end-success"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function actionNode(id: string, label: string, config: ActionConfig): GraphNode {
  return node(id, "action", label, config);
}

function node(id: string, nodeType: GraphNodeType, label: string, config: unknown): GraphNode {
  return {
    id,
    node_type: nodeType,
    label,
    position: { x: 0, y: 0 },
    config,
    ports: ports(nodeType),
  };
}

function edge(source: string, sourcePort: string, target: string) {
  return {
    id: `edge-${source}-${sourcePort}-${target}`,
    source_node_id: source,
    source_port: sourcePort,
    target_node_id: target,
    target_port: "in",
  };
}

function ports(nodeType: GraphNodeType): GraphPort[] {
  switch (nodeType) {
    case "start":
      return [{ id: "out", label: "Out", direction: "output" }];
    case "end_success":
      return [{ id: "in", label: "In", direction: "input" }];
    case "if":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "true", label: "True", direction: "output" },
        { id: "false", label: "False", direction: "output" },
        { id: "done", label: "Done", direction: "output" },
      ];
    case "switch":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "case_1", label: "Case 1", direction: "output" },
        { id: "case_2", label: "Case 2", direction: "output" },
        { id: "default", label: "Default", direction: "output" },
        { id: "done", label: "Done", direction: "output" },
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "loop", label: "Loop", direction: "output" },
        { id: "done", label: "Done", direction: "output" },
      ];
    case "repeat_until":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "loop", label: "Loop", direction: "output" },
        { id: "done", label: "Done", direction: "output" },
        { id: "timeout", label: "Timeout", direction: "output" },
      ];
    case "retry":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "try", label: "Try", direction: "output" },
        { id: "success", label: "Success", direction: "output" },
        { id: "failed", label: "Failed", direction: "output" },
      ];
    default:
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ];
  }
}
