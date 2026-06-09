import { describe, expect, test } from "vitest";
import type { WorkflowGraph } from "../../../types/workflow";
import {
  buildSelectedSubflowPlan,
  insertSubflowGraphNodes,
  replaceSelectionWithSubflowNode,
} from "./subflowSelection";

const graph: WorkflowGraph = {
  version: 2,
  nodes: [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: [
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: null,
    },
    {
      id: "step-1",
      node_type: "action",
      label: "Open",
      position: { x: 220, y: 0 },
      config: { type: "navigate", config: { url: "https://example.test" } },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: null,
    },
    {
      id: "step-2",
      node_type: "action",
      label: "Fill",
      position: { x: 440, y: 0 },
      config: { type: "input_text", config: { text: "qa@example.test" } },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: null,
    },
    {
      id: "after",
      node_type: "action",
      label: "Submit",
      position: { x: 660, y: 0 },
      config: { type: "click", config: {} },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: null,
    },
  ],
  edges: [
    {
      id: "edge-start-step-1",
      source_node_id: "start",
      source_port: "out",
      target_node_id: "step-1",
      target_port: "in",
      label: "next",
      condition: null,
    },
    {
      id: "edge-step-1-step-2",
      source_node_id: "step-1",
      source_port: "out",
      target_node_id: "step-2",
      target_port: "in",
      label: "next",
      condition: null,
    },
    {
      id: "edge-step-2-after",
      source_node_id: "step-2",
      source_port: "out",
      target_node_id: "after",
      target_port: "in",
      label: "next",
      condition: null,
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("subflow selection planning", () => {
  test("builds a reusable subflow graph from a connected selection", () => {
    const plan = buildSelectedSubflowPlan(graph, {
      nodeIds: ["step-1", "step-2"],
      edgeIds: [],
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.entryNode.id).toBe("step-1");
    expect(plan.externalIncomingEdges).toHaveLength(1);
    expect(plan.externalOutgoingEdges).toHaveLength(1);
    expect(plan.subflowGraph.nodes.map((node) => node.id)).toEqual([
      "start",
      "step-1",
      "step-2",
    ]);
    expect(plan.subflowGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_node_id: "start",
          target_node_id: "step-1",
        }),
        expect.objectContaining({
          source_node_id: "step-1",
          target_node_id: "step-2",
        }),
      ]),
    );
  });

  test("replaces a selected block with one call-subflow node", () => {
    const replacement = replaceSelectionWithSubflowNode(
      graph,
      { nodeIds: ["step-1", "step-2"], edgeIds: [] },
      { id: "subflow-login", name: "Login" },
    );

    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;
    expect(replacement.selection.nodeIds).toHaveLength(1);
    const callNode = replacement.graph.nodes.find((node) => node.node_type === "call_subflow");
    expect(callNode).toEqual(
      expect.objectContaining({
        label: "Login",
        config: {
          subflow_id: "subflow-login",
          input_mapping: [],
          output_prefix: null,
        },
      }),
    );
    expect(replacement.graph.nodes.some((node) => node.id === "step-1")).toBe(false);
    expect(replacement.graph.nodes.some((node) => node.id === "step-2")).toBe(false);
    expect(replacement.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_node_id: "start",
          target_node_id: callNode?.id,
        }),
        expect.objectContaining({
          source_node_id: callNode?.id,
          target_node_id: "after",
        }),
      ]),
    );
  });

  test("rejects replacement when a selected branch also exits the selection", () => {
    const branchingGraph: WorkflowGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: "side-exit",
          node_type: "action",
          label: "Side Exit",
          position: { x: 440, y: 180 },
          config: { type: "click", config: {} },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
          group_id: null,
        },
      ],
      edges: [
        ...graph.edges.filter((edge) => edge.id !== "edge-step-2-after"),
        {
          id: "edge-step-1-side-exit",
          source_node_id: "step-1",
          source_port: "out",
          target_node_id: "side-exit",
          target_port: "in",
          label: "side branch",
          condition: null,
        },
      ],
    };

    expect(
      replaceSelectionWithSubflowNode(
        branchingGraph,
        { nodeIds: ["step-1", "step-2"], edgeIds: [] },
        { id: "subflow-login", name: "Login" },
      ),
    ).toEqual({
      ok: false,
      message:
        "Replace cannot safely rewire selections where a selected node has both internal links and links to the outside graph.",
    });
  });

  test("rejects selections that include start", () => {
    expect(
      buildSelectedSubflowPlan(graph, {
        nodeIds: ["start", "step-1"],
        edgeIds: [],
      }),
    ).toEqual({
      ok: false,
      message: "Start cannot be included in a reusable subflow.",
    });
  });

  test("inserts real subflow nodes into a workflow graph without linking to the source subflow", () => {
    const sourceSubflowGraph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: {},
          ports: [{ id: "out", label: "Out", direction: "output" }],
          group_id: null,
        },
        {
          id: "step-1",
          node_type: "action",
          label: "Open",
          position: { x: 220, y: 40 },
          config: { type: "navigate", config: { url: "https://login.test" } },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
          group_id: null,
        },
        {
          id: "step-2",
          node_type: "action",
          label: "Fill",
          position: { x: 440, y: 100 },
          config: { type: "input_text", config: { text: "qa@example.test" } },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
          group_id: null,
        },
      ],
      edges: [
        {
          id: "edge-start-step-1",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "step-1",
          target_port: "in",
          label: "next",
          condition: null,
        },
        {
          id: "edge-step-1-step-2",
          source_node_id: "step-1",
          source_port: "out",
          target_node_id: "step-2",
          target_port: "in",
          label: "next",
          condition: null,
          delay: { type: "fixed", duration_ms: 250 },
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const insertion = insertSubflowGraphNodes(graph, sourceSubflowGraph, {
      x: 900,
      y: 300,
    });

    expect(insertion.ok).toBe(true);
    if (!insertion.ok) return;
    expect(insertion.selection.nodeIds).toEqual(["step-1-2", "step-2-2"]);
    expect(insertion.graph.nodes.some((node) => node.id === "start-2")).toBe(false);
    expect(insertion.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "step-1-2",
          label: "Open",
          position: { x: 900, y: 300 },
          config: { type: "navigate", config: { url: "https://login.test" } },
        }),
        expect.objectContaining({
          id: "step-2-2",
          label: "Fill",
          position: { x: 1120, y: 360 },
          config: { type: "input_text", config: { text: "qa@example.test" } },
        }),
      ]),
    );
    expect(insertion.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-step-1-2-out-step-2-2-in",
          source_node_id: "step-1-2",
          target_node_id: "step-2-2",
          delay: { type: "fixed", duration_ms: 250 },
        }),
      ]),
    );
    expect(
      insertion.graph.edges.some(
        (edge) => edge.source_node_id === "start" && edge.target_node_id === "step-1-2",
      ),
    ).toBe(false);
  });
});
