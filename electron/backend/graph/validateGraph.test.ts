// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { WorkflowGraph } from "../../../src/types/workflow";
import { validateWorkflowGraph } from "./validateGraph";

describe("graph validation module", () => {
  test("runs graph validation independently of graph compilation", () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: {} },
        {
          id: "action",
          node_type: "action",
          label: "Action",
          position: { x: 100, y: 0 },
          config: { type: "legacy_action", config: {} },
        },
        {
          id: "legacy",
          node_type: "legacy_node",
          label: "Legacy",
          position: { x: 200, y: 0 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge-1",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "action",
          target_port: "in",
        },
        {
          id: "edge-2",
          source_node_id: "action",
          source_port: "out",
          target_node_id: "legacy",
          target_port: "in",
        },
      ],
    } as WorkflowGraph;

    expect(validateWorkflowGraph(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          node_id: "action",
          message: "Node Action has invalid action config: Unsupported action type: legacy_action",
        }),
        expect.objectContaining({
          level: "error",
          node_id: "legacy",
          message: "Unsupported graph node type: legacy_node",
        }),
      ]),
    );
  });

  test("accepts Find Element refs for element-visible graph conditions", () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: {} },
        {
          id: "if-visible",
          node_type: "if",
          label: "Panel visible?",
          position: { x: 180, y: 0 },
          config: {
            condition: { kind: "element_visible", target_ref: "current_panel" },
          },
        },
        {
          id: "done",
          node_type: "end_success",
          label: "Done",
          position: { x: 360, y: 0 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge-start-if",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "if-visible",
          target_port: "in",
        },
        {
          id: "edge-if-done",
          source_node_id: "if-visible",
          source_port: "done",
          target_node_id: "done",
          target_port: "in",
        },
      ],
    } as WorkflowGraph;

    expect(validateWorkflowGraph(graph).filter((issue) => issue.level === "error")).toEqual([]);
  });
});
