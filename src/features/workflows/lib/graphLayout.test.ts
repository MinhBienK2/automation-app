import { describe, expect, test } from "vitest";
import type { GraphNode, GraphNodeType, WorkflowGraph } from "../../../types/workflow";
import { createDefaultGraphNode } from "./workflowGraph";
import {
  classifyWorkflowGraphEdge,
  layoutWorkflowGraph,
} from "./graphLayout";
import { graphNodeHeightForPorts } from "./graphNodeDimensions";

describe("workflow graph layout", () => {
  test("wraps long main paths into deterministic left-to-right rows", async () => {
    const graph = linearWorkflowGraph(18);

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("start")).toEqual({ x: 0, y: 0 });
    expect(positions.get("node-1")?.x).toBeLessThan(positions.get("node-8")?.x ?? 0);
    expect(positions.get("node-9")).toEqual({ x: 260, y: 180 });
    expect(positions.get("node-16")).toEqual({ x: 2080, y: 180 });
    expect(positions.get("node-17")).toEqual({ x: 260, y: 360 });
    expect(result.graph.edges).toEqual(graph.edges);
    expect(result.graph.viewport).toEqual(graph.viewport);
  });

  test("keeps wrapped rows below port-heavy nodes", async () => {
    const graph = linearWorkflowGraph(10);
    const tallPorts = [
      { id: "in", label: "In", direction: "input" as const },
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `point_${index + 1}`,
        label: `Point ${index + 1}`,
        direction: "output" as const,
      })),
      { id: "out", label: "Out", direction: "output" as const },
    ];
    graph.nodes[1] = {
      ...graph.nodes[1],
      ports: tallPorts,
    };

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);
    const tallNodeBottom = (positions.get("node-1")?.y ?? 0) + graphNodeHeightForPorts(tallPorts);

    expect(positions.get("node-9")?.x).toBe(positions.get("node-1")?.x);
    expect(positions.get("node-9")?.y).toBeGreaterThanOrEqual(tallNodeBottom + 24);
  });

  test("keeps branch and continuation work on separate lanes", async () => {
    const graph = ifMergeWorkflowGraph();

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("if-1")?.x).toBeGreaterThan(positions.get("start")?.x ?? 0);
    expect(positions.get("true-action")?.y).not.toBe(positions.get("false-action")?.y);
    expect(positions.get("merge-1")?.x).toBeGreaterThan(
      Math.max(positions.get("true-action")?.x ?? 0, positions.get("false-action")?.x ?? 0),
    );
    expect(positions.get("after-merge")?.x).toBeGreaterThan(positions.get("merge-1")?.x ?? 0);
  });

  test("orders output targets top-to-bottom by source port order", async () => {
    const graph = switchFanoutWorkflowGraph();

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("case-1")?.y).toBeLessThan(positions.get("case-2")?.y ?? 0);
    expect(positions.get("case-2")?.y).toBeLessThan(positions.get("done")?.y ?? 0);
  });

  test("keeps source port order when branch targets converge on one merge input", async () => {
    const graph = tryCatchMergeWorkflowGraph();

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("try")?.y).toBeLessThan(positions.get("success")?.y ?? 0);
    expect(positions.get("success")?.y).toBeLessThan(positions.get("error")?.y ?? 0);
    expect(positions.get("error")?.y).toBeLessThan(positions.get("finally")?.y ?? 0);
    expect(positions.get("finally")?.y).toBeLessThan(positions.get("done")?.y ?? 0);
  });

  test("keeps output port order across nested branch columns", async () => {
    const graph = nestedBranchColumnWorkflowGraph();

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("case1-0")?.y).toBeLessThan(positions.get("case1-1")?.y ?? 0);
    expect(positions.get("case1-1")?.y).toBeLessThan(positions.get("case1-2")?.y ?? 0);
    expect(positions.get("case1-2")?.y).toBeLessThan(positions.get("case1-3")?.y ?? 0);
    expect(positions.get("case1-3")?.y)
      .toBeLessThan(positions.get("case1-switch-done")?.y ?? 0);
    expect(positions.get("case2-0")?.y).toBeLessThan(positions.get("case2-1")?.y ?? 0);
    expect(positions.get("case2-1")?.y).toBeLessThan(positions.get("case2-2")?.y ?? 0);
    expect(positions.get("case2-2")?.y).toBeLessThan(positions.get("case2-3")?.y ?? 0);
    expect(positions.get("case2-3")?.y).toBeLessThan(positions.get("case2-done")?.y ?? 0);
    expect(positions.get("try")?.y).toBeLessThan(positions.get("success")?.y ?? 0);
    expect(positions.get("success")?.y).toBeLessThan(positions.get("error")?.y ?? 0);
    expect(positions.get("error")?.y).toBeLessThan(positions.get("finally")?.y ?? 0);
    expect(positions.get("finally")?.y).toBeLessThan(positions.get("fallback")?.y ?? 0);
  });

  test("keeps branch continuations in their source port lanes", async () => {
    const graph = copyOfMainRandomChoiceContinuationGraph();

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("node-call_subflow-1780929859993")?.y).toBe(0);
    expect(positions.get("node-call_subflow-1780929859993-copy-2")?.y).toBe(162);
    expect(positions.get("node-call_subflow-1780932688283-copy")?.x)
      .toBeGreaterThan(positions.get("node-call_subflow-1780929859993")?.x ?? 0);
    expect(positions.get("node-call_subflow-1780932688283-copy")?.y)
      .toBe(positions.get("node-call_subflow-1780929859993")?.y);
    expect(positions.get("node-call_subflow-1780932688283-copy-copy")?.y)
      .toBe(positions.get("node-call_subflow-1780929859993-copy-2")?.y);
  });

  test("keeps deep branch continuations in their inherited branch lane", async () => {
    const graph = copyOfMainRandomChoiceContinuationGraph();
    graph.nodes.push(
      callSubflowNode("branch-like-third", "Lướt video tiktok", { x: 1184, y: 972 }),
      callSubflowNode("branch-dwell-third", "Xem video tiktok 15 - 20s", { x: 1184, y: 1134 }),
      callSubflowNode("branch-scroll-third", "Lướt comment", { x: 1184, y: 1296 }),
    );
    graph.edges.push(
      edge("edge-b1-c1", "node-call_subflow-1780932688283-copy", "out", "branch-like-third"),
      edge("edge-b2-c2", "node-call_subflow-1780932688283-copy-copy", "out", "branch-dwell-third"),
      edge("edge-b3-c3", "node-call_subflow-1780929859993-copy-2-copy-copy", "out", "branch-scroll-third"),
    );

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("branch-like-third")?.y)
      .toBe(positions.get("node-call_subflow-1780929859993")?.y);
    expect(positions.get("branch-dwell-third")?.y)
      .toBe(positions.get("node-call_subflow-1780929859993-copy-2")?.y);
    expect(positions.get("branch-scroll-third")?.y)
      .toBe(positions.get("node-call_subflow-1780929859993-copy-2-copy-copy")?.y);
  });

  test("orders input sources top-to-bottom by target port order", async () => {
    const graph = multiInputWorkflowGraph();

    const result = await layoutWorkflowGraph(graph);
    const positions = positionsByNode(result.graph);

    expect(positions.get("source-first")?.y).toBeLessThan(
      positions.get("source-second")?.y ?? 0,
    );
  });

  test("classifies edge intent without persisting layout metadata", () => {
    const graph = ifMergeWorkflowGraph();

    expect(classifyWorkflowGraphEdge(graph, graph.edges[0])).toBe("main");
    expect(classifyWorkflowGraphEdge(graph, graph.edges[1])).toBe("branch");
    expect(classifyWorkflowGraphEdge(graph, graph.edges[3])).toBe("continuation");
    expect(layoutMetadataKeys(graph)).toEqual([]);
  });
});

function positionsByNode(graph: WorkflowGraph) {
  return new Map(graph.nodes.map((node) => [node.id, node.position]));
}

function layoutMetadataKeys(graph: WorkflowGraph) {
  return graph.edges.flatMap((edge) =>
    Object.keys(edge).filter((key) => key === "kind" || key === "layout" || key === "route"),
  );
}

function linearWorkflowGraph(actionCount: number): WorkflowGraph {
  const nodes: GraphNode[] = [
    graphNode("start", "start", { x: 400, y: 200 }),
    ...Array.from({ length: actionCount }, (_, index) =>
      graphNode(
        `node-${index + 1}`,
        "action",
        { x: 400 - index * 20, y: 200 + index * 10 },
      ),
    ),
  ];

  const sequence = nodes.map((node) => node.id);
  return {
    version: 2,
    nodes,
    edges: sequence.slice(0, -1).map((sourceNodeId, index) => ({
      id: `edge-${sourceNodeId}-${sequence[index + 1]}`,
      source_node_id: sourceNodeId,
      source_port: "out",
      target_node_id: sequence[index + 1],
      target_port: "in",
      label: "next",
      condition: null,
    })),
    viewport: { x: -80, y: 20, zoom: 0.8 },
  };
}

function ifMergeWorkflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      graphNode("start", "start", { x: 600, y: 200 }),
      graphNode("if-1", "if", { x: 400, y: 120 }),
      actionNode("true-action", { x: 120, y: 480 }),
      actionNode("false-action", { x: 220, y: -120 }),
      graphNode("merge-1", "merge", { x: 40, y: 80 }),
      actionNode("after-merge", { x: -120, y: 160 }),
    ],
    edges: [
      edge("edge-start-if", "start", "out", "if-1"),
      edge("edge-if-true", "if-1", "true", "true-action"),
      edge("edge-if-false", "if-1", "false", "false-action"),
      edge("edge-if-done", "if-1", "done", "after-merge"),
      edge("edge-true-merge", "true-action", "out", "merge-1"),
      edge("edge-false-merge", "false-action", "out", "merge-1"),
      edge("edge-merge-after", "merge-1", "out", "after-merge"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function switchFanoutWorkflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      graphNode("start", "start", { x: 600, y: 200 }),
      {
        ...graphNode("switch-1", "switch", { x: 400, y: 120 }),
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "case_1", label: "Case 1", direction: "output" },
          { id: "case_2", label: "Case 2", direction: "output" },
          { id: "done", label: "Done", direction: "output" },
        ],
      },
      actionNode("case-1", { x: 120, y: 480 }),
      actionNode("case-2", { x: 220, y: -120 }),
      actionNode("done", { x: -120, y: 160 }),
    ],
    edges: [
      edge("edge-start-switch", "start", "out", "switch-1"),
      edge("edge-switch-done", "switch-1", "done", "done"),
      edge("edge-switch-case-2", "switch-1", "case_2", "case-2"),
      edge("edge-switch-case-1", "switch-1", "case_1", "case-1"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function tryCatchMergeWorkflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      graphNode("start", "start", { x: 600, y: 200 }),
      graphNode("try-catch", "try_catch", { x: 400, y: 120 }),
      actionNode("try", { x: 120, y: 0 }),
      actionNode("success", { x: 120, y: 480 }),
      actionNode("error", { x: 120, y: 240 }),
      actionNode("finally", { x: 120, y: 720 }),
      actionNode("done", { x: 120, y: 960 }),
      graphNode("merge", "merge", { x: 320, y: 360 }),
    ],
    edges: [
      edge("edge-start-try-catch", "start", "out", "try-catch"),
      edge("edge-try-catch-try", "try-catch", "try", "try"),
      edge("edge-try-catch-success", "try-catch", "success", "success"),
      edge("edge-try-catch-error", "try-catch", "error", "error"),
      edge("edge-try-catch-finally", "try-catch", "finally", "finally"),
      edge("edge-try-catch-done", "try-catch", "done", "done"),
      edge("edge-merge-a-error", "error", "out", "merge"),
      edge("edge-merge-b-success", "success", "out", "merge"),
      edge("edge-merge-c-finally", "finally", "out", "merge"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function nestedBranchColumnWorkflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      graphNode("start", "start", { x: 0, y: 0 }),
      graphNode("seed", "set_json_variables", { x: 0, y: 0 }),
      configuredNode("router", "router", routerOutputs(), { x: 0, y: 0 }, {
        cases: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
      }),
      graphNode("big-merge", "merge", { x: 0, y: 0 }),
      graphNode("branch-end", "end_success", { x: 0, y: 0 }),
      graphNode("done-stop", "stop_workflow", { x: 0, y: 0 }),
      graphNode("case1-if", "if", { x: 0, y: 0 }),
      actionNode("case1-true", { x: 0, y: 0 }),
      configuredNode("case1-switch", "switch", switchOutputs(), { x: 0, y: 0 }),
      graphNode("case1-merge", "merge", { x: 0, y: 0 }),
      graphNode("case1-if-done", "end_success", { x: 0, y: 0 }),
      actionNode("case1-0", { x: 0, y: 0 }),
      actionNode("case1-1", { x: 0, y: 0 }),
      actionNode("case1-2", { x: 0, y: 0 }),
      actionNode("case1-3", { x: 0, y: 0 }),
      graphNode("case1-switch-done", "end_success", { x: 0, y: 0 }),
      configuredNode("case2-random", "random_choice", randomChoiceOutputs(), { x: 0, y: 0 }, {
        choices: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
      }),
      graphNode("case2-merge", "merge", { x: 0, y: 0 }),
      actionNode("case2-0", { x: 0, y: 0 }),
      actionNode("case2-1", { x: 0, y: 0 }),
      actionNode("case2-2", { x: 0, y: 0 }),
      actionNode("case2-3", { x: 0, y: 0 }),
      graphNode("case2-done", "end_success", { x: 0, y: 0 }),
      graphNode("case3-repeat", "repeat_times", { x: 0, y: 0 }),
      actionNode("case3-body", { x: 0, y: 0 }),
      graphNode("case3-continue", "continue_loop", { x: 0, y: 0 }),
      graphNode("case3-until", "repeat_until", { x: 0, y: 0 }),
      graphNode("case3-break", "break_loop", { x: 0, y: 0 }),
      graphNode("case3-merge", "merge", { x: 0, y: 0 }),
      graphNode("case3-timeout", "end_failure", { x: 0, y: 0 }),
      graphNode("case4-retry", "retry", { x: 0, y: 0 }),
      actionNode("case4-retry-try", { x: 0, y: 0 }),
      actionNode("case4-retry-fail", { x: 0, y: 0 }),
      graphNode("case4-retry-fail-end", "end_failure", { x: 0, y: 0 }),
      graphNode("tc", "try_catch", { x: 0, y: 0 }),
      graphNode("fallback", "fallback", { x: 0, y: 0 }),
      graphNode("case4-merge", "merge", { x: 0, y: 0 }),
      actionNode("try", { x: 0, y: 0 }),
      graphNode("try-end", "end_success", { x: 0, y: 0 }),
      actionNode("success", { x: 0, y: 0 }),
      graphNode("success-end", "end_success", { x: 0, y: 0 }),
      actionNode("error", { x: 0, y: 0 }),
      graphNode("error-end", "end_success", { x: 0, y: 0 }),
      actionNode("finally", { x: 0, y: 0 }),
      graphNode("finally-end", "end_success", { x: 0, y: 0 }),
      actionNode("fb-primary", { x: 0, y: 0 }),
      graphNode("fb-primary-end", "end_success", { x: 0, y: 0 }),
      actionNode("fb-fallback", { x: 0, y: 0 }),
      graphNode("fb-fallback-end", "end_success", { x: 0, y: 0 }),
      graphNode("default-call", "call_subflow", { x: 0, y: 0 }),
    ],
    edges: [
      edge("e-start-seed", "start", "out", "seed"),
      edge("e-seed-router", "seed", "out", "router"),
      edge("router-1", "router", "case_1", "case1-if"),
      edge("router-2", "router", "case_2", "case2-random"),
      edge("router-3", "router", "case_3", "case3-repeat"),
      edge("router-4", "router", "case_4", "case4-retry"),
      edge("router-default", "router", "default", "default-call"),
      edge("router-done", "router", "done", "done-stop"),
      edge("big-end", "big-merge", "out", "branch-end"),
      edge("default-big", "default-call", "out", "big-merge"),
      edge("case1-true", "case1-if", "true", "case1-true"),
      edge("case1-false", "case1-if", "false", "case1-switch"),
      edge("case1-done", "case1-if", "done", "case1-if-done"),
      edge("case1-true-merge", "case1-true", "out", "case1-merge"),
      edge("case1-merge-big", "case1-merge", "out", "big-merge"),
      edge("switch-1", "case1-switch", "case_1", "case1-0"),
      edge("switch-2", "case1-switch", "case_2", "case1-1"),
      edge("switch-3", "case1-switch", "case_3", "case1-2"),
      edge("switch-default", "case1-switch", "default", "case1-3"),
      edge("switch-done", "case1-switch", "done", "case1-switch-done"),
      edge("case1-0-merge", "case1-0", "out", "case1-merge"),
      edge("case1-1-merge", "case1-1", "out", "case1-merge"),
      edge("case1-2-merge", "case1-2", "out", "case1-merge"),
      edge("case1-3-merge", "case1-3", "out", "case1-merge"),
      edge("random-1", "case2-random", "choice_1", "case2-0"),
      edge("random-2", "case2-random", "choice_2", "case2-1"),
      edge("random-3", "case2-random", "choice_3", "case2-2"),
      edge("random-4", "case2-random", "choice_4", "case2-3"),
      edge("random-done", "case2-random", "done", "case2-done"),
      edge("case2-0-merge", "case2-0", "out", "case2-merge"),
      edge("case2-1-merge", "case2-1", "out", "case2-merge"),
      edge("case2-2-merge", "case2-2", "out", "case2-merge"),
      edge("case2-3-merge", "case2-3", "out", "case2-merge"),
      edge("case2-merge-big", "case2-merge", "out", "big-merge"),
      edge("repeat-loop", "case3-repeat", "loop", "case3-body"),
      edge("repeat-done", "case3-repeat", "done", "case3-until"),
      edge("body-cont", "case3-body", "out", "case3-continue"),
      edge("until-loop", "case3-until", "loop", "case3-break"),
      edge("until-timeout", "case3-until", "timeout", "case3-timeout"),
      edge("until-done", "case3-until", "done", "case3-merge"),
      edge("case3-merge-big", "case3-merge", "out", "big-merge"),
      edge("retry-try", "case4-retry", "try", "case4-retry-try"),
      edge("retry-failed", "case4-retry", "failed", "case4-retry-fail"),
      edge("retry-success", "case4-retry", "success", "tc"),
      edge("retry-fail-end", "case4-retry-fail", "out", "case4-retry-fail-end"),
      edge("tc-try", "tc", "try", "try"),
      edge("tc-success", "tc", "success", "success"),
      edge("tc-error", "tc", "error", "error"),
      edge("tc-finally", "tc", "finally", "finally"),
      edge("tc-done", "tc", "done", "fallback"),
      edge("try-end", "try", "out", "try-end"),
      edge("success-end", "success", "out", "success-end"),
      edge("error-end", "error", "out", "error-end"),
      edge("finally-end", "finally", "out", "finally-end"),
      edge("fb-primary", "fallback", "primary", "fb-primary"),
      edge("fb-fallback", "fallback", "fallback", "fb-fallback"),
      edge("fb-done", "fallback", "done", "case4-merge"),
      edge("fb-primary-end", "fb-primary", "out", "fb-primary-end"),
      edge("fb-fallback-end", "fb-fallback", "out", "fb-fallback-end"),
      edge("case4-merge-big", "case4-merge", "out", "big-merge"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function multiInputWorkflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      graphNode("start", "start", { x: 600, y: 200 }),
      graphNode("if-1", "if", { x: 400, y: 120 }),
      actionNode("source-second", { x: 120, y: 480 }),
      actionNode("source-first", { x: 220, y: -120 }),
      {
        ...actionNode("join", { x: -120, y: 160 }),
        ports: [
          { id: "first", label: "First", direction: "input" },
          { id: "second", label: "Second", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      edge("edge-start-if", "start", "out", "if-1"),
      edge("edge-if-source-second", "if-1", "true", "source-second"),
      edgeToPort("edge-source-second-join", "source-second", "out", "join", "second"),
      edgeToPort("edge-source-first-join", "source-first", "out", "join", "first"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function copyOfMainRandomChoiceContinuationGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      graphNode("start", "start", { x: 0, y: 0 }),
      {
        ...graphNode("choose-behavior", "random_choice", { x: 296, y: 355 }),
        label: "Random TikTok behavior",
        config: {
          choices: [
            { id: "like", label: "Maybe like visible video", weight: 1 },
            { id: "dwell", label: "Just watch/read", weight: 1 },
            { id: "scroll", label: "Scroll to next video", weight: 1 },
            { id: "choice_1780678579846", label: "Choice 4", weight: 1 },
            { id: "choice_1780935838568", label: "Choice 5", weight: 1 },
            { id: "choice_1780935840672", label: "Choice 6", weight: 1 },
            { id: "choice_1780938373844", label: "Choice 7", weight: 1 },
          ],
          output_name: "random_choice",
        },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "choice_like", label: "Maybe like visible video", direction: "output" },
          { id: "choice_dwell", label: "Just watch/read", direction: "output" },
          { id: "choice_scroll", label: "Scroll to next video", direction: "output" },
          { id: "choice_choice_1780678579846", label: "Choice 4", direction: "output" },
          { id: "choice_choice_1780935838568", label: "Choice 5", direction: "output" },
          { id: "choice_choice_1780935840672", label: "Choice 6", direction: "output" },
          { id: "choice_choice_1780938373844", label: "Choice 7", direction: "output" },
          { id: "done", label: "Done", direction: "output" },
        ],
      },
      callSubflowNode("node-call_subflow-1780929859993", "Xem video tiktok 15 - 20s", { x: 592, y: 0 }),
      callSubflowNode("node-call_subflow-1780929859993-copy-2", "Xem video tiktok 15 - 20s", { x: 592, y: 162 }),
      callSubflowNode("node-call_subflow-1780932688283-copy-copy-copy", "Like video tiktok", { x: 592, y: 324 }),
      callSubflowNode("node-call_subflow-1780932688283-copy-copy-copy-copy", "Like video tiktok", { x: 592, y: 486 }),
      callSubflowNode("node-call_subflow-1780932830594", "comment video tiktok", { x: 592, y: 663 }),
      graphNode("node-repeat_times-1780937351330", "repeat_times", { x: 592, y: 825 }),
      callSubflowNode("node-call_subflow-1780932830594-copy", "comment video tiktok", { x: 592, y: 1134 }),
      callSubflowNode("node-call_subflow-1780929859993-copy-2-copy-copy", "Xem video tiktok 15 - 20s", { x: 888, y: 0 }),
      callSubflowNode("node-call_subflow-1780929859993-copy", "Xem video tiktok 15 - 20s", { x: 888, y: 162 }),
      callSubflowNode("node-call_subflow-1780938428230-copy", "Lướt video tiktok", { x: 888, y: 324 }),
      callSubflowNode("node-call_subflow-1780938428230-copy-copy", "Lướt video tiktok", { x: 888, y: 486 }),
      callSubflowNode("node-call_subflow-1780937680973", "Lướt comment", { x: 888, y: 648 }),
      callSubflowNode("node-call_subflow-1780938428230", "Lướt video tiktok", { x: 888, y: 810 }),
      callSubflowNode("node-call_subflow-1780932688283-copy", "Like video tiktok", { x: 888, y: 972 }),
      callSubflowNode("node-call_subflow-1780932688283-copy-copy", "Like video tiktok", { x: 888, y: 1134 }),
    ],
    edges: [
      edge("edge-start-choice", "start", "out", "choose-behavior"),
      edge("edge-choose-like", "choose-behavior", "choice_like", "node-call_subflow-1780929859993"),
      edge("edge-choose-dwell", "choose-behavior", "choice_dwell", "node-call_subflow-1780929859993-copy-2"),
      edge("edge-choose-scroll", "choose-behavior", "choice_scroll", "node-call_subflow-1780932688283-copy-copy-copy"),
      edge("edge-choose-choice-4", "choose-behavior", "choice_choice_1780678579846", "node-call_subflow-1780932688283-copy-copy-copy-copy"),
      edge("edge-choose-choice-5", "choose-behavior", "choice_choice_1780935838568", "node-call_subflow-1780932830594"),
      edge("edge-choose-choice-6", "choose-behavior", "choice_choice_1780935840672", "node-repeat_times-1780937351330"),
      edge("edge-choose-choice-7", "choose-behavior", "choice_choice_1780938373844", "node-call_subflow-1780932830594-copy"),
      edge("edge-a1-b1", "node-call_subflow-1780929859993", "out", "node-call_subflow-1780932688283-copy"),
      edge("edge-a2-b2", "node-call_subflow-1780929859993-copy-2", "out", "node-call_subflow-1780932688283-copy-copy"),
      edge("edge-a3-b3", "node-call_subflow-1780932688283-copy-copy-copy", "out", "node-call_subflow-1780929859993-copy-2-copy-copy"),
      edge("edge-a4-b4", "node-call_subflow-1780932688283-copy-copy-copy-copy", "out", "node-call_subflow-1780938428230-copy"),
      edge("edge-a5-b5", "node-call_subflow-1780932830594", "out", "node-call_subflow-1780938428230-copy-copy"),
      edge("edge-repeat-loop", "node-repeat_times-1780937351330", "loop", "node-call_subflow-1780937680973"),
      edge("edge-repeat-done", "node-repeat_times-1780937351330", "done", "node-call_subflow-1780938428230"),
      edge("edge-a7-b7", "node-call_subflow-1780932830594-copy", "out", "node-call_subflow-1780929859993-copy"),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function callSubflowNode(
  id: string,
  label: string,
  position: { x: number; y: number },
): GraphNode {
  return {
    ...graphNode(id, "call_subflow", position),
    label,
  };
}

function actionNode(id: string, position: { x: number; y: number }): GraphNode {
  return graphNode(id, "action", position);
}

function configuredNode(
  id: string,
  nodeType: GraphNodeType,
  outputs: Array<{ id: string; label: string }>,
  position: { x: number; y: number },
  config?: Record<string, unknown>,
): GraphNode {
  return {
    ...graphNode(id, nodeType, position),
    config: config ?? null,
    ports: [
      { id: "in", label: "In", direction: "input" },
      ...outputs.map((output) => ({
        ...output,
        direction: "output" as const,
      })),
    ],
  };
}

function routerOutputs() {
  return [
    { id: "case_1", label: "Case 1" },
    { id: "case_2", label: "Case 2" },
    { id: "case_3", label: "Case 3" },
    { id: "case_4", label: "Case 4" },
    { id: "default", label: "Default" },
    { id: "done", label: "Done" },
  ];
}

function switchOutputs() {
  return [
    { id: "case_1", label: "Case 1" },
    { id: "case_2", label: "Case 2" },
    { id: "case_3", label: "Case 3" },
    { id: "default", label: "Default" },
    { id: "done", label: "Done" },
  ];
}

function randomChoiceOutputs() {
  return [
    { id: "choice_1", label: "Choice 1" },
    { id: "choice_2", label: "Choice 2" },
    { id: "choice_3", label: "Choice 3" },
    { id: "choice_4", label: "Choice 4" },
    { id: "done", label: "Done" },
  ];
}

function graphNode(
  id: string,
  nodeType: GraphNodeType,
  position: { x: number; y: number },
): GraphNode {
  return {
    ...createDefaultGraphNode(nodeType, position),
    id,
    label: id,
    position,
  };
}

function edge(id: string, source: string, sourcePort: string, target: string) {
  return {
    id,
    source_node_id: source,
    source_port: sourcePort,
    target_node_id: target,
    target_port: "in",
    label: sourcePort,
    condition: null,
  };
}

function edgeToPort(
  id: string,
  source: string,
  sourcePort: string,
  target: string,
  targetPort: string,
) {
  return {
    ...edge(id, source, sourcePort, target),
    target_port: targetPort,
  };
}
