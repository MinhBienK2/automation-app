// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  createTestHandlers,
  runnableGraph,
  waitFor,
  type ProjectWorkflowTestHandlers,
} from "../commands.testHelpers";
import type { RunState } from "../../../src/types/workflow";

describe("Schedule commands integration", () => {
  test("creates disabled draft schedules and enables only runnable workflows", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Scheduled workflow");

    const draft = handlers.createSchedule({
      workflow_id: workflow.id,
      name: "Hourly",
      enabled: false,
      kind: { type: "interval", every_seconds: 3600 },
    });

    expect(draft).toMatchObject({
      workflow_id: workflow.id,
      workflow_name: "Scheduled workflow",
      name: "Hourly",
      enabled: false,
      next_run_at: null,
    });
    expect(() => handlers.enableSchedule(draft.id)).toThrow(
      "Choose an action type before running this node",
    );

    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const enabled = await handlers.enableSchedule(draft.id);

    expect(enabled).toMatchObject({
      id: draft.id,
      enabled: true,
      next_run_at: expect.any(String),
    });
    expect(handlers.listSchedules()).toEqual([
      expect.objectContaining({
        id: draft.id,
        enabled: true,
        workflow_name: "Scheduled workflow",
      }),
    ]);
  });

  test("validates schedule config and returns field-addressable issues", async () => {
    const { handlers } = await createTestHandlers();

    expect(
      handlers.validateSchedule({
        workflow_id: "",
        name: "",
        enabled: true,
        kind: { type: "calendar", preset: "weekly", weekdays: [], time: "25:00" },
      }),
    ).toEqual([
      { field: "workflow_id", message: "Workflow is required", level: "error" },
      { field: "name", message: "Schedule name is required", level: "error" },
      {
        field: "kind.weekdays",
        message: "Select at least one weekday",
        level: "error",
      },
      {
        field: "kind.time",
        message: "Use a valid HH:mm time",
        level: "error",
      },
    ]);
  });

  test("scheduler tick skips profile conflicts but can start isolated workflows", async () => {
    const scheduledAt = "2099-05-17T09:00:00.000Z";
    let activeRunSignal: AbortSignal | null = null;
    const startedRunSignals: AbortSignal[] = [];
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: { signal?: AbortSignal }): Promise<RunState> {
          activeRunSignal = request.signal ?? null;
          startedRunSignals.push(request.signal as AbortSignal);
          await new Promise<void>((resolve) => {
            request.signal?.addEventListener("abort", resolve, { once: true });
          });
          return {
            status: "stopped",
            mode: "run_workflow",
            target_step_id: null,
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: [],
            outputs: {},
            error: null,
          };
        },
      },
    });
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const runningWorkflow = handlers.createWorkflow("Running workflow");
    handlers.saveWorkflowGraph(runningWorkflow.id, runnableGraph());
    const scheduledWorkflow = handlers.createWorkflow("Scheduled workflow");
    handlers.saveWorkflowGraph(scheduledWorkflow.id, runnableGraph());
    const isolatedWorkflow = handlers.createWorkflow("Isolated workflow");
    handlers.saveWorkflowGraph(isolatedWorkflow.id, runnableGraph());
    const schedule = handlers.createSchedule({
      workflow_id: scheduledWorkflow.id,
      name: "Once",
      enabled: true,
      kind: { type: "once_at", timestamp: scheduledAt },
    });
    const isolatedSchedule = handlers.createSchedule({
      workflow_id: isolatedWorkflow.id,
      name: "Isolated",
      enabled: true,
      kind: { type: "once_at", timestamp: scheduledAt },
    });
    const isolatedProfile = projectHandlers.createProjectEnvironment(
      isolatedWorkflow.project_id ?? "",
      { name: "Isolated scheduler profile" },
    );
    projectHandlers.setWorkflowProjectEnvironment(isolatedWorkflow.id, isolatedProfile.id);

    const runPromise = handlers.runWorkflow(runningWorkflow.id);
    await waitFor(() => activeRunSignal !== null);
    await handlers.runSchedulerTick(new Date(scheduledAt));

    expect(handlers.listScheduleEvents({ schedule_id: schedule.id })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "skipped",
          reason: "active_profile",
          scheduled_for: scheduledAt,
        }),
        expect.objectContaining({
          event_type: "disabled",
          reason: "one_time_elapsed",
        }),
      ]),
    );
    expect(handlers.getSchedule(schedule.id)).toMatchObject({
      enabled: false,
      next_run_at: null,
      last_status: "disabled",
    });
    expect(handlers.listScheduleEvents({ schedule_id: isolatedSchedule.id })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "started",
          scheduled_for: scheduledAt,
        }),
      ]),
    );
    expect(startedRunSignals).toHaveLength(2);

    for (const snapshot of handlers.listRunStates().filter((item) => item.state.status === "running")) {
      await handlers.stopRun(snapshot.run_id);
    }
    await runPromise;
  });
});
