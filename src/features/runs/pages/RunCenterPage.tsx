import { Square } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { WorkflowRunSnapshot } from "../../../types/workflow";
import { runStatusLabel } from "../../../lib/workflowUi";

type RunCenterPageProps = {
  runSnapshots: WorkflowRunSnapshot[];
  error: string;
  onStopRun: (runId: string) => void;
};

export function RunCenterPage({
  runSnapshots,
  error,
  onStopRun,
}: RunCenterPageProps) {
  const sortedRuns = [...runSnapshots].sort((left, right) =>
    right.started_at.localeCompare(left.started_at),
  );

  return (
    <section className="app-screen run-center-screen" aria-label="Run Center">
      <header className="app-header">
        <div>
          <p className="eyebrow">Execution</p>
          <h1>Run Center</h1>
        </div>
        <div className="header-stats" aria-label="Run summary">
          <span>{sortedRuns.filter((run) => run.state.status === "running").length} active</span>
          <span>{sortedRuns.length} session runs</span>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <section className="run-center-panel panel">
        {sortedRuns.length === 0 ? (
          <div className="empty-state">
            <h2>No runs in this session</h2>
            <p className="muted">Started workflow runs will appear here.</p>
          </div>
        ) : (
          <div className="run-center-table-wrap">
            <table className="run-center-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Step</th>
                  <th>Started</th>
                  <th>Issue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.map((run) => (
                  <tr key={run.run_id}>
                    <td>
                      <strong>{run.workflow_name}</strong>
                      <small>{run.run_id}</small>
                    </td>
                    <td>{run.source}</td>
                    <td>
                      <span className={run.state.status === "running" ? "status-pill status-pill-on" : "status-pill"}>
                        {runStatusLabel(run.state)}
                      </span>
                    </td>
                    <td>{run.state.current_step_number ?? "-"}</td>
                    <td>{formatDateTime(run.started_at)}</td>
                    <td>{run.state.error?.reason ? compactIssue(run.state.error.reason) : "-"}</td>
                    <td>
                      {run.state.status === "running" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => onStopRun(run.run_id)}
                        >
                          <Square aria-hidden="true" />
                          Stop {run.workflow_name} run
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function compactIssue(reason: string) {
  const firstLine = reason.split("\n")[0] ?? reason;
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
}
