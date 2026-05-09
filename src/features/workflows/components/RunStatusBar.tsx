import type { ElectronRunEvent, RunState } from "../../../types/workflow";
import { Badge } from "../../../components/ui/badge";
import { runStatusLabel } from "../../../lib/workflowUi";

type RunStatusBarProps = {
  state: RunState;
  error: string;
  hasBlockingIssues?: boolean;
  runEvents?: ElectronRunEvent[];
};

export function RunStatusBar({
  state,
  error,
  hasBlockingIssues = false,
  runEvents = [],
}: RunStatusBarProps) {
  const failure =
    state.status === "failed" && state.error
      ? `Failed at step ${state.error.step_number}: ${state.error.reason}`
      : "";
  const label = runStatusLabel(state, {
    appError: error,
    hasBlockingIssues,
  });
  const recentRunEvents = runEvents.slice(-4);

  return (
    <div className="run-status">
      <span>Status</span>
      <Badge variant={state.status === "failed" ? "destructive" : "default"}>
        {label}
      </Badge>
      {failure ? <p>{failure}</p> : null}
      {error ? <p>{error}</p> : null}
      {recentRunEvents.length ? (
        <ol className="run-event-stream" aria-label="Recent run events">
          {recentRunEvents.map((event, index) => (
            <li key={`${event.runId}-${event.type}-${event.createdAt}-${index}`}>
              <span className="run-event-type">{event.type}</span>
              {runEventDetail(event) ? (
                <span className="run-event-detail">{runEventDetail(event)}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function runEventDetail(event: ElectronRunEvent) {
  const actionType = event.payload.actionType;
  if (typeof actionType === "string") return actionType;
  const status = event.payload.status;
  if (typeof status === "string") return status;
  const reason = event.payload.reason;
  if (typeof reason === "string") return reason;
  return "";
}
