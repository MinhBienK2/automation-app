import { Activity, AlertTriangle, CalendarClock, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import type {
  OperationsOverview,
  OperationsNavigationTarget,
  OverviewAttentionItem,
  OverviewLiveRun,
  OverviewUpcomingSchedule,
  CloakBrowserDiagnostics,
} from "../../../types/workflow";

type OperationsOverviewPageProps = {
  overview: OperationsOverview | null;
  loading: boolean;
  error: string;
  focus?: "attention" | "recent_evidence" | "live_runs" | null;
  onRefresh: () => void;
  onOpenWorkflows: () => void;
  onNavigate: (target: OperationsNavigationTarget) => void;
  diagnostics: CloakBrowserDiagnostics | null;
  diagnosticsLoading: boolean;
  diagnosticsError: string;
  onRefreshDiagnostics: () => void | Promise<void>;
};

export function OperationsOverviewPage({
  overview,
  loading,
  error,
  focus,
  onRefresh,
  onOpenWorkflows,
  onNavigate,
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  onRefreshDiagnostics,
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
            Open Projects
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
          {focus === "attention" ? (
            <p className="overview-focus-note">Attention focus active</p>
          ) : null}
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

        <Panel title="System Health" icon={<ShieldCheck aria-hidden="true" />}>
          {diagnosticsError ? (
            <p className="field-error" role="alert">
              {diagnosticsError}
            </p>
          ) : null}
          {diagnosticsLoading && !diagnostics ? (
            <p className="muted">Loading system readiness...</p>
          ) : null}
          {diagnostics ? (
            <div className="settings-readiness-grid" style={{ gridTemplateColumns: "1fr", gap: "8px" }}>
              <ReadinessItem
                label="CloakBrowser"
                value={
                  diagnostics.binary.installed
                    ? `Installed ${diagnostics.binary.version || ""}`
                    : "Not installed"
                }
                tone={diagnostics.binary.installed ? "ready" : "attention"}
              />
              <ReadinessItem
                label="GeoIP"
                value={diagnostics.geoip_available ? "GeoIP available" : "GeoIP unavailable"}
                tone={diagnostics.geoip_available ? "ready" : "attention"}
              />
              <ReadinessItem
                label="Headed display"
                value={diagnostics.headed_display.available ? "Available" : "Unavailable"}
                tone={diagnostics.headed_display.available ? "ready" : "attention"}
              />
              <ReadinessItem
                label="Fingerprint fonts"
                value={statusLabel(diagnostics.font_checklist.status)}
                tone={diagnostics.font_checklist.status === "error" ? "attention" : "ready"}
              />
            </div>
          ) : null}
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void onRefreshDiagnostics();
              }}
            >
              Refresh Health
            </Button>
          </div>
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


function ReadinessItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "attention" | "neutral";
}) {
  return (
    <div className={`settings-readiness-item settings-readiness-item-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
