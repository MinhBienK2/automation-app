import { Square } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { OperationalRunDetail, WorkflowRunSnapshot } from "../../../types/workflow";
import { runStatusLabel } from "../../../lib/workflowUi";

type RunCenterPageProps = {
  runSnapshots: WorkflowRunSnapshot[];
  focusedRunDetail?: OperationalRunDetail | null;
  error: string;
  onStopRun: (runId: string) => void;
};

export function RunCenterPage({
  runSnapshots,
  focusedRunDetail,
  error,
  onStopRun,
}: RunCenterPageProps) {
  const sortedRuns = [...runSnapshots].sort((left, right) =>
    right.started_at.localeCompare(left.started_at),
  );

  return (
    <section className="app-screen run-center-screen" aria-label="Runs">
      <header className="app-header">
        <div>
          <p className="eyebrow">Execution</p>
          <h1>Runs</h1>
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
        {focusedRunDetail ? (
          <article className="focused-run-detail" aria-label="Selected run detail">
            <header>
              <div>
                <p className="eyebrow">Persisted Run</p>
                <h2>{focusedRunDetail.workflow.name}</h2>
              </div>
              <span className={focusedRunDetail.status === "failed" ? "status-pill status-pill-danger" : "status-pill"}>
                {focusedRunDetail.status}
              </span>
            </header>
            <dl className="detail-list">
              <div>
                <dt>Run ID</dt>
                <dd>{focusedRunDetail.run_id}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatDateTime(focusedRunDetail.started_at)}</dd>
              </div>
              <div>
                <dt>Issue</dt>
                <dd>{focusedRunDetail.sanitized_error_summary ?? "-"}</dd>
              </div>
            </dl>
            <div className="run-step-summary-list">
              {focusedRunDetail.step_summaries.map((step) => (
                <div key={`${step.step_number}-${step.node_id ?? "step"}`} className="run-step-summary">
                  <span>{step.step_number}</span>
                  <strong>{step.action_type}</strong>
                  <span>{step.status}</span>
                  <small>{step.sanitized_error_summary ?? step.node_id ?? "-"}</small>
                </div>
              ))}
            </div>
          </article>
        ) : null}
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
