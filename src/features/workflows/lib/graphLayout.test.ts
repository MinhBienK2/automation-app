import { describe, expect, test } from "vitest";
import type { GraphNode, GraphNodeType, WorkflowGraph } from "../../../types/workflow";
import { createDefaultGraphNode } from "./workflowGraph";
import {
  classifyWorkflowGraphEdge,
  layoutWorkflowGraph,
} from "./graphLayout";

describe("workflow graph layout", () => {
  test("wraps long main paths into deterministic left-to-right rows", async () => {
    const graph = linearWorkflowGraph(18);

    const result = await layoutWorkflowGraph(graph, { type: "full" });
    const positions = positionsByNode(result.graph);

    expect(positions.get("start")).toEqual({ x: 0, y: 0 });
    expect(positions.get("node-1")?.x).toBeLessThan(positions.get("node-8")?.x ?? 0);
    expect(positions.get("node-9")).toEqual({ x: 260, y: 180 });
    expect(positions.get("node-16")).toEqual({ x: 2080, y: 180 });
    expect(positions.get("node-17")).toEqual({ x: 260, y: 360 });
    expect(result.graph.edges).toEqual(graph.edges);
    expect(result.graph.viewport).toEqual(graph.viewport);
  });

  test("keeps branch and continuation work on separate lanes", async () => {
    const graph = ifMergeWorkflowGraph();

    const result = await layoutWorkflowGraph(graph, { type: "full" });
    const positions = positionsByNode(result.graph);

    expect(positions.get("if-1")?.x).toBeGreaterThan(positions.get("start")?.x ?? 0);
    expect(positions.get("true-action")?.y).not.toBe(positions.get("false-action")?.y);
    expect(positions.get("merge-1")?.x).toBeGreaterThan(
      Math.max(positions.get("true-action")?.x ?? 0, positions.get("false-action")?.x ?? 0),
    );
    expect(positions.get("after-merge")?.x).toBeGreaterThan(positions.get("merge-1")?.x ?? 0);
  });

  test("selection layout moves only selected nodes", async () => {
    const graph = linearWorkflowGraph(5);

    const result = await layoutWorkflowGraph(graph, {
      type: "selection",
      nodeIds: ["node-2", "node-3", "node-4"],
    });
    const original = positionsByNode(graph);
    const next = positionsByNode(result.graph);

    expect(next.get("start")).toEqual(original.get("start"));
    expect(next.get("node-1")).toEqual(original.get("node-1"));
    expect(next.get("node-5")).toEqual(original.get("node-5"));
    expect(next.get("node-2")).not.toEqual(original.get("node-2"));
    expect(next.get("node-3")).not.toEqual(original.get("node-3"));
    expect(next.get("node-4")).not.toEqual(original.get("node-4"));
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

function actionNode(id: string, position: { x: number; y: number }): GraphNode {
  return graphNode(id, "action", position);
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
