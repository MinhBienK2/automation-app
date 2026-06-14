import { describe, expect, test } from "vitest";
import { collectVariableOptions } from "./WorkflowGraphInspector";
import type { WorkflowGraph, GraphNode } from "../../../types/workflow";
import { nodePorts } from "../lib/workflowGraph";

function graphNode(id: string, nodeType: string, config: any): GraphNode {
  return {
    id,
    node_type: nodeType as any,
    label: id,
    position: { x: 0, y: 0 },
    config,
    ports: nodePorts(nodeType as any),
    group_id: null,
  };
}

describe("collectVariableOptions", () => {
  const nodeA = graphNode("node-A", "set_variable", { name: "varA", value_type: "text", value: "1" });
  const nodeB = graphNode("node-B", "set_variable", { name: "varB", value_type: "text", value: "2" });
  const nodeC = graphNode("node-C", "set_variable", { name: "varC", value_type: "text", value: "3" });

  const graph: WorkflowGraph = {
    version: 2,
    nodes: [nodeA, nodeB, nodeC],
    edges: [
      {
        id: "edge-A-B",
        source_node_id: "node-A",
        source_port: "out",
        target_node_id: "node-B",
        target_port: "in",
        label: "next",
        condition: null,
      },
      {
        id: "edge-B-C",
        source_node_id: "node-B",
        source_port: "out",
        target_node_id: "node-C",
        target_port: "in",
        label: "next",
        condition: null,
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  test("only collects variables from upstream (ancestor) nodes relative to B", () => {
    const options = collectVariableOptions(graph, nodeB);
    const names = options.map((opt) => opt.name);
    // Should include varA (upstream), but not varB (self) or varC (downstream)
    expect(names).toContain("varA");
    expect(names).not.toContain("varB");
    expect(names).not.toContain("varC");
  });

  test("only collects variables from upstream relative to C", () => {
    const options = collectVariableOptions(graph, nodeC);
    const names = options.map((opt) => opt.name);
    // Should include varA and varB (upstream), but not varC (self)
    expect(names).toContain("varA");
    expect(names).toContain("varB");
    expect(names).not.toContain("varC");
  });

  test("does not collect variables for A because nothing is upstream of A", () => {
    const options = collectVariableOptions(graph, nodeA);
    const names = options.map((opt) => opt.name);
    // Should not contain any of them
    expect(names).not.toContain("varA");
    expect(names).not.toContain("varB");
    expect(names).not.toContain("varC");
  });

  test("falls back to all variables when selectedNode is null", () => {
    const options = collectVariableOptions(graph, null);
    const names = options.map((opt) => opt.name);
    expect(names).toContain("varA");
    expect(names).toContain("varB");
    expect(names).toContain("varC");
  });
});
