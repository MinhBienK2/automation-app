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
import { Label } from "../../../components/ui/label";
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
  const [saving, setSaving] = useState(false);

  const associatedWorkflows = selectedEnv ? workflows.filter((w) => w.browser_profile_id === selectedEnv.id) : [];

  useEffect(() => {
    if (open) {
      setActiveTab("browser");
    }
  }, [open]);

  useEffect(() => {
    setSaving(false);
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
      <DialogContent className="max-w-4xl max-h-[85vh] h-[650px] grid grid-rows-[auto_1fr_auto] gap-4">
        <DialogHeader className="border-b border-base-300 pb-3">
          <DialogTitle className="flex items-center gap-2 text-primary font-bold">
            <Fingerprint size={20} />
            <span>Profile Configuration: {selectedEnv?.name}</span>
          </DialogTitle>
          <DialogDescription className="text-secondary text-xs mt-0.5">
            Configure browser options, proxy settings, WebRTC policy, and custom fonts.
          </DialogDescription>
        </DialogHeader>

        {selectedEnv && browserLaunchDraft && (
          <div className="flex gap-6 min-h-0 py-2">
            {/* Sidebar Navigation */}
            <ul className="menu bg-base-200 p-2 rounded-box w-full max-w-[220px] shrink-0 gap-1 h-fit" role="tablist">
              <li>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "browser"}
                  onClick={() => setActiveTab("browser")}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg ${activeTab === "browser" ? "active bg-primary text-primary-content" : "text-base-content hover:bg-base-300"}`}
                >
                  Browser Configuration
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "env"}
                  onClick={() => setActiveTab("env")}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg ${activeTab === "env" ? "active bg-primary text-primary-content" : "text-base-content hover:bg-base-300"}`}
                >
                  Environment Variables
                </button>
              </li>
            </ul>

            {/* Content pane */}
            <section className="flex-grow overflow-y-auto pr-2" role="tabpanel">
              {activeTab === "browser" ? (
                <div className="flex flex-col gap-6">
                  {/* General Settings */}
                  <SettingsFieldGroup
                    title="General Settings"
                    description="Modify the profile display name."
                  >
                    <div className="flex flex-col gap-1 w-full mt-2">
                      <Label htmlFor="edit-profile-name">Profile name</Label>
                      <Input
                        id="edit-profile-name"
                        aria-label={`Profile name for ${selectedEnv.name}`}
                        value={profileNameDraft}
                        onChange={(e) => setProfileNameDraft(e.target.value)}
                        className="input-sm border-base-300 w-full"
                      />
                    </div>
                  </SettingsFieldGroup>

                  {/* Associated Workflows */}
                  <SettingsFieldGroup
                    title="Associated Workflows"
                    description="Workflows utilizing this browser profile."
                  >
                    {associatedWorkflows.length === 0 ? (
                      <p className="text-secondary text-xs italic mt-2">
                        This profile is not used by any workflows.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 mt-2 w-full">
                        {associatedWorkflows.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between p-2.5 px-3 rounded-lg bg-base-300 border border-base-300"
                          >
                            <span className="text-xs font-semibold text-base-content">{w.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                onOpenWorkflow(w.id);
                                onOpenChange(false);
                              }}
                              className="btn-xs text-primary hover:bg-primary/10"
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
                    <div className="flex flex-col gap-3 w-full mt-2">
                      <SwitchField
                        checked={browserLaunchDraft.proxy_enabled}
                        label="Enable Proxy"
                        onCheckedChange={(checked) =>
                          setBrowserLaunchDraft((current) => current ? { ...current, proxy_enabled: checked } : null)
                        }
                      />
                      {browserLaunchDraft.proxy_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                          <div className="flex flex-col gap-1 md:col-span-2">
                            <Label htmlFor="proxy-server">Proxy Server</Label>
                            <Input
                              id="proxy-server"
                              aria-label="Proxy Server"
                              value={browserLaunchDraft.proxy_server ?? ""}
                              placeholder="http://host:port"
                              onChange={(e) =>
                                setBrowserLaunchDraft((current) => current ? { ...current, proxy_server: e.target.value } : null)
                              }
                              className="input-sm border-base-300"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="proxy-username">Proxy Username</Label>
                            <Input
                              id="proxy-username"
                              aria-label="Proxy Username"
                              value={browserLaunchDraft.proxy_username ?? ""}
                              onChange={(e) =>
                                setBrowserLaunchDraft((current) => current ? { ...current, proxy_username: e.target.value } : null)
                              }
                              className="input-sm border-base-300"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="proxy-password">Proxy Password</Label>
                            <Input
                              id="proxy-password"
                              aria-label="Proxy Password"
                              type="password"
                              value={browserLaunchDraft.proxy_password ?? ""}
                              onChange={(e) =>
                                setBrowserLaunchDraft((current) => current ? { ...current, proxy_password: e.target.value } : null)
                              }
                              className="input-sm border-base-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </SettingsFieldGroup>

                  {/* Browser Posture Settings */}
                  <SettingsFieldGroup
                    title="Browser Posture"
                    description="Manage localization, location GeoIP, and headless/humanization options."
                  >
                    <div className="flex flex-col gap-3 w-full mt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      </div>
                      
                      {browserLaunchDraft.humanize && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="human-preset">Human Preset</Label>
                          <Select
                            id="human-preset"
                            aria-label="Human Preset"
                            value={browserLaunchDraft.human_preset}
                            onChange={(e) =>
                              setBrowserLaunchDraft((current) => current ? { ...current, human_preset: e.target.value as WorkflowHumanPreset } : null)
                            }
                            className="select-sm border-base-300 bg-base-100 w-full"
                          >
                            <option value="default">Default</option>
                            <option value="careful">Careful</option>
                          </Select>
                        </div>
                      )}

                      <SwitchField
                        checked={browserLaunchDraft.geoip}
                        label="Determine location by GeoIP"
                        onCheckedChange={(checked) =>
                          setBrowserLaunchDraft((current) => current ? { ...current, geoip: checked } : null)
                        }
                      />
                      
                      {!browserLaunchDraft.geoip && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="timezone">Timezone</Label>
                            <Input
                              id="timezone"
                              aria-label="Timezone"
                              value={browserLaunchDraft.timezone ?? ""}
                              placeholder="e.g. Asia/Ho_Chi_Minh"
                              onChange={(e) =>
                                setBrowserLaunchDraft((current) => current ? { ...current, timezone: e.target.value } : null)
                              }
                              className="input-sm border-base-300"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="locale">Locale</Label>
                            <Input
                              id="locale"
                              aria-label="Locale"
                              value={browserLaunchDraft.locale ?? ""}
                              placeholder="e.g. vi-VN"
                              onChange={(e) =>
                                setBrowserLaunchDraft((current) => current ? { ...current, locale: e.target.value } : null)
                              }
                              className="input-sm border-base-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </SettingsFieldGroup>

                  {/* WebRTC Policy Settings */}
                  <SettingsFieldGroup
                    title="WebRTC Policy"
                    description="Choose WebRTC IP handling strategy."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="webrtc-policy">WebRTC Policy</Label>
                        <Select
                          id="webrtc-webrtc-policy"
                          aria-label="WebRTC Policy"
                          value={browserLaunchDraft.webrtc_policy}
                          onChange={(e) =>
                            setBrowserLaunchDraft((current) => current ? { ...current, webrtc_policy: e.target.value as WorkflowWebRtcPolicy } : null)
                          }
                          className="select-sm border-base-300 bg-base-100 w-full"
                        >
                          <option value="default">Default</option>
                          <option value="auto_proxy_exit_ip">Auto proxy exit IP</option>
                          <option value="explicit_ip">Explicit IP</option>
                          <option value="disabled_if_supported">Disabled</option>
                        </Select>
                      </div>
                      {browserLaunchDraft.webrtc_policy === "explicit_ip" && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="webrtc-ip">Explicit WebRTC IP</Label>
                          <Input
                            id="webrtc-ip"
                            aria-label="Explicit WebRTC IP"
                            value={browserLaunchDraft.webrtc_ip ?? ""}
                            placeholder="e.g. 1.2.3.4"
                            onChange={(e) =>
                              setBrowserLaunchDraft((current) => current ? { ...current, webrtc_ip: e.target.value } : null)
                            }
                            className="input-sm border-base-300"
                          />
                        </div>
                      )}
                    </div>
                  </SettingsFieldGroup>

                  {/* Custom Fonts Settings */}
                  <SettingsFieldGroup
                    title="Custom Fonts"
                    description="Provide a directory path for custom browser fonts."
                  >
                    <div className="flex flex-col gap-1 w-full mt-2">
                      <Label htmlFor="fingerprint-fonts-dir">Custom Fonts Directory</Label>
                      <Input
                        id="fingerprint-fonts-dir"
                        aria-label="Custom Fonts Directory"
                        value={browserLaunchDraft.fingerprint_fonts_dir ?? ""}
                        placeholder="e.g. /path/to/fonts"
                        onChange={(e) =>
                          setBrowserLaunchDraft((current) => current ? { ...current, fingerprint_fonts_dir: e.target.value } : null)
                        }
                        className="input-sm border-base-300 w-full"
                      />
                    </div>
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

        <DialogFooter className="border-t border-base-300 pt-3 mt-auto flex gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!hasChanges || saving} loading={saving} onClick={async () => {
            setSaving(true);
            try {
              await handleSaveProfile();
              onOpenChange(false);
            } finally {
              setSaving(false);
            }
          }} className="btn-primary">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
