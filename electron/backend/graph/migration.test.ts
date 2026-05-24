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
      version: 2,
      migration_notes: [],
    });
  });
});
