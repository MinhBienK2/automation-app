import { describe, expect, test } from "vitest";
import { invokeMock, resetTauriInvoke } from "../tests/mocks/tauri";
import {
  exportWorkflow,
  importWorkflow,
  runBatchWorkflow,
  validateSchedule,
} from "./workflowApi";
import type { WorkflowExport } from "../types/workflow";

describe("workflow API phase ten commands", () => {
  test("invokes orchestration commands with frontend-safe payloads", async () => {
    resetTauriInvoke();
    const exported: WorkflowExport = {
      version: 1,
      workflow: {
        id: "workflow-1",
        name: "Export me",
        created_at: "1",
        updated_at: "1",
      },
      steps: [],
    };

    invokeMock.mockResolvedValue(undefined);

    await validateSchedule({
      workflow_id: "workflow-1",
      enabled: true,
      kind: { kind: "interval", every_seconds: 60 },
    });
    await exportWorkflow("workflow-1");
    await importWorkflow(exported);
    await runBatchWorkflow("workflow-1", {
      rows: [{ email: "a@example.com" }],
      concurrency_limit: 1,
      headless: false,
    });

    expect(invokeMock).toHaveBeenCalledWith("validate_schedule", {
      schedule: {
        workflow_id: "workflow-1",
        enabled: true,
        kind: { kind: "interval", every_seconds: 60 },
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("export_workflow", {
      workflowId: "workflow-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("import_workflow", { exported });
    expect(invokeMock).toHaveBeenCalledWith("run_batch_workflow", {
      workflowId: "workflow-1",
      request: {
        rows: [{ email: "a@example.com" }],
        concurrency_limit: 1,
        headless: false,
      },
    });
  });
});
