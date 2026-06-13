import { useState, type ReactNode } from "react";
import { Fingerprint, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type {
  IdentityLabOverview,
  IdentityLabTarget,
  ManagedIdentitySummary,
} from "../../../types/workflow";

type IdentityLabPageProps = {
  overview: IdentityLabOverview | null;
  loading: boolean;
  error: string;
  selectedIdentityId: string | null;
  onRefresh: () => void;
  onSelect: (workflowId: string, identityId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenWorkflowSettings: (workflowId: string) => void;
  onCloseRetainedSession: (workflowId: string, profileName: string) => void;
  onResetIdentity: (workflowId: string) => void | Promise<void>;
  onOpenIdentityTarget: (target: IdentityLabTarget) => void;
};

export function IdentityLabPage({
  overview,
  loading,
  error,
  selectedIdentityId,
  onRefresh,
  onSelect,
  onOpenWorkflow,
  onOpenWorkflowSettings,
  onCloseRetainedSession,
  onResetIdentity,
  onOpenIdentityTarget,
}: IdentityLabPageProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const detail = overview?.selected?.kind === "managed" ? overview.selected : null;
  const historicalDetail = overview?.selected?.kind === "historical" ? overview.selected : null;

  async function confirmResetIdentity() {
    if (!detail) return;
    setResetPending(true);
    try {
      await onResetIdentity(detail.workflow_ref.id);
      setResetDialogOpen(false);
    } finally {
      setResetPending(false);
    }
  }

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
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!detail.actions.can_reset_identity}
                  onClick={() => setResetDialogOpen(true)}
                >
                  Reset Identity
                </Button>
              </div>
              {detail.session.reset_blocked_reason ? (
                <p className="field-warning">{detail.session.reset_blocked_reason}</p>
              ) : null}
              {detail.actions.reset_disabled_reason ? (
                <p className="muted">{detail.actions.reset_disabled_reason}</p>
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

              <Section title="Rotation History">
                {detail.rotation_history.length ? (
                  <div className="identity-history-list">
                    {detail.rotation_history.map((entry, index) => (
                      <button
                        key={`${entry.previous_identity_id ?? "unknown"}-${index}`}
                        type="button"
                        onClick={() => {
                          if (!entry.previous_identity_id) return;
                          onOpenIdentityTarget({
                            type: "historical",
                            identity_id: entry.previous_identity_id,
                            workflow_id: detail.workflow_ref.id,
                          });
                        }}
                      >
                        <strong>{entry.previous_identity_id ?? "Previous identity unavailable"}</strong>
                        <span>{entry.message}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No identity rotations recorded.</p>
                )}
              </Section>
            </div>
          ) : historicalDetail ? (
            <div className="identity-detail-body">
              <header>
                <Fingerprint aria-hidden="true" />
                <div>
                  <h2>Historical Identity Reference</h2>
                  <p className="muted">{historicalDetail.identity_ref.id}</p>
                </div>
              </header>
              <p className="field-warning">
                This identity is read-only and is no longer attached to current workflow settings.
              </p>
              <div className="identity-actions">
                {historicalDetail.workflow_ref ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onOpenWorkflow(historicalDetail.workflow_ref?.id ?? "")}
                  >
                    Open Related Workflow
                  </Button>
                ) : null}
              </div>
              <Section title="Observed Fields">
                {historicalDetail.observed_fields.length ? (
                  <dl className="identity-definition-list">
                    {historicalDetail.observed_fields.map((field) => (
                      <div key={field.key}><dt>{field.key}</dt><dd>{String(field.value)}</dd></div>
                    ))}
                  </dl>
                ) : (
                  <p className="muted">No bounded observed fields are available for this reference.</p>
                )}
              </Section>
            </div>
          ) : (
            <Empty title="Select an identity" />
          )}
        </section>
      </div>
      {detail ? (
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Identity</p>
              <DialogTitle>Reset browser identity</DialogTitle>
              <DialogDescription>
                This rotates the identity id, profile directory, and fingerprint seed for {detail.workflow_ref.name}.
                Historical runs and evidence remain unchanged.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={resetPending}
                onClick={() => setResetDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={resetPending}
                onClick={() => {
                  void confirmResetIdentity();
                }}
              >
                Reset Identity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
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
