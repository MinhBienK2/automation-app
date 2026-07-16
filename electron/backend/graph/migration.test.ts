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
      version: 9,
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
      version: 9,
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

  test("migrates update_text_variable to new granular text nodes", () => {
    const graph: WorkflowGraph = {
      version: 4,
      nodes: [
        {
          id: "node-append",
          node_type: "update_text_variable" as any,
          label: "Update Text",
          position: { x: 0, y: 0 },
          config: {
            name: "msg",
            operation: "append",
            value: " world",
          },
          ports: [],
        },
        {
          id: "node-replace",
          node_type: "update_text_variable" as any,
          label: "Update Text",
          position: { x: 0, y: 0 },
          config: {
            name: "msg",
            operation: "replace",
            value: "planet",
            search_pattern: "world",
          },
          ports: [],
        },
        {
          id: "node-case",
          node_type: "update_text_variable" as any,
          label: "Update Text",
          position: { x: 0, y: 0 },
          config: {
            name: "msg",
            operation: "uppercase",
          },
          ports: [],
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    expect(migrateWorkflowGraph(graph)).toEqual({
      version: 9,
      nodes: [
        {
          id: "node-append",
          node_type: "append_text" as any,
          label: "Update Text",
          position: { x: 0, y: 0 },
          config: {
            name: "msg",
            value: " world",
          },
          ports: [],
        },
        {
          id: "node-replace",
          node_type: "replace_text" as any,
          label: "Update Text",
          position: { x: 0, y: 0 },
          config: {
            name: "msg",
            search_pattern: "world",
            replacement: "planet",
          },
          ports: [],
        },
        {
          id: "node-case",
          node_type: "change_text_case" as any,
          label: "Update Text",
          position: { x: 0, y: 0 },
          config: {
            name: "msg",
            to_case: "upper",
          },
          ports: [],
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });
});

