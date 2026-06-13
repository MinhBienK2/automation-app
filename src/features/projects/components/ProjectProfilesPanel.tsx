import { useState, useEffect, useRef } from "react";
import { RefreshCw, ShieldCheck, XCircle, Plus, Trash2, Fingerprint } from "lucide-react";
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
import { Select } from "../../../components/ui/select";
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import { SwitchField } from "../../../components/ui/switch";
import type {
  Project,
  ProjectEnvironment,
  WorkflowSummary,
  IdentityLabOverview,
  IdentityLabTarget,
  ProjectEnvironmentInput,
  WorkflowSettingsBrowserLaunch,
  WorkflowWebRtcPolicy,
  WorkflowHumanPreset,
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
    input: Partial<ProjectEnvironmentInput>,
  ) => Promise<void>;
  onDeleteProjectEnvironment: (environmentId: string) => Promise<void>;
};

export function ProjectProfilesPanel(props: ProjectProfilesPanelProps) {
  const {
    project,
    projectEnvironments,
    workflows,
    overview,
    loading,
    error,
    onRefresh,
    onSelectIdentity,
    onCreateProjectEnvironment,
    onUpdateProjectEnvironment,
    onDeleteProjectEnvironment,
  } = props;

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [browserLaunchDraft, setBrowserLaunchDraft] = useState<WorkflowSettingsBrowserLaunch | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedEnv = projectEnvironments.find((e) => e.id === selectedEnvId) || projectEnvironments[0] || null;
  const usingWorkflows = selectedEnv ? workflows.filter((w) => w.environment_id === selectedEnv.id) : [];
  const selectedMatches = selectedEnv ? overview?.items.filter((item) => {
    const wf = workflows.find((w) => w.id === item.workflow_ref.id);
    return wf?.environment_id === selectedEnv.id;
  }) || [] : [];
  const hasSession = selectedMatches.some((item) => item.retained_session.active);

  const lastSyncedWorkflowIdRef = useRef<string | null>(null);

  // Sync selectedEnvId when overview.selected changes (e.g., via external navigation)
  useEffect(() => {
    const activeWorkflowId = overview?.selected?.workflow_ref?.id || null;
    if (activeWorkflowId !== lastSyncedWorkflowIdRef.current) {
      lastSyncedWorkflowIdRef.current = activeWorkflowId;
      if (activeWorkflowId) {
        const activeWf = workflows.find((w) => w.id === activeWorkflowId);
        if (activeWf?.environment_id && activeWf.environment_id !== selectedEnvId) {
          setSelectedEnvId(activeWf.environment_id);
        }
      }
    }
  }, [overview?.selected?.workflow_ref?.id, workflows, selectedEnvId]);

  // Sync environment changes & name/launch draft when the selected environment changes
  useEffect(() => {
    if (selectedEnv) {
      setSelectedEnvId(selectedEnv.id);
      setProfileNameDraft(selectedEnv.name);
      setBrowserLaunchDraft(selectedEnv.browser_launch);
    } else {
      setSelectedEnvId(null);
      setProfileNameDraft("");
      setBrowserLaunchDraft(null);
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
  const launchChanged = selectedEnv && JSON.stringify(browserLaunchDraft) !== JSON.stringify(selectedEnv.browser_launch);
  const hasChanges = nameChanged || launchChanged;

  async function handleAddProfile() {
    if (!project || !newProfileName.trim()) return;
    await onCreateProjectEnvironment(project.id, { name: newProfileName.trim(), description: null });
    setNewProfileName("");
    setCreateDialogOpen(false);
  }

  async function handleSaveProfile() {
    if (!selectedEnv) return;
    const updates: Partial<ProjectEnvironmentInput> = {};
    if (nameChanged) {
      updates.name = profileNameDraft.trim();
    }
    if (launchChanged && browserLaunchDraft) {
      updates.browser_launch = browserLaunchDraft;
    }
    if (Object.keys(updates).length > 0) {
      await onUpdateProjectEnvironment(selectedEnv.id, updates);
    }
  }

  async function handleDeleteProfile() {
    if (!selectedEnv) return;
    await onDeleteProjectEnvironment(selectedEnv.id);
    setDeleteDialogOpen(false);
    setSelectedEnvId(projectEnvironments[0]?.id || null);
  }


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
          {selectedEnv && browserLaunchDraft ? (
            <div className="identity-detail-body" style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto", paddingRight: "8px" }}>
                <header style={{
                  borderBottom: "1px solid #233240",
                  paddingBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "48px",
                      height: "48px",
                      borderRadius: "8px",
                      background: "rgba(50, 211, 230, 0.08)",
                      border: "1px solid rgba(50, 211, 230, 0.2)"
                    }}>
                      <Fingerprint style={{ width: "24px", height: "24px", color: "var(--app-accent)" }} />
                    </div>
                    <div>
                      <h2 style={{
                        margin: 0,
                        fontSize: "1.2rem",
                        fontWeight: 600,
                        color: "var(--app-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}>
                        {profileNameDraft || selectedEnv.name}
                        {hasChanges && (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 500,
                            color: "var(--app-warning)",
                            border: "1px solid rgba(244, 183, 64, 0.3)",
                            background: "rgba(244, 183, 64, 0.08)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            textTransform: "uppercase"
                          }}>
                            Unsaved Changes
                          </span>
                        )}
                      </h2>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
                        <span className={hasSession ? "status-pill status-pill-on" : "status-pill"}>
                          {hasSession ? "retained" : "closed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button type="button" size="sm" disabled={!hasChanges} onClick={handleSaveProfile}>
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
                </header>

                <div className="profile-settings-form" style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* General Settings */}
                  <SettingsFieldGroup
                    title="General Settings"
                    description="Modify the profile display name."
                  >
                    <label className="field settings-field-group-wide">
                      <span>Profile name</span>
                      <Input
                        aria-label={`Profile name for ${selectedEnv.name}`}
                        value={profileNameDraft}
                        onChange={(e) => setProfileNameDraft(e.target.value)}
                      />
                    </label>
                  </SettingsFieldGroup>
                {/* Proxy Settings */}
                <SettingsFieldGroup
                  title="Proxy Configuration"
                  description="Setup a proxy server for the browser profile session."
                >
                  <SwitchField
                    checked={browserLaunchDraft.proxy_enabled}
                    label="Enable Proxy"
                    onCheckedChange={(checked) =>
                      setBrowserLaunchDraft((current) => current ? { ...current, proxy_enabled: checked } : null)
                    }
                  />
                  {browserLaunchDraft.proxy_enabled && (
                    <>
                      <label className="field settings-field-group-wide">
                        <span>Proxy Server</span>
                        <Input
                          aria-label="Proxy Server"
                          value={browserLaunchDraft.proxy_server ?? ""}
                          placeholder="http://host:port"
                          onChange={(e) =>
                            setBrowserLaunchDraft((current) => current ? { ...current, proxy_server: e.target.value } : null)
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Proxy Username</span>
                        <Input
                          aria-label="Proxy Username"
                          value={browserLaunchDraft.proxy_username ?? ""}
                          onChange={(e) =>
                            setBrowserLaunchDraft((current) => current ? { ...current, proxy_username: e.target.value } : null)
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Proxy Password</span>
                        <Input
                          aria-label="Proxy Password"
                          type="password"
                          value={browserLaunchDraft.proxy_password ?? ""}
                          onChange={(e) =>
                            setBrowserLaunchDraft((current) => current ? { ...current, proxy_password: e.target.value } : null)
                          }
                        />
                      </label>
                    </>
                  )}
                </SettingsFieldGroup>

                {/* Browser Posture Settings */}
                <SettingsFieldGroup
                  title="Browser Posture"
                  description="Manage localization, location GeoIP, and headless/humanization options."
                >
                  <SwitchField
                    checked={browserLaunchDraft.headless}
                    label="Headless mode"
                    onCheckedChange={(checked) =>
                      setBrowserLaunchDraft((current) => current ? { ...current, headless: checked } : null)
                    }
                  />
                  <SwitchField
                    checked={browserLaunchDraft.humanize}
                    label="Humanize movements"
                    onCheckedChange={(checked) =>
                      setBrowserLaunchDraft((current) => current ? { ...current, humanize: checked } : null)
                    }
                  />
                  {browserLaunchDraft.humanize && (
                    <label className="field">
                      <span>Human Preset</span>
                      <Select
                        aria-label="Human Preset"
                        value={browserLaunchDraft.human_preset}
                        onChange={(e) =>
                          setBrowserLaunchDraft((current) => current ? { ...current, human_preset: e.target.value as WorkflowHumanPreset } : null)
                        }
                      >
                        <option value="default">Default</option>
                        <option value="careful">Careful</option>
                      </Select>
                    </label>
                  )}
                  <SwitchField
                    checked={browserLaunchDraft.geoip}
                    label="Determine location by GeoIP"
                    onCheckedChange={(checked) =>
                      setBrowserLaunchDraft((current) => current ? { ...current, geoip: checked } : null)
                    }
                  />
                  {!browserLaunchDraft.geoip && (
                    <>
                      <label className="field">
                        <span>Timezone</span>
                        <Input
                          aria-label="Timezone"
                          value={browserLaunchDraft.timezone ?? ""}
                          placeholder="e.g. Asia/Ho_Chi_Minh"
                          onChange={(e) =>
                            setBrowserLaunchDraft((current) => current ? { ...current, timezone: e.target.value } : null)
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Locale</span>
                        <Input
                          aria-label="Locale"
                          value={browserLaunchDraft.locale ?? ""}
                          placeholder="e.g. vi-VN"
                          onChange={(e) =>
                            setBrowserLaunchDraft((current) => current ? { ...current, locale: e.target.value } : null)
                          }
                        />
                      </label>
                    </>
                  )}
                </SettingsFieldGroup>

                {/* WebRTC Policy Settings */}
                <SettingsFieldGroup
                  title="WebRTC Policy"
                  description="Choose WebRTC IP handling strategy."
                >
                  <label className="field">
                    <span>WebRTC Policy</span>
                    <Select
                      aria-label="WebRTC Policy"
                      value={browserLaunchDraft.webrtc_policy}
                      onChange={(e) =>
                        setBrowserLaunchDraft((current) => current ? { ...current, webrtc_policy: e.target.value as WorkflowWebRtcPolicy } : null)
                      }
                    >
                      <option value="default">Default</option>
                      <option value="auto_proxy_exit_ip">Auto proxy exit IP</option>
                      <option value="explicit_ip">Explicit IP</option>
                      <option value="disabled_if_supported">Disabled</option>
                    </Select>
                  </label>
                  {browserLaunchDraft.webrtc_policy === "explicit_ip" && (
                    <label className="field">
                      <span>Explicit WebRTC IP</span>
                      <Input
                        aria-label="Explicit WebRTC IP"
                        value={browserLaunchDraft.webrtc_ip ?? ""}
                        placeholder="e.g. 1.2.3.4"
                        onChange={(e) =>
                          setBrowserLaunchDraft((current) => current ? { ...current, webrtc_ip: e.target.value } : null)
                        }
                      />
                    </label>
                  )}
                </SettingsFieldGroup>

                {/* Custom Fonts Settings */}
                <SettingsFieldGroup
                  title="Custom Fonts"
                  description="Provide a directory path for custom browser fonts."
                >
                  <label className="field settings-field-group-wide">
                    <span>Custom Fonts Directory</span>
                    <Input
                      aria-label="Custom Fonts Directory"
                      value={browserLaunchDraft.fingerprint_fonts_dir ?? ""}
                      placeholder="e.g. /path/to/fonts"
                      onChange={(e) =>
                        setBrowserLaunchDraft((current) => current ? { ...current, fingerprint_fonts_dir: e.target.value } : null)
                      }
                    />
                  </label>
                </SettingsFieldGroup>
              </div>
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
    </section>
  );
}
