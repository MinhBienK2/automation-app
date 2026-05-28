import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";
import { SchedulesPage } from "./SchedulesPage";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowSummary,
} from "../../../types/workflow";

describe("SchedulesPage", () => {
  test("captures form field values before scheduling state updates", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/features/schedules/pages/SchedulesPage.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/setForm\(\([^)]*\) =>[\s\S]{0,180}event\.currentTarget\.value/);
  });

  test("renders schedule operations summary and human-readable row decisions", async () => {
    const onToggleSchedule = vi.fn();
    renderSchedules({
      schedules: [
        schedule({
          enabled: true,
          name: "Weekday login",
          workflow_name: "Login flow",
          last_status: "failed_to_start",
          last_reason: "validation_failed",
        }),
        schedule({
          id: "schedule-2",
          name: "Profile audit",
          enabled: true,
          last_status: "skipped",
          last_reason: "active_profile",
          kind: { type: "calendar", preset: "weekly", weekdays: [1, 3, 5], time: "09:00" },
        }),
        schedule({
          id: "schedule-3",
          name: "Draft monthly",
          enabled: false,
          next_run_at: null,
          last_status: null,
          kind: { type: "calendar", preset: "monthly", day: 31, time: "10:30" },
        }),
      ],
      events: [
        event({
          event_type: "skipped",
          reason: "active_profile",
        }),
      ],
      onToggleSchedule,
    });

    const row = screen.getByRole("row", { name: /Weekday login Login flow/i });
    expect(within(row).getByText("Enabled")).toBeInTheDocument();
    expect(within(row).getByText("Weekday login")).toBeInTheDocument();
    expect(within(row).getByText("Login flow")).toBeInTheDocument();
    expect(within(row).getByText("Failed to start")).toBeInTheDocument();
    expect(within(row).getByText("Saved workflow is not runnable")).toBeInTheDocument();
    expect(within(row).getByText("Needs review")).toBeInTheDocument();

    const profileRow = screen.getByRole("row", { name: /Profile audit Login flow/i });
    expect(within(profileRow).getByText("Weekly Mon, Wed, Fri at 09:00")).toBeInTheDocument();
    expect(within(profileRow).getByText("Browser profile already in use")).toBeInTheDocument();
    expect(screen.getByText("3 total")).toBeInTheDocument();
    expect(screen.getByText("2 enabled")).toBeInTheDocument();
    expect(screen.getByText("2 attention")).toBeInTheDocument();
    expect(screen.getByText("1 draft")).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "Disable Weekday login" }));
    expect(onToggleSchedule).toHaveBeenCalledWith("schedule-1", false);

    await userEvent.click(within(row).getByRole("button", { name: "View history for Weekday login" }));
    const historyDialog = await screen.findByRole("dialog", { name: "Weekday login history" });
    expect(historyDialog).toBeInTheDocument();
    expect(within(historyDialog).getByText("Browser profile already in use.")).toBeInTheDocument();
  });

  test("creates an interval schedule with preview and keeps validation errors in context", async () => {
    const onCreateSchedule = vi.fn().mockRejectedValue({
      message: "Interval must be at least 60 seconds",
      field: "kind.every_seconds",
    });
    renderSchedules({ schedules: [], onCreateSchedule });

    await userEvent.click(screen.getByRole("button", { name: "New Schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "New Schedule" });
    expect(within(dialog).getByText("Scheduled runs use the latest saved workflow and Workflow Settings."))
      .toBeInTheDocument();
    expect(within(dialog).getByText("Displayed in local time.")).toBeInTheDocument();
    expect(within(dialog).getByText("Mission Control must be open for schedules to run."))
      .toBeInTheDocument();
    expect(within(dialog).getByText("Ready to save as draft")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Schedule name"), "Too fast");
    await userEvent.clear(within(dialog).getByLabelText("Every"));
    await userEvent.type(within(dialog).getByLabelText("Every"), "1");
    await userEvent.click(within(dialog).getByRole("switch", { name: "Enable schedule" }));
    expect(within(dialog).getByText("Ready to enable")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Create Schedule" }));

    await waitFor(() => {
      expect(onCreateSchedule).toHaveBeenCalledWith({
        workflow_id: "workflow-1",
        name: "Too fast",
        enabled: true,
        kind: { type: "interval", every_seconds: 60 },
      });
    });
    expect(await within(dialog).findByRole("alert", { name: /readiness/i }))
      .toBeInTheDocument();
    expect(within(dialog).getAllByText("Interval must be at least 60 seconds").length)
      .toBeGreaterThan(0);
  });

  test("edits a weekly schedule and preserves kind-specific values", async () => {
    const onUpdateSchedule = vi.fn().mockResolvedValue(undefined);
    renderSchedules({
      schedules: [
        schedule({
          name: "Old schedule",
          kind: { type: "calendar", preset: "weekly", weekdays: [1, 3, 5], time: "09:30" },
        }),
      ],
      onUpdateSchedule,
    });

    const row = screen.getByRole("row", { name: /Old schedule Login flow/i });
    await userEvent.click(within(row).getByRole("button", { name: "Edit Old schedule" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit Schedule" });
    expect(within(dialog).getByRole("button", { name: "Weekly" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Wed" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Fri" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByLabelText("Time")).toHaveValue("09:30");
    const nameInput = within(dialog).getByLabelText("Schedule name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "New schedule");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Schedule" }));

    await waitFor(() => {
      expect(onUpdateSchedule).toHaveBeenCalledWith("schedule-1", {
        workflow_id: "workflow-1",
        name: "New schedule",
        enabled: true,
        kind: { type: "calendar", preset: "weekly", weekdays: [1, 3, 5], time: "09:30" },
      });
    });
  });

  test("keeps one-time edit errors inside the dialog when the datetime is invalid", async () => {
    renderSchedules({
      schedules: [
        schedule({
          name: "One-time",
          kind: { type: "once_at", timestamp: "" },
        }),
      ],
    });

    const row = screen.getByRole("row", { name: /One-time Login flow/i });
    await userEvent.click(within(row).getByRole("button", { name: "Edit One-time" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit Schedule" });
    await userEvent.clear(within(dialog).getByLabelText("Schedule name"));
    await userEvent.type(within(dialog).getByLabelText("Schedule name"), "Renamed one-time");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Schedule" }));

    expect(await within(dialog).findByText("Use a valid date and time"))
      .toBeInTheDocument();
  });

  test("validates weekly and monthly cadence fields before enabled submit", async () => {
    const onCreateSchedule = vi.fn();
    renderSchedules({ schedules: [], onCreateSchedule });

    await userEvent.click(screen.getByRole("button", { name: "New Schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "New Schedule" });
    await userEvent.type(within(dialog).getByLabelText("Schedule name"), "Calendar schedule");
    await userEvent.click(within(dialog).getByRole("button", { name: "Weekly" }));
    await userEvent.click(within(dialog).getByRole("switch", { name: "Enable schedule" }));
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
      await userEvent.click(within(dialog).getByRole("button", { name: day }));
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Create Schedule" }));
    expect(await within(dialog).findByText("Select at least one weekday")).toBeInTheDocument();
    expect(onCreateSchedule).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Monthly" }));
    await userEvent.clear(within(dialog).getByLabelText("Day of month"));
    await userEvent.type(within(dialog).getByLabelText("Day of month"), "31");
    expect(within(dialog).getByText("Months without this day are skipped.")).toBeInTheDocument();
  });

  test("keeps enable failures associated with the affected row", async () => {
    const onToggleSchedule = vi.fn().mockRejectedValue({
      message: "Saved workflow is not runnable",
      field: "workflow_id",
    });
    renderSchedules({
      schedules: [schedule({ enabled: false, name: "Draft login", next_run_at: null })],
      onToggleSchedule,
    });

    const row = screen.getByRole("row", { name: /Draft login Login flow/i });
    await userEvent.click(within(row).getByRole("button", { name: "Enable Draft login" }));

    expect(await screen.findByRole("alert", { name: /Draft login command error/i }))
      .toHaveTextContent("Could not enable: Saved workflow is not runnable");
  });

  test("requires named confirmation before deleting a schedule", async () => {
    const onDeleteSchedule = vi.fn().mockResolvedValue(undefined);
    renderSchedules({
      schedules: [schedule({ name: "Delete me" })],
      onDeleteSchedule,
    });

    const row = screen.getByRole("row", { name: /Delete me Login flow/i });
    await userEvent.click(within(row).getByRole("button", { name: "Delete Delete me" }));

    expect(onDeleteSchedule).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "Delete Schedule" });
    expect(within(dialog).getByText(/Delete "Delete me"\?/)).toBeInTheDocument();
    expect(within(dialog).getByText("Existing runs and evidence remain unchanged.")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete Schedule" }));
    expect(onDeleteSchedule).toHaveBeenCalledWith("schedule-1");
  });

  test("shows history loading, empty, populated, and safe detail states", async () => {
    const onOpenRun = vi.fn();
    const onOpenWorkflow = vi.fn();
    const onLoadEvents = vi.fn();
    const { rerender } = renderSchedules(
      {
        schedules: [schedule({ name: "Audited schedule" })],
        events: [],
        onLoadEvents,
        onOpenRun,
        onOpenWorkflow,
      },
      { historyLoading: true },
    );

    await userEvent.click(screen.getByRole("button", { name: "View history for Audited schedule" }));
    let historyDialog = await screen.findByRole("dialog", { name: "Audited schedule history" });
    expect(within(historyDialog).getByText("Loading schedule history...")).toBeInTheDocument();

    rerenderSchedules(rerender, {
      schedules: [schedule({ name: "Audited schedule" })],
      events: [],
      onLoadEvents,
      onOpenRun,
      onOpenWorkflow,
    });
    historyDialog = await screen.findByRole("dialog", { name: "Audited schedule history" });
    expect(within(historyDialog).getByText("No events recorded yet.")).toBeInTheDocument();

    rerenderSchedules(rerender, {
      schedules: [schedule({ name: "Audited schedule" })],
      events: [
        event({
          event_type: "failed_to_start",
          reason: "validation_failed",
          details_json: JSON.stringify({
            issues: [
              { source: "graph", message: "Start node is not connected", level: "error" },
              { source: "settings", message: "Browser timezone is missing", level: "warning" },
            ],
          }),
        }),
        event({
          id: "event-2",
          event_type: "started",
          run_id: "run-123",
        }),
      ],
      onLoadEvents,
      onOpenRun,
      onOpenWorkflow,
    });
    historyDialog = await screen.findByRole("dialog", { name: "Audited schedule history" });
    expect(within(historyDialog).getByText("2 validation findings recorded.")).toBeInTheDocument();
    expect(within(historyDialog).getByText("Graph")).toBeInTheDocument();
    expect(within(historyDialog).getByText("Start node is not connected")).toBeInTheDocument();
    expect(within(historyDialog).queryByText(/\{"issues"/)).not.toBeInTheDocument();

    await userEvent.click(within(historyDialog).getByRole("button", { name: "Open Run run-123" }));
    expect(onOpenRun).toHaveBeenCalledWith("run-123");
    await userEvent.click(within(historyDialog).getAllByRole("button", { name: "Open Workflow Login flow" })[0]);
    expect(onOpenWorkflow).toHaveBeenCalledWith("workflow-1");
  });

  test("shows no-workflow prerequisite instead of creating an orphan schedule", () => {
    renderSchedules({ schedules: [], workflows: [] });

    expect(screen.getByText("Create a workflow before adding schedules.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Schedule" })).toBeDisabled();
  });
});

type SchedulesPageTestProps = ComponentProps<typeof SchedulesPage>;

function defaultProps(
  overrides: Partial<SchedulesPageTestProps> = {},
): SchedulesPageTestProps {
  return {
    schedules: [schedule()],
    workflows: [workflow()],
    events: [],
    loading: false,
    error: "",
    onCreateSchedule: vi.fn(),
    onUpdateSchedule: vi.fn(),
    onDeleteSchedule: vi.fn(),
    onToggleSchedule: vi.fn(),
    onLoadEvents: vi.fn(),
    ...overrides,
  };
}

function renderSchedules(
  overrides: Partial<SchedulesPageTestProps> = {},
  extraProps: Record<string, unknown> = {},
) {
  return render(
    <SchedulesPage
      {...({
        ...defaultProps(overrides),
        ...extraProps,
      } as SchedulesPageTestProps)}
    />,
  );
}

function rerenderSchedules(
  rerender: ReturnType<typeof render>["rerender"],
  overrides: Partial<SchedulesPageTestProps> = {},
  extraProps: Record<string, unknown> = {},
) {
  rerender(
    <SchedulesPage
      {...({
        ...defaultProps(overrides),
        ...extraProps,
      } as SchedulesPageTestProps)}
    />,
  );
}

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
