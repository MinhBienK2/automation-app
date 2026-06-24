import { describe, expect, test } from "vitest";
import type { GraphNode, GraphEdge } from "../../../types/workflow";
import { displayPositionsForGraphNodes } from "./workflowGraphPositions";

describe("displayPositionsForGraphNodes - Node-Edge collision resolution", () => {
  // Test case 1: Node-node collision avoidance is preserved
  test("preserves existing same-column node-node collision avoidance", () => {
    const nodes: GraphNode[] = [
      {
        id: "nodeA",
        node_type: "action",
        label: "Node A",
        position: { x: 0, y: 100 },
        ports: [{ id: "out", label: "Out", direction: "output" }],
        config: {},
      },
      {
        id: "nodeB",
        node_type: "action",
        label: "Node B",
        position: { x: 0, y: 110 }, // overlaps Node A's height (82px)
        ports: [{ id: "in", label: "In", direction: "input" }],
        config: {},
      },
    ];
    const edges: GraphEdge[] = [];

    const positions = displayPositionsForGraphNodes(nodes, edges);

    const posA = positions.get("nodeA");
    const posB = positions.get("nodeB");

    expect(posA?.y).toBe(100);
    // Node B height is 82, clearance is 24, so B should be pushed to at least 100 + 82 + 24 = 206
    expect(posB?.y).toBeGreaterThanOrEqual(206);
  });

  // Test case 2: Node overlaps a horizontal edge segment
  test("pushes down a node overlapping a horizontal segment of an edge", () => {
    // Edge goes from nodeA (at column 0) to nodeB (at column 2)
    // nodeC is in column 1, right in the middle, and overlaps the edge path vertically
    const nodes: GraphNode[] = [
      {
        id: "nodeA",
        node_type: "action",
        label: "Node A",
        position: { x: 0, y: 100 },
        ports: [{ id: "out", label: "Out", direction: "output" }],
        config: {},
      },
      {
        id: "nodeC",
        node_type: "action",
        label: "Node C",
        position: { x: 260, y: 120 }, // Column 1. Edge Y is 141 (100 + 41). Node C is at y: 120, height: 82.
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
        config: {},
      },
      {
        id: "nodeB",
        node_type: "action",
        label: "Node B",
        position: { x: 520, y: 100 },
        ports: [{ id: "in", label: "In", direction: "input" }],
        config: {},
      },
    ];

    const edges: GraphEdge[] = [
      {
        id: "edgeAB",
        source_node_id: "nodeA",
        source_port: "out",
        target_node_id: "nodeB",
        target_port: "in",
      },
    ];

    const positions = displayPositionsForGraphNodes(nodes, edges);

    const posC = positions.get("nodeC");
    // Edge is at Y = 141. Node C should be pushed below 141 + 24 = 165
    expect(posC?.y).toBeGreaterThanOrEqual(165);
  });

  // Test case 3: Node overlaps a vertical edge segment
  test("pushes down a node overlapping a vertical segment of a step-routed edge", () => {
    // Edge goes from nodeA (at column 0, y: 100) to nodeB (at column 2, y: 300)
    // The vertical segment of this edge is at the midpoint X (e.g. 160 + 32 = 192, or midpoint X = (160 + 520)/2 = 340).
    // Let's place nodeC at column 1 (x: 260), so its X range [260, 420] contains midpoint X (340).
    // If nodeC's Y is at 200, it overlaps the vertical segment (spanning from Y = 141 to Y = 341).
    const nodes: GraphNode[] = [
      {
        id: "nodeA",
        node_type: "action",
        label: "Node A",
        position: { x: 0, y: 100 },
        ports: [{ id: "out", label: "Out", direction: "output" }],
        config: {},
      },
      {
        id: "nodeC",
        node_type: "action",
        label: "Node C",
        position: { x: 260, y: 200 }, // vertical segment is from 141 to 341. Node C overlaps it.
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
        config: {},
      },
      {
        id: "nodeB",
        node_type: "action",
        label: "Node B",
        position: { x: 520, y: 300 },
        ports: [{ id: "in", label: "In", direction: "input" }],
        config: {},
      },
    ];

    const edges: GraphEdge[] = [
      {
        id: "edgeAB",
        source_node_id: "nodeA",
        source_port: "out",
        target_node_id: "nodeB",
        target_port: "in",
      },
    ];

    const positions = displayPositionsForGraphNodes(nodes, edges);

    const posC = positions.get("nodeC");
    // Vertical segment bottom is max(141, 341) = 341. Node C should be pushed below 341 + 24 = 365
    expect(posC?.y).toBeGreaterThanOrEqual(365);
  });
});
