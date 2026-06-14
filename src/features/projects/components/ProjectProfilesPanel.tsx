import { useState, useEffect } from "react";
import { Plus, Trash2, Fingerprint, Pencil } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { IconButton } from "../../../components/ui/icon-button";
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
  ProjectEnvironmentInput,
  WorkflowSettingsBrowserLaunch,
  WorkflowWebRtcPolicy,
  WorkflowHumanPreset,
} from "../../../types/workflow";

type ProjectProfilesPanelProps = {
  project: Project | null;
  projectEnvironments: ProjectEnvironment[];
  workflows: WorkflowSummary[];
  overview: any; // Keep signature compatibility
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSelectIdentity: (workflowId: string, identityId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenWorkflowSettings: (workflowId: string) => void;
  onCloseRetainedSession: (workflowId: string, profileName: string) => void;
  onResetIdentity: (workflowId: string) => void | Promise<void>;
  onOpenIdentityTarget: (target: any) => void;
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
    error,
    onCreateProjectEnvironment,
    onUpdateProjectEnvironment,
    onDeleteProjectEnvironment,
    onOpenWorkflow,
  } = props;

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [browserLaunchDraft, setBrowserLaunchDraft] = useState<WorkflowSettingsBrowserLaunch | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const selectedEnv = projectEnvironments.find((e) => e.id === selectedEnvId) || null;
  const associatedWorkflows = selectedEnv ? workflows.filter((w) => w.environment_id === selectedEnv.id) : [];

  // Sync environment changes & name/launch draft when the selected environment changes
  useEffect(() => {
    if (selectedEnv) {
      setProfileNameDraft(selectedEnv.name);
      setBrowserLaunchDraft(selectedEnv.browser_launch);
    } else {
      setProfileNameDraft("");
      setBrowserLaunchDraft(null);
    }
  }, [selectedEnv?.id, selectedEnv?.name]);

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
    if (!selectedEnvId) return;
    await onDeleteProjectEnvironment(selectedEnvId);
    setDeleteDialogOpen(false);
    setSelectedEnvId(null);
  }

  return (
    <section className="app-screen workflow-list-screen" aria-label="Profiles workspace">
      <div role="group" aria-label="Browser Profiles" style={{ display: "contents" }}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Project Settings</p>
          <h1>Browser Profiles</h1>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Profile summary">
            <span>{projectEnvironments.length} profiles</span>
          </div>
          <Button shape="pill" type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus aria-hidden="true" />
            Add profile
          </Button>
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </header>

      <section className="workflow-library" aria-label="Browser profiles list">
        {projectEnvironments.length === 0 ? (
          <div className="empty-state panel" style={{ minHeight: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Fingerprint aria-hidden="true" style={{ width: "36px", height: "36px", color: "var(--app-muted)", marginBottom: "12px" }} />
            <h2>No profiles configured</h2>
            <p className="muted">Add a profile to start setting up browser configurations.</p>
          </div>
        ) : (
          projectEnvironments.map((env) => {
            const count = workflows.filter((w) => w.environment_id === env.id).length;
            return (
              <Card className="workflow-card" key={env.id}>
                <div className="workflow-card-main">
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "40px",
                      height: "40px",
                      borderRadius: "6px",
                      background: "rgba(50, 211, 230, 0.06)",
                      border: "1px solid rgba(50, 211, 230, 0.15)"
                    }}>
                      <Fingerprint style={{ width: "20px", height: "20px", color: "var(--app-accent)" }} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--app-text)" }}>{env.name}</h2>
                      <p className="muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
                        {count === 0 ? "Not used" : `Used by ${count} workflow${count === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="row-actions">
                  <IconButton
                    label={`Configure profile ${env.name}`}
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSelectedEnvId(env.id);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Delete profile ${env.name}`}
                    type="button"
                    variant="destructive"
                    disabled={count > 0}
                    tooltip={count > 0 ? "Profile is used by workflows" : `Delete profile ${env.name}`}
                    onClick={() => {
                      setSelectedEnvId(env.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="workflow-dialog" style={{ width: "min(640px, calc(100vw - 32px))", maxHeight: "calc(100vh - 100px)", display: "flex", flexDirection: "column" }}>
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Fingerprint style={{ color: "var(--app-accent)" }} />
              Profile Configuration: {selectedEnv?.name}
            </DialogTitle>
            <DialogDescription>
              Configure browser options, proxy settings, WebRTC policy, and custom fonts.
            </DialogDescription>
          </DialogHeader>

          {selectedEnv && browserLaunchDraft && (
            <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px", margin: "16px 0", display: "flex", flexDirection: "column", gap: "20px" }}>
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

              {/* Associated Workflows */}
              <SettingsFieldGroup
                title="Associated Workflows"
                description="Workflows utilizing this browser profile."
              >
                {associatedWorkflows.length === 0 ? (
                  <p className="muted settings-field-group-wide" style={{ fontSize: "13px", margin: 0 }}>
                    This profile is not used by any workflows.
                  </p>
                ) : (
                  <div className="settings-field-group-wide" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {associatedWorkflows.map((w) => (
                      <div
                        key={w.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#0b1016",
                          border: "1px solid #233240"
                        }}
                      >
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--app-text)" }}>{w.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onOpenWorkflow(w.id);
                            setEditDialogOpen(false);
                          }}
                        >
                          Open Workflow
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
          )}

          <DialogFooter className="form-actions" style={{ borderTop: "1px solid #233240", paddingTop: "16px", marginTop: "auto" }}>
            <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!hasChanges} onClick={async () => {
              await handleSaveProfile();
              setEditDialogOpen(false);
            }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      </div>
    </section>
  );
}
