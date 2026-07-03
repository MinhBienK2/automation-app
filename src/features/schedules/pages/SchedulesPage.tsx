import { CalendarClock, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowSummary,
} from "../../../types/workflow";
import { ScheduleFormDialog } from "../components/ScheduleFormDialog";
import { ScheduleHistoryDrawer } from "../components/ScheduleHistoryDrawer";

type ScheduleDialogMode = "create" | "edit" | null;

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

  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) =>
        right.created_at.localeCompare(left.created_at),
      ),
    [events],
  );

  const editingSchedule = useMemo(() => {
    if (dialogMode === "edit" && editingScheduleId) {
      return schedules.find((s) => s.id === editingScheduleId) || null;
    }
    return null;
  }, [dialogMode, editingScheduleId, schedules]);

  function openCreateDialog() {
    setDialogMode("create");
    setEditingScheduleId(null);
  }

  function openEditDialog(schedule: WorkflowSchedule) {
    setDialogMode("edit");
    setEditingScheduleId(schedule.id);
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingScheduleId(null);
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

      <ScheduleFormDialog
        open={Boolean(dialogMode)}
        mode={dialogMode}
        scheduleId={editingScheduleId}
        schedule={editingSchedule}
        workflows={workflows}
        onCreateSchedule={onCreateSchedule}
        onUpdateSchedule={onUpdateSchedule}
        onClose={closeDialog}
      />

      <ScheduleHistoryDrawer
        open={Boolean(historySchedule)}
        schedule={historySchedule}
        events={sortedEvents}
        onOpenWorkflow={onOpenWorkflow}
        onClose={() => setHistorySchedule(null)}
      />
    </section>
  );
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
