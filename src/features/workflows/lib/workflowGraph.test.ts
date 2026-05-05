import { describe, expect, test } from "vitest";
import type { WorkflowStep } from "../../../types/workflow";
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

    expect(graph.version).toBe(1);
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
    expect(nodePorts("try_catch").map((port) => port.id)).toEqual([
      "in",
      "try",
      "success",
      "error",
      "finally",
      "done",
    ]);
    expect(nodePorts("manual_approval").map((port) => port.id)).toEqual([
      "in",
      "out",
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
          dragHandle: ".graph-node-drag-handle",
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
          className: "graph-edge graph-edge-has-issue",
          interactionWidth: 20,
          markerEnd: expect.objectContaining({
            type: "arrowclosed",
            color: "#fbbf24",
          }),
          style: expect.objectContaining({
            stroke: "#fbbf24",
            strokeWidth: 2.75,
          }),
          data: expect.objectContaining({
            hasIssue: true,
          }),
        }),
      ]),
    );
    expect(flow.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
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
            color: "#22d3ee",
          }),
          style: expect.objectContaining({
            stroke: "#22d3ee",
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
          className: "graph-edge",
          style: expect.objectContaining({ stroke: "#4d4d4d" }),
        }),
      );

    const completedFlow = toReactFlowGraph(graph, {
      completedNodeIds: new Set(["step-wait"]),
    });
    expect(completedFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-completed"),
          style: expect.objectContaining({ stroke: "#3ecf8e" }),
        }),
      );

    const failedFlow = toReactFlowGraph(graph, {
      failedNodeId: "step-wait",
    });
    expect(failedFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-failed"),
          style: expect.objectContaining({ stroke: "#ff7b72" }),
        }),
      );

    const issueFlow = toReactFlowGraph(graph, {
      issueEdgeIds: new Set(["edge-start-step-wait"]),
    });
    expect(issueFlow.edges.find((edge) => edge.id === "edge-start-step-wait"))
      .toEqual(
        expect.objectContaining({
          className: expect.stringContaining("graph-edge-has-issue"),
          style: expect.objectContaining({ stroke: "#fbbf24" }),
        }),
      );
  });

  test("maps React Flow nodes and edges back to a persisted workflow graph", () => {
    const graph = linearGraphFromSteps([waitStep]);
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
      ]),
    );
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
