import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { SwitchField } from "../../../components/ui/switch";
import { commandMessage } from "../../../lib/workflowUi";
import type {
  WorkflowSchedule,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowSummary,
} from "../../../types/workflow";

type ScheduleDialogMode = "create" | "edit" | null;
type ScheduleKindDraft = "once_at" | "interval" | "calendar_daily" | "calendar_weekly" | "calendar_monthly";
type IntervalUnit = "minutes" | "hours" | "days";

export type ScheduleFormState = {
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

type ScheduleFormDialogProps = {
  open: boolean;
  mode: ScheduleDialogMode;
  scheduleId: string | null;
  schedule: WorkflowSchedule | null;
  workflows: WorkflowSummary[];
  onCreateSchedule: (input: WorkflowScheduleInput) => Promise<unknown>;
  onUpdateSchedule: (scheduleId: string, input: WorkflowScheduleInput) => Promise<unknown>;
  onClose: () => void;
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

export function ScheduleFormDialog({
  open,
  mode,
  scheduleId,
  schedule,
  workflows,
  onCreateSchedule,
  onUpdateSchedule,
  onClose,
}: ScheduleFormDialogProps) {
  const [form, setForm] = useState<ScheduleFormState>(() => defaultForm(workflows));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSaving(false);
      if (mode === "edit" && schedule) {
        setForm(formFromSchedule(schedule));
      } else {
        setForm(defaultForm(workflows));
      }
      setFormError("");
    }
  }, [open, mode, schedule, workflows]);

  async function submitSchedule(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const input: WorkflowScheduleInput = {
        workflow_id: form.workflowId,
        name: form.name,
        enabled: form.enabled,
        kind: kindFromForm(form),
      };
      if (mode === "edit" && scheduleId) {
        await onUpdateSchedule(scheduleId, input);
      } else {
        await onCreateSchedule(input);
      }
      onClose();
    } catch (caught) {
      setFormError(commandMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="workflow-dialog schedule-dialog">
        <DialogHeader>
          <p className="eyebrow">Schedule</p>
          <DialogTitle>
            {mode === "edit" ? "Edit Schedule" : "New Schedule"}
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
              setForm((current) => ({ ...current, kind: value as ScheduleKindDraft }))
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
            <Button shape="pill" type="submit" disabled={saving} loading={saving}>
              {mode === "edit" ? "Save Schedule" : "Create Schedule"}
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
