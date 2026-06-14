import { useState, useEffect } from "react";
import { Fingerprint } from "lucide-react";
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
import { EnvironmentVariablesEditor, type EditorVariable } from "./EnvironmentVariablesEditor";
import type {
  BrowserProfile,
  WorkflowSummary,
  BrowserProfileInput,
  WorkflowSettingsBrowserLaunch,
  WorkflowWebRtcPolicy,
  WorkflowHumanPreset,
} from "../../../types/workflow";

type ProfileEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEnv: BrowserProfile | null;
  workflows: WorkflowSummary[];
  onUpdateBrowserProfile: (profileId: string, input: Partial<BrowserProfileInput>) => Promise<void>;
  onOpenWorkflow: (workflowId: string) => void;
};

export function ProfileEditDialog({
  open,
  onOpenChange,
  selectedEnv,
  workflows,
  onUpdateBrowserProfile,
  onOpenWorkflow,
}: ProfileEditDialogProps) {
  const [activeTab, setActiveTab] = useState<"browser" | "env">("browser");
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [browserLaunchDraft, setBrowserLaunchDraft] = useState<WorkflowSettingsBrowserLaunch | null>(null);
  const [environmentDraft, setEnvironmentDraft] = useState<EditorVariable[]>([]);

  const associatedWorkflows = selectedEnv ? workflows.filter((w) => w.browser_profile_id === selectedEnv.id) : [];

  useEffect(() => {
    if (open) {
      setActiveTab("browser");
    }
  }, [open]);

  useEffect(() => {
    if (selectedEnv) {
      setProfileNameDraft(selectedEnv.name);
      setBrowserLaunchDraft(selectedEnv.browser_launch);
      const vars = selectedEnv.environment?.variables ?? [];
      setEnvironmentDraft(
        vars.map((v) => ({
          name: v.name,
          value_type: v.value_type,
          value: v.value,
          persist: Boolean(v.persist),
        }))
      );
    } else {
      setProfileNameDraft("");
      setBrowserLaunchDraft(null);
      setEnvironmentDraft([]);
    }
  }, [selectedEnv?.id, selectedEnv?.name, open]);

  const nameChanged = selectedEnv && profileNameDraft.trim() !== selectedEnv.name;
  const launchChanged = selectedEnv && JSON.stringify(browserLaunchDraft) !== JSON.stringify(selectedEnv.browser_launch);
  const envChanged = selectedEnv && JSON.stringify(environmentDraft) !== JSON.stringify(
    (selectedEnv.environment?.variables ?? []).map((v) => ({
      name: v.name,
      value_type: v.value_type,
      value: v.value,
      persist: Boolean(v.persist),
    }))
  );
  const hasChanges = nameChanged || launchChanged || envChanged;

  async function handleSaveProfile() {
    if (!selectedEnv) return;
    const updates: Partial<BrowserProfileInput> = {};
    if (nameChanged) {
      updates.name = profileNameDraft.trim();
    }
    if (launchChanged && browserLaunchDraft) {
      updates.browser_launch = browserLaunchDraft;
    }
    if (envChanged) {
      updates.environment = {
        variables: environmentDraft.map((v) => ({
          name: v.name.trim(),
          value_type: v.value_type,
          value: v.value,
          persist: v.persist,
        })),
      };
    }
    if (Object.keys(updates).length > 0) {
      await onUpdateBrowserProfile(selectedEnv.id, updates);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="workflow-settings-dialog" style={{ width: "min(1000px, calc(100vw - 48px))", maxHeight: "min(800px, calc(100vh - 48px))", height: "min(700px, calc(100vh - 64px))", display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto" }}>
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
          <div className="workflow-settings-body" style={{ margin: "16px 0", minHeight: 0 }}>
            <nav className="workflow-settings-sidebar" role="tablist">
              <Button
                type="button"
                className="workflow-settings-tab"
                data-active={activeTab === "browser" ? "true" : "false"}
                role="tab"
                variant={activeTab === "browser" ? "default" : "ghost"}
                aria-selected={activeTab === "browser"}
                onClick={() => setActiveTab("browser")}
              >
                Browser Configuration
              </Button>
              <Button
                type="button"
                className="workflow-settings-tab"
                data-active={activeTab === "env" ? "true" : "false"}
                role="tab"
                variant={activeTab === "env" ? "default" : "ghost"}
                aria-selected={activeTab === "env"}
                onClick={() => setActiveTab("env")}
              >
                Environment Variables
              </Button>
            </nav>

            <section className="workflow-settings-content" role="tabpanel" style={{ paddingRight: "8px" }}>
              {activeTab === "browser" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
                                onOpenChange(false);
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
              ) : (
                <EnvironmentVariablesEditor
                  variables={environmentDraft}
                  onChange={setEnvironmentDraft}
                  showPersistOptions={true}
                />
              )}
            </section>
          </div>
        )}

        <DialogFooter className="form-actions" style={{ borderTop: "1px solid #233240", paddingTop: "16px", marginTop: "auto" }}>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!hasChanges} onClick={async () => {
            await handleSaveProfile();
            onOpenChange(false);
          }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
