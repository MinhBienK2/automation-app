import { Activity, AlertTriangle, CalendarClock, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import type {
  OperationsOverview,
  OperationsNavigationTarget,
  OverviewAttentionItem,
  OverviewEvidenceItem,
  OverviewLiveRun,
  OverviewUpcomingSchedule,
} from "../../../types/workflow";

type OperationsOverviewPageProps = {
  overview: OperationsOverview | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOpenWorkflows: () => void;
  onNavigate: (target: OperationsNavigationTarget) => void;
};

export function OperationsOverviewPage({
  overview,
  loading,
  error,
  onRefresh,
  onOpenWorkflows,
  onNavigate,
}: OperationsOverviewPageProps) {
  const metrics = overview?.metrics;

  return (
    <section className="app-screen operations-overview-screen" aria-label="Overview">
      <header className="app-header overview-header">
        <div>
          <p className="eyebrow">Operations Dashboard</p>
          <h1>Overview</h1>
          <p className="muted">
            {overview
              ? `Today in ${overview.range.timezone_label}. Last refreshed ${formatDateTime(overview.generated_at)}.`
              : "Loading durable operations state."}
          </p>
        </div>
        <div className="page-header-actions">
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            Refresh Overview
          </Button>
          <Button type="button" onClick={onOpenWorkflows}>
            Open Workflows
          </Button>
        </div>
      </header>

      {error ? (
        <div className="panel overview-error" role="alert">
          <strong>Overview unavailable</strong>
          <p>{error}</p>
          <Button type="button" variant="secondary" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      ) : null}

      <section className="overview-kpi-grid" aria-label="Operations metrics">
        <MetricCard label="Active Runs" value={metrics?.active_runs} tone="active" loading={loading} />
        <MetricCard label="Succeeded Today" value={metrics?.succeeded_today} tone="success" loading={loading} />
        <MetricCard label="Attention Needed" value={metrics?.attention_today} tone="attention" loading={loading} />
        <MetricCard label="Upcoming Schedules" value={metrics?.upcoming_schedules} tone="neutral" loading={loading} />
      </section>

      <div className="overview-grid">
        <Panel title="Live Operations" icon={<Activity aria-hidden="true" />} count={overview?.live_runs.total}>
          {overview?.live_runs.items.length ? (
            <div className="overview-list">
              {overview.live_runs.items.map((run) => (
                <LiveRunRow key={run.run_id} run={run} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState title="No active runs" body="Workflow runs that are currently executing appear here." />
          )}
        </Panel>

        <Panel title="Attention Queue" icon={<AlertTriangle aria-hidden="true" />} count={overview?.attention.total}>
          {overview?.attention.items.length ? (
            <div className="overview-list">
              {overview.attention.items.map((item) => (
                <AttentionRow key={item.id} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState title="No attention items" body="Blocked launches, failed runs, and schedule issues appear here." />
          )}
        </Panel>

        <Panel title="Execution Activity" icon={<ShieldCheck aria-hidden="true" />} count={overview?.activity.length}>
          {overview?.activity.length ? (
            <div className="activity-strip" aria-label="Execution activity buckets">
              {overview.activity.map((bucket) => {
                const total = bucket.succeeded + bucket.failed + bucket.blocked + bucket.schedule_attention;
                return (
                  <div className="activity-bucket" key={bucket.bucket_start_utc}>
                    <span className="activity-hour">{formatHour(bucket.bucket_start_utc)}</span>
                    <span className="activity-bar" aria-label={`${total} events`}>
                      <i className="activity-success" style={{ flexGrow: bucket.succeeded }} />
                      <i className="activity-failed" style={{ flexGrow: bucket.failed }} />
                      <i className="activity-blocked" style={{ flexGrow: bucket.blocked }} />
                      <i className="activity-schedule" style={{ flexGrow: bucket.schedule_attention }} />
                    </span>
                    <span className="activity-caption">
                      {bucket.succeeded} success / {bucket.failed} failed / {bucket.blocked} blocked / {bucket.schedule_attention} schedule
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No activity today" body="Completed, failed, blocked, and schedule attention events appear by hour." />
          )}
        </Panel>

        <Panel title="Recent Evidence" icon={<ShieldCheck aria-hidden="true" />} count={overview?.recent_evidence.total}>
          {overview?.data_warnings.evidence_items_skipped ? (
            <p className="field-warning">
              {overview.data_warnings.evidence_items_skipped} malformed evidence item
              {overview.data_warnings.evidence_items_skipped === 1 ? "" : "s"} skipped.
            </p>
          ) : null}
          {overview?.recent_evidence.items.length ? (
            <div className="overview-list">
              {overview.recent_evidence.items.map((item) => (
                <EvidenceRow key={item.evidence_id} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState title="No evidence metadata" body="Generated screenshot and download metadata appears here after runs finish." />
          )}
        </Panel>

        <Panel title="Upcoming Schedules" icon={<CalendarClock aria-hidden="true" />} count={overview?.upcoming_schedules.total}>
          {overview?.upcoming_schedules.items.length ? (
            <div className="overview-list">
              {overview.upcoming_schedules.items.map((schedule) => (
                <ScheduleRow key={schedule.schedule_id} schedule={schedule} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState title="No upcoming schedules" body="Enabled schedules with a next occurrence appear here." />
          )}
        </Panel>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value?: number;
  tone: "active" | "success" | "attention" | "neutral";
  loading: boolean;
}) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{loading && value === undefined ? "-" : value ?? 0}</strong>
    </article>
  );
}

function Panel({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="panel overview-panel" aria-label={title}>
      <header className="overview-panel-header">
        <h2>{icon}{title}</h2>
        {count !== undefined ? <span className="status-pill">{count}</span> : null}
      </header>
      {children}
    </section>
  );
}

function LiveRunRow({
  run,
  onNavigate,
}: {
  run: OverviewLiveRun;
  onNavigate: (target: OperationsNavigationTarget) => void;
}) {
  return (
    <button className="overview-row" type="button" onClick={() => onNavigate(run.navigation_target)}>
      <span>
        <strong>{run.workflow_name}</strong>
        <small>{run.identity_display_name ?? "Identity unavailable"}</small>
      </span>
      <span>Step {run.current_step_number ?? "-"}</span>
      <span className="status-pill status-pill-on">{run.status}</span>
    </button>
  );
}

function AttentionRow({
  item,
  onNavigate,
}: {
  item: OverviewAttentionItem;
  onNavigate: (target: OperationsNavigationTarget) => void;
}) {
  return (
    <button className="overview-row" type="button" onClick={() => onNavigate(item.navigation_target)}>
      <span>
        <strong>{item.title}</strong>
        <small>{item.workflow.name}</small>
      </span>
      <span>{item.summary}</span>
      <span className={`status-pill ${item.severity === "failure" ? "status-pill-danger" : ""}`}>
        {item.severity}
      </span>
    </button>
  );
}

function EvidenceRow({
  item,
  onNavigate,
}: {
  item: OverviewEvidenceItem;
  onNavigate: (target: OperationsNavigationTarget) => void;
}) {
  return (
    <button
      className="overview-row"
      type="button"
      onClick={() => onNavigate(item.navigation_targets.run ?? item.navigation_targets.workflow ?? { type: "workflow", workflow_id: item.workflow.id })}
    >
      <span>
        <strong>{item.artifact_kind}</strong>
        <small>{item.workflow.name}</small>
      </span>
      <span>{item.relative_path_or_label}</span>
      <span>{item.node_id ?? "-"}</span>
    </button>
  );
}

function ScheduleRow({
  schedule,
  onNavigate,
}: {
  schedule: OverviewUpcomingSchedule;
  onNavigate: (target: OperationsNavigationTarget) => void;
}) {
  return (
    <button className="overview-row" type="button" onClick={() => onNavigate(schedule.navigation_target)}>
      <span>
        <strong>{schedule.schedule_name}</strong>
        <small>{schedule.workflow_name}</small>
      </span>
      <span>{formatDateTime(schedule.next_run_at)}</span>
      <span>{schedule.last_status ?? "ready"}</span>
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state empty-state-compact">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatHour(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit" });
}
