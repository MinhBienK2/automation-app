import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { WorkflowSchedule, WorkflowScheduleEvent } from "../../../types/workflow";

type ScheduleHistoryDrawerProps = {
  open: boolean;
  schedule: WorkflowSchedule | null;
  events: WorkflowScheduleEvent[];
  onOpenWorkflow?: (workflowId: string) => void;
  onClose: () => void;
};

export function ScheduleHistoryDrawer({
  open,
  schedule,
  events,
  onOpenWorkflow,
  onClose,
}: ScheduleHistoryDrawerProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="workflow-dialog schedule-history-dialog">
        <DialogHeader>
          <p className="eyebrow">Schedule</p>
          <DialogTitle>Schedule History</DialogTitle>
          <DialogDescription>{schedule?.name || ""}</DialogDescription>
        </DialogHeader>
        <div className="schedule-history-list">
          {events.length === 0 ? (
            <p className="muted">No events recorded yet.</p>
          ) : (
            events.map((event) => (
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
    </Dialog>
  );
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
