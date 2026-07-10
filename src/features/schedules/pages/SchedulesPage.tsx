import { CalendarClock, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { Badge } from "../../../components/ui/badge";
import { Alert } from "../../../components/ui/alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowSummary,
} from "../../../types/workflow";
import { ScheduleFormDialog } from "../components/ScheduleFormDialog";
import { ScheduleHistoryDrawer } from "../components/ScheduleHistoryDrawer";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";

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
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

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
      <header className="app-header flex justify-between items-center mb-4 border-b border-base-300 pb-3">
        <div>
          <p className="eyebrow">Automation</p>
          <h1 className="text-2xl font-bold">Schedules</h1>
        </div>
        <div className="page-header-actions flex gap-3 items-center">
          <Badge variant="secondary" className="badge-sm font-semibold uppercase tracking-wider">
            {schedules.length} schedules
          </Badge>
          <Button type="button" onClick={openCreateDialog} className="btn-primary btn-sm inline-flex items-center gap-1">
            <Plus aria-hidden="true" size={16} />
            <span>New schedule</span>
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="error" className="text-xs p-3 mb-4 animate-fade-in">
          {error}
        </Alert>
      ) : null}

      <section className="card bg-base-200 border border-base-300 card-body p-5 flex flex-col" aria-label="Schedule list">
        {loading ? (
          <div className="flex items-center gap-2 text-secondary text-sm py-8 justify-center">
            <span className="loading loading-spinner loading-sm" />
            <span>Loading schedules...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-secondary">
            <CalendarClock aria-hidden="true" className="w-10 h-10 mb-2 stroke-[1.5]" />
            <h2 className="text-sm font-bold text-base-content mb-1">No schedules yet</h2>
            <p className="text-xs">Create a schedule to run a saved workflow automatically.</p>
          </div>
        ) : (
          <Table className="table-zebra">
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Last result</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  aria-label={`${schedule.name} ${schedule.workflow_name}`}
                  className={focusedScheduleId === schedule.id ? "bg-primary/5 border-l-4 border-l-primary" : ""}
                >
                  <TableCell>
                    <Badge variant={schedule.enabled ? "success" : "secondary"} className="badge-xs uppercase tracking-wider font-semibold">
                      {schedule.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <strong className="text-sm font-semibold text-base-content">{schedule.name}</strong>
                      <span className="text-[11px] text-secondary">{scheduleKindSummary(schedule.kind)}</span>
                      {focusedScheduleId === schedule.id ? (
                        <span className="badge badge-primary badge-xs mt-1 font-semibold uppercase tracking-wider">Selected Target</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{schedule.workflow_name}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(schedule.next_run_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant={schedule.last_status === "started" ? "success" : (schedule.last_status === "failed_to_start" || schedule.last_status === "missed") ? "failure" : "secondary"} className="badge-xs w-fit font-semibold uppercase tracking-wider">
                        {statusLabel(schedule.last_status)}
                      </Badge>
                      {schedule.last_reason ? (
                        <span className="text-[10px] text-error max-w-[180px] truncate" title={schedule.last_reason}>
                          {schedule.last_reason}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end items-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={() => onToggleSchedule(schedule.id, !schedule.enabled)}
                        className="btn-xs rounded-md"
                      >
                        {schedule.enabled ? `Disable ${schedule.name}` : `Enable ${schedule.name}`}
                      </Button>
                      <IconButton
                        label={`Edit ${schedule.name}`}
                        type="button"
                        className="btn-ghost btn-xs text-base-content hover:bg-base-300"
                        onClick={() => openEditDialog(schedule)}
                      >
                        <Pencil aria-hidden="true" size={14} />
                      </IconButton>
                      <IconButton
                        label={`View history for ${schedule.name}`}
                        type="button"
                        className="btn-ghost btn-xs text-base-content hover:bg-base-300"
                        onClick={() => {
                          void openHistory(schedule);
                        }}
                      >
                        <History aria-hidden="true" size={14} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${schedule.name}`}
                        type="button"
                        className="btn-ghost btn-xs text-error hover:bg-error/10"
                        onClick={() => setDeleteCandidateId(schedule.id)}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <ConfirmDialog
        open={deleteCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidateId(null);
        }}
        title="Delete Schedule?"
        description="Are you sure you want to delete this schedule? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deleteCandidateId) {
            await onDeleteSchedule(deleteCandidateId);
            setDeleteCandidateId(null);
          }
        }}
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
