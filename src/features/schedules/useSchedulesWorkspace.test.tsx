import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
} from "../../types/workflow";
import {
  createSchedule,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  listScheduleEvents,
  listSchedules,
  updateSchedule,
} from "../../lib/api/workflowApi";
import { useSchedulesWorkspace } from "./useSchedulesWorkspace";

vi.mock("../../lib/api/workflowApi", () => ({
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  disableSchedule: vi.fn(),
  enableSchedule: vi.fn(),
  listScheduleEvents: vi.fn(),
  listSchedules: vi.fn(),
  updateSchedule: vi.fn(),
}));

describe("useSchedulesWorkspace", () => {
  beforeEach(() => {
    vi.mocked(createSchedule).mockReset();
    vi.mocked(deleteSchedule).mockReset();
    vi.mocked(disableSchedule).mockReset();
    vi.mocked(enableSchedule).mockReset();
    vi.mocked(listScheduleEvents).mockReset();
    vi.mocked(listSchedules).mockReset();
    vi.mocked(updateSchedule).mockReset();
  });

  test("loads schedules and focused schedule history", async () => {
    vi.mocked(listSchedules).mockResolvedValue([schedule("schedule-1")]);
    vi.mocked(listScheduleEvents).mockResolvedValue([scheduleEvent("event-1")]);
    const { result } = renderHook(() =>
      useSchedulesWorkspace({ setAppError: vi.fn() }),
    );

    await act(async () => {
      await result.current.loadSchedules();
      result.current.setFocusedScheduleId("schedule-1");
      await result.current.loadScheduleHistory("schedule-1");
    });

    expect(result.current.schedules.map((item) => item.id)).toEqual(["schedule-1"]);
    expect(result.current.focusedScheduleId).toBe("schedule-1");
    expect(listScheduleEvents).toHaveBeenCalledWith({ schedule_id: "schedule-1" });
    expect(result.current.scheduleEvents.map((event) => event.id)).toEqual(["event-1"]);
    expect(result.current.loading).toBe(false);
  });

  test("toggles schedules and refreshes the list", async () => {
    vi.mocked(listSchedules).mockResolvedValue([schedule("schedule-1")]);
    vi.mocked(enableSchedule).mockResolvedValue(schedule("schedule-1"));
    vi.mocked(disableSchedule).mockResolvedValue(schedule("schedule-1"));
    const { result } = renderHook(() =>
      useSchedulesWorkspace({ setAppError: vi.fn() }),
    );

    await act(async () => {
      await result.current.toggleSchedule("schedule-1", true);
      await result.current.toggleSchedule("schedule-1", false);
    });

    expect(enableSchedule).toHaveBeenCalledWith("schedule-1");
    expect(disableSchedule).toHaveBeenCalledWith("schedule-1");
    expect(listSchedules).toHaveBeenCalledTimes(2);
  });
});

function schedule(id: string): WorkflowSchedule {
  return {
    id,
    workflow_id: "workflow-1",
    workflow_name: "Workflow",
    name: "Daily run",
    enabled: true,
    kind: { type: "calendar", preset: "daily", time: "09:00" },
    next_run_at: "2026-06-02T09:00:00.000Z",
    last_event_at: null,
    last_status: null,
    last_reason: null,
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
  };
}

function scheduleEvent(id: string): WorkflowScheduleEvent {
  return {
    id,
    schedule_id: "schedule-1",
    workflow_id: "workflow-1",
    event_type: "started",
    run_id: "run-1",
    scheduled_for: "2026-06-02T09:00:00.000Z",
    created_at: "2026-06-02T09:00:00.000Z",
    reason: null,
    details_json: null,
  };
}
