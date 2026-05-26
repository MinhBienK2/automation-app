import { test, expect } from "./support/electronFixture";
import { createAndRunGraph, createAndRunGraphExpectingFailure } from "./support/workflows";
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
          "set_variable, set_json_variables, if, switch, repeat_times, repeat_for_each(array/literal), while, repeat_until, retry, end_success",
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
    expect(state.outputs.literal_item_seen).toBe("two");
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
        "repeat-each-literal",
        "each-literal-value",
        "while-node",
        "while-body",
        "until-node",
        "until-body",
        "retry-node",
        "retry-attempt",
      ]),
    );
  });

  test("runs loop-control nodes inside visible loop branches", async ({ appWindow }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "none" },
      {
        type: "nodes",
        description: "repeat_times, break_loop, continue_loop, set_variable, end_success",
      },
      {
        type: "desktop depth",
        description: "Verifies visible loop-control nodes are valid and executable inside loop branches.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "E2E loop controls",
      loopControlGraph(),
    );

    expect(state.outputs.break_count).toBe(1);
    expect(state.outputs.break_result).toBe("after-break");
    expect(state.outputs.continue_count).toBe(2);
    expect(state.outputs.continue_result).toBe("after-continue");
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining([
        "break-repeat",
        "break-counter",
        "after-break",
        "continue-repeat",
        "continue-counter",
        "after-continue",
      ]),
    );
  });

  test("routes through prioritized router cases, default, and merge convergence", async ({
    appWindow,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "none" },
      {
        type: "nodes",
        description: "router, merge, set_variable, end_success",
      },
      {
        type: "desktop depth",
        description:
          "Verifies graph-native Router and Merge behavior through saved graph compilation and runner traces.",
      },
    );

    const { state } = await createAndRunGraph(
      appWindow,
      "E2E router merge priority convergence",
      routerMergeGraph(),
    );

    expect(state.outputs.route_result).toBe("expired");
    expect(state.outputs.default_result).toBeUndefined();
    expect(state.outputs.after_merge).toBe("verified");
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining(["router-node", "route-expired", "merge-node", "after-merge"]),
    );
    expect(state.outputs.__action_traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node_id: "router-node", action_type: "router_condition" }),
        expect.objectContaining({ node_id: "merge-node", action_type: "graph_noop" }),
      ]),
    );

    const defaultRun = await createAndRunGraph(
      appWindow,
      "E2E router merge default convergence",
      routerMergeGraph("normal"),
    );

    expect(defaultRun.state.outputs.route_result).toBeUndefined();
    expect(defaultRun.state.outputs.default_result).toBe("normal");
    expect(defaultRun.state.outputs.after_merge).toBe("verified");
    expect(defaultRun.state.completed_step_ids).toEqual(
      expect.arrayContaining(["router-node", "route-default", "merge-node", "after-merge"]),
    );
  });

  test("surfaces visible end failure and stop workflow terminal outcomes", async ({
    appWindow,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "none" },
      {
        type: "nodes",
        description: "end_failure, stop_workflow",
      },
      {
        type: "desktop depth",
        description: "Verifies visible terminal graph nodes set final desktop run outcomes.",
      },
    );

    const failure = await createAndRunGraphExpectingFailure(
      appWindow,
      "E2E terminal failure",
      terminalFailureGraph(),
    );

    expect(failure.state.error).toMatchObject({
      step_id: "end-failure",
      action_type: "stop_workflow",
      reason: "terminal failure",
    });

    const stopped = await createAndRunGraph(appWindow, "E2E terminal stop success", stopSuccessGraph());
    expect(stopped.state.status).toBe("success");
    expect(stopped.state.outputs.__action_traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node_id: "stop-success", action_type: "stop_workflow" }),
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
    node("repeat-each-literal", "repeat_for_each", "Repeat Each Literal", {
      item_name: "literal_item",
      array_variable: null,
      items: ["one", "two"],
    }),
    node("each-literal-value", "set_variable", "Set Literal Each Value", {
      variables: [{ name: "literal_item_seen", value_type: "text", value: "{{literal_item}}" }],
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
      edge("repeat-each", "done", "repeat-each-literal"),
      edge("repeat-each-literal", "loop", "each-literal-value"),
      edge("repeat-each-literal", "done", "while-node"),
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

function loopControlGraph(): WorkflowGraph {
  const nodes = [
    node("start", "start", "Start", null),
    node("break-repeat", "repeat_times", "Repeat Break", { times: 3 }),
    actionNode("break-counter", "Count Before Break", {
      type: "execute_js",
      config: {
        script: "window.__breakCount = (window.__breakCount || 0) + 1; return window.__breakCount;",
        output_name: "break_count",
      },
    }),
    node("break-loop", "break_loop", "Break Loop", null),
    node("after-break", "set_variable", "After Break", {
      variables: [{ name: "break_result", value_type: "text", value: "after-break" }],
    }),
    node("continue-repeat", "repeat_times", "Repeat Continue", { times: 2 }),
    actionNode("continue-counter", "Count Before Continue", {
      type: "execute_js",
      config: {
        script:
          "window.__continueCount = (window.__continueCount || 0) + 1; return window.__continueCount;",
        output_name: "continue_count",
      },
    }),
    node("continue-loop", "continue_loop", "Continue Loop", null),
    node("after-continue", "set_variable", "After Continue", {
      variables: [{ name: "continue_result", value_type: "text", value: "after-continue" }],
    }),
    node("end-success", "end_success", "End Success", { close_browser: false }),
  ];

  return {
    version: 2,
    nodes,
    edges: [
      edge("start", "out", "break-repeat"),
      edge("break-repeat", "loop", "break-counter"),
      edge("break-counter", "out", "break-loop"),
      edge("break-repeat", "done", "after-break"),
      edge("after-break", "out", "continue-repeat"),
      edge("continue-repeat", "loop", "continue-counter"),
      edge("continue-counter", "out", "continue-loop"),
      edge("continue-repeat", "done", "after-continue"),
      edge("after-continue", "out", "end-success"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function terminalFailureGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      node("start", "start", "Start", null),
      node("end-failure", "end_failure", "End Failure", {
        reason: "terminal failure",
        close_browser: false,
      }),
    ],
    edges: [edge("start", "out", "end-failure")],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function stopSuccessGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      node("start", "start", "Start", null),
      node("stop-success", "stop_workflow", "Stop Success", {
        status: "success",
        reason: "operator stop",
        close_browser: true,
      }),
    ],
    edges: [edge("start", "out", "stop-success")],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function routerMergeGraph(accountState = "expired challenge"): WorkflowGraph {
  const nodes = [
    node("start", "start", "Start", null),
    node("seed-route", "set_variable", "Seed Route", {
      variables: [{ name: "account_state", value_type: "text", value: accountState }],
    }),
    node("router-node", "router", "Route Account State", {
      mode: "first_match",
      cases: [
        {
          id: "expired",
          label: "Expired Session",
          condition: { kind: "output_contains", name: "account_state", value: "expired" },
        },
        {
          id: "challenge",
          label: "Challenge Visible",
          condition: { kind: "output_contains", name: "account_state", value: "challenge" },
        },
      ],
      default_label: "Normal",
    }),
    node("route-expired", "set_variable", "Route Expired", {
      variables: [{ name: "route_result", value_type: "text", value: "expired" }],
    }),
    node("route-default", "set_variable", "Route Default", {
      variables: [{ name: "default_result", value_type: "text", value: "normal" }],
    }),
    node("merge-node", "merge", "Merge Routes", null),
    node("after-merge", "set_variable", "After Merge", {
      variables: [{ name: "after_merge", value_type: "text", value: "verified" }],
    }),
    node("end-success", "end_success", "End Success", { close_browser: false }),
  ];

  return {
    version: 2,
    nodes,
    edges: [
      edge("start", "out", "seed-route"),
      edge("seed-route", "out", "router-node"),
      edge("router-node", "case_expired", "route-expired"),
      edge("router-node", "default", "route-default"),
      edge("route-expired", "out", "merge-node"),
      edge("route-default", "out", "merge-node"),
      edge("merge-node", "out", "after-merge"),
      edge("after-merge", "out", "end-success"),
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
    case "end_failure":
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
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
    case "router":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "case_expired", label: "Expired Session", direction: "output" },
        { id: "case_challenge", label: "Challenge Visible", direction: "output" },
        { id: "default", label: "Normal", direction: "output" },
        { id: "done", label: "Done", direction: "output" },
      ];
    case "merge":
      return [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
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
