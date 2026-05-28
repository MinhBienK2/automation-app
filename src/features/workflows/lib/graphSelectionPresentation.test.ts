import { describe, expect, test } from "vitest";
import type { GraphEdgeDelay, WorkflowGraph } from "../../../types/workflow";
import {
  describeLinkWait,
  summarizeGraphSelection,
  validateGraphEdgeDelay,
} from "./graphSelectionPresentation";
import { nodePorts } from "./workflowGraph";

describe("graph selection presentation", () => {
  test("summarizes copyable, deletable, protected, and internal selected items", () => {
    const graph = graphFixture();

    expect(
      summarizeGraphSelection(graph, {
        nodeIds: ["start", "node-a", "node-b"],
        edgeIds: ["edge-a-b"],
      }),
    ).toEqual({
      nodeCount: 3,
      edgeCount: 1,
      protectedStartCount: 1,
      copyableNodeCount: 2,
      deletableNodeCount: 2,
      selectedInternalLinkCount: 1,
      canCopy: true,
      canDuplicate: true,
      canDelete: true,
      disabledReason: null,
    });
  });

  test("explains Start-only protection and invalid link waits", () => {
    const startOnly = summarizeGraphSelection(graphFixture(), {
      nodeIds: ["start"],
      edgeIds: [],
    });
    const invalidRandomDelay: GraphEdgeDelay = {
      type: "random",
      min_ms: 2000,
      max_ms: 1000,
    };

    expect(startOnly.canCopy).toBe(false);
    expect(startOnly.canDuplicate).toBe(false);
    expect(startOnly.canDelete).toBe(false);
    expect(startOnly.disabledReason).toBe("Start is protected and cannot be copied, duplicated, or deleted.");
    expect(describeLinkWait(null)).toBe("No transition wait");
    expect(describeLinkWait({ type: "fixed", duration_ms: 1200 })).toBe("Fixed wait: 1200 ms");
    expect(validateGraphEdgeDelay(invalidRandomDelay))
      .toBe("Random max must be greater than or equal to min.");
  });
});

function graphFixture(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: {},
        ports: nodePorts("start"),
      },
      {
        id: "node-a",
        node_type: "action",
        label: "A",
        position: { x: 220, y: 0 },
        config: null,
        ports: nodePorts("action"),
      },
      {
        id: "node-b",
        node_type: "action",
        label: "B",
        position: { x: 440, y: 0 },
        config: null,
        ports: nodePorts("action"),
      },
    ],
    edges: [
      {
        id: "edge-start-a",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "node-a",
        target_port: "in",
      },
      {
        id: "edge-a-b",
        source_node_id: "node-a",
        source_port: "out",
        target_node_id: "node-b",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
