import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SchedulesPage } from "./SchedulesPage";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowSummary,
} from "../../../types/workflow";

describe("SchedulesPage", () => {
  test("renders schedules with actions and event history", async () => {
    const onToggleSchedule = vi.fn();
    render(
      <SchedulesPage
        schedules={[
          schedule({
            enabled: true,
            name: "Weekday login",
            workflow_name: "Login flow",
            last_status: "skipped",
            last_reason: "active_run",
          }),
        ]}
        workflows={[workflow()]}
        events={[
          event({
            event_type: "skipped",
            reason: "active_run",
          }),
        ]}
        loading={false}
        error=""
        onCreateSchedule={vi.fn()}
        onUpdateSchedule={vi.fn()}
        onDeleteSchedule={vi.fn()}
        onToggleSchedule={onToggleSchedule}
        onLoadEvents={vi.fn()}
      />,
    );

    const row = screen.getByRole("row", { name: /Weekday login Login flow/i });
    expect(within(row).getByText("Enabled")).toBeInTheDocument();
    expect(within(row).getByText("Weekday login")).toBeInTheDocument();
    expect(within(row).getByText("Login flow")).toBeInTheDocument();
    expect(within(row).getByText("Skipped")).toBeInTheDocument();
    expect(within(row).getByText("active_run")).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Disable Weekday login" }));
    expect(onToggleSchedule).toHaveBeenCalledWith("schedule-1", false);

    await userEvent.click(within(row).getByRole("button", { name: "View history for Weekday login" }));
    const historyDialog = await screen.findByRole("dialog", { name: "Schedule History" });
    expect(historyDialog).toBeInTheDocument();
    expect(within(historyDialog).getByText("active_run")).toBeInTheDocument();
  });

  test("creates an interval schedule and keeps validation errors visible", async () => {
    const onCreateSchedule = vi.fn().mockRejectedValue({
      message: "Interval must be at least 60 seconds",
      field: "kind.every_seconds",
    });
    render(
      <SchedulesPage
        schedules={[]}
        workflows={[workflow()]}
        events={[]}
        loading={false}
        error=""
        onCreateSchedule={onCreateSchedule}
        onUpdateSchedule={vi.fn()}
        onDeleteSchedule={vi.fn()}
        onToggleSchedule={vi.fn()}
        onLoadEvents={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "New schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "New Schedule" });
    await userEvent.type(within(dialog).getByLabelText("Schedule name"), "Too fast");
    await userEvent.clear(within(dialog).getByLabelText("Every"));
    await userEvent.type(within(dialog).getByLabelText("Every"), "1");
    await userEvent.click(within(dialog).getByRole("switch", { name: "Enable schedule" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create Schedule" }));

    await waitFor(() => {
      expect(onCreateSchedule).toHaveBeenCalledWith({
        workflow_id: "workflow-1",
        name: "Too fast",
        enabled: true,
        kind: { type: "interval", every_seconds: 60 },
      });
    });
    expect(await within(dialog).findByText("Interval must be at least 60 seconds"))
      .toBeInTheDocument();
  });
});

function workflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    id: "workflow-1",
    name: "Login flow",
    step_count: 0,
    created_at: "2026-05-17T08:00:00.000Z",
    updated_at: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

function schedule(overrides: Partial<WorkflowSchedule> = {}): WorkflowSchedule {
  return {
    id: "schedule-1",
    workflow_id: "workflow-1",
    workflow_name: "Login flow",
    name: "Hourly",
    enabled: true,
    kind: { type: "interval", every_seconds: 3600 },
    next_run_at: "2026-05-17T09:00:00.000Z",
    last_event_at: "2026-05-17T08:00:00.000Z",
    last_status: "started",
    last_reason: null,
    created_at: "2026-05-17T08:00:00.000Z",
    updated_at: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<WorkflowScheduleEvent> = {}): WorkflowScheduleEvent {
  return {
    id: "event-1",
    schedule_id: "schedule-1",
    workflow_id: "workflow-1",
    event_type: "started",
    run_id: "run-1",
    scheduled_for: "2026-05-17T09:00:00.000Z",
    created_at: "2026-05-17T09:00:00.000Z",
    reason: null,
    details_json: null,
    ...overrides,
  };
}
