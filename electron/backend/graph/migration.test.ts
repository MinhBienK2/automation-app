// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { WorkflowGraph } from "../../../src/types/workflow";
import { migrateWorkflowGraph } from "./migration";

describe("workflow graph migration", () => {
  test("only upgrades graph version and preserves current contract nodes", () => {
    const graph: WorkflowGraph = {
      version: 1,
      nodes: [
        {
          id: "click-submit",
          node_type: "action",
          label: "Click Submit",
          position: { x: 0, y: 0 },
          config: {
            type: "click",
            config: {
              target: {
                locators: [{ kind: "xpath", value: "//*[@id='submit']" }],
              },
            },
          },
          ports: [],
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    expect(migrateWorkflowGraph(graph)).toEqual({
      ...graph,
      version: 4,
      migration_notes: [],
    });
  });

  test("migrates evaluate_logic and evaluate_expression nodes to check_conditions and calculate_value", () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "node-logic",
          node_type: "evaluate_logic",
          label: "Check Conditions",
          position: { x: 0, y: 0 },
          config: {
            output_name: "is_valid",
            mode: "visual",
          },
          ports: [],
        },
        {
          id: "node-expr",
          node_type: "evaluate_expression",
          label: "Calculate Value",
          position: { x: 0, y: 0 },
          config: {
            output_name: "result",
            expression: "outputs.A + 10",
          },
          ports: [],
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    expect(migrateWorkflowGraph(graph)).toEqual({
      version: 4,
      nodes: [
        {
          id: "node-logic",
          node_type: "check_conditions",
          label: "Check Conditions",
          position: { x: 0, y: 0 },
          config: {
            output_name: "is_valid",
            mode: "visual",
          },
          ports: [],
        },
        {
          id: "node-expr",
          node_type: "calculate_value",
          label: "Calculate Value",
          position: { x: 0, y: 0 },
          config: {
            output_name: "result",
            expression: "outputs.A + 10",
          },
          ports: [],
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });
});
