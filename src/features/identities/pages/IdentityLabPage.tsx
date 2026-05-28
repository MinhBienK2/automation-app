import { Fingerprint, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type {
  IdentityLabOverview,
  ManagedIdentitySummary,
  OperationsNavigationTarget,
} from "../../../types/workflow";

type IdentityLabPageProps = {
  overview: IdentityLabOverview | null;
  loading: boolean;
  error: string;
  selectedIdentityId: string | null;
  onRefresh: () => void;
  onSelect: (workflowId: string, identityId: string) => void;
  onOpenEvidence: (workflowId: string, identityId: string) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkflowSettings: (workflowId: string) => void;
  onCloseRetainedSession: (workflowId: string, profileName: string) => void;
  onNavigate: (target: OperationsNavigationTarget) => void;
};

export function IdentityLabPage({
  overview,
  loading,
  error,
  selectedIdentityId,
  onRefresh,
  onSelect,
  onOpenEvidence,
  onOpenRun,
  onOpenWorkflowSettings,
  onCloseRetainedSession,
}: IdentityLabPageProps) {
  const detail = overview?.selected?.kind === "managed" ? overview.selected : null;
  return (
    <section className="app-screen identity-lab-screen" aria-label="Identity Lab">
      <header className="app-header">
        <div>
          <p className="eyebrow">Identity Workspace</p>
          <h1>Identity Lab</h1>
          <p className="muted">
            {overview ? `Last refreshed ${formatDateTime(overview.generated_at)}.` : "Loading managed identities."}
          </p>
        </div>
        <div className="page-header-actions">
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <section className="identity-kpi-grid" aria-label="Identity metrics">
        <Metric label="Managed" value={overview?.counts.managed_identities ?? 0} />
        <Metric label="Retained Sessions" value={overview?.counts.active_retained_sessions ?? 0} />
        <Metric label="Recent Failures" value={overview?.counts.identities_with_recent_failures ?? 0} />
      </section>
      <div className="identity-workspace">
        <section className="panel identity-list" aria-label="Managed identities">
          {loading ? <Empty title="Loading identities" /> : null}
          {overview?.items.length ? (
            overview.items.map((identity) => (
              <IdentityRow
                key={`${identity.workflow_ref.id}-${identity.identity_ref.id}`}
                identity={identity}
                selected={identity.identity_ref.id === selectedIdentityId}
                onSelect={() => onSelect(identity.workflow_ref.id, identity.identity_ref.id)}
              />
            ))
          ) : loading ? null : (
            <Empty title="No managed identities" />
          )}
        </section>
        <section className="panel identity-detail" aria-label="Identity detail">
          {detail ? (
            <div className="identity-detail-body">
              <header>
                <Fingerprint aria-hidden="true" />
                <div>
                  <h2>{detail.identity_ref.display_name ?? detail.identity_ref.id}</h2>
                  <p className="muted">{detail.workflow_ref.name}</p>
                </div>
              </header>
              <div className="identity-actions">
                <Button type="button" variant="secondary" onClick={() => onOpenEvidence(detail.workflow_ref.id, detail.identity_ref.id)}>
                  Open Evidence
                </Button>
                {detail.last_run ? (
                  <Button type="button" variant="secondary" onClick={() => onOpenRun(detail.last_run?.run_id ?? "")}>
                    Open Last Run
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" onClick={() => onOpenWorkflowSettings(detail.workflow_ref.id)}>
                  Open Workflow Settings
                </Button>
                {detail.actions.can_close_retained_session && detail.session.profile_name ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onCloseRetainedSession(detail.workflow_ref.id, detail.session.profile_name ?? "")}
                  >
                    Close Retained Session
                  </Button>
                ) : null}
              </div>
              {detail.session.reset_blocked_reason ? (
                <p className="field-warning">{detail.session.reset_blocked_reason}</p>
              ) : null}
              <Section title="Configured Posture">
                <dl className="identity-definition-list">
                  {detail.configured_posture.map((item) => (
                    <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                  ))}
                </dl>
              </Section>
              <Section title="Latest Observed">
                {detail.latest_observed ? (
                  <dl className="identity-definition-list">
                    <div><dt>Run</dt><dd>{detail.latest_observed.run_id}</dd></div>
                    {detail.latest_observed.fields.map((field) => (
                      <div key={field.key}><dt>{field.key}</dt><dd>{String(field.value)}</dd></div>
                    ))}
                  </dl>
                ) : (
                  <p className="muted">No observed browser identity evidence yet.</p>
                )}
              </Section>
              <Section title="Diagnostics">
                <dl className="identity-definition-list">
                  <div><dt>Binary</dt><dd>{detail.diagnostics.binary_installed ? "Installed" : "Missing"}</dd></div>
                  <div><dt>GeoIP</dt><dd>{detail.diagnostics.geoip_available ? "Available" : "Unavailable"}</dd></div>
                  <div><dt>Headed Display</dt><dd>{detail.diagnostics.headed_display_available ? "Available" : "Unavailable"}</dd></div>
                  <div><dt>Fonts</dt><dd>{detail.diagnostics.font_status}</dd></div>
                </dl>
              </Section>
            </div>
          ) : (
            <Empty title="Select an identity" />
          )}
        </section>
      </div>
    </section>
  );
}

function IdentityRow({
  identity,
  selected,
  onSelect,
}: {
  identity: ManagedIdentitySummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={selected ? "identity-row identity-row-active" : "identity-row"}
      type="button"
      onClick={onSelect}
    >
      <span>
        <strong>{identity.identity_ref.display_name ?? identity.identity_ref.id}</strong>
        <small>{identity.workflow_ref.name} / {identity.short_identity_id}</small>
      </span>
      <span>{identity.persona_label ?? "Persona unavailable"}</span>
      <span className={identity.retained_session.active ? "status-pill status-pill-on" : "status-pill"}>
        {identity.retained_session.active ? "retained" : "closed"}
      </span>
      {identity.recent_failures_24h > 0 ? (
        <span className="status-pill status-pill-danger">{identity.recent_failures_24h} failure</span>
      ) : (
        <ShieldCheck aria-hidden="true" />
      )}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="identity-detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div className="empty-state empty-state-compact">
      <XCircle aria-hidden="true" />
      <h3>{title}</h3>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
