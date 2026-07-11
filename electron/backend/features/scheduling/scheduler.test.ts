// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import {
  calculateNextRunAt,
  processDueSchedules,
  validateScheduleInput,
} from "./scheduler";
import { WorkflowScheduleRepository } from "./workflowScheduleRepository";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
} from "../../../../src/types/workflow";

describe("workflow schedule calculation", () => {
  test("calculates once, interval, daily, weekly, and monthly next runs", () => {
    expect(
      calculateNextRunAt(
        { type: "once_at", timestamp: "2026-05-17T10:00:00.000Z" },
        new Date("2026-05-17T09:00:00.000Z"),
      ),
    ).toBe("2026-05-17T10:00:00.000Z");

    expect(
      calculateNextRunAt(
        { type: "interval", every_seconds: 1800 },
        new Date("2026-05-17T09:00:00.000Z"),
      ),
    ).toBe("2026-05-17T09:30:00.000Z");

    expect(
      calculateNextRunAt(
        { type: "calendar", preset: "daily", time: "09:30" },
        localDate(2026, 4, 17, 9, 0),
      ),
    ).toBe(localDate(2026, 4, 17, 9, 30).toISOString());

    expect(
      calculateNextRunAt(
        { type: "calendar", preset: "weekly", weekdays: [1], time: "09:00" },
        localDate(2026, 4, 17, 10, 0),
      ),
    ).toBe(localDate(2026, 4, 18, 9, 0).toISOString());

    expect(
      calculateNextRunAt(
        { type: "calendar", preset: "monthly", day: 31, time: "08:00" },
        localDate(2026, 3, 30, 10, 0),
      ),
    ).toBe(localDate(2026, 4, 31, 8, 0).toISOString());
  });

  test("validates schedule input with field-addressable issues", () => {
    expect(
      validateScheduleInput(
        {
          workflow_id: "",
          name: "",
          enabled: true,
          kind: { type: "interval", every_seconds: 30 },
        },
        new Date("2026-05-17T09:00:00.000Z"),
      ),
    ).toEqual([
      { field: "workflow_id", message: "Workflow is required", level: "error" },
      { field: "name", message: "Schedule name is required", level: "error" },
      {
        field: "kind.every_seconds",
        message: "Interval must be at least 60 seconds",
        level: "error",
      },
    ]);
  });
});

describe("workflow scheduler engine", () => {
  test("starts a due schedule and records an event with the run id", async () => {
    const repository = memoryScheduleRepository([
      schedule({ next_run_at: "2026-05-17T09:00:00.000Z" }),
    ]);
    const startWorkflow = vi.fn().mockResolvedValue({ runId: "run-1" });

    await processDueSchedules({
      now: new Date("2026-05-17T09:00:00.000Z"),
      repository,
      getRunConflict: () => null,
      validateWorkflow: () => [],
      startWorkflow,
    });

    expect(startWorkflow).toHaveBeenCalledWith("workflow-1");
    expect(repository.events).toMatchObject([
      {
        schedule_id: "schedule-1",
        workflow_id: "workflow-1",
        event_type: "started",
        run_id: "run-1",
        scheduled_for: "2026-05-17T09:00:00.000Z",
      },
    ]);
    expect(repository.schedules[0]).toMatchObject({
      next_run_at: "2026-05-17T10:00:00.000Z",
      last_status: "started",
    });
  });

  test("skips active workflow conflicts and disables one-time schedules", async () => {
    const repository = memoryScheduleRepository([
      schedule({
        kind: { type: "once_at", timestamp: "2026-05-17T09:00:00.000Z" },
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
    ]);

    await processDueSchedules({
      now: new Date("2026-05-17T09:00:00.000Z"),
      repository,
      getRunConflict: () => "active_workflow",
      validateWorkflow: () => [],
      startWorkflow: vi.fn(),
    });

    expect(repository.events).toMatchObject([
      {
        event_type: "skipped",
        reason: "active_workflow",
        scheduled_for: "2026-05-17T09:00:00.000Z",
      },
      {
        event_type: "disabled",
        reason: "one_time_elapsed",
        scheduled_for: "2026-05-17T09:00:00.000Z",
      },
    ]);
    expect(repository.schedules[0]).toMatchObject({
      enabled: false,
      next_run_at: null,
      last_status: "disabled",
    });
  });

  test("records missed occurrences when the app resumes outside the active window", async () => {
    const repository = memoryScheduleRepository([
      schedule({ next_run_at: "2026-05-17T09:00:00.000Z" }),
    ]);

    await processDueSchedules({
      now: new Date("2026-05-17T09:10:01.000Z"),
      missedWindowMs: 5 * 60 * 1000,
      repository,
      getRunConflict: () => null,
      validateWorkflow: () => [],
      startWorkflow: vi.fn(),
    });

    expect(repository.events).toMatchObject([
      {
        event_type: "missed",
        reason: "missed_window",
        scheduled_for: "2026-05-17T09:00:00.000Z",
      },
    ]);
    expect(repository.schedules[0]?.next_run_at).toBe("2026-05-17T10:00:00.000Z");
  });

  test("records failed_to_start when saved workflow validation fails", async () => {
    const repository = memoryScheduleRepository([
      schedule({ next_run_at: "2026-05-17T09:00:00.000Z" }),
    ]);

    await processDueSchedules({
      now: new Date("2026-05-17T09:00:00.000Z"),
      repository,
      getRunConflict: () => null,
      validateWorkflow: () => [
        { source: "graph", level: "error", message: "Select an action type" },
      ],
      startWorkflow: vi.fn(),
    });

    expect(repository.events).toMatchObject([
      {
        event_type: "failed_to_start",
        reason: "validation_failed",
        scheduled_for: "2026-05-17T09:00:00.000Z",
      },
    ]);
    expect(repository.events[0]?.details_json).toContain("Select an action type");
  });

  test("starts multiple due schedules for isolated workflows in one tick", async () => {
    const repository = memoryScheduleRepository([
      schedule({
        id: "schedule-1",
        workflow_id: "workflow-1",
        workflow_name: "Workflow 1",
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
      schedule({
        id: "schedule-2",
        workflow_id: "workflow-2",
        workflow_name: "Workflow 2",
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
    ]);
    const startWorkflow = vi.fn(async (workflowId: string) => ({
      runId: `run-${workflowId}`,
    }));

    await processDueSchedules({
      now: new Date("2026-05-17T09:00:00.000Z"),
      repository,
      getRunConflict: () => null,
      validateWorkflow: () => [],
      startWorkflow,
    });

    expect(startWorkflow).toHaveBeenCalledTimes(2);
    expect(startWorkflow).toHaveBeenNthCalledWith(1, "workflow-1");
    expect(startWorkflow).toHaveBeenNthCalledWith(2, "workflow-2");
    expect(repository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schedule_id: "schedule-1",
          event_type: "started",
          run_id: "run-workflow-1",
        }),
        expect.objectContaining({
          schedule_id: "schedule-2",
          event_type: "started",
          run_id: "run-workflow-2",
        }),
      ]),
    );
  });

  test("skips only conflicting scheduled workflows with explicit reasons", async () => {
    const activeWorkflows = new Set<string>();
    const repository = memoryScheduleRepository([
      schedule({
        id: "schedule-1",
        workflow_id: "workflow-1",
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
      schedule({
        id: "schedule-2",
        workflow_id: "workflow-1",
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
      schedule({
        id: "schedule-3",
        workflow_id: "workflow-3",
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
    ]);

    await processDueSchedules({
      now: new Date("2026-05-17T09:00:00.000Z"),
      repository,
      getRunConflict: (workflowId) => {
        if (activeWorkflows.has(workflowId)) return "active_workflow";
        if (workflowId === "workflow-3") return "active_profile";
        return null;
      },
      validateWorkflow: () => [],
      startWorkflow: vi.fn(async (workflowId: string) => {
        activeWorkflows.add(workflowId);
        return { runId: `run-${workflowId}` };
      }),
    });

    expect(repository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schedule_id: "schedule-1",
          event_type: "started",
        }),
        expect.objectContaining({
          schedule_id: "schedule-2",
          event_type: "skipped",
          reason: "active_workflow",
        }),
        expect.objectContaining({
          schedule_id: "schedule-3",
          event_type: "skipped",
          reason: "active_profile",
        }),
      ]),
    );
  });
});

function schedule(overrides: Partial<WorkflowSchedule> = {}): WorkflowSchedule {
  return {
    id: "schedule-1",
    workflow_id: "workflow-1",
    workflow_name: "Workflow 1",
    name: "Hourly run",
    enabled: true,
    kind: { type: "interval", every_seconds: 3600 },
    next_run_at: "2026-05-17T09:00:00.000Z",
    last_event_at: null,
    last_status: null,
    last_reason: null,
    created_at: "2026-05-17T08:00:00.000Z",
    updated_at: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

function memoryScheduleRepository(initialSchedules: WorkflowSchedule[]) {
  const state = {
    schedules: initialSchedules,
    events: [] as WorkflowScheduleEvent[],
    listDueSchedules(now: Date) {
      return state.schedules.filter(
        (item) =>
          item.enabled &&
          item.next_run_at &&
          new Date(item.next_run_at).getTime() <= now.getTime(),
      );
    },
    updateScheduleRuntime(
      scheduleId: string,
      update: {
        enabled?: boolean;
        next_run_at?: string | null;
        last_status?: string | null;
        last_reason?: string | null;
        last_event_at?: string | null;
      },
    ) {
      state.schedules = state.schedules.map((item) =>
        item.id === scheduleId ? { ...item, ...update } : item,
      );
    },
    createEvent(event: Omit<WorkflowScheduleEvent, "id">) {
      const created = { id: `event-${state.events.length + 1}`, ...event };
      state.events.push(created);
      return created;
    },
  } satisfies Pick<
    WorkflowScheduleRepository,
    "listDueSchedules" | "updateScheduleRuntime" | "createEvent"
  > & {
    schedules: WorkflowSchedule[];
    events: WorkflowScheduleEvent[];
  };
  return state;
}

function localDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0);
}
