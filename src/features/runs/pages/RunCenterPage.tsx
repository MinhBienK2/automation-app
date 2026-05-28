import { Square } from "lucide-react";
import { StaleTargetPanel } from "../../../components/patterns/StaleTargetPanel";
import { Button } from "../../../components/ui/button";
import type { StaleTargetDescriptor } from "../../../lib/missionControlNavigation";
import type {
  IdentityLabTarget,
  OperationalRunDetail,
  WorkflowRunSnapshot,
} from "../../../types/workflow";
import { runStatusLabel } from "../../../lib/workflowUi";
import {
  buildRunCenterSummary,
  compactRunIssueSummary,
  formatRunDateTime,
  runSourceLabel,
  runStatusTone,
  sortRunSnapshotsByStartedAt,
} from "../lib/runCenterPresentation";

type RunCenterPageProps = {
  runSnapshots: WorkflowRunSnapshot[];
  focusedRunDetail?: OperationalRunDetail | null;
  missingRunId?: string | null;
  staleTarget?: StaleTargetDescriptor | null;
  error: string;
  onStopRun: (runId: string) => void;
  onRefreshTarget?: () => void;
  onOpenList?: () => void;
  onOpenOverview?: () => void;
  onClearStaleTarget?: () => void;
  onOpenEvidence?: (runId: string) => void;
  onOpenWorkflow?: (workflowId: string) => void;
  onOpenIdentity?: (target: IdentityLabTarget) => void;
};

export function RunCenterPage({
  runSnapshots,
  focusedRunDetail,
  missingRunId,
  staleTarget,
  error,
  onStopRun,
  onRefreshTarget,
  onOpenList,
  onOpenOverview,
  onClearStaleTarget,
  onOpenEvidence,
  onOpenWorkflow,
  onOpenIdentity,
}: RunCenterPageProps) {
  const sortedRuns = sortRunSnapshotsByStartedAt(runSnapshots);
  const summary = buildRunCenterSummary(runSnapshots);
  const focusedRunSnapshot = focusedRunDetail
    ? sortedRuns.find((run) => run.run_id === focusedRunDetail.run_id)
    : null;
  const focusedRunSource = focusedRunDetail?.source ?? focusedRunSnapshot?.source ?? null;

  return (
    <section className="app-screen run-center-screen" aria-label="Runs">
      <header className="app-header">
        <div>
          <p className="eyebrow">Execution</p>
          <h1>Runs</h1>
        </div>
        <div className="header-stats" aria-label="Run summary">
          <span>{summary.activeLabel}</span>
          <span>{summary.sessionLabel}</span>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <section className="run-center-panel panel">
        {!focusedRunDetail && staleTarget ? (
          <StaleTargetPanel
            descriptor={staleTarget}
            onRefresh={onRefreshTarget}
            onOpenList={onOpenList}
            onOpenOverview={onOpenOverview}
            onClear={onClearStaleTarget}
          />
        ) : !focusedRunDetail && missingRunId ? (
          <article
            className="focused-run-detail focused-run-missing"
            aria-label="Run target unavailable"
          >
            <header>
              <div>
                <p className="eyebrow">Stale target</p>
                <h2>Run target unavailable</h2>
              </div>
              <span className="status-pill">Needs refresh</span>
            </header>
            <p className="muted">
              The requested run is not available in the current bounded session
              list. Existing session runs remain visible below.
            </p>
            <dl className="detail-list">
              <div>
                <dt>Requested id</dt>
                <dd>{missingRunId}</dd>
              </div>
            </dl>
          </article>
        ) : null}
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
                <dt>Source</dt>
                <dd>
                  {focusedRunSource ? runSourceLabel(focusedRunSource) : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{focusedRunDetail.status}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatRunDateTime(focusedRunDetail.started_at)}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{formatRunDateTime(focusedRunDetail.finished_at)}</dd>
              </div>
              <div>
                <dt>Identity</dt>
                <dd>
                  {focusedRunDetail.identity?.display_name ||
                    focusedRunDetail.identity?.id ||
                    "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Issue</dt>
                <dd>{focusedRunDetail.sanitized_error_summary ?? "-"}</dd>
              </div>
            </dl>
            <div className="run-detail-actions">
              {onOpenEvidence ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenEvidence(focusedRunDetail.run_id)}
                >
                  Open Evidence
                </Button>
              ) : null}
              {onOpenWorkflow ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenWorkflow(focusedRunDetail.workflow.id)}
                >
                  Open Workflow
                </Button>
              ) : null}
              {onOpenIdentity && focusedRunDetail.identity?.id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    onOpenIdentity({
                      type: "managed",
                      workflow_id: focusedRunDetail.workflow.id,
                      identity_id: focusedRunDetail.identity?.id ?? "",
                    })
                  }
                >
                  Open Identity
                </Button>
              ) : null}
            </div>
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
                    <td>{runSourceLabel(run.source)}</td>
                    <td>
                      <span className={statusPillClassName(run)}>
                        {runStatusLabel(run.state)}
                      </span>
                    </td>
                    <td>{run.state.current_step_number ?? "-"}</td>
                    <td>{formatRunDateTime(run.started_at)}</td>
                    <td>
                      {run.state.error?.reason
                        ? compactRunIssueSummary(run.state.error.reason)
                        : "-"}
                    </td>
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

function statusPillClassName(run: WorkflowRunSnapshot) {
  const tone = runStatusTone(run);
  if (tone === "active") return "status-pill status-pill-on";
  if (tone === "danger") return "status-pill status-pill-danger";
  return "status-pill";
}
