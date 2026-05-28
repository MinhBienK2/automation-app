import {
  CalendarClock,
  History,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { StaleTargetPanel } from "../../../components/patterns/StaleTargetPanel";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogBody,
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
  RunValidationIssue,
  ScheduleValidationIssue,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowScheduleStatus,
  WorkflowSummary,
} from "../../../types/workflow";
import type { StaleTargetDescriptor } from "../../../lib/missionControlNavigation";

type ScheduleDialogMode = "create" | "edit" | null;
type ScheduleKindDraft =
  | "once_at"
  | "interval"
  | "calendar_daily"
  | "calendar_weekly"
  | "calendar_monthly";
type IntervalUnit = "minutes" | "hours" | "days";
type RowCommandAction = "enable" | "disable" | "delete" | "history";

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

type FieldErrors = Record<string, string>;

type SchedulesPageProps = {
  schedules: WorkflowSchedule[];
  workflows: WorkflowSummary[];
  events: WorkflowScheduleEvent[];
  focusedScheduleId?: string | null;
  focusedScheduleEventId?: string | null;
  staleTarget?: StaleTargetDescriptor | null;
  loading: boolean;
  historyLoading?: boolean;
  historyError?: string;
  error: string;
  onCreateSchedule: (input: WorkflowScheduleInput) => Promise<unknown>;
  onUpdateSchedule: (scheduleId: string, input: WorkflowScheduleInput) => Promise<unknown>;
  onDeleteSchedule: (scheduleId: string) => Promise<unknown> | void;
  onToggleSchedule: (scheduleId: string, enabled: boolean) => Promise<unknown> | void;
  onLoadEvents: (scheduleId: string) => Promise<unknown> | void;
  onRefreshTarget?: () => void;
  onOpenList?: () => void;
  onOpenOverview?: () => void;
  onClearStaleTarget?: () => void;
  onOpenRun?: (runId: string) => void;
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

const scheduleKindOptions: Array<{ label: string; value: ScheduleKindDraft }> = [
  { label: "Once", value: "once_at" },
  { label: "Interval", value: "interval" },
  { label: "Daily", value: "calendar_daily" },
  { label: "Weekly", value: "calendar_weekly" },
  { label: "Monthly", value: "calendar_monthly" },
];

export function SchedulesPage({
  schedules,
  workflows,
  events,
  focusedScheduleId,
  focusedScheduleEventId,
  staleTarget,
  loading,
  historyLoading = false,
  historyError = "",
  error,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onLoadEvents,
  onRefreshTarget,
  onOpenList,
  onOpenOverview,
  onClearStaleTarget,
  onOpenRun,
  onOpenWorkflow,
}: SchedulesPageProps) {
  const [dialogMode, setDialogMode] = useState<ScheduleDialogMode>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [historySchedule, setHistorySchedule] = useState<WorkflowSchedule | null>(null);
  const [historyPending, setHistoryPending] = useState(false);
  const [form, setForm] = useState(() => defaultForm(workflows));
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pendingRowAction, setPendingRowAction] = useState<{
    scheduleId: string;
    action: RowCommandAction;
  } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkflowSchedule | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const summary = useMemo(() => buildScheduleSummary(schedules), [schedules]);
  const sortedEvents = useMemo(
    () =>
      [...events]
        .filter((event) => !historySchedule || event.schedule_id === historySchedule.id)
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [events, historySchedule],
  );
  const activeHistoryLoading = historyLoading || historyPending;
  const focusedEventMissing =
    Boolean(focusedScheduleEventId) &&
    !activeHistoryLoading &&
    !sortedEvents.some((event) => event.id === focusedScheduleEventId);
  const hasWorkflows = workflows.length > 0;

  useEffect(() => {
    if (!focusedScheduleId) return;
    const schedule = schedules.find((item) => item.id === focusedScheduleId);
    if (schedule) {
      setHistorySchedule(schedule);
    }
  }, [focusedScheduleId, schedules]);

  function openCreateDialog() {
    if (!hasWorkflows) return;
    setDialogMode("create");
    setEditingScheduleId(null);
    setForm(defaultForm(workflows));
    setFormError("");
    setFieldErrors({});
  }

  function openEditDialog(schedule: WorkflowSchedule) {
    setDialogMode("edit");
    setEditingScheduleId(schedule.id);
    setForm(formFromSchedule(schedule, workflows));
    setFormError("");
    setFieldErrors({});
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingScheduleId(null);
    setFormError("");
    setFieldErrors({});
    setSubmitting(false);
  }

  async function submitSchedule(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const validation = validateForm(form);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    try {
      setSubmitting(true);
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
      const message = commandMessage(caught);
      const field = commandField(caught);
      if (field) {
        setFieldErrors({ [field]: message });
      }
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory(schedule: WorkflowSchedule) {
    setHistorySchedule(schedule);
    setHistoryPending(true);
    setPendingRowAction({ scheduleId: schedule.id, action: "history" });
    try {
      await onLoadEvents(schedule.id);
    } catch (caught) {
      setRowErrors((current) => ({
        ...current,
        [schedule.id]: `Could not load history: ${commandMessage(caught)}`,
      }));
    } finally {
      setHistoryPending(false);
      setPendingRowAction((current) =>
        current?.scheduleId === schedule.id && current.action === "history" ? null : current,
      );
    }
  }

  async function handleToggle(schedule: WorkflowSchedule) {
    const nextEnabled = !schedule.enabled;
    const action: RowCommandAction = nextEnabled ? "enable" : "disable";
    setPendingRowAction({ scheduleId: schedule.id, action });
    setRowErrors((current) => ({ ...current, [schedule.id]: "" }));
    try {
      await onToggleSchedule(schedule.id, nextEnabled);
    } catch (caught) {
      const prefix = nextEnabled ? "Could not enable" : "Could not disable";
      setRowErrors((current) => ({
        ...current,
        [schedule.id]: `${prefix}: ${commandMessage(caught)}`,
      }));
    } finally {
      setPendingRowAction((current) =>
        current?.scheduleId === schedule.id && current.action === action ? null : current,
      );
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    setDeleteError("");
    setPendingRowAction({ scheduleId: deleteCandidate.id, action: "delete" });
    try {
      await onDeleteSchedule(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (caught) {
      setDeleteError(commandMessage(caught));
    } finally {
      setPendingRowAction((current) =>
        current?.scheduleId === deleteCandidate.id && current.action === "delete"
          ? null
          : current,
      );
    }
  }

  return (
    <section className="app-screen schedules-screen" aria-label="Schedules">
      <header className="app-header schedules-header">
        <div className="schedules-title-copy">
          <p className="eyebrow">Automation</p>
          <h1>Schedules</h1>
          <p className="muted">Saved workflows can run automatically while Mission Control is open.</p>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Schedule summary">
            <span>{summary.total} total</span>
            <span>Enabled {summary.enabled}</span>
            <span>Attention {summary.attention}</span>
          </div>
          <Button
            shape="pill"
            type="button"
            disabled={!hasWorkflows}
            onClick={openCreateDialog}
          >
            <Plus aria-hidden="true" />
            New Schedule
          </Button>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <section className="schedule-summary-strip" aria-label="Schedule readiness summary">
        <SummaryCell label="Enabled" value={`${summary.enabled} enabled`} tone="info" />
        <SummaryCell label="Next Due" value={summary.nextDueLabel} tone="neutral" />
        <SummaryCell label="Attention" value={`${summary.attention} attention`} tone={summary.attentionTone} />
        <SummaryCell label="Drafts" value={`${summary.drafts} draft`} tone="muted" />
      </section>

      {staleTarget ? (
        <StaleTargetPanel
          descriptor={staleTarget}
          onRefresh={onRefreshTarget}
          onOpenList={onOpenList}
          onOpenOverview={onOpenOverview}
          onClear={onClearStaleTarget}
        />
      ) : null}

      <section className="panel schedule-panel" aria-label="Schedule list">
        {loading ? (
          <p className="muted">Loading schedules...</p>
        ) : schedules.length === 0 ? (
          <div className="empty-state schedule-empty-state">
            <CalendarClock aria-hidden="true" />
            <h2>No schedules yet</h2>
            <p className="muted">
              {hasWorkflows
                ? "Create a schedule to run a saved workflow automatically while Mission Control is open."
                : "Create a workflow before adding schedules."}
            </p>
          </div>
        ) : (
          <div className="schedule-table-wrap">
            <table className="schedule-table" aria-label="Workflow schedules">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Workflow</th>
                  <th>Cadence</th>
                  <th>Next Run</th>
                  <th>Last Decision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => {
                  const pendingAction =
                    pendingRowAction?.scheduleId === schedule.id
                      ? pendingRowAction.action
                      : null;
                  return (
                    <ScheduleRow
                      key={schedule.id}
                      schedule={schedule}
                      focused={focusedScheduleId === schedule.id}
                      pendingAction={pendingAction}
                      rowError={rowErrors[schedule.id] ?? ""}
                      onEdit={() => openEditDialog(schedule)}
                      onHistory={() => {
                        void openHistory(schedule);
                      }}
                      onToggle={() => {
                        void handleToggle(schedule);
                      }}
                      onDelete={() => {
                        setDeleteCandidate(schedule);
                        setDeleteError("");
                      }}
                      onOpenWorkflow={onOpenWorkflow}
                    />
                  );
                })}
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
          <DialogContent className="workflow-dialog schedule-dialog" size="xl">
            <DialogHeader>
              <p className="eyebrow">Schedule</p>
              <DialogTitle>
                {dialogMode === "edit" ? "Edit Schedule" : "New Schedule"}
              </DialogTitle>
              <DialogDescription>
                {dialogMode === "edit"
                  ? "Changes apply to future occurrences only."
                  : "Scheduled runs use the latest saved workflow and Workflow Settings."}
              </DialogDescription>
            </DialogHeader>
            <form className="schedule-dialog-form" onSubmit={submitSchedule}>
              <DialogBody className="schedule-dialog-body">
                <div className="schedule-form-fields">
                  <section className="schedule-form-section" aria-label="Target">
                    <h2>Target</h2>
                    <div className="form-field">
                      <Label htmlFor="schedule-workflow">Workflow</Label>
                      <Select
                        id="schedule-workflow"
                        value={form.workflowId}
                        disabled={!hasWorkflows}
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
                      <FieldError message={fieldErrors.workflow_id} />
                    </div>

                    <div className="form-field">
                      <Label htmlFor="schedule-name">Schedule name</Label>
                      <Input
                        id="schedule-name"
                        placeholder="Weekday login audit"
                        value={form.name}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setForm((current) => ({ ...current, name: value }));
                        }}
                      />
                      <FieldError message={fieldErrors.name} />
                    </div>
                  </section>

                  <section className="schedule-form-section" aria-label="Cadence">
                    <h2>Cadence</h2>
                    <SegmentedControl
                      ariaLabel="Schedule kind"
                      className="schedule-kind-segmented"
                      value={form.kind}
                      options={scheduleKindOptions}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, kind: value }))
                      }
                    />

                    {form.kind === "once_at" ? (
                      <div className="form-field">
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
                        <FieldError message={fieldErrors["kind.timestamp"]} />
                      </div>
                    ) : null}

                    {form.kind === "interval" ? (
                      <div className="schedule-inline-fields">
                        <div className="form-field">
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
                          <FieldError message={fieldErrors["kind.every_seconds"]} />
                        </div>
                        <div className="form-field">
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
                      <div className="form-field">
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
                        <FieldError message={fieldErrors["kind.time"]} />
                      </div>
                    ) : null}

                    {form.kind === "calendar_weekly" ? (
                      <div className="form-field">
                        <Label>Weekdays</Label>
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
                        <FieldError message={fieldErrors["kind.weekdays"]} />
                      </div>
                    ) : null}

                    {form.kind === "calendar_monthly" ? (
                      <div className="form-field">
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
                        <FieldError message={fieldErrors["kind.day"]} />
                        {Number(form.monthDay) >= 29 && Number(form.monthDay) <= 31 ? (
                          <p className="schedule-helper-copy">Months without this day are skipped.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <section className="schedule-form-section" aria-label="Enablement">
                    <h2>Enablement</h2>
                    <SwitchField
                      label="Enable schedule"
                      description="Disabled drafts do not run until enabled."
                      checked={form.enabled}
                      onCheckedChange={(enabled) =>
                        setForm((current) => ({ ...current, enabled }))
                      }
                    />
                  </section>
                </div>

                <ScheduleReadinessPanel
                  form={form}
                  workflows={workflows}
                  fieldErrors={fieldErrors}
                  formError={formError}
                />
              </DialogBody>
              <DialogFooter className="form-actions schedule-dialog-footer">
                <Button shape="pill" type="submit" disabled={!hasWorkflows || submitting}>
                  {submitting
                    ? dialogMode === "edit"
                      ? "Saving..."
                      : "Creating..."
                    : dialogMode === "edit"
                      ? "Save Schedule"
                      : "Create Schedule"}
                </Button>
                <Button type="button" variant="secondary" onClick={closeDialog}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <ScheduleHistoryDialog
        schedule={historySchedule}
        events={sortedEvents}
        loading={activeHistoryLoading}
        error={historyError}
        focusedEventId={focusedScheduleEventId}
        focusedEventMissing={focusedEventMissing}
        onOpenChange={(open) => {
          if (!open) setHistorySchedule(null);
        }}
        onOpenRun={onOpenRun}
        onOpenWorkflow={onOpenWorkflow}
      />

      <ScheduleDeleteDialog
        schedule={deleteCandidate}
        pending={
          Boolean(deleteCandidate) &&
          pendingRowAction?.scheduleId === deleteCandidate?.id &&
          pendingRowAction?.action === "delete"
        }
        error={deleteError}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </section>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "info" | "warning" | "danger" | "muted";
}) {
  return (
    <div className={`schedule-summary-cell schedule-summary-cell-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScheduleRow({
  schedule,
  focused,
  pendingAction,
  rowError,
  onEdit,
  onHistory,
  onToggle,
  onDelete,
  onOpenWorkflow,
}: {
  schedule: WorkflowSchedule;
  focused: boolean;
  pendingAction: RowCommandAction | null;
  rowError: string;
  onEdit: () => void;
  onHistory: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onOpenWorkflow?: (workflowId: string) => void;
}) {
  const attention = scheduleNeedsAttention(schedule);
  const toggleLabel = schedule.enabled ? `Disable ${schedule.name}` : `Enable ${schedule.name}`;
  const pendingToggleLabel =
    pendingAction === "enable" ? "Enabling..." : pendingAction === "disable" ? "Disabling..." : toggleLabel;

  return (
    <>
      <tr
        aria-label={`${safeScheduleName(schedule.name)} ${schedule.workflow_name}`}
        className={focused ? "schedule-row-focused" : undefined}
      >
        <td>
          <span className={schedule.enabled ? "status-pill status-pill-on" : "status-pill"}>
            {schedule.enabled ? "Enabled" : "Disabled"}
          </span>
          {attention ? (
            <span className={`status-pill schedule-attention-pill ${attention}`}>
              Needs review
            </span>
          ) : null}
        </td>
        <td>
          <strong title={safeScheduleName(schedule.name)}>{safeScheduleName(schedule.name)}</strong>
          {focused ? <small>Selected schedule target</small> : null}
        </td>
        <td>
          <span>{schedule.workflow_name}</span>
          {onOpenWorkflow ? (
            <Button
              type="button"
              size="sm"
              variant="quiet"
              onClick={() => onOpenWorkflow(schedule.workflow_id)}
            >
              Open Workflow
            </Button>
          ) : null}
        </td>
        <td>
          <span>{scheduleKindSummary(schedule.kind)}</span>
        </td>
        <td>
          <span>{nextRunLabel(schedule)}</span>
          <small>{nextRunHint(schedule)}</small>
        </td>
        <td>
          <span>{statusLabel(schedule.last_status)}</span>
          <small>{reasonLabel(schedule.last_reason)}</small>
        </td>
        <td>
          <div className="row-actions schedule-row-actions">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              disabled={pendingAction === "enable" || pendingAction === "disable"}
              onClick={onToggle}
            >
              {pendingToggleLabel}
            </Button>
            <IconButton
              label={`Edit ${safeScheduleName(schedule.name)}`}
              type="button"
              variant="secondary"
              onClick={onEdit}
            >
              <Pencil aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`View history for ${safeScheduleName(schedule.name)}`}
              type="button"
              variant="secondary"
              disabled={pendingAction === "history"}
              onClick={onHistory}
            >
              <History aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`Delete ${safeScheduleName(schedule.name)}`}
              type="button"
              variant="destructive"
              onClick={onDelete}
            >
              <Trash2 aria-hidden="true" />
            </IconButton>
          </div>
        </td>
      </tr>
      {rowError ? (
        <tr className="schedule-row-error">
          <td colSpan={7}>
            <p role="alert" aria-label={`${safeScheduleName(schedule.name)} command error`}>
              {rowError}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ScheduleReadinessPanel({
  form,
  workflows,
  fieldErrors,
  formError,
}: {
  form: ScheduleFormState;
  workflows: WorkflowSummary[];
  fieldErrors: FieldErrors;
  formError: string;
}) {
  const selectedWorkflow = workflows.find((workflow) => workflow.id === form.workflowId);
  const localErrors = Object.values(fieldErrors).filter(Boolean);
  const readiness = form.enabled ? "Ready to enable" : "Ready to save as draft";
  const preview = scheduleFormPreview(form);

  return (
    <aside className="schedule-readiness-panel" aria-label="Preview and readiness">
      <p className="eyebrow">Preview</p>
      <h2>{selectedWorkflow?.name ?? "No workflow selected"}</h2>
      <dl className="schedule-readiness-list">
        <div>
          <dt>Cadence</dt>
          <dd>{preview}</dd>
        </div>
        <div>
          <dt>Next occurrence</dt>
          <dd>{nextOccurrencePreview(form)}</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>Displayed in local time.</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>Mission Control must be open for schedules to run.</dd>
        </div>
        <div>
          <dt>Saved state</dt>
          <dd>Uses the latest saved workflow graph and Workflow Settings.</dd>
        </div>
        <div>
          <dt>Readiness</dt>
          <dd>{localErrors.length > 0 ? "Needs schedule fields" : readiness}</dd>
        </div>
      </dl>
      {formError ? (
        <p className="field-error schedule-readiness-error" role="alert" aria-label="readiness error">
          {formError}
        </p>
      ) : null}
    </aside>
  );
}

function ScheduleHistoryDialog({
  schedule,
  events,
  loading,
  error,
  focusedEventId,
  focusedEventMissing,
  onOpenChange,
  onOpenRun,
  onOpenWorkflow,
}: {
  schedule: WorkflowSchedule | null;
  events: WorkflowScheduleEvent[];
  loading: boolean;
  error: string;
  focusedEventId?: string | null;
  focusedEventMissing: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenRun?: (runId: string) => void;
  onOpenWorkflow?: (workflowId: string) => void;
}) {
  return (
    <Dialog open={Boolean(schedule)} onOpenChange={onOpenChange}>
      {schedule ? (
        <DialogContent className="workflow-dialog schedule-history-dialog" size="lg">
          <DialogHeader>
            <p className="eyebrow">Schedule History</p>
            <DialogTitle>{safeScheduleName(schedule.name)} history</DialogTitle>
            <DialogDescription>
              {schedule.workflow_name} · {scheduleKindSummary(schedule.kind)} ·{" "}
              {schedule.enabled ? "Enabled" : "Disabled"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {error ? (
              <p className="field-error" role="alert">
                Could not load schedule history.
              </p>
            ) : null}
            {focusedEventMissing && focusedEventId ? (
              <p className="field-error" role="alert">
                Schedule event target is no longer available: {focusedEventId}
              </p>
            ) : null}
            <div className="schedule-history-list">
              {loading ? (
                <p className="muted">Loading schedule history...</p>
              ) : events.length === 0 ? (
                <div className="schedule-history-empty">
                  <p>No events recorded yet.</p>
                  <small>Events appear after the scheduler processes an enabled schedule.</small>
                </div>
              ) : (
                events.map((event) => (
                  <ScheduleHistoryItem
                    key={event.id}
                    event={event}
                    workflowName={schedule.workflow_name}
                    focused={event.id === focusedEventId}
                    onOpenRun={onOpenRun}
                    onOpenWorkflow={onOpenWorkflow}
                  />
                ))
              )}
            </div>
          </DialogBody>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ScheduleHistoryItem({
  event,
  workflowName,
  focused,
  onOpenRun,
  onOpenWorkflow,
}: {
  event: WorkflowScheduleEvent;
  workflowName: string;
  focused: boolean;
  onOpenRun?: (runId: string) => void;
  onOpenWorkflow?: (workflowId: string) => void;
}) {
  const detail = historyDetail(event);

  return (
    <article
      className={`schedule-history-item ${focused ? "schedule-history-item-focused" : ""}`.trim()}
      aria-label={`${statusLabel(event.event_type)} event`}
    >
      <div className="schedule-history-item-header">
        <strong>{statusLabel(event.event_type)}</strong>
        <span className={`status-pill ${historyToneClass(event.event_type)}`}>
          {statusLabel(event.event_type)}
        </span>
      </div>
      <dl className="schedule-history-meta">
        <div>
          <dt>Scheduled for</dt>
          <dd>{formatDateTime(event.scheduled_for)}</dd>
        </div>
        <div>
          <dt>Recorded at</dt>
          <dd>{formatDateTime(event.created_at)}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{reasonLabel(event.reason) || "None"}</dd>
        </div>
      </dl>
      <p>{detail.summary}</p>
      {detail.sections.length > 0 ? (
        <div className="schedule-history-details">
          {detail.sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      <div className="schedule-history-actions">
        {event.run_id && onOpenRun ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={`Open Run ${event.run_id}`}
            onClick={() => onOpenRun(event.run_id ?? "")}
          >
            Open Run
          </Button>
        ) : null}
        {onOpenWorkflow ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={`Open Workflow ${workflowName}`}
            onClick={() => onOpenWorkflow(event.workflow_id)}
          >
            Open Workflow
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function ScheduleDeleteDialog({
  schedule,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  schedule: WorkflowSchedule | null;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(schedule)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {schedule ? (
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Delete &quot;{safeScheduleName(schedule.name)}&quot;? Future occurrences will stop.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="muted">Existing runs and evidence remain unchanged.</p>
            <dl className="key-value-list">
              <div>
                <dt>Affected schedule</dt>
                <dd>{safeScheduleName(schedule.name)}</dd>
              </div>
            </dl>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? "Deleting..." : "Delete Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
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

function formFromSchedule(
  schedule: WorkflowSchedule,
  workflows: WorkflowSummary[],
): ScheduleFormState {
  const base = defaultForm(
    workflows.length
      ? workflows
      : [
          {
            id: schedule.workflow_id,
            name: schedule.workflow_name,
            step_count: 0,
            created_at: schedule.created_at,
            updated_at: schedule.updated_at,
          },
        ],
  );
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

function validateForm(form: ScheduleFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.workflowId.trim()) {
    errors.workflow_id = "Workflow is required";
  }
  if (!form.name.trim()) {
    errors.name = "Schedule name is required";
  }

  if (form.kind === "once_at") {
    const date = new Date(form.onceAt);
    if (!form.onceAt || Number.isNaN(date.getTime())) {
      errors["kind.timestamp"] = "Use a valid date and time";
    } else if (form.enabled && date.getTime() <= Date.now()) {
      errors["kind.timestamp"] = "One-time schedule must be in the future";
    }
  }

  if (form.kind === "interval") {
    const seconds = Number(form.intervalEvery || 0) * intervalMultiplier(form.intervalUnit);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      errors["kind.every_seconds"] = "Use a positive interval";
    } else if (seconds < 60) {
      errors["kind.every_seconds"] = "Interval must be at least 60 seconds";
    }
  }

  if (form.kind.startsWith("calendar_") && !timeIsValid(form.calendarTime)) {
    errors["kind.time"] = "Use a valid HH:mm time";
  }

  if (form.kind === "calendar_weekly" && form.enabled && form.weekdays.length === 0) {
    errors["kind.weekdays"] = "Select at least one weekday";
  }

  if (form.kind === "calendar_monthly") {
    const day = Number(form.monthDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      errors["kind.day"] = "Use a day from 1 to 31";
    }
  }

  return errors;
}

function kindFromForm(form: ScheduleFormState): WorkflowScheduleKind {
  if (form.kind === "once_at") {
    return { type: "once_at", timestamp: parseDatetimeLocal(form.onceAt) };
  }
  if (form.kind === "interval") {
    return {
      type: "interval",
      every_seconds: Number(form.intervalEvery || 0) * intervalMultiplier(form.intervalUnit),
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

function intervalMultiplier(unit: IntervalUnit) {
  return unit === "days" ? 86_400 : unit === "hours" ? 3_600 : 60;
}

function intervalDraft(seconds: number): { every: number; unit: IntervalUnit } {
  if (seconds % 86_400 === 0) return { every: seconds / 86_400, unit: "days" };
  if (seconds % 3_600 === 0) return { every: seconds / 3_600, unit: "hours" };
  return { every: Math.max(1, seconds / 60), unit: "minutes" };
}

function buildScheduleSummary(schedules: WorkflowSchedule[]) {
  const attention = schedules.filter(scheduleNeedsAttention);
  const nextDue = schedules
    .filter((schedule) => schedule.enabled && schedule.next_run_at)
    .map((schedule) => schedule.next_run_at as string)
    .sort()[0];
  const attentionTone: "neutral" | "warning" | "danger" = attention.some(
    (schedule) => schedule.last_status === "failed_to_start",
  )
    ? "danger"
    : attention.length > 0
      ? "warning"
      : "neutral";
  return {
    total: schedules.length,
    enabled: schedules.filter((schedule) => schedule.enabled).length,
    attention: attention.length,
    attentionTone,
    drafts: schedules.filter((schedule) => !schedule.enabled).length,
    nextDueLabel: nextDue ? formatDateTime(nextDue) : "Not scheduled",
  };
}

function scheduleNeedsAttention(schedule: WorkflowSchedule) {
  if (schedule.enabled && !schedule.next_run_at) return "schedule-attention-warning";
  if (schedule.last_status === "failed_to_start") return "schedule-attention-danger";
  if (schedule.last_status === "skipped" || schedule.last_status === "missed") {
    return "schedule-attention-warning";
  }
  return "";
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

function scheduleFormPreview(form: ScheduleFormState) {
  if (form.kind === "once_at") {
    return form.onceAt
      ? `Runs once at ${formatDateTime(parseDatetimeLocalLenient(form.onceAt))}.`
      : "Runs once after a valid date and time is set.";
  }
  if (form.kind === "interval") {
    return `Runs every ${formatInterval(Number(form.intervalEvery || 0) * intervalMultiplier(form.intervalUnit))} while Mission Control is open.`;
  }
  if (form.kind === "calendar_daily") return `Runs daily at ${form.calendarTime} local time.`;
  if (form.kind === "calendar_weekly") {
    return `Runs ${form.weekdays.map(weekdayLabel).join(", ") || "selected weekdays"} at ${form.calendarTime} local time.`;
  }
  return `Runs on day ${form.monthDay || "?"} at ${form.calendarTime} local time.`;
}

function nextOccurrencePreview(form: ScheduleFormState) {
  if (!form.enabled) return "Next run will be calculated after save.";
  if (form.kind === "once_at" && form.onceAt) return formatDateTime(parseDatetimeLocalLenient(form.onceAt));
  return "Next run will be calculated after save.";
}

function formatInterval(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "a positive interval";
  if (seconds % 86_400 === 0) return plural(seconds / 86_400, "day");
  if (seconds % 3_600 === 0) return plural(seconds / 3_600, "hour");
  return plural(seconds / 60, "minute");
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function weekdayLabel(day: number) {
  return weekdayOptions.find((option) => option.value === day)?.label ?? String(day);
}

function statusLabel(status: WorkflowScheduleStatus | string | null) {
  if (!status) return "No events yet";
  const labels: Record<string, string> = {
    started: "Started",
    skipped: "Skipped",
    missed: "Missed",
    failed_to_start: "Failed to start",
    disabled: "Disabled",
  };
  return labels[status] ?? humanizeToken(status);
}

function reasonLabel(reason: string | null) {
  if (!reason) return "";
  const labels: Record<string, string> = {
    active_workflow: "Workflow already running",
    active_profile: "Browser profile already in use",
    active_batch: "Batch run active",
    active_run: "Run already active",
    missed_window: "Missed while app was inactive",
    validation_failed: "Saved workflow is not runnable",
    start_failed: "Start command failed",
    one_time_elapsed: "One-time schedule elapsed",
  };
  return labels[reason] ?? humanizeToken(reason);
}

function historyDetail(event: WorkflowScheduleEvent): {
  summary: string;
  sections: Array<{ title: string; items: string[] }>;
} {
  if (event.event_type === "started") {
    return { summary: "Run was started for this occurrence.", sections: [] };
  }
  if (event.event_type === "skipped") {
    return { summary: `${reasonLabel(event.reason)}.`, sections: [] };
  }
  if (event.event_type === "missed") {
    return {
      summary: "Mission Control was not able to process this occurrence inside the active window.",
      sections: [],
    };
  }
  if (event.event_type === "disabled") {
    return { summary: `${reasonLabel(event.reason) || "Schedule disabled"}.`, sections: [] };
  }

  const parsed = parseDetailsJson(event.details_json);
  if (parsed.kind === "issues") {
    return {
      summary: `${parsed.count} validation ${parsed.count === 1 ? "finding" : "findings"} recorded.`,
      sections: parsed.sections,
    };
  }
  if (parsed.kind === "message") {
    return { summary: sanitizeDetailMessage(parsed.message), sections: [] };
  }
  if (parsed.kind === "invalid") {
    return { summary: "Details unavailable.", sections: [] };
  }
  return { summary: "Additional scheduler details were recorded.", sections: [] };
}

function parseDetailsJson(value: string | null):
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "message"; message: string }
  | { kind: "issues"; count: number; sections: Array<{ title: string; items: string[] }> }
  | { kind: "unknown" } {
  if (!value) return { kind: "none" };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      return { kind: "message", message: String((parsed as { message: unknown }).message) };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { issues?: unknown }).issues)) {
      const issues = (parsed as { issues: Array<RunValidationIssue | ScheduleValidationIssue> }).issues;
      const sections = new Map<string, string[]>();
      for (const issue of issues) {
        const title = issueSourceTitle(issue);
        const message = sanitizeDetailMessage(issue.message);
        sections.set(title, [...(sections.get(title) ?? []), message]);
      }
      return {
        kind: "issues",
        count: issues.length,
        sections: [...sections.entries()].map(([title, items]) => ({ title, items })),
      };
    }
    return { kind: "unknown" };
  } catch {
    return { kind: "invalid" };
  }
}

function issueSourceTitle(issue: RunValidationIssue | ScheduleValidationIssue) {
  if ("source" in issue && issue.source) return humanizeToken(issue.source);
  const section = (issue as { section?: string | null }).section;
  if (section) return humanizeToken(section);
  if ("field" in issue && issue.field?.startsWith("kind.")) return "Schedule";
  return "Schedule";
}

function sanitizeDetailMessage(message: string) {
  return message
    .replace(/[A-Za-z]:\\[^\s]+/g, "[path]")
    .replace(/\/[\w./-]+/g, "[path]")
    .slice(0, 240);
}

function historyToneClass(status: WorkflowScheduleStatus) {
  if (status === "started") return "status-pill-success";
  if (status === "failed_to_start") return "status-pill-danger";
  if (status === "skipped" || status === "missed") return "status-pill-warning";
  return "";
}

function nextRunLabel(schedule: WorkflowSchedule) {
  if (!schedule.enabled || !schedule.next_run_at) return "Not scheduled";
  return formatDateTime(schedule.next_run_at);
}

function nextRunHint(schedule: WorkflowSchedule) {
  if (!schedule.enabled || !schedule.next_run_at) return "Disabled drafts do not run until enabled.";
  const timestamp = new Date(schedule.next_run_at).getTime();
  if (Number.isNaN(timestamp)) return "Needs review";
  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(Math.abs(diffMs) / 60_000);
  if (diffMs < 0) return `overdue by ${Math.max(1, diffMinutes)} minutes`;
  if (diffMinutes < 60) return `in ${Math.max(1, diffMinutes)} minutes`;
  return "Displayed in local time";
}

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Needs review";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function parseDatetimeLocalLenient(value: string) {
  try {
    return parseDatetimeLocal(value);
  } catch {
    return null;
  }
}

function timeIsValid(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function humanizeToken(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function safeScheduleName(name: string) {
  return name.trim() || "Untitled schedule";
}

function commandMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}

function commandField(error: unknown) {
  if (error && typeof error === "object" && "field" in error) {
    const field = (error as { field: unknown }).field;
    return typeof field === "string" ? field : "";
  }
  return "";
}
