import { describe, expect, test } from "vitest";
import type { WorkflowStep } from "../../../types/workflow";
import {
  createDefaultGraphNode,
  graphIssuesByNode,
  linearGraphFromSteps,
  nodePorts,
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
});
