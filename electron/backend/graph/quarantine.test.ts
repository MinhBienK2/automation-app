// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { GraphNode, WorkflowGraph } from "../../../src/types/workflow.js";
import { quarantineNode, isQuarantinedNode } from "./quarantine.js";
import { compileWorkflowGraph } from "./compiler.js";
import { validateWorkflowGraph } from "./validateGraph.js";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node-1",
    node_type: "action",
    label: "Click Submit",
    position: { x: 10, y: 20 },
    ports: [],
    config: {
      type: "click",
      config: {
        target: { locators: [{ kind: "xpath", value: "//button" }] },
      },
    },
    ...overrides,
  };
}

function graphWith(nodes: GraphNode[], edges: WorkflowGraph["edges"] = []): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [],
      },
      ...nodes,
    ],
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("quarantineNode", () => {
  test("converts unknown type node, preserves payload", () => {
    const original = makeNode({ id: "bad", node_type: "unknown_type" as any, label: "Bad Node" });
    const result = quarantineNode(original, {
      reason: "unknown_type",
      message: "Unsupported node type: unknown_type",
    });

    expect(result.id).toBe("bad");
    expect(result.node_type).toBe("quarantined");
    expect(result.label).toBe("Bad Node");
    expect(result.position).toEqual({ x: 10, y: 20 });
    expect(result.ports).toEqual([]);
    expect(result.config).toEqual({
      type: "quarantined",
      config: {
        original_type: "click",
        reason: "unknown_type",
        message: "Unsupported node type: unknown_type",
        original_payload: original.config,
      },
    });
  });

  test("converts node with no action config type", () => {
    const original: GraphNode = {
      id: "no-type",
      node_type: "unknown_type" as any,
      label: "Mystery",
      position: { x: 0, y: 0 },
      ports: [],
      config: null,
    };
    const result = quarantineNode(original, { reason: "parse_error", message: "no config" });
    expect((result.config as any).config.original_type).toBe("unknown_type");
    expect((result.config as any).config.original_payload).toBeNull();
  });

  test("converts invalid config node, preserves action type", () => {
    const original = makeNode({ id: "bad-config" });
    const result = quarantineNode(original, {
      reason: "invalid_config",
      message: "url: required",
    });

    expect(result.node_type).toBe("quarantined");
    expect((result.config as any).config.original_type).toBe("click");
    expect((result.config as any).config.reason).toBe("invalid_config");
    expect((result.config as any).config.original_payload).toBe(original.config);
  });

  test("uses default label when original is empty", () => {
    const original = makeNode({ label: "" });
    const result = quarantineNode(original, { reason: "parse_error", message: "boom" });
    expect(result.label).toBe("Quarantined node");
  });

  test("isQuarantinedNode type guard", () => {
    const quarantined = quarantineNode(makeNode(), { reason: "unknown_type", message: "x" });
    expect(isQuarantinedNode(quarantined)).toBe(true);
    expect(isQuarantinedNode(makeNode())).toBe(false);
  });
});

describe("compiler with quarantined nodes", () => {
  test("quarantined node is skipped, normal node compiles, warning emitted", () => {
    const quarantined = quarantineNode(
      makeNode({ id: "quarantined-1", label: "Bad Action" }),
      { reason: "unknown_type", message: "Unsupported type" },
    );
    const normal = makeNode({
      id: "normal-1",
      label: "Normal Click",
      node_type: "action",
      config: {
        type: "click",
        config: {
          target: { locators: [{ kind: "xpath", value: "//button" }] },
        },
      },
    });

    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: null, ports: [] },
        quarantined,
        normal,
        { id: "end", node_type: "end_success", label: "End", position: { x: 0, y: 0 }, config: null, ports: [] },
      ],
      edges: [
        { id: "e1", source_node_id: "start", source_port: "out", target_node_id: "quarantined-1", target_port: "in" },
        { id: "e2", source_node_id: "quarantined-1", source_port: "out", target_node_id: "normal-1", target_port: "in" },
        { id: "e3", source_node_id: "normal-1", source_port: "out", target_node_id: "end", target_port: "in" },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const compiled = compileWorkflowGraph(graph);
    const stepIds = compiled.steps.map((s) => s.node_id);
    expect(stepIds).toContain("normal-1");
    expect(stepIds).not.toContain("quarantined-1");
  });
});

describe("validateGraph with quarantined nodes", () => {
  test("quarantined node produces warning, not error", () => {
    const quarantined = quarantineNode(
      makeNode({ id: "quarantined-1", label: "Bad" }),
      { reason: "unknown_type", message: "Unsupported" },
    );

    const graph = graphWith([quarantined], [
      { id: "e1", source_node_id: "start", source_port: "out", target_node_id: "quarantined-1", target_port: "in" },
    ]);

    const issues = validateWorkflowGraph(graph);
    const quarantinedIssues = issues.filter((i) => i.node_id === "quarantined-1");
    expect(quarantinedIssues.length).toBe(1);
    expect(quarantinedIssues[0].level).toBe("warning");
    expect(quarantinedIssues[0].message).toContain("Quarantined");
    expect(issues.filter((i) => i.level === "error" && i.node_id === "quarantined-1")).toHaveLength(0);
  });
});
