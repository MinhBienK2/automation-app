import { CalendarClock, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { IconButton } from "../../../components/ui/icon-button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { SwitchField } from "../../../components/ui/switch";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowSummary,
} from "../../../types/workflow";

type ScheduleDialogMode = "create" | "edit" | null;
type ScheduleKindDraft = "once_at" | "interval" | "calendar_daily" | "calendar_weekly" | "calendar_monthly";
type IntervalUnit = "minutes" | "hours" | "days";

type ScheduleFormState = {
  workflowId: string;
  name: string;
  enabled: boolean;
  kind: ScheduleKindDraft;
  onceAt: string;
  intervalEvery: string;
  intervalUnit: IntervalUnit;
  calendarTime: string;
  weekdays: number[];
  monthDay: string;
};

type SchedulesPageProps = {
  schedules: WorkflowSchedule[];
  workflows: WorkflowSummary[];
  events: WorkflowScheduleEvent[];
  focusedScheduleId?: string | null;
  loading: boolean;
  error: string;
  onCreateSchedule: (input: WorkflowScheduleInput) => Promise<unknown>;
  onUpdateSchedule: (scheduleId: string, input: WorkflowScheduleInput) => Promise<unknown>;
  onDeleteSchedule: (scheduleId: string) => Promise<unknown> | void;
  onToggleSchedule: (scheduleId: string, enabled: boolean) => Promise<unknown> | void;
  onLoadEvents: (scheduleId: string) => Promise<unknown> | void;
  onOpenWorkflow?: (workflowId: string) => void;
};

const weekdayOptions = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function SchedulesPage({
  schedules,
  workflows,
  events,
  focusedScheduleId,
  loading,
  error,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onLoadEvents,
  onOpenWorkflow,
}: SchedulesPageProps) {
  const [dialogMode, setDialogMode] = useState<ScheduleDialogMode>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [historySchedule, setHistorySchedule] = useState<WorkflowSchedule | null>(null);
  const [form, setForm] = useState(() => defaultForm(workflows));
  const [formError, setFormError] = useState("");

  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) =>
        right.created_at.localeCompare(left.created_at),
      ),
    [events],
  );

  function openCreateDialog() {
    setDialogMode("create");
    setEditingScheduleId(null);
    setForm(defaultForm(workflows));
    setFormError("");
  }

  function openEditDialog(schedule: WorkflowSchedule) {
    setDialogMode("edit");
    setEditingScheduleId(schedule.id);
    setForm(formFromSchedule(schedule));
    setFormError("");
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingScheduleId(null);
    setFormError("");
  }

  async function submitSchedule(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    try {
      const input: WorkflowScheduleInput = {
        workflow_id: form.workflowId,
        name: form.name,
        enabled: form.enabled,
        kind: kindFromForm(form),
      };
      if (dialogMode === "edit" && editingScheduleId) {
        await onUpdateSchedule(editingScheduleId, input);
      } else {
        await onCreateSchedule(input);
      }
      closeDialog();
    } catch (caught) {
      setFormError(commandMessage(caught));
    }
  }

  async function openHistory(schedule: WorkflowSchedule) {
    setHistorySchedule(schedule);
    await onLoadEvents(schedule.id);
  }

  return (
    <section className="app-screen schedules-screen" aria-label="Schedules">
      <header className="app-header">
        <div>
          <p className="eyebrow">Automation</p>
          <h1>Schedules</h1>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Schedule summary">
            <span>{schedules.length} schedules</span>
          </div>
          <Button shape="pill" type="button" onClick={openCreateDialog}>
            <Plus aria-hidden="true" />
            New schedule
          </Button>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <section className="panel schedule-panel" aria-label="Schedule list">
        {loading ? (
          <p className="muted">Loading schedules...</p>
        ) : schedules.length === 0 ? (
          <div className="empty-state">
            <CalendarClock aria-hidden="true" />
            <h2>No schedules yet</h2>
            <p className="muted">Create a schedule to run a saved workflow automatically.</p>
          </div>
        ) : (
          <div className="schedule-table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Workflow</th>
                  <th>Next run</th>
                  <th>Last result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr
                    key={schedule.id}
                    aria-label={`${schedule.name} ${schedule.workflow_name}`}
                    className={focusedScheduleId === schedule.id ? "schedule-row-focused" : undefined}
                  >
                    <td>
                      <span className={schedule.enabled ? "status-pill status-pill-on" : "status-pill"}>
                        {schedule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <strong>{schedule.name}</strong>
                      <small>{scheduleKindSummary(schedule.kind)}</small>
                      {focusedScheduleId === schedule.id ? <small>Selected schedule target</small> : null}
                    </td>
                    <td>{schedule.workflow_name}</td>
                    <td>{formatDateTime(schedule.next_run_at)}</td>
                    <td>
                      <span>{statusLabel(schedule.last_status)}</span>
                      {schedule.last_reason ? <small>{schedule.last_reason}</small> : null}
                    </td>
                    <td>
                      <div className="row-actions schedule-row-actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() => onToggleSchedule(schedule.id, !schedule.enabled)}
                        >
                          {schedule.enabled ? `Disable ${schedule.name}` : `Enable ${schedule.name}`}
                        </Button>
                        <IconButton
                          label={`Edit ${schedule.name}`}
                          type="button"
                          variant="secondary"
                          onClick={() => openEditDialog(schedule)}
                        >
                          <Pencil aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`View history for ${schedule.name}`}
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            void openHistory(schedule);
                          }}
                        >
                          <History aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          label={`Delete ${schedule.name}`}
                          type="button"
                          variant="destructive"
                          onClick={() => onDeleteSchedule(schedule.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(dialogMode)}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        {dialogMode ? (
          <DialogContent className="workflow-dialog schedule-dialog">
            <DialogHeader>
              <p className="eyebrow">Schedule</p>
              <DialogTitle>
                {dialogMode === "edit" ? "Edit Schedule" : "New Schedule"}
              </DialogTitle>
              <DialogDescription>
                Scheduled runs use the latest saved workflow and settings.
              </DialogDescription>
            </DialogHeader>
            <form className="workflow-dialog-form" onSubmit={submitSchedule}>
              <Label htmlFor="schedule-workflow">Workflow</Label>
              <Select
                id="schedule-workflow"
                value={form.workflowId}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({
                    ...current,
                    workflowId: value,
                  }));
                }}
              >
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </Select>

              <Label htmlFor="schedule-name">Schedule name</Label>
              <Input
                id="schedule-name"
                value={form.name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setForm((current) => ({ ...current, name: value }));
                }}
              />

              <SegmentedControl
                ariaLabel="Schedule kind"
                value={form.kind}
                options={[
                  { label: "Once", value: "once_at" },
                  { label: "Interval", value: "interval" },
                  { label: "Daily", value: "calendar_daily" },
                  { label: "Weekly", value: "calendar_weekly" },
                  { label: "Monthly", value: "calendar_monthly" },
                ]}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, kind: value }))
                }
              />

              {form.kind === "once_at" ? (
                <>
                  <Label htmlFor="schedule-once-at">Run at</Label>
                  <Input
                    id="schedule-once-at"
                    type="datetime-local"
                    value={form.onceAt}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({
                        ...current,
                        onceAt: value,
                      }));
                    }}
                  />
                </>
              ) : null}

              {form.kind === "interval" ? (
                <div className="schedule-inline-fields">
                  <div>
                    <Label htmlFor="schedule-every">Every</Label>
                    <Input
                      id="schedule-every"
                      type="number"
                      min="1"
                      value={form.intervalEvery}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setForm((current) => ({
                          ...current,
                          intervalEvery: value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="schedule-interval-unit">Unit</Label>
                    <Select
                      id="schedule-interval-unit"
                      value={form.intervalUnit}
                      onChange={(event) => {
                        const value = event.currentTarget.value as IntervalUnit;
                        setForm((current) => ({
                          ...current,
                          intervalUnit: value,
                        }));
                      }}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </Select>
                  </div>
                </div>
              ) : null}

              {form.kind.startsWith("calendar_") ? (
                <>
                  <Label htmlFor="schedule-calendar-time">Time</Label>
                  <Input
                    id="schedule-calendar-time"
                    type="time"
                    value={form.calendarTime}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({
                        ...current,
                        calendarTime: value,
                      }));
                    }}
                  />
                </>
              ) : null}

              {form.kind === "calendar_weekly" ? (
                <div className="weekday-toggle-list" aria-label="Weekdays">
                  {weekdayOptions.map((weekday) => (
                    <Button
                      key={weekday.value}
                      aria-pressed={form.weekdays.includes(weekday.value)}
                      size="sm"
                      type="button"
                      variant={form.weekdays.includes(weekday.value) ? "default" : "secondary"}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          weekdays: current.weekdays.includes(weekday.value)
                            ? current.weekdays.filter((value) => value !== weekday.value)
                            : [...current.weekdays, weekday.value].sort(),
                        }))
                      }
                    >
                      {weekday.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {form.kind === "calendar_monthly" ? (
                <>
                  <Label htmlFor="schedule-month-day">Day of month</Label>
                  <Input
                    id="schedule-month-day"
                    type="number"
                    min="1"
                    max="31"
                    value={form.monthDay}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({
                        ...current,
                        monthDay: value,
                      }));
                    }}
                  />
                </>
              ) : null}

              <SwitchField
                label="Enable schedule"
                checked={form.enabled}
                onCheckedChange={(enabled) =>
                  setForm((current) => ({ ...current, enabled }))
                }
              />

              {formError ? <p className="field-error">{formError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  {dialogMode === "edit" ? "Save Schedule" : "Create Schedule"}
                </Button>
                <Button type="button" variant="secondary" onClick={closeDialog}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(historySchedule)}
        onOpenChange={(open) => {
          if (!open) setHistorySchedule(null);
        }}
      >
        {historySchedule ? (
          <DialogContent className="workflow-dialog schedule-history-dialog">
            <DialogHeader>
              <p className="eyebrow">Schedule</p>
              <DialogTitle>Schedule History</DialogTitle>
              <DialogDescription>{historySchedule.name}</DialogDescription>
            </DialogHeader>
            <div className="schedule-history-list">
              {sortedEvents.length === 0 ? (
                <p className="muted">No events recorded yet.</p>
              ) : (
                sortedEvents.map((event) => (
                  <div className="schedule-history-item" key={event.id}>
                    <strong>{statusLabel(event.event_type)}</strong>
                    <span>{formatDateTime(event.scheduled_for)}</span>
                    {event.reason ? <small>{event.reason}</small> : null}
                    <div className="schedule-history-actions">
                      {onOpenWorkflow ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenWorkflow(event.workflow_id)}
                        >
                          Open Workflow
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function defaultForm(workflows: WorkflowSummary[]): ScheduleFormState {
  return {
    workflowId: workflows[0]?.id ?? "",
    name: "",
    enabled: false,
    kind: "interval",
    onceAt: "",
    intervalEvery: "60",
    intervalUnit: "minutes",
    calendarTime: "09:00",
    weekdays: [1, 2, 3, 4, 5],
    monthDay: "1",
  };
}

function formFromSchedule(schedule: WorkflowSchedule): ScheduleFormState {
  const base = defaultForm([
    {
      id: schedule.workflow_id,
      name: schedule.workflow_name,
      step_count: 0,
      created_at: schedule.created_at,
      updated_at: schedule.updated_at,
    },
  ]);
  const form = {
    ...base,
    workflowId: schedule.workflow_id,
    name: schedule.name,
    enabled: schedule.enabled,
  };
  if (schedule.kind.type === "once_at") {
    return { ...form, kind: "once_at", onceAt: toDatetimeLocal(schedule.kind.timestamp) };
  }
  if (schedule.kind.type === "interval") {
    const { every, unit } = intervalDraft(schedule.kind.every_seconds);
    return {
      ...form,
      kind: "interval",
      intervalEvery: String(every),
      intervalUnit: unit,
    };
  }
  if (schedule.kind.preset === "weekly") {
    return {
      ...form,
      kind: "calendar_weekly",
      calendarTime: schedule.kind.time,
      weekdays: schedule.kind.weekdays,
    };
  }
  if (schedule.kind.preset === "monthly") {
    return {
      ...form,
      kind: "calendar_monthly",
      calendarTime: schedule.kind.time,
      monthDay: String(schedule.kind.day),
    };
  }
  return { ...form, kind: "calendar_daily", calendarTime: schedule.kind.time };
}

function kindFromForm(form: ScheduleFormState): WorkflowScheduleKind {
  if (form.kind === "once_at") {
    return { type: "once_at", timestamp: parseDatetimeLocal(form.onceAt) };
  }
  if (form.kind === "interval") {
    const multiplier =
      form.intervalUnit === "days" ? 86_400 : form.intervalUnit === "hours" ? 3_600 : 60;
    return {
      type: "interval",
      every_seconds: Number(form.intervalEvery || 0) * multiplier,
    };
  }
  if (form.kind === "calendar_weekly") {
    return {
      type: "calendar",
      preset: "weekly",
      weekdays: form.weekdays,
      time: form.calendarTime,
    };
  }
  if (form.kind === "calendar_monthly") {
    return {
      type: "calendar",
      preset: "monthly",
      day: Number(form.monthDay || 0),
      time: form.calendarTime,
    };
  }
  return { type: "calendar", preset: "daily", time: form.calendarTime };
}

function intervalDraft(seconds: number): { every: number; unit: IntervalUnit } {
  if (seconds % 86_400 === 0) return { every: seconds / 86_400, unit: "days" };
  if (seconds % 3_600 === 0) return { every: seconds / 3_600, unit: "hours" };
  return { every: Math.max(1, seconds / 60), unit: "minutes" };
}

function scheduleKindSummary(kind: WorkflowScheduleKind) {
  if (kind.type === "once_at") return `Once at ${formatDateTime(kind.timestamp)}`;
  if (kind.type === "interval") return `Every ${formatInterval(kind.every_seconds)}`;
  if (kind.preset === "daily") return `Daily at ${kind.time}`;
  if (kind.preset === "weekly") {
    return `Weekly ${kind.weekdays.map(weekdayLabel).join(", ")} at ${kind.time}`;
  }
  return `Monthly on day ${kind.day} at ${kind.time}`;
}

function formatInterval(seconds: number) {
  if (seconds % 86_400 === 0) return `${seconds / 86_400} days`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hours`;
  return `${seconds / 60} minutes`;
}

function weekdayLabel(day: number) {
  return weekdayOptions.find((option) => option.value === day)?.label ?? String(day);
}

function statusLabel(status: string | null) {
  if (!status) return "None";
  return status
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid date and time");
  }
  return date.toISOString();
}

function commandMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}
