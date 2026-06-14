// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createWorkflowCommandHandlers } from "../commands";
import { createAppPaths, initializeDatabase } from "../persistence/database";
import {
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  validateActionConfig,
} from "./compiler";
import type {
  ActionConfig,
  GraphNode,
  GraphNodeType,
  GraphPort,
  WorkflowCondition,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("TypeScript graph compiler parity", () => {
  test("compiles edge delays as synthetic wait steps before the target node", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("first", "action", { config: clickAction("//first") }),
        graphNode("second", "action", { config: clickAction("//second") }),
      ],
      [
        edge("start", "out", "first", "in", "edge-start-first"),
        {
          ...edge("first", "out", "second", "in", "edge-first-second"),
          delay: { type: "random" as const, min_ms: 500, max_ms: 1200 },
        },
      ],
    );

    expect(compileWorkflowRunPlan(graph, workflowSettings()).steps.map((step) => ({
      node_id: step.node_id,
      label: step.label,
      config: step.config,
    }))).toEqual([
      {
        node_id: "first",
        label: "First",
        config: clickAction("//first"),
      },
      {
        node_id: "__edge_wait:edge-first-second",
        label: "Wait before Second",
        config: { type: "random_wait", config: { min_ms: 500, max_ms: 1200 } },
      },
      {
        node_id: "second",
        label: "Second",
        config: clickAction("//second"),
      },
    ]);
  });

  test("validates edge delay ranges", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("first", "action", { config: clickAction("//first") }),
      ],
      [
        {
          ...edge("start", "out", "first", "in", "edge-start-first"),
          delay: { type: "random" as const, min_ms: 1200, max_ms: 500 },
        },
      ],
    );

    expect(handlers.validateWorkflowGraph(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edge_id: "edge-start-first",
          message: "Edge wait range is invalid",
        }),
      ]),
    );
  });

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

  test("rejects unknown graph node and action discriminants", async () => {
    const { handlers } = await createTestHandlers();
    const unknownNodeGraph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("unknown", "sidequest" as GraphNodeType, {
          ports: [inputPort("in", "In"), outputPort("out", "Out")],
        }),
      ],
      [edge("start", "out", "unknown", "in")],
    );
    const unknownActionGraph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("unknown-action", "action", {
          config: { type: "mystery_action", config: {} } as ActionConfig,
        }),
      ],
      [edge("start", "out", "unknown-action", "in")],
    );

    expect(handlers.validateWorkflowGraph(unknownNodeGraph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "unknown",
          level: "error",
          message: "Unsupported graph node type: sidequest",
        }),
      ]),
    );
    expect(handlers.validateWorkflowGraph(unknownActionGraph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "unknown-action",
          level: "error",
          message: "Node Unknown Action has invalid action config: Unsupported action type: mystery_action",
        }),
      ]),
    );
  });

  test("validates unknown condition kinds across branching and loops", async () => {
    const { handlers } = await createTestHandlers();
    const unsupportedCondition = {
      kind: "fingerprint_score",
      name: "score",
      value: "low",
    } as WorkflowCondition;
    const graphs = [
      graphOf(
        [
          graphNode("start", "start"),
          graphNode("if-node", "if", { config: { condition: unsupportedCondition } }),
        ],
        [edge("start", "out", "if-node", "in")],
      ),
      graphOf(
        [
          graphNode("start", "start"),
          graphNode("router", "router", {
            config: {
              mode: "first_match",
              cases: [{ id: "case-1", label: "Case 1", condition: unsupportedCondition }],
            },
          }),
        ],
        [edge("start", "out", "router", "in")],
      ),
      graphOf(
        [
          graphNode("start", "start"),
          graphNode("while", "while", {
            config: { condition: unsupportedCondition, max_attempts: 2 },
          }),
          graphNode("body", "action", { config: waitAction(1) }),
        ],
        [
          edge("start", "out", "while", "in"),
          edge("while", "loop", "body", "in"),
        ],
      ),
      graphOf(
        [
          graphNode("start", "start"),
          graphNode("repeat-until", "repeat_until", {
            config: { condition: unsupportedCondition, max_attempts: 2 },
          }),
          graphNode("body", "action", { config: waitAction(1) }),
        ],
        [
          edge("start", "out", "repeat-until", "in"),
          edge("repeat-until", "loop", "body", "in"),
        ],
      ),
    ];

    for (const graph of graphs) {
      expect(handlers.validateWorkflowGraph(graph)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: "error",
            message: "Unsupported condition kind: fingerprint_score",
          }),
        ]),
      );
    }
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
        graphNode("update-var", "update_list_variable", {
          config: {
            name: "row.tags",
            operation: "push",
            value: "completed",
            value_type: "text",
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
        edge("set-var", "out", "update-var", "in"),
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
              {
                type: "update_list_variable",
                graph_node_id: "update-var",
                graph_label: "Update Var",
                config: {
                  name: "row.tags",
                  operation: "push",
                  value: "completed",
                  value_type: "text",
                  index: null,
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

  test("prepends settings prelude variables when compiling from a selected node", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("first", "action", { config: waitAction(100) }),
        graphNode("second", "action", { config: clickAction("//continue") }),
      ],
      [
        edge("start", "out", "first", "in"),
        edge("first", "out", "second", "in"),
      ],
    );
    const settings = workflowSettings({
      environment: {
        initial_variables: [
          { name: "workflow_var", value_type: "text", value: "hello" },
        ],
      },
    });
    const profileEnvironment = {
      variables: [
        { name: "profile_var", value_type: "text" as const, value: "world", persist: false },
      ],
    };

    const plan = compileWorkflowGraphFromNode(graph, "second", {
      settings,
      profileEnvironment,
    });

    expect(plan.steps.map((step) => step.node_id)).toEqual([
      "__settings:profile:variables",
      "__settings:inputs:variables",
      "second",
    ]);

    expect(plan.steps[0].config).toEqual({
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: [
          { name: "profile_var", value_type: "text", value: "world" },
        ],
      },
    });

    expect(plan.steps[1].config).toEqual({
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: [
          { name: "workflow_var", value_type: "text", value: "hello" },
        ],
      },
    });
  });


  test("compiles a selected-only run plan for just the selected main-path node", () => {
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
    const compileFromNodeWithMode = compileWorkflowGraphFromNode as unknown as (
      graphValue: WorkflowGraph,
      startNodeId: string,
      options: { mode: "selected_only" },
    ) => ReturnType<typeof compileWorkflowGraphFromNode>;

    const plan = compileFromNodeWithMode(graph, "second", { mode: "selected_only" });

    expect(plan.steps.map((step) => step.node_id)).toEqual(["second"]);
  });

  test("compiles run-from-selected plans across Call Subflow nodes", () => {
    const subflowGraph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("fill", "action", { config: inputTextAction("//email", "{{ email }}") }),
      ],
      [edge("start", "out", "fill", "in")],
    );
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("before", "action", { config: waitAction(100) }),
        graphNode("call-login", "call_subflow", {
          config: {
            subflow_id: "subflow-login",
            input_mapping: [{ input_name: "email", value: "{{ account.email }}" }],
          },
        }),
        graphNode("after", "action", { config: clickAction("//continue") }),
      ],
      [
        edge("start", "out", "before", "in"),
        edge("before", "out", "call-login", "in"),
        edge("call-login", "out", "after", "in"),
      ],
    );
    const options = {
      projectId: "project-1",
      workflowLabel: "Checkout",
      resolveSubflow: (subflowId: string) =>
        subflowId === "subflow-login"
          ? {
              id: "subflow-login",
              project_id: "project-1",
              name: "Login",
              graph: subflowGraph,
            }
          : null,
    };

    const plan = compileWorkflowGraphFromNode(graph, "before", options);
    const afterPlan = compileWorkflowGraphFromNode(graph, "after", options);

    expect(plan.steps.map((step) => step.node_id)).toEqual([
      "before",
      "call-login::__inputs",
      "call-login::fill",
      "after",
    ]);
    expect(plan.steps.map((step) => step.label)).toEqual([
      "Before",
      "Checkout > Login > Inputs",
      "Checkout > Login > Fill",
      "After",
    ]);
    expect(afterPlan.steps.map((step) => step.node_id)).toEqual(["after"]);
  });

  test("annotates inlined Call Subflow steps with subflow order metadata", () => {
    const subflowGraph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("fill", "action", { config: inputTextAction("//email", "{{ email }}") }),
        graphNode("submit", "action", { config: clickAction("//button[@type='submit']") }),
      ],
      [
        edge("start", "out", "fill", "in"),
        edge("fill", "out", "submit", "in"),
      ],
    );
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("call-login", "call_subflow", {
          config: { subflow_id: "subflow-login", input_mapping: [] },
        }),
      ],
      [edge("start", "out", "call-login", "in")],
    );

    const plan = compileWorkflowRunPlan(graph, workflowSettings(), {
      projectId: "project-1",
      workflowLabel: "Checkout",
      resolveSubflow: (subflowId: string) =>
        subflowId === "subflow-login"
          ? {
              id: "subflow-login",
              project_id: "project-1",
              name: "Login",
              graph: subflowGraph,
            }
          : null,
    });

    expect(plan.steps.map((step) => ({
      node_id: step.node_id,
      metadata: step.metadata,
    }))).toEqual([
      {
        node_id: "call-login::fill",
        metadata: {
          subflow: {
            id: "subflow-login",
            name: "Login",
            step_number: 1,
            step_count: 2,
          },
        },
      },
      {
        node_id: "call-login::submit",
        metadata: {
          subflow: {
            id: "subflow-login",
            name: "Login",
            step_number: 2,
            step_count: 2,
          },
        },
      },
    ]);
  });

  test("rejects Call Subflow references that compile to no executable steps", () => {
    const emptySubflowGraph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("done", "end_success"),
      ],
      [edge("start", "out", "done", "in")],
    );
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("call-login", "call_subflow", {
          config: { subflow_id: "subflow-empty", input_mapping: [] },
        }),
        graphNode("after", "action", { config: clickAction("//continue") }),
      ],
      [
        edge("start", "out", "call-login", "in"),
        edge("call-login", "out", "after", "in"),
      ],
    );

    expect(() =>
      compileWorkflowRunPlan(graph, workflowSettings(), {
        projectId: "project-1",
        resolveSubflow: (subflowId: string) =>
          subflowId === "subflow-empty"
            ? {
                id: "subflow-empty",
                project_id: "project-1",
                name: "Empty Login",
                graph: emptySubflowGraph,
              }
            : null,
      }),
    ).toThrow("Referenced subflow has no executable steps");
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

  test("rejects Merge as a run-from-selected start", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("merge", "merge"),
        graphNode("after", "action", { config: waitAction(100) }),
      ],
      [
        edge("start", "out", "merge", "in"),
        edge("merge", "out", "after", "in"),
      ],
    );

    expect(() => compileWorkflowGraphFromNode(graph, "merge")).toThrow(
      "Run from selected requires an executable graph node",
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

  test("allows branch paths to converge through Merge and compiles Merge as a no-op step", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", { config: { condition: outputEqualsCondition() } }),
        graphNode("true-step", "action", { config: waitAction(100) }),
        graphNode("false-step", "action", { config: waitAction(200) }),
        graphNode("merge", "merge"),
        graphNode("after-merge", "action", { config: clickAction("//after") }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "true-step", "in"),
        edge("if-node", "false", "false-step", "in"),
        edge("true-step", "out", "merge", "in"),
        edge("false-step", "out", "merge", "in"),
        edge("merge", "out", "after-merge", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph).filter((issue) => issue.level === "error")).toEqual([]);
    expect(handlers.compileWorkflowGraph(graph).steps[0]).toMatchObject({
      node_id: "if-node",
      config: {
        type: "if_condition",
        config: {
          then_steps: [
            expect.objectContaining({ type: "wait", graph_node_id: "true-step" }),
            expect.objectContaining({ type: "graph_noop", graph_node_id: "merge" }),
            expect.objectContaining({ type: "click", graph_node_id: "after-merge" }),
          ],
          else_steps: [
            expect.objectContaining({ type: "wait", graph_node_id: "false-step" }),
            expect.objectContaining({ type: "graph_noop", graph_node_id: "merge" }),
            expect.objectContaining({ type: "click", graph_node_id: "after-merge" }),
          ],
        },
      },
    });
  });

  test("keeps the one incoming edge rule for non-Merge nodes", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("if-node", "if", { config: { condition: outputEqualsCondition() } }),
        graphNode("left", "action", { config: waitAction(100) }),
        graphNode("right", "action", { config: waitAction(200) }),
        graphNode("shared", "action", { config: clickAction("//shared") }),
      ],
      [
        edge("start", "out", "if-node", "in"),
        edge("if-node", "true", "left", "in"),
        edge("if-node", "false", "right", "in"),
        edge("left", "out", "shared", "in"),
        edge("right", "out", "shared", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph)).toContainEqual(
      expect.objectContaining({
        level: "error",
        node_id: "shared",
        message: "Only one edge can enter an input port",
      }),
    );
  });

  test("compiles Router cases with stable case ids and done continuation", async () => {
    const { handlers } = await createTestHandlers();
    const firstCondition = { kind: "output_equals", name: "state", value: "expired" } as const;
    const secondCondition = { kind: "output_contains", name: "state", value: "challenge" } as const;
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("router", "router", {
          config: {
            mode: "first_match",
            cases: [
              { id: "expired", label: "Expired session", condition: firstCondition },
              { id: "challenge", label: "Challenge", condition: secondCondition },
            ],
            default_label: "Normal",
          },
          ports: [
            inputPort("in", "In"),
            outputPort("case_expired", "Expired session"),
            outputPort("case_challenge", "Challenge"),
            outputPort("default", "Normal"),
            outputPort("done", "Done"),
          ],
        }),
        graphNode("relogin", "action", { config: clickAction("//login") }),
        graphNode("evidence", "action", { config: clickAction("//capture") }),
        graphNode("normal", "action", { config: waitAction(10) }),
        graphNode("continue", "action", { config: waitAction(20) }),
      ],
      [
        edge("start", "out", "router", "in"),
        edge("router", "case_expired", "relogin", "in"),
        edge("router", "case_challenge", "evidence", "in"),
        edge("router", "default", "normal", "in"),
        edge("router", "done", "continue", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph).filter((issue) => issue.level === "error")).toEqual([]);
    expect(handlers.compileWorkflowGraph(graph).steps).toEqual([
      {
        node_id: "router",
        label: "Router",
        config: {
          type: "router_condition",
          config: {
            mode: "first_match",
            cases: [
              {
                id: "expired",
                label: "Expired session",
                condition: firstCondition,
                steps: [
                  expect.objectContaining({ type: "click", graph_node_id: "relogin" }),
                ],
              },
              {
                id: "challenge",
                label: "Challenge",
                condition: secondCondition,
                steps: [
                  expect.objectContaining({ type: "click", graph_node_id: "evidence" }),
                ],
              },
            ],
            default_steps: [
              expect.objectContaining({ type: "wait", graph_node_id: "normal" }),
            ],
          },
        },
      },
      {
        node_id: "continue",
        label: "Continue",
        config: waitAction(20),
      },
    ]);
  });

  test("compiles Random Choice weighted choices with done continuation", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("random", "random_choice" as GraphNodeType, {
          config: {
            choices: [
              { id: "like", label: "Like", weight: 3 },
              { id: "comment", label: "Comment", weight: 1 },
            ],
            output_name: "selected_action",
          },
          ports: [
            inputPort("in", "In"),
            outputPort("choice_like", "Like"),
            outputPort("choice_comment", "Comment"),
            outputPort("done", "Done"),
          ],
        }),
        graphNode("like", "action", { config: clickAction("//button[@data-action='like']") }),
        graphNode("comment", "action", { config: clickAction("//button[@data-action='comment']") }),
        graphNode("continue", "action", { config: waitAction(20) }),
      ],
      [
        edge("start", "out", "random", "in"),
        edge("random", "choice_like", "like", "in"),
        edge("random", "choice_comment", "comment", "in"),
        edge("random", "done", "continue", "in"),
      ],
    );

    expect(handlers.validateWorkflowGraph(graph).filter((issue) => issue.level === "error")).toEqual([]);
    expect(handlers.compileWorkflowGraph(graph).steps).toEqual([
      {
        node_id: "random",
        label: "Random",
        config: {
          type: "random_choice",
          config: {
            choices: [
              {
                id: "like",
                label: "Like",
                weight: 3,
                steps: [
                  expect.objectContaining({ type: "click", graph_node_id: "like" }),
                ],
              },
              {
                id: "comment",
                label: "Comment",
                weight: 1,
                steps: [
                  expect.objectContaining({ type: "click", graph_node_id: "comment" }),
                ],
              },
            ],
            output_name: "selected_action",
          },
        },
      },
      {
        node_id: "continue",
        label: "Continue",
        config: waitAction(20),
      },
    ]);
  });

  test("rejects Router nodes with empty cases, duplicate ids, invalid conditions, and stale ports", async () => {
    const { handlers } = await createTestHandlers();
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("router", "router", {
          config: {
            mode: "first_match",
            cases: [
              { id: "same", label: " ", condition: { kind: "output_equals", name: "", value: "" } },
              { id: "same", label: "Duplicate", condition: outputEqualsCondition() },
            ],
          },
          ports: [
            inputPort("in", "In"),
            outputPort("case_removed", "Removed"),
            outputPort("default", "Default"),
            outputPort("done", "Done"),
          ],
        }),
        graphNode("removed", "action", { config: waitAction(100) }),
      ],
      [
        edge("start", "out", "router", "in"),
        edge("router", "case_removed", "removed", "in"),
      ],
    );

    const messages = handlers.validateWorkflowGraph(graph).map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      "Router case ids must be unique",
      "Router case labels are required",
      "Condition output name is required",
      "Edge edge-router-case_removed-removed-in source port does not exist",
    ]));
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

  test("compiles environment variables without settings-driven preflight actions", () => {
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
    };

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

  test("compiles profile environment variables and lets workflow environment variables override them", () => {
    const graph = graphOf(
      [
        graphNode("start", "start"),
        graphNode("click", "action", { config: clickAction("//button") }),
      ],
      [
        edge("start", "out", "click", "in"),
      ],
    );
    const settings = workflowSettings({
      environment: {
        initial_variables: [{ name: "var1", value_type: "text", value: "workflow-val" }],
      },
    });

    const profileEnvironment = {
      variables: [
        { name: "var1", value_type: "text" as const, value: "profile-val", persist: true },
        { name: "var2", value_type: "text" as const, value: "profile-only-val", persist: false },
      ],
    };

    const plan = compileWorkflowRunPlan(graph, settings, {
      profileEnvironment,
    });

    // Verify both prelude steps are present
    const profilePrelude = plan.steps.find((step) => step.node_id === "__settings:profile:variables");
    const workflowPrelude = plan.steps.find((step) => step.node_id === "__settings:inputs:variables");

    expect(profilePrelude).toBeDefined();
    expect(workflowPrelude).toBeDefined();

    // Verify profile variables are seeded first (low priority)
    expect(profilePrelude?.config).toEqual({
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: [
          { name: "var1", value_type: "text", value: "profile-val" },
          { name: "var2", value_type: "text", value: "profile-only-val" },
        ],
      },
    });

    // Verify workflow variables are seeded second (high priority, will override)
    expect(workflowPrelude?.config).toEqual({
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: [
          { name: "var1", value_type: "text", value: "workflow-val" },
        ],
      },
    });

    // Verify order: profile:variables should come before inputs:variables
    const stepIds = plan.steps.map((step) => step.node_id);
    const profileIndex = stepIds.indexOf("__settings:profile:variables");
    const workflowIndex = stepIds.indexOf("__settings:inputs:variables");
    expect(profileIndex).toBeLessThan(workflowIndex);
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
          type: "select_option",
          config: { xpath: "//select", target, iframe_xpath: null, match_by: "index" as never, value: "1" },
        },
        field: "match_by",
        message: "Match by must be label or value",
      },
      {
        config: {
          type: "click",
          config: { xpath: "//button", target, iframe_xpath: null, wait_until: "ready" as never },
        },
        field: "wait_until",
        message: "Wait until must be attached, visible, enabled, or clickable",
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
        config: {
          type: "assert_text",
          config: { xpath: "//body", target, iframe_xpath: null, text: "Ready", match_mode: "regex" as never },
        },
        field: "match_mode",
        message: "Match mode must be contains or equals",
      },
      {
        config: { type: "assert_output", config: { name: "status", match_mode: "regex" as never, value: "Ready" } },
        field: "match_mode",
        message: "Match mode must be contains or equals",
      },
      {
        config: { type: "set_viewport", config: { width: 0, height: 720 } },
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

  test("accepts scroll target modes and rejects removed or missing element targets", () => {
    const removedScrollMode = ["until", "visible"].join("_") as never;

    expect(
      validateActionConfig({
        type: "scroll",
        config: {
          mode: "into_view",
          target: elementTarget(),
          timeout_ms: 5000,
        },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "scroll",
        config: {
          mode: "page",
          direction: "down",
          pixels: 500,
          scroll_style: "smooth_single",
        },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "scroll",
        config: {
          mode: "page",
          direction: "down",
          pixels: 500,
          scroll_style: "fast" as never,
        },
      }),
    ).toEqual({
      field: "scroll_style",
      message: "Scroll style must be human_like or smooth_single",
    });

    expect(
      validateActionConfig({
        type: "scroll",
        config: {
          mode: "until_element_visible",
          target: elementTarget(),
          direction: "down",
          pixels: 700,
          timeout_ms: 5000,
        },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "scroll",
        config: {
          mode: removedScrollMode,
          xpath: "//h2[normalize-space(.)='Ready']",
          iframe_xpath: "//iframe[@id='main']",
          timeout_ms: 5000,
        },
      }),
    ).toEqual({
      field: "mode",
      message: "Scroll mode must be page, into_view, or until_element_visible",
    });

    expect(
      validateActionConfig({
        type: "scroll",
        config: {
          mode: "into_view",
          target: null,
          xpath: null,
          timeout_ms: 5000,
        },
      }),
    ).toEqual({
      field: "xpath",
      message: "Element target is required",
    });
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

  test("rejects unknown nested action discriminants", () => {
    expect(
      validateActionConfig({
        type: "if_condition",
        config: {
          condition: outputEqualsCondition(),
          then_steps: [{ type: "mystery_action", config: {} }],
          else_steps: [],
        },
      } as ActionConfig),
    ).toEqual({
      field: "then_steps[0].type",
      message: "Unsupported action type: mystery_action",
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
      target: {
        locators: [{ kind: "xpath", value: xpath }],
      },
      text,
      clear_before_input: true,
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
      humanize: true,
      human_preset: "default",
      ...overrides.browser_launch,
    },
    environment: {
      initial_variables: [],
      ...overrides.environment,
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    migration_notes: [],
    created_at: "1",
    updated_at: "1",
  };
}
