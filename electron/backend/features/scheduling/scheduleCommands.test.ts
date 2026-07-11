// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import type { RunValidationIssue, WorkflowScheduleInput } from "../../../../src/types/workflow";
import { prepareScheduleInput } from "./scheduleCommands";

describe("prepareScheduleInput", () => {
  test("trims disabled draft names and requires the referenced workflow without run validation", async () => {
    const requireWorkflow = vi.fn();
    const validateWorkflowRun = vi.fn<() => RunValidationIssue[]>(() => [
      {
        source: "graph",
        field: "graph",
        node_id: null,
        edge_id: null,
        message: "Graph is not runnable",
        level: "error",
      },
    ]);

    const prepared = await prepareScheduleInput(disabledSchedule(), {
      requireWorkflow,
      validateWorkflowRun,
      now: new Date("2026-05-27T12:00:00.000Z"),
    });

    expect(prepared).toMatchObject({
      workflow_id: "workflow-1",
      name: "Draft schedule",
      enabled: false,
      next_run_at: null,
    });
    expect(requireWorkflow).toHaveBeenCalledWith("workflow-1");
    expect(validateWorkflowRun).not.toHaveBeenCalled();
  });

  test("rejects enabled schedules when the saved workflow is not runnable", async () => {
    let thrown: unknown;
    try {
      await prepareScheduleInput(
        { ...disabledSchedule(), enabled: true },
        {
          requireWorkflow: vi.fn(),
          validateWorkflowRun: vi.fn<() => RunValidationIssue[]>(() => [
            {
              source: "graph",
              field: null,
              node_id: "visit",
              edge_id: null,
              message: "Select an action type",
              level: "error",
            },
          ]),
          now: new Date("2026-05-27T12:00:00.000Z"),
        },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      message: "Select an action type",
      field: "visit",
    });
  });
});

function disabledSchedule(): WorkflowScheduleInput {
  return {
    workflow_id: "workflow-1",
    name: " Draft schedule ",
    enabled: false,
    kind: { type: "interval", every_seconds: 3600 },
  };
}
