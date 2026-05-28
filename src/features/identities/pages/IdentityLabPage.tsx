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
  IdentityLabHistoricalDetail,
  IdentityLabManagedDetail,
  IdentityLabOverview,
  IdentityLabTarget,
  ManagedIdentitySummary,
} from "../../../types/workflow";
import {
  buildSafeIdentityFields,
  formatIdentityBytes,
  formatIdentityDateTime,
  identityEvidenceCountLabel,
  identityTitle,
  retainedSessionLabel,
  sessionModeLabel,
} from "./identityPresentation";

type IdentityLabPageProps = {
  overview: IdentityLabOverview | null;
  loading: boolean;
  error: string;
  selectedIdentityId: string | null;
  onRefresh: () => void;
  onSelect: (workflowId: string, identityId: string) => void;
  onOpenEvidence: (workflowId: string, identityId: string) => void;
  onOpenRun: (runId: string) => void;
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
  onOpenEvidence,
  onOpenRun,
  onOpenWorkflow,
  onOpenWorkflowSettings,
  onCloseRetainedSession,
  onResetIdentity,
  onOpenIdentityTarget,
}: IdentityLabPageProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closePending, setClosePending] = useState(false);
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

  async function confirmCloseRetainedSession() {
    if (!detail?.session.profile_name) return;
    setClosePending(true);
    try {
      await onCloseRetainedSession(detail.workflow_ref.id, detail.session.profile_name);
      setCloseDialogOpen(false);
    } finally {
      setClosePending(false);
    }
  }

  return (
    <section className="app-screen identity-lab-screen" aria-label="Identity Lab">
      <header className="app-header">
        <div>
          <p className="eyebrow">Identity Workspace</p>
          <h1>Identity Lab</h1>
          <p className="muted">
            {overview ? `Last refreshed ${formatIdentityDateTime(overview.generated_at)}.` : "Loading managed identities."}
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
        <Metric label="Managed identities" value={overview?.counts.managed_identities ?? 0} />
        <Metric label="Retained Sessions" value={overview?.counts.active_retained_sessions ?? 0} />
        <Metric label="Recent Failures" value={overview?.counts.identities_with_recent_failures ?? 0} />
        {overview?.counts.identities_with_warnings ? (
          <Metric label="Warnings" value={overview.counts.identities_with_warnings} />
        ) : null}
      </section>
      {overview?.data_warnings.length ? (
        <div className="identity-warning-list">
          {overview.data_warnings.map((warning) => (
            <p className="field-warning" key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
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
            <ManagedIdentityDetailView
              detail={detail}
              onOpenEvidence={onOpenEvidence}
              onOpenRun={onOpenRun}
              onOpenWorkflow={onOpenWorkflow}
              onOpenWorkflowSettings={onOpenWorkflowSettings}
              onRequestCloseSession={() => setCloseDialogOpen(true)}
              onRequestReset={() => setResetDialogOpen(true)}
              onOpenIdentityTarget={onOpenIdentityTarget}
            />
          ) : historicalDetail ? (
            <HistoricalIdentityDetailView
              detail={historicalDetail}
              onOpenEvidence={onOpenEvidence}
              onOpenRun={onOpenRun}
              onOpenWorkflow={onOpenWorkflow}
            />
          ) : (
            <Empty title="Select an identity" />
          )}
        </section>
      </div>
      {detail?.session.profile_name ? (
        <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Retained Session</p>
              <DialogTitle>Close retained session</DialogTitle>
              <DialogDescription>
                This closes only the in-memory retained browser context for {identityTitle(detail)}.
                It does not delete profile data, does not delete cookies/login state, does not delete
                workflow settings, does not delete evidence, and does not delete historical runs.
                Run from selected may be unavailable until this workflow creates a new retained session.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={closePending}
                onClick={() => setCloseDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={closePending}
                onClick={() => {
                  void confirmCloseRetainedSession();
                }}
              >
                Close Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {detail ? (
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Identity</p>
              <DialogTitle>Reset browser identity</DialogTitle>
              <DialogDescription>
                Resetting {identityTitle(detail)} ({detail.identity_ref.id}) means the identity id,
                profile directory, and fingerprint seed will rotate for {detail.workflow_ref.name}.
                Non-storage preferences such as proxy, locale, and fingerprint font settings may be
                preserved by the backend. Historical runs and evidence remain unchanged.
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

function ManagedIdentityDetailView({
  detail,
  onOpenEvidence,
  onOpenRun,
  onOpenWorkflow,
  onOpenWorkflowSettings,
  onRequestCloseSession,
  onRequestReset,
  onOpenIdentityTarget,
}: {
  detail: IdentityLabManagedDetail;
  onOpenEvidence: (workflowId: string, identityId: string) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenWorkflowSettings: (workflowId: string) => void;
  onRequestCloseSession: () => void;
  onRequestReset: () => void;
  onOpenIdentityTarget: (target: IdentityLabTarget) => void;
}) {
  const safeObservedFields = buildSafeIdentityFields(detail.latest_observed?.fields ?? []);

  return (
    <div className="identity-detail-body">
      <header>
        <Fingerprint aria-hidden="true" />
        <div>
          <h2>{identityTitle(detail)}</h2>
          <p className="muted identity-detail-kicker">
            <span>Managed current identity</span>
            <span className="identity-mono">{detail.identity_ref.id}</span>
            <span>{detail.workflow_ref.name}</span>
          </p>
        </div>
      </header>
      <div className="identity-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenEvidence(detail.workflow_ref.id, detail.identity_ref.id)}
        >
          Open Evidence
        </Button>
        {detail.last_run ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenRun(detail.last_run?.run_id ?? "")}
          >
            Open Last Run
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={() => onOpenWorkflow(detail.workflow_ref.id)}>
          Open Workflow
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenWorkflowSettings(detail.workflow_ref.id)}
        >
          Open Workflow Settings
        </Button>
        {detail.actions.can_close_retained_session && detail.session.profile_name ? (
          <Button type="button" variant="secondary" onClick={onRequestCloseSession}>
            Close Retained Session
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={!detail.actions.can_reset_identity}
          onClick={onRequestReset}
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
      <Section title="Session Continuity">
        <dl className="identity-definition-list">
          <div><dt>Retained session</dt><dd>{retainedSessionLabel(detail.session)}</dd></div>
          <div><dt>Profile action scope</dt><dd>Close only releases in-memory browser context.</dd></div>
        </dl>
      </Section>
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
            <div><dt>Observed</dt><dd>{formatIdentityDateTime(detail.latest_observed.observed_at)}</dd></div>
            {safeObservedFields.map((field) => (
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
          <div><dt>Wrapper</dt><dd>{detail.diagnostics.wrapper_version ? `Wrapper ${detail.diagnostics.wrapper_version}` : "Unavailable"}</dd></div>
          <div><dt>GeoIP</dt><dd>{detail.diagnostics.geoip_available ? "Available" : "Unavailable"}</dd></div>
          <div><dt>Headed Display</dt><dd>{detail.diagnostics.headed_display_available ? "Available" : "Unavailable"}</dd></div>
          <div><dt>Fonts</dt><dd>{detail.diagnostics.font_status}</dd></div>
          {detail.diagnostics.profile ? (
            <>
              <div><dt>Profile size</dt><dd>{formatIdentityBytes(detail.diagnostics.profile.approximate_size_bytes)}</dd></div>
              <div><dt>Profile session</dt><dd>{detail.diagnostics.profile.active_session ? "Active session" : "Inactive"}</dd></div>
            </>
          ) : null}
        </dl>
      </Section>
      <Section title="Evidence">
        <p className="muted">{identityEvidenceCountLabel(detail.evidence_summary.total)}</p>
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
  );
}

function HistoricalIdentityDetailView({
  detail,
  onOpenEvidence,
  onOpenRun,
  onOpenWorkflow,
}: {
  detail: IdentityLabHistoricalDetail;
  onOpenEvidence: (workflowId: string, identityId: string) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
}) {
  const safeObservedFields = buildSafeIdentityFields(detail.observed_fields);

  return (
    <div className="identity-detail-body">
      <header>
        <Fingerprint aria-hidden="true" />
        <div>
          <h2>Historical Identity Reference</h2>
          <p className="muted identity-detail-kicker">
            <span>Read-only historical reference</span>
            <span className="identity-mono">{detail.identity_ref.id}</span>
            {detail.workflow_ref ? <span>{detail.workflow_ref.name}</span> : null}
          </p>
        </div>
      </header>
      <p className="field-warning">
        This identity is no longer attached to current workflow settings. Current workflows may have a different active identity.
      </p>
      <div className="identity-actions">
        {detail.evidence_id && detail.workflow_ref ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenEvidence(detail.workflow_ref?.id ?? "", detail.identity_ref.id)}
          >
            Open Related Evidence
          </Button>
        ) : null}
        {detail.run_id ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenRun(detail.run_id ?? "")}
          >
            Open Related Run
          </Button>
        ) : null}
        {detail.workflow_ref ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenWorkflow(detail.workflow_ref?.id ?? "")}
          >
            Open Related Workflow
          </Button>
        ) : null}
      </div>
      <Section title="Observed Fields">
        {safeObservedFields.length ? (
          <dl className="identity-definition-list">
            {safeObservedFields.map((field) => (
              <div key={field.key}><dt>{field.key}</dt><dd>{String(field.value)}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="muted">No bounded observed fields are available for this reference.</p>
        )}
      </Section>
    </div>
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
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      <span>
        <strong>{identity.identity_ref.display_name ?? identity.identity_ref.id}</strong>
        <small>{identity.workflow_ref.name} / {identity.short_identity_id}</small>
      </span>
      <span>
        {identity.persona_label ?? "Persona unavailable"}
        <small>{sessionModeLabel(identity.session_mode, identity.profile_reuse)}</small>
      </span>
      <span className={identity.retained_session.active ? "status-pill status-pill-on" : "status-pill"}>
        {retainedSessionLabel(identity.retained_session)}
      </span>
      {identity.recent_failures_24h > 0 ? (
        <span className="status-pill status-pill-danger">{identity.recent_failures_24h} failure</span>
      ) : identity.warning_badges.length ? (
        <span className="status-pill status-pill-warning">{identity.warning_badges.length} warning</span>
      ) : (
        <ShieldCheck aria-hidden="true" />
      )}
      {selected ? <span className="identity-row-selected-marker">Selected</span> : null}
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
