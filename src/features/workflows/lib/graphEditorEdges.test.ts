import { describe, expect, test } from "vitest";
import type { GraphNode, GraphNodeType, WorkflowGraph } from "../../../types/workflow";
import {
  edgeKindForFlowSource,
  edgePortsExist,
  replacePortEdge,
} from "./graphEditorEdges";
import { nodePorts, type WorkflowFlowEdge, type WorkflowFlowNode } from "./workflowGraph";

const flowNode = (id: string, nodeType: GraphNodeType): WorkflowFlowNode => ({
  id,
  type: "workflow",
  position: { x: 0, y: 0 },
  data: {
    label: id,
    kindLabel: "Node",
    metaLabel: null,
    nodeType,
    ports: nodePorts(nodeType),
    status: "idle",
    hasIssue: false,
  },
});

const flowEdge = (
  id: string,
  source: string,
  target: string,
  targetHandle = "in",
): WorkflowFlowEdge => ({
  id,
  source,
  sourceHandle: "out",
  target,
  targetHandle,
  data: { hasIssue: false, status: "idle", kind: "main" },
});

const graphNode = (id: string, nodeType: GraphNodeType): GraphNode => ({
  id,
  node_type: nodeType,
  label: id,
  position: { x: 0, y: 0 },
  config: null,
  ports: nodePorts(nodeType),
  group_id: null,
});

describe("replacePortEdge", () => {
  test("preserves multiple incoming links only for merge inputs", () => {
    const existingEdge = flowEdge("edge-a-out-merge-in", "a", "merge");
    const nextMergeEdge = flowEdge("edge-b-out-merge-in", "b", "merge");
    const nextNormalEdge = flowEdge("edge-b-out-target-in", "b", "target");

    expect(
      replacePortEdge(
        [existingEdge],
        nextMergeEdge,
        [flowNode("a", "action"), flowNode("b", "action"), flowNode("merge", "merge")],
      ).map((edge) => edge.id),
    ).toEqual(["edge-a-out-merge-in", "edge-b-out-merge-in"]);
    expect(
      replacePortEdge(
        [flowEdge("edge-a-out-target-in", "a", "target")],
        nextNormalEdge,
        [flowNode("a", "action"), flowNode("b", "action"), flowNode("target", "action")],
      ).map((edge) => edge.id),
    ).toEqual(["edge-b-out-target-in"]);
  });
});

describe("edgeKindForFlowSource", () => {
  test("classifies source ports into graph layout edge kinds", () => {
    const nodes = [
      flowNode("repeat", "repeat_until"),
      flowNode("retry", "retry"),
      flowNode("condition", "if"),
      flowNode("fallback", "fallback"),
    ];

    expect(edgeKindForFlowSource(nodes, "repeat", "loop")).toBe("loop");
    expect(edgeKindForFlowSource(nodes, "retry", "failed")).toBe("recovery");
    expect(edgeKindForFlowSource(nodes, "condition", "false")).toBe("branch");
    expect(edgeKindForFlowSource(nodes, "fallback", "done")).toBe("continuation");
    expect(edgeKindForFlowSource(nodes, "unknown", "out")).toBe("main");
  });
});

describe("edgePortsExist", () => {
  test("returns false when either edge endpoint port no longer exists", () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [graphNode("source", "action"), graphNode("target", "merge")],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    expect(
      edgePortsExist(graph, {
        id: "edge-source-target",
        source_node_id: "source",
        source_port: "out",
        target_node_id: "target",
        target_port: "in",
        label: null,
        condition: null,
      }),
    ).toBe(true);
    expect(
      edgePortsExist(graph, {
        id: "edge-source-target-missing",
        source_node_id: "source",
        source_port: "missing",
        target_node_id: "target",
        target_port: "in",
        label: null,
        condition: null,
      }),
    ).toBe(false);
  });
});
