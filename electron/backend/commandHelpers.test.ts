// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { CompiledWorkflowGraph, WorkflowSummary } from "../../src/types/workflow.js";
import {
  commandError,
  createDraftGraph,
  isCommandError,
  prependBatchRowVariables,
  summaryToWorkflow,
} from "./commandHelpers.js";

describe("commandHelpers", () => {
  test("creates serializable command errors and detects command error shapes", () => {
    expect(commandError("Name required", "name")).toEqual({
      message: "Name required",
      field: "name",
    });
    expect(isCommandError({ message: "Boom" })).toBe(true);
    expect(isCommandError(new Error("Boom"))).toBe(true);
    expect(isCommandError({ message: 123 })).toBe(false);
  });

  test("converts workflow summaries and creates the default draft graph", () => {
    const summary: WorkflowSummary = {
      id: "workflow-1",
      name: "Login",
      step_count: 0,
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T00:00:00.000Z",
    };

    expect(summaryToWorkflow(summary)).toEqual({
      id: "workflow-1",
      name: "Login",
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T00:00:00.000Z",
    });
    expect(createDraftGraph().edges).toEqual([
      expect.objectContaining({
        source_node_id: "start",
        target_node_id: "new-node",
      }),
    ]);
  });

  test("prepends batch row variables to compiled graph steps", () => {
    const graph: CompiledWorkflowGraph = {
      steps: [
        {
          node_id: "step-1",
          label: "Run action",
          config: { type: "wait", config: { duration_ms: 100 } },
        },
      ],
    };

    expect(prependBatchRowVariables(graph, 1, { email: "qa@example.test" }).steps)
      .toEqual([
        expect.objectContaining({
          node_id: "batch-row-1",
          label: "Batch row 2",
          config: {
            type: "set_variable",
            config: {
              variables: [
                { name: "email", value_type: "text", value: "qa@example.test" },
              ],
            },
          },
        }),
        graph.steps[0],
      ]);
  });
});
