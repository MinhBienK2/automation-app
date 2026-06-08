import { describe, expect, test } from "vitest";
import type { ActionConfig, WorkflowSettings } from "./workflowCore";
import type { WorkflowGraph, WorkflowRunSource } from "./workflowGraphOps";
import type {
  EvidencePage,
  RecordingWorkflowDraft,
  RunState,
} from "./workflowEvidenceRecording";

describe("workflow contract modules", () => {
  test("export representative workflow DTO slices", async () => {
    await expect(import("./workflowCore")).resolves.toBeDefined();
    await expect(import("./workflowGraphOps")).resolves.toBeDefined();
    await expect(import("./workflowEvidenceRecording")).resolves.toBeDefined();

    const action: ActionConfig = {
      type: "navigate",
      config: { url: "https://owned.test" },
    };
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const source: WorkflowRunSource = "manual";
    const page: EvidencePage = {
      generated_at: "2026-05-27T12:00:00.000Z",
      items: [],
      next_cursor: null,
      has_more: false,
      warnings: {
        skipped_artifacts: 0,
        skipped_reports: 0,
        skipped_traces: 0,
        skipped_manifests: 0,
      },
    };
    const runState: RunState = {
      status: "idle",
      mode: "none",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      error: null,
    };

    expect(action.type).toBe("navigate");
    expect(graph.version).toBe(2);
    expect(source).toBe("manual");
    expect(page.items).toEqual([]);
    expect(runState.status).toBe("idle");
    expectTypeOnly<WorkflowSettings>();
    expectTypeOnly<RecordingWorkflowDraft>();
  });
});

function expectTypeOnly<T>() {
  expect(typeof (null as T | null)).toBe("object");
}
