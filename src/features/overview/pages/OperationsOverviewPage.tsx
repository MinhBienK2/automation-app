import { Activity, AlertTriangle, CalendarClock, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Alert } from "../../../components/ui/alert";
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
      <header className="app-header overview-header mb-4">
        <div>
          <p className="eyebrow">Operations Dashboard</p>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-secondary text-xs mt-1">
            {overview
              ? `Today in ${overview.range.timezone_label}. Last refreshed ${formatDateTime(overview.generated_at)}.`
              : "Loading durable operations state."}
          </p>
        </div>
        <div className="page-header-actions flex gap-2">
          <Button type="button" variant="secondary" onClick={onRefresh} className="btn-sm">
            <RefreshCw aria-hidden="true" size={14} />
            Refresh Overview
          </Button>
          <Button type="button" onClick={onOpenWorkflows} className="btn-primary btn-sm">
            Open Projects
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="error" className="mb-4">
          <div>
            <h3 className="font-bold">Overview unavailable</h3>
            <div className="text-xs">{error}</div>
          </div>
          <Button type="button" variant="secondary" onClick={onRefresh} className="btn-xs">
            Retry
          </Button>
        </Alert>
      ) : null}

      {/* KPI Stats using daisyUI Stats component */}
      <section className="stats stats-vertical lg:stats-horizontal shadow w-full bg-base-200 border border-base-300 mb-6" aria-label="Operations metrics">
        <div className="stat p-4">
          <div className="stat-title text-xs text-secondary font-medium uppercase tracking-wider">Active Runs</div>
          <div className="stat-value text-xl font-bold text-primary mt-1">
            {loading && metrics?.active_runs === undefined ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              metrics?.active_runs ?? 0
            )}
          </div>
        </div>
        <div className="stat p-4">
          <div className="stat-title text-xs text-secondary font-medium uppercase tracking-wider">Succeeded Today</div>
          <div className="stat-value text-xl font-bold text-success mt-1">
            {loading && metrics?.succeeded_today === undefined ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              metrics?.succeeded_today ?? 0
            )}
          </div>
        </div>
        <div className="stat p-4">
          <div className="stat-title text-xs text-secondary font-medium uppercase tracking-wider">Attention Needed</div>
          <div className="stat-value text-xl font-bold text-error mt-1">
            {loading && metrics?.attention_today === undefined ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              metrics?.attention_today ?? 0
            )}
          </div>
        </div>
        <div className="stat p-4">
          <div className="stat-title text-xs text-secondary font-medium uppercase tracking-wider">Upcoming Schedules</div>
          <div className="stat-value text-xl font-bold text-base-content/80 mt-1">
            {loading && metrics?.upcoming_schedules === undefined ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              metrics?.upcoming_schedules ?? 0
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Live Operations" icon={<Activity aria-hidden="true" />} count={overview?.live_runs.total}>
          {overview?.live_runs.items.length ? (
            <div className="flex flex-col gap-2 mt-2">
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
            <p className="text-warning text-xs mb-2">Attention focus active</p>
          ) : null}
          {overview?.attention.items.length ? (
            <div className="flex flex-col gap-2 mt-2">
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
            <div className="flex flex-col gap-2 mt-2">
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
            <Alert variant="error" className="text-xs p-2 mb-2">
              {diagnosticsError}
            </Alert>
          ) : null}
          {diagnosticsLoading && !diagnostics ? (
            <div className="flex items-center gap-2 text-secondary text-xs">
              <span className="loading loading-spinner loading-xs" />
              <span>Loading system readiness...</span>
            </div>
          ) : null}
          {diagnostics ? (
            <div className="grid grid-cols-1 gap-2 mt-2">
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
          <div className="flex justify-end mt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void onRefreshDiagnostics();
              }}
              className="btn-xs"
            >
              Refresh Health
            </Button>
          </div>
        </Panel>
      </div>
    </section>
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
    <section className="card bg-base-200 border border-base-300 card-body p-5" aria-label={title}>
      <header className="flex justify-between items-center border-b border-base-300 pb-2 mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2 text-base-content">
          {icon}
          <span>{title}</span>
        </h2>
        {count !== undefined ? (
          <Badge variant="secondary" className="badge-sm font-semibold">
            {count}
          </Badge>
        ) : null}
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
    <button
      className="flex justify-between items-center p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-300 text-left w-full transition-colors cursor-pointer"
      type="button"
      onClick={() => onNavigate(run.navigation_target)}
    >
      <span className="flex flex-col gap-0.5">
        <strong className="text-xs font-semibold text-base-content">{run.workflow_name}</strong>
        <span className="text-[11px] text-secondary">{run.identity_display_name ?? "Identity unavailable"}</span>
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-secondary font-mono">Step {run.current_step_number ?? "-"}</span>
        <Badge variant="running" className="badge-xs uppercase tracking-wider font-semibold">
          {run.status}
        </Badge>
      </div>
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
    <button
      className="flex justify-between items-center p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-300 text-left w-full transition-colors cursor-pointer"
      type="button"
      onClick={() => onNavigate(item.navigation_target)}
    >
      <span className="flex flex-col gap-0.5">
        <strong className="text-xs font-semibold text-base-content">{item.title}</strong>
        <span className="text-[11px] text-secondary">{item.workflow.name}</span>
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-secondary">{item.summary}</span>
        <Badge variant={item.severity === "failure" ? "failure" : "attention"} className="badge-xs uppercase tracking-wider font-semibold">
          {item.severity}
        </Badge>
      </div>
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
    <button
      className="flex justify-between items-center p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-300 text-left w-full transition-colors cursor-pointer"
      type="button"
      onClick={() => onNavigate(schedule.navigation_target)}
    >
      <span className="flex flex-col gap-0.5">
        <strong className="text-xs font-semibold text-base-content">{schedule.schedule_name}</strong>
        <span className="text-[11px] text-secondary">{schedule.workflow_name}</span>
      </span>
      <div className="flex items-center gap-3 text-xs text-secondary">
        <span>{formatDateTime(schedule.next_run_at)}</span>
        <Badge variant="secondary" className="badge-xs uppercase tracking-wider font-semibold">
          {schedule.last_status ?? "ready"}
        </Badge>
      </div>
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 rounded-lg bg-base-100/50 border border-dashed border-base-300 text-center text-secondary">
      <h3 className="text-xs font-semibold text-base-content mb-1">{title}</h3>
      <p className="text-[11px] max-w-[280px] leading-relaxed">{body}</p>
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
  const badgeTone = {
    ready: "badge-success",
    attention: "badge-warning",
    neutral: "badge-neutral",
  }[tone];

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-100 border border-base-300">
      <span className="text-secondary text-xs">{label}</span>
      <span className={`badge ${badgeTone} badge-sm font-semibold`}>{value}</span>
    </div>
  );
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
