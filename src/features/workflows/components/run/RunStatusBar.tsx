import type { RunState } from "../../../../types/workflow";
import { Badge } from "../../../../components/ui/badge";
import { runStatusLabel } from "../../../../lib/workflowUi";

type RunStatusBarProps = {
  state: RunState;
  error: string;
  hasBlockingIssues?: boolean;
};

export function RunStatusBar({
  state,
  error,
  hasBlockingIssues = false,
}: RunStatusBarProps) {
  const label = runStatusLabel(state, {
    appError: error,
    hasBlockingIssues,
  });

  return (
    <div className="run-status">
      <span>Status</span>
      <Badge variant={state.status === "failed" ? "destructive" : "default"}>
        {label}
      </Badge>
    </div>
  );
}
