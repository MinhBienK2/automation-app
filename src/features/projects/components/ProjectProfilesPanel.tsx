import { useState, useEffect } from "react";
import { Fingerprint, RefreshCw, ShieldCheck, XCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import type {
  Project,
  ProjectEnvironment,
  WorkflowSummary,
  IdentityLabOverview,
  IdentityLabTarget,
} from "../../../types/workflow";

type ProjectProfilesPanelProps = {
  project: Project | null;
  projectEnvironments: ProjectEnvironment[];
  workflows: WorkflowSummary[];
  overview: IdentityLabOverview | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSelectIdentity: (workflowId: string, identityId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenWorkflowSettings: (workflowId: string) => void;
  onCloseRetainedSession: (workflowId: string, profileName: string) => void;
  onResetIdentity: (workflowId: string) => void | Promise<void>;
  onOpenIdentityTarget: (target: IdentityLabTarget) => void;
  onCreateProjectEnvironment: (
    projectId: string,
    input: { name: string; description?: string | null },
  ) => Promise<void>;
  onUpdateProjectEnvironment: (
    environmentId: string,
    input: { name: string },
  ) => Promise<void>;
  onDeleteProjectEnvironment: (environmentId: string) => Promise<void>;
};

export function ProjectProfilesPanel({
  project,
  projectEnvironments,
  workflows,
  overview,
  loading,
  error,
  onRefresh,
  onSelectIdentity,
  onOpenWorkflow,
  onOpenWorkflowSettings,
  onCloseRetainedSession,
  onResetIdentity,
  onOpenIdentityTarget,
  onCreateProjectEnvironment,
  onUpdateProjectEnvironment,
  onDeleteProjectEnvironment,
}: ProjectProfilesPanelProps) {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);

  const selectedEnv = projectEnvironments.find((e) => e.id === selectedEnvId) || projectEnvironments[0] || null;
  const usingWorkflows = selectedEnv ? workflows.filter((w) => w.environment_id === selectedEnv.id) : [];
  const selectedWorkflow =
    usingWorkflows.find((w) => w.id === overview?.selected?.workflow_ref?.id) ||
    usingWorkflows[0] ||
    (overview?.selected?.workflow_ref ? { id: overview.selected.workflow_ref.id, name: overview.selected.workflow_ref.name, environment_id: selectedEnv?.id } as any : null);

  // Sync selectedEnvId when overview.selected changes (e.g., via external navigation)
  useEffect(() => {
    const activeWorkflowId = overview?.selected?.workflow_ref?.id;
    if (activeWorkflowId) {
      const activeWf = workflows.find((w) => w.id === activeWorkflowId);
      if (activeWf?.environment_id && activeWf.environment_id !== selectedEnvId) {
        setSelectedEnvId(activeWf.environment_id);
      }
    }
  }, [overview?.selected?.workflow_ref?.id, workflows, selectedEnvId]);

  // Sync environment changes & name draft when the selected environment changes
  useEffect(() => {
    if (selectedEnv) {
      setSelectedEnvId(selectedEnv.id);
      setProfileNameDraft(selectedEnv.name);
    } else {
      setSelectedEnvId(null);
      setProfileNameDraft("");
    }
  }, [selectedEnv?.id, selectedEnv?.name]);

  // Auto-select new active workflow safely without loops
  useEffect(() => {
    if (selectedEnv && overview && !loading) {
      const currentUsingWorkflows = workflows.filter((w) => w.environment_id === selectedEnv.id);
      const currentSelectedWfId = overview.selected?.workflow_ref?.id;
      const isCurrentWfInEnv = currentUsingWorkflows.some((w) => w.id === currentSelectedWfId);
      if (!isCurrentWfInEnv) {
        const firstWf = currentUsingWorkflows[0];
        const identityId = firstWf?.environment_id ? selectedEnv.browser_launch?.identity_id : null;
        if (firstWf && identityId) {
          onSelectIdentity(firstWf.id, identityId);
        }
      }
    }
  }, [selectedEnv?.id, selectedEnv?.browser_launch?.identity_id, workflows, overview?.selected?.workflow_ref?.id, loading, onSelectIdentity]);

  const nameChanged = selectedEnv && profileNameDraft.trim() !== selectedEnv.name;

  async function handleAddProfile() {
    if (!project || !newProfileName.trim()) return;
    await onCreateProjectEnvironment(project.id, { name: newProfileName.trim(), description: null });
    setNewProfileName("");
    setCreateDialogOpen(false);
  }

  async function handleRenameProfile() {
    if (!selectedEnv || !profileNameDraft.trim()) return;
    await onUpdateProjectEnvironment(selectedEnv.id, { name: profileNameDraft.trim() });
  }

  async function handleDeleteProfile() {
    if (!selectedEnv) return;
    await onDeleteProjectEnvironment(selectedEnv.id);
    setDeleteDialogOpen(false);
    setSelectedEnvId(projectEnvironments[0]?.id || null);
  }

  async function confirmResetIdentity() {
    const detail = overview?.selected?.kind === "managed" ? overview.selected : null;
    if (!detail) return;
    setResetPending(true);
    try {
      await onResetIdentity(detail.workflow_ref.id);
      setResetDialogOpen(false);
    } finally {
      setResetPending(false);
    }
  }

  const detail = overview?.selected?.kind === "managed" ? overview.selected : null;
  const historicalDetail = overview?.selected?.kind === "historical" ? overview.selected : null;

  return (
    <section className="identity-lab-screen" aria-label="Profiles workspace">
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="identity-workspace" role="group" aria-label="Browser Profiles">
        <section className="panel identity-list" aria-label="Browser profiles list">
          <div className="projects-list-tools" style={{ padding: "8px 0", display: "flex", gap: "8px" }}>
            <Button shape="pill" type="button" onClick={() => setCreateDialogOpen(true)}>
              <Plus aria-hidden="true" />
              Add profile
            </Button>
            <Button shape="pill" type="button" variant="secondary" onClick={onRefresh} disabled={loading} aria-label="Refresh profiles">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </Button>
          </div>
          {projectEnvironments.map((env) => {
            const active = selectedEnvId === env.id;
            const count = workflows.filter((w) => w.environment_id === env.id).length;
            const matches = overview?.items.filter((item) => {
              const wf = workflows.find((w) => w.id === item.workflow_ref.id);
              return wf?.environment_id === env.id;
            }) || [];
            const hasSession = matches.some((item) => item.retained_session.active);
            const failures = matches.reduce((sum, item) => sum + item.recent_failures_24h, 0);

            return (
              <button
                key={env.id}
                className={active ? "identity-row identity-row-active" : "identity-row"}
                type="button"
                onClick={() => setSelectedEnvId(env.id)}
              >
                <span>
                  <strong>{env.name}</strong>
                  <small>{count === 0 ? "Not used" : `Used by ${count} workflow${count === 1 ? "" : "s"}`}</small>
                </span>
                <span className={hasSession ? "status-pill status-pill-on" : "status-pill"}>
                  {hasSession ? "retained" : "closed"}
                </span>
                {failures > 0 ? (
                  <span className="status-pill status-pill-danger">{failures} failure</span>
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
              </button>
            );
          })}
        </section>

        <section className="panel identity-detail" aria-label="Profile detail">
          {selectedEnv ? (
            <div className="identity-detail-body">
              <header style={{ borderBottom: "1px solid #233240", paddingBottom: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <label className="field" style={{ flex: 1, margin: 0 }}>
                    <span>Profile name</span>
                    <Input
                      aria-label={`Profile name for ${selectedEnv.name}`}
                      value={profileNameDraft}
                      onChange={(e) => setProfileNameDraft(e.target.value)}
                    />
                  </label>
                  <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                    <Button type="button" size="sm" disabled={!nameChanged} onClick={handleRenameProfile}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      aria-label={`Delete profile ${selectedEnv.name}`}
                      disabled={usingWorkflows.length > 0}
                      title={usingWorkflows.length > 0 ? "Profile is used by workflows" : undefined}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              </header>

              {usingWorkflows.length === 0 && !detail && !historicalDetail ? (
                <div className="empty-state empty-state-compact">
                  <XCircle aria-hidden="true" />
                  <h3>No workflows are using this profile</h3>
                </div>
              ) : (
                <>
                  {usingWorkflows.length > 1 && (
                    <div className="project-collection-tabs" style={{ margin: "12px 0" }}>
                      {usingWorkflows.map((wf) => (
                        <Button
                          key={wf.id}
                          type="button"
                          variant={selectedWorkflow?.id === wf.id ? "default" : "ghost"}
                          onClick={() => {
                            const identityId = wf.environment_id ? selectedEnv?.browser_launch?.identity_id : null;
                            if (identityId) onSelectIdentity(wf.id, identityId);
                          }}
                        >
                          {wf.name}
                        </Button>
                      ))}
                    </div>
                  )}

                  {detail && detail.workflow_ref.id === selectedWorkflow?.id ? (
                    <>
                      <div className="identity-actions" style={{ marginTop: "12px" }}>
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

                      <section className="identity-detail-section">
                        <h3>Configured Posture</h3>
                        <dl className="identity-definition-list">
                          {detail.configured_posture.map((item) => (
                            <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                          ))}
                        </dl>
                      </section>

                      <section className="identity-detail-section">
                        <h3>Latest Observed</h3>
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
                      </section>

                      <section className="identity-detail-section">
                        <h3>Diagnostics</h3>
                        <dl className="identity-definition-list">
                          <div><dt>Binary</dt><dd>{detail.diagnostics.binary_installed ? "Installed" : "Missing"}</dd></div>
                          <div><dt>GeoIP</dt><dd>{detail.diagnostics.geoip_available ? "Available" : "Unavailable"}</dd></div>
                          <div><dt>Headed Display</dt><dd>{detail.diagnostics.headed_display_available ? "Available" : "Unavailable"}</dd></div>
                          <div><dt>Fonts</dt><dd>{detail.diagnostics.font_status}</dd></div>
                        </dl>
                      </section>

                      <section className="identity-detail-section">
                        <h3>Rotation History</h3>
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
                      </section>
                    </>
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
                      <section className="identity-detail-section">
                        <h3>Observed Fields</h3>
                        {historicalDetail.observed_fields.length ? (
                          <dl className="identity-definition-list">
                            {historicalDetail.observed_fields.map((field) => (
                              <div key={field.key}><dt>{field.key}</dt><dd>{String(field.value)}</dd></div>
                            ))}
                          </dl>
                        ) : (
                          <p className="muted">No bounded observed fields are available for this reference.</p>
                        )}
                      </section>
                    </div>
                  ) : (
                    <div className="empty-state empty-state-compact">
                      <XCircle aria-hidden="true" />
                      <h3>Loading identity details...</h3>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="empty-state empty-state-compact">
              <XCircle aria-hidden="true" />
              <h3>Select a profile</h3>
            </div>
          )}
        </section>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add browser profile</DialogTitle>
            <DialogDescription>Create a fresh browser profile for this project.</DialogDescription>
          </DialogHeader>
          <label className="field">
            <span>Profile name</span>
            <Input
              aria-label="Profile name"
              autoFocus
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddProfile}>
              Create profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete browser profile</DialogTitle>
            <DialogDescription>Do you want to delete this browser profile?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteProfile}>
              Delete profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                onClick={confirmResetIdentity}
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
