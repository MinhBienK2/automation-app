import { describe, expect, test } from "vitest";
import type { WorkflowStep } from "../../../types/workflow";
import {
  createDefaultGraphNode,
  fromReactFlowGraph,
  graphIssuesByNode,
  linearGraphFromSteps,
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

    expect(ifNode.node_type).toBe("if");
    expect(ifNode.ports.map((port) => `${port.direction}:${port.id}`)).toEqual([
      "input:in",
      "output:true",
      "output:false",
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
    expect(nodePorts("manual_approval").map((port) => port.id)).toEqual([
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
          markerEnd: expect.objectContaining({
            type: "arrowclosed",
          }),
          data: expect.objectContaining({
            hasIssue: true,
          }),
        }),
      ]),
    );
    expect(flow.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
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
});
