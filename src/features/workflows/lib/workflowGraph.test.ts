import { describe, expect, test } from "vitest";
import type { GraphNode, GraphNodeType, WorkflowGraph, WorkflowStep } from "../../../types/workflow";
import {
  createDefaultGraphNode,
  fromReactFlowGraph,
  graphIssuesByNode,
  linearGraphFromSteps,
  mergeReactFlowNodeRuntimeState,
  nodePorts,
  toReactFlowGraph,
} from "./workflowGraph";

const waitStep: WorkflowStep = {
  id: "step-wait",
  name: "Wait",
  workflow_id: "workflow-1",
  order_index: 0,
  action_type: "wait",
  config: {
    type: "wait",
    config: { condition: "duration", duration_ms: 100 },
  },
  created_at: "1",
  updated_at: "1",
};

describe("workflow graph helpers", () => {
  test("builds a start to New node draft graph when workflow has no steps", () => {
    const graph = linearGraphFromSteps([]);

    expect(graph.nodes.map((node) => node.id)).toEqual(["start", "new-node"]);
    expect(graph.nodes[1]).toEqual(
      expect.objectContaining({
        node_type: "action",
        label: "New node",
        config: null,
      }),
    );
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source_node_id: "start",
        source_port: "out",
        target_node_id: "new-node",
        target_port: "in",
      }),
    ]);
  });

  test("builds a linear graph from existing workflow steps", () => {
    const graph = linearGraphFromSteps([waitStep]);

    expect(graph.version).toBe(2);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      "start",
      "step-wait",
      "end_success",
    ]);
    expect(graph.edges.map((edge) => edge.source_node_id)).toEqual([
      "start",
      "step-wait",
    ]);
  });

  test("creates default nodes with stable ports", () => {
    const ifNode = createDefaultGraphNode("if", { x: 10, y: 20 });
    const variablesNode = createDefaultGraphNode("set_variable", { x: 20, y: 30 });
    const jsonVariablesNode = createDefaultGraphNode("set_json_variables", { x: 30, y: 40 });
    const mergeNode = createDefaultGraphNode("merge", { x: 40, y: 50 });
    const routerNode = createDefaultGraphNode("router", { x: 50, y: 60 });
    const randomChoiceNode = createDefaultGraphNode("random_choice" as GraphNodeType, { x: 60, y: 70 });

    expect(ifNode.node_type).toBe("if");
    expect(ifNode.ports.map((port) => `${port.direction}:${port.id}`)).toEqual([
      "input:in",
      "output:true",
      "output:false",
      "output:done",
    ]);
    expect(variablesNode.label).toBe("Set Variables");
    expect(variablesNode.config).toEqual({
      variables: [{ name: "name", value_type: "text", value: "" }],
    });
    expect(jsonVariablesNode.label).toBe("Set JSON Variables");
    expect(jsonVariablesNode.config).toEqual({
      json: "{\n  \"name\": \"value\"\n}",
    });
    expect(mergeNode.ports.map((port) => `${port.direction}:${port.id}`)).toEqual([
      "input:in",
      "output:out",
    ]);
    expect(routerNode.config).toEqual({
      mode: "first_match",
      cases: [
        {
          id: "1",
          label: "Case 1",
          condition: { kind: "output_equals", name: "name", value: "" },
        },
      ],
      default_label: "Default",
    });
    expect(routerNode.ports.map((port) => `${port.direction}:${port.id}:${port.label}`)).toEqual([
      "input:in:In",
      "output:case_1:Case 1",
      "output:default:Default",
      "output:done:Done",
    ]);
    expect(randomChoiceNode.config).toEqual({
      choices: [
        { id: "1", label: "Choice 1", weight: 1 },
        { id: "2", label: "Choice 2", weight: 1 },
      ],
      output_name: "random_choice",
    });
    expect(randomChoiceNode.ports.map((port) => `${port.direction}:${port.id}:${port.label}`)).toEqual([
      "input:in:In",
      "output:choice_1:Choice 1",
      "output:choice_2:Choice 2",
      "output:done:Done",
    ]);
  });

  test("returns stable port definitions for graph node types", () => {
    expect(nodePorts("repeat_times").map((port) => port.id)).toEqual([
      "in",
      "loop",
      "done",
    ]);
    expect(nodePorts("repeat_for_each").map((port) => port.id)).toEqual([
      "in",
      "loop",
      "done",
    ]);
    expect(nodePorts("retry").map((port) => port.id)).toEqual([
      "in",
      "try",
      "success",
      "failed",
    ]);
    expect(nodePorts("if").map((port) => port.id)).toEqual([
      "in",
      "true",
      "false",
      "done",
    ]);
    expect(nodePorts("switch").map((port) => port.id)).toEqual([
      "in",
      "case_1",
      "default",
      "done",
    ]);
    expect(nodePorts("merge").map((port) => port.id)).toEqual([
      "in",
      "out",
    ]);
    expect(nodePorts("router").map((port) => port.id)).toEqual([
      "in",
      "case_1",
      "default",
      "done",
    ]);
    expect(nodePorts("random_choice" as GraphNodeType).map((port) => port.id)).toEqual([
      "in",
      "choice_1",
      "choice_2",
      "done",
    ]);
    expect(nodePorts("try_catch").map((port) => port.id)).toEqual([
      "in",
      "try",
      "success",
      "error",
      "finally",
      "done",
    ]);
    expect(nodePorts("set_json_variables").map((port) => port.id)).toEqual([
      "in",
      "out",
    ]);
  });

  test("groups validation issues by node id", () => {
    const grouped = graphIssuesByNode([
      {
        level: "error",
        node_id: "node-1",
        edge_id: null,
        message: "Node is invalid",
      },
      {
        level: "warning",
        node_id: null,
        edge_id: "edge-1",
        message: "Graph warning",
      },
    ]);

    expect(grouped.get("node-1")?.[0].message).toBe("Node is invalid");
    expect(grouped.get("__graph__")?.[0].message).toBe("Graph warning");
  });

  test("maps persisted workflow graph to React Flow nodes and edges", () => {
    const graph = linearGraphFromSteps([waitStep]);
    graph.edges[0] = {
      ...graph.edges[0],
      delay: { type: "fixed", duration_ms: 750 },
    };

    const flow = toReactFlowGraph(graph, {
      selectedNodeId: "step-wait",
      runningNodeId: "step-wait",
      completedNodeIds: new Set(["start"]),
      failedNodeId: null,
      issueNodeIds: new Set(["step-wait"]),
      issueEdgeIds: new Set(["edge-start-step-wait"]),
    });

    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "step-wait",
          type: "workflow",
          position: { x: 220, y: 0 },
          selected: true,
          data: expect.objectContaining({
            label: "Wait",
            nodeType: "action",
            status: "running",
            hasIssue: true,
            ports: expect.arrayContaining([
              expect.objectContaining({ id: "in", direction: "input" }),
              expect.objectContaining({ id: "out", direction: "output" }),
            ]),
          }),
        }),
      ]),
    );
    expect(flow.nodes.find((node) => node.id === "step-wait")).not.toHaveProperty("dragHandle");
    expect(flow.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-start-step-wait",
          source: "start",
          sourceHandle: "out",
          target: "step-wait",
          targetHandle: "in",
          label: "1",
          ariaLabel: "Step 1: Start to Wait via next",
          className: expect.stringContaining("graph-edge-has-issue"),
          interactionWidth: 20,
          markerEnd: expect.objectContaining({
            type: "arrowclosed",
            color: "#f4b740",
          }),
          style: expect.objectContaining({
            stroke: "#f4b740",
            strokeWidth: 2.75,
          }),
          data: expect.objectContaining({
            hasIssue: true,
            kind: "main",
            delayLabel: "750ms",
          }),
        }),
      ]),
    );
    expect(flow.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  test("orders graph edge labels by execution port traversal instead of edge array order", () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: {},
          ports: nodePorts("start"),
          group_id: null,
        },
        {
          id: "if-1",
          node_type: "if",
          label: "If account is ready",
          position: { x: 240, y: 0 },
          config: {
            condition: { kind: "output_equals", name: "ready", value: "yes" },
          },
          ports: nodePorts("if"),
          group_id: null,
        },
        {
          id: "true-action",
          node_type: "action",
          label: "Ready branch",
          position: { x: 480, y: -120 },
          config: { type: "wait", config: { condition: "duration", duration_ms: 10 } },
          ports: nodePorts("action"),
          group_id: null,
        },
        {
          id: "false-action",
          node_type: "action",
          label: "Not ready branch",
          position: { x: 480, y: 0 },
          config: { type: "wait", config: { condition: "duration", duration_ms: 10 } },
          ports: nodePorts("action"),
          group_id: null,
        },
        {
          id: "done-action",
          node_type: "action",
          label: "Continue",
          position: { x: 480, y: 120 },
          config: { type: "wait", config: { condition: "duration", duration_ms: 10 } },
          ports: nodePorts("action"),
          group_id: null,
        },
      ],
      edges: [
        {
          id: "edge-if-done",
          source_node_id: "if-1",
          source_port: "done",
          target_node_id: "done-action",
          target_port: "in",
          label: "done",
          condition: null,
        },
        {
          id: "edge-if-false",
          source_node_id: "if-1",
          source_port: "false",
          target_node_id: "false-action",
          target_port: "in",
          label: "false",
          condition: null,
        },
        {
          id: "edge-start-if",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "if-1",
          target_port: "in",
          label: "next",
          condition: null,
        },
        {
          id: "edge-if-true",
          source_node_id: "if-1",
          source_port: "true",
          target_node_id: "true-action",
          target_port: "in",
          label: "true",
          condition: null,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const labels = new Map(toReactFlowGraph(graph).edges.map((edge) => [edge.id, edge.label]));

    expect(labels).toEqual(
      new Map([
        ["edge-if-done", "4"],
        ["edge-if-false", "3"],
        ["edge-start-if", "1"],
        ["edge-if-true", "2"],
      ]),
    );
  });

  test("converts very large linear graphs without recursive traversal failure", () => {
    const graph = largeLinearGraph(12_000);

    expect(() => toReactFlowGraph(graph)).not.toThrow();
  });

  test("marks selected graph edges with distinct stroke and marker styling", () => {
    const graph = linearGraphFromSteps([waitStep]);

    const flow = toReactFlowGraph(graph, {
      selectedEdgeId: "edge-start-step-wait",
    });

    expect(flow.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-start-step-wait",
          selected: true,
          className: expect.stringContaining("graph-edge-selected"),
          markerEnd: expect.objectContaining({
            color: "#32d3e6",
          }),
          style: expect.objectContaining({
            stroke: "#32d3e6",
            strokeWidth: 3.5,
          }),
        }),
      ]),
    );
  });

  test("uses semantic graph edge colors with neutral defaults and success green only for completed runs", () => {
    const graph = linearGraphFromSteps([waitStep]);

    const defaultFlow = toReactFlowGraph(graph);
    expect(defaultFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-main"),
          style: expect.objectContaining({ stroke: "#3e5668" }),
        }),
      );

    const completedFlow = toReactFlowGraph(graph, {
      completedNodeIds: new Set(["step-wait"]),
    });
    expect(completedFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-completed"),
          style: expect.objectContaining({ stroke: "#39d98a" }),
        }),
      );

    const failedFlow = toReactFlowGraph(graph, {
      failedNodeId: "step-wait",
    });
    expect(failedFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-failed"),
          style: expect.objectContaining({ stroke: "#f06467" }),
        }),
      );

    const issueFlow = toReactFlowGraph(graph, {
      issueEdgeIds: new Set(["edge-start-step-wait"]),
    });
    expect(issueFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-has-issue"),
          style: expect.objectContaining({ stroke: "#f4b740" }),
        }),
      );
  });

  test("classifies workflow edges by graph intent for visual routing", () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        graphNode("start", "start", { x: 0, y: 0 }),
        graphNode("if-1", "if", { x: 260, y: 0 }),
        graphNode("true-action", "action", { x: 520, y: -120 }),
        graphNode("after-if", "action", { x: 520, y: 0 }),
        graphNode("retry-1", "retry", { x: 780, y: 0 }),
        graphNode("failed-action", "action", { x: 1040, y: 120 }),
      ],
      edges: [
        {
          id: "edge-start-if",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "if-1",
          target_port: "in",
          label: "next",
          condition: null,
        },
        {
          id: "edge-if-true",
          source_node_id: "if-1",
          source_port: "true",
          target_node_id: "true-action",
          target_port: "in",
          label: "true",
          condition: null,
        },
        {
          id: "edge-if-done",
          source_node_id: "if-1",
          source_port: "done",
          target_node_id: "after-if",
          target_port: "in",
          label: "done",
          condition: null,
        },
        {
          id: "edge-retry-failed",
          source_node_id: "retry-1",
          source_port: "failed",
          target_node_id: "failed-action",
          target_port: "in",
          label: "failed",
          condition: null,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const edges = new Map(toReactFlowGraph(graph).edges.map((edge) => [edge.id, edge]));

    expect(edges.get("edge-start-if")).toEqual(
      expect.objectContaining({
        className: expect.stringContaining("graph-edge-main"),
        data: expect.objectContaining({ kind: "main" }),
      }),
    );
    expect(edges.get("edge-if-true")).toEqual(
      expect.objectContaining({
        className: expect.stringContaining("graph-edge-branch"),
        data: expect.objectContaining({ kind: "branch" }),
      }),
    );
    expect(edges.get("edge-if-done")).toEqual(
      expect.objectContaining({
        className: expect.stringContaining("graph-edge-continuation"),
        data: expect.objectContaining({ kind: "continuation" }),
      }),
    );
    expect(edges.get("edge-retry-failed")).toEqual(
      expect.objectContaining({
        className: expect.stringContaining("graph-edge-recovery"),
        data: expect.objectContaining({ kind: "recovery" }),
      }),
    );
  });

  test("maps React Flow nodes and edges back to a persisted workflow graph", () => {
    const graph = linearGraphFromSteps([waitStep]);
    graph.edges[0] = {
      ...graph.edges[0],
      delay: { type: "random", min_ms: 500, max_ms: 1200 },
    };
    const flow = toReactFlowGraph(graph);
    const movedNodes = flow.nodes.map((node) =>
      node.id === "step-wait" ? { ...node, position: { x: 320, y: 80 } } : node,
    );
    const connectedEdges = [
      ...flow.edges,
      {
        id: "edge-step-wait-end_success",
        source: "step-wait",
        sourceHandle: "out",
        target: "end_success",
        targetHandle: "in",
        label: "next",
      },
    ];

    const nextGraph = fromReactFlowGraph(
      graph,
      movedNodes,
      connectedEdges,
      { x: 12, y: 24, zoom: 0.8 },
    );

    expect(nextGraph.viewport).toEqual({ x: 12, y: 24, zoom: 0.8 });
    expect(nextGraph.nodes.find((node) => node.id === "step-wait")?.position)
      .toEqual({ x: 320, y: 80 });
    expect(nextGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-step-wait-end_success",
          source_node_id: "step-wait",
          source_port: "out",
          target_node_id: "end_success",
          target_port: "in",
          label: "next",
          condition: null,
        }),
        expect.objectContaining({
          id: "edge-start-step-wait",
          delay: { type: "random", min_ms: 500, max_ms: 1200 },
        }),
      ]),
    );
  });

  test("keeps execution order labels as display-only when syncing React Flow edges", () => {
    const graph = linearGraphFromSteps([waitStep]);
    const flow = toReactFlowGraph(graph);

    expect(flow.edges.find((edge) => edge.id === "edge-start-step-wait")?.label)
      .toBe("1");

    const nextGraph = fromReactFlowGraph(
      graph,
      flow.nodes,
      flow.edges,
      graph.viewport,
    );

    expect(nextGraph.edges.find((edge) => edge.id === "edge-start-step-wait")?.label)
      .toBe("next");
  });

  test("preserves React Flow measured node dimensions when graph nodes are remapped", () => {
    const graph = linearGraphFromSteps([waitStep]);
    const firstFlow = toReactFlowGraph(graph);
    const measuredNodes = firstFlow.nodes.map((node) =>
      node.id === "step-wait"
        ? {
            ...node,
            measured: { width: 172, height: 74 },
            width: 172,
            height: 74,
            dragging: true,
          }
        : node,
    );

    const nextFlow = toReactFlowGraph(graph, { selectedNodeId: "step-wait" });
    const mergedNodes = mergeReactFlowNodeRuntimeState(
      nextFlow.nodes,
      measuredNodes,
    );

    expect(mergedNodes.find((node) => node.id === "step-wait")).toEqual(
      expect.objectContaining({
        selected: true,
        measured: { width: 172, height: 74 },
        width: 172,
        height: 74,
        dragging: true,
      }),
    );
  });
});

function largeLinearGraph(actionCount: number): WorkflowGraph {
  const nodes: WorkflowGraph["nodes"] = [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: nodePorts("start"),
      group_id: null,
    },
    ...Array.from({ length: actionCount }, (_, index) => ({
      id: `node-${index + 1}`,
      node_type: "action" as const,
      label: `Node ${index + 1}`,
      position: { x: (index + 1) * 220, y: 0 },
      config: { type: "wait" as const, config: { condition: "duration" as const, duration_ms: 10 } },
      ports: nodePorts("action"),
      group_id: null,
    })),
  ];

  return {
    version: 2,
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `edge-${node.id}-${nodes[index + 1].id}`,
      source_node_id: node.id,
      source_port: "out",
      target_node_id: nodes[index + 1].id,
      target_port: "in",
      label: "next",
      condition: null,
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
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
