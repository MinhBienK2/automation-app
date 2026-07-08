import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
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
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col gap-4">
        <DialogHeader className="border-b border-base-300 pb-2">
          <p className="eyebrow">Schedule</p>
          <DialogTitle className="font-bold text-base-content">Schedule History</DialogTitle>
          <DialogDescription className="text-secondary text-xs mt-0.5">{schedule?.name || ""}</DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-1 overflow-y-auto pr-1 flex-1 min-h-0">
          {events.length === 0 ? (
            <p className="text-secondary text-xs italic py-6 text-center">No events recorded yet.</p>
          ) : (
            events.map((event) => {
              const status = event.event_type;
              const badgeVariant = status === "started" ? "success" : (status === "failed_to_start" || status === "missed") ? "failure" : "secondary";
              return (
                <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-base-200 border border-base-300" key={event.id}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-0.5">
                      <Badge variant={badgeVariant} className="badge-xs uppercase tracking-wider font-semibold w-fit mb-1">
                        {statusLabel(event.event_type)}
                      </Badge>
                      <span className="text-secondary text-[11px] font-medium">{formatDateTime(event.scheduled_for)}</span>
                    </div>
                    {onOpenWorkflow ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenWorkflow(event.workflow_id)}
                        className="btn-xs rounded-md"
                      >
                        Open Workflow
                      </Button>
                    ) : null}
                  </div>
                  {event.reason ? (
                    <p className="text-error text-xs bg-error/5 p-2 rounded border border-error/10 font-mono mt-1 whitespace-pre-wrap leading-relaxed">
                      {event.reason}
                    </p>
                  ) : null}
                </div>
              );
            })
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
