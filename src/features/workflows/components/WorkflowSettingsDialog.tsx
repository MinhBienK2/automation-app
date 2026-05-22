import { useState } from "react";
import { HelpCircle, Save, Settings } from "lucide-react";
import type {
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSettingsEnvironment,
  WorkflowSettingsGraphDefaults,
  WorkflowSettingsGeneral,
  WorkflowSettingsRunPolicy,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import { SwitchField } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import {
  tagsFromInput,
  tagsToInput,
  type WorkflowSettingsHelpLanguage,
  workflowSettingsHelp,
  workflowSettingsSections,
} from "../lib/workflowSettings";
import { SetVariablesConfigFields } from "./VariableConfigFields";

type WorkflowSettingsDialogProps = {
  open: boolean;
  settings: WorkflowSettings | null;
  activeSection: WorkflowSettingsSectionId;
  error?: string;
  hasUnsavedChanges: boolean;
  onOpenChange: (open: boolean) => void;
  onActiveSectionChange: (section: WorkflowSettingsSectionId) => void;
  onSettingsChange: (settings: WorkflowSettings) => void;
  onSaveSettings: () => void | boolean | Promise<void | boolean>;
  onDiscardChanges: () => void;
};

export function WorkflowSettingsDialog({
  open,
  settings,
  activeSection,
  error,
  hasUnsavedChanges,
  onOpenChange,
  onActiveSectionChange,
  onSettingsChange,
  onSaveSettings,
  onDiscardChanges,
}: WorkflowSettingsDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const activeMeta =
    workflowSettingsSections.find((section) => section.id === activeSection) ??
    workflowSettingsSections[0];

  const updateSection = <Section extends WorkflowSettingsSectionId>(
    section: Section,
    value: WorkflowSettings[Section],
  ) => {
    if (!settings) return;
    onSettingsChange({ ...settings, [section]: value });
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  const saveAndClose = async () => {
    const saved = await onSaveSettings();
    if (saved === false) return;
    onOpenChange(false);
    setConfirmCloseOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        {settings ? (
          <DialogContent className="workflow-settings-dialog">
            <DialogHeader className="workflow-settings-dialog-header">
              <div className="workflow-settings-title-row">
                <div className="workflow-settings-title-copy">
                  <Settings aria-hidden="true" />
                  <div>
                    <p className="eyebrow">Workflow</p>
                    <DialogTitle>Workflow Settings</DialogTitle>
                    <DialogDescription className="sr-only">
                      Configure workflow settings before running this workflow.
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  className="workflow-settings-save-button"
                  shape="pill"
                  type="button"
                  onClick={() => {
                    void onSaveSettings();
                  }}
                >
                  <Save aria-hidden="true" />
                  Save Settings
                </Button>
              </div>
            </DialogHeader>

            <div className="workflow-settings-body">
              <nav
                aria-label="Workflow settings sections"
                className="workflow-settings-sidebar"
                role="tablist"
              >
                {workflowSettingsSections.map((section) => (
                  <Button
                    key={section.id}
                    className="workflow-settings-tab"
                    data-active={activeSection === section.id ? "true" : "false"}
                    role="tab"
                    type="button"
                    variant={activeSection === section.id ? "default" : "ghost"}
                    aria-selected={activeSection === section.id}
                    onClick={() => onActiveSectionChange(section.id)}
                  >
                    {section.label}
                  </Button>
                ))}
              </nav>

              <section
                aria-labelledby="workflow-settings-section-title"
                className="workflow-settings-content"
                role="tabpanel"
              >
                <div className="workflow-settings-section-header">
                  <div>
                    <h2 id="workflow-settings-section-title">{activeMeta.label}</h2>
                    <p>{workflowSettingsHelp[activeSection]?.en.summary}</p>
                  </div>
                  <WorkflowSettingsHelpButton section={activeSection} />
                </div>

                {error ? <p className="field-error">{error}</p> : null}

                {activeSection === "general" ? (
                  <GeneralSettingsSection
                    value={settings.general}
                    onChange={(value) => updateSection("general", value)}
                  />
                ) : null}
                {activeSection === "run_policy" ? (
                  <RunPolicySettingsSection
                    value={settings.run_policy}
                    onChange={(value) => updateSection("run_policy", value)}
                  />
                ) : null}
                {activeSection === "browser_launch" ? (
                  <BrowserLaunchSettingsSection
                    runPolicy={settings.run_policy}
                    value={settings.browser_launch}
                    onChange={(value) => updateSection("browser_launch", value)}
                  />
                ) : null}
                {activeSection === "graph_defaults" ? (
                  <GraphDefaultsSettingsSection
                    value={settings.graph_defaults}
                    onChange={(value) => updateSection("graph_defaults", value)}
                  />
                ) : null}
                {activeSection === "environment" ? (
                  <EnvironmentSettingsSection
                    value={settings.environment}
                    onChange={(value) => updateSection("environment", value)}
                  />
                ) : null}
              </section>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
      <UnsavedChangesDialog
        open={confirmCloseOpen}
        onKeepEditing={() => setConfirmCloseOpen(false)}
        onDiscardChanges={() => {
          onDiscardChanges();
          setConfirmCloseOpen(false);
        }}
        onSaveAndClose={saveAndClose}
      />
    </>
  );
}

function WorkflowSettingsHelpButton({ section }: { section: WorkflowSettingsSectionId }) {
  const [language, setLanguage] = useState<WorkflowSettingsHelpLanguage>("en");
  const help = workflowSettingsHelp[section]?.[language];
  if (!help) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label={`${help.title}`}
          className="workflow-settings-help-button"
          type="button"
          variant="ghost"
        >
          <HelpCircle aria-hidden="true" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="workflow-settings-help-dialog">
        <DialogHeader
          className="workflow-settings-help-header"
          data-testid="workflow-settings-help-header"
        >
          <div>
            <DialogTitle>{help.title}</DialogTitle>
            <DialogDescription>{help.summary}</DialogDescription>
          </div>
          <div className="workflow-settings-help-language">
            <Button
              type="button"
              variant={language === "en" ? "default" : "ghost"}
              onClick={() => setLanguage("en")}
            >
              EN
            </Button>
            <Button
              type="button"
              variant={language === "vi" ? "default" : "ghost"}
              onClick={() => setLanguage("vi")}
            >
              VI
            </Button>
          </div>
        </DialogHeader>
        <div
          className="workflow-settings-help-body"
          data-testid="workflow-settings-help-body"
        >
          <section className="workflow-settings-help-list workflow-settings-help-fields">
            <h3>{help.uiLabels.fieldGuide}</h3>
            {help.fieldGuide.map((field) => (
              <div key={field.name}>
                <strong>{field.name}</strong>
                <p>{field.description}</p>
                {field.whenToUse ? <span>{field.whenToUse}</span> : null}
              </div>
            ))}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneralSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsGeneral;
  onChange: (value: WorkflowSettingsGeneral) => void;
}) {
  return (
    <SettingsFieldGroup
      title="Workflow details"
      description="Name and describe the workflow so it is easy to find, export, and audit."
    >
      <label className="field">
        <span>Workflow name</span>
        <Input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
        />
      </label>
      <label className="field settings-field-group-wide">
        <span>Description</span>
        <Textarea
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.currentTarget.value })}
        />
      </label>
      <label className="field">
        <span>Tags</span>
        <Input
          value={tagsToInput(value.tags)}
          onChange={(event) => onChange({ ...value, tags: tagsFromInput(event.currentTarget.value) })}
        />
      </label>
      <label className="field settings-field-group-wide">
        <span>Notes</span>
        <Textarea
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.currentTarget.value })}
        />
      </label>
    </SettingsFieldGroup>
  );
}

function RunPolicySettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsRunPolicy;
  onChange: (value: WorkflowSettingsRunPolicy) => void;
}) {
  return (
    <div className="settings-form-grid">
      <SettingsFieldGroup
        title="Run lifecycle"
        description="Limits and browser-session behavior for normal workflow runs."
      >
        <NumberField
          label="Max workflow duration ms"
          value={value.max_workflow_duration_ms}
          onChange={(next) => onChange({ ...value, max_workflow_duration_ms: next })}
        />
        <label className="field">
          <span>Browser retention</span>
          <Select
            value={value.browser_retention}
            onChange={(event) =>
              onChange({
                ...value,
                browser_retention: event.currentTarget.value === "close" ? "close" : "retain",
              })
            }
          >
            <option value="retain">Retain for inspection</option>
            <option value="close">Close after run</option>
          </Select>
        </label>
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Batch defaults"
        description="Saved defaults for future batch runs."
        footer="Batch controls are paused until Batch Run UI is ready."
      >
        <NumberField
          label="Batch concurrency limit"
          value={value.batch_concurrency_limit}
          disabled
          onChange={(next) => onChange({ ...value, batch_concurrency_limit: next })}
        />
        <SwitchField
          checked={value.batch_headless}
          disabled
          label="Batch runs are headless"
          onCheckedChange={(checked) => onChange({ ...value, batch_headless: checked })}
        />
        <SwitchField
          checked={value.batch_stop_on_first_failed_row}
          disabled
          label="Stop batch on first failed row"
          onCheckedChange={(checked) =>
            onChange({ ...value, batch_stop_on_first_failed_row: checked })
          }
        />
      </SettingsFieldGroup>
    </div>
  );
}

function BrowserLaunchSettingsSection({
  runPolicy,
  value,
  onChange,
}: {
  runPolicy: WorkflowSettingsRunPolicy;
  value: WorkflowSettingsBrowserLaunch;
  onChange: (value: WorkflowSettingsBrowserLaunch) => void;
}) {
  const persistent = value.session_mode === "persistent_profile";
  const canEnableRunFromSelected =
    persistent && runPolicy.browser_retention === "retain";
  return (
    <div className="settings-form-grid">
      <SettingsFieldGroup
        title="Session & identity"
        description="Persistent storage, browser identity, and operator controls for this workflow."
      >
        <SwitchField
          checked={persistent}
          label="Reuse login session"
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              session_mode: checked ? "persistent_profile" : "temporary",
              profile_name: checked ? value.profile_dir : null,
              run_from_selected_enabled: checked
                ? value.run_from_selected_enabled
                : false,
            })
          }
        />
        <div className="workflow-settings-identity-row settings-field-group-wide">
          <label className="field workflow-settings-identity-id-field">
            <span>Identity id</span>
            <Input value={value.identity_id} readOnly />
          </label>
          <label className="field workflow-settings-identity-name-field">
            <span>Identity display name</span>
            <Input
              value={value.display_name}
              onChange={(event) => onChange({ ...value, display_name: event.currentTarget.value })}
            />
          </label>
        </div>
        <label className="field">
          <span>Fingerprint seed</span>
          <Input
            type="password"
            value={value.fingerprint_seed}
            onChange={(event) => onChange({ ...value, fingerprint_seed: event.currentTarget.value.trim() })}
          />
        </label>
        <div className="settings-field-group-actions">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!window.confirm("Reset this browser identity? This creates a new profile directory and fingerprint seed.")) {
                return;
              }
              onChange(resetBrowserIdentity(value));
            }}
          >
            Reset identity
          </Button>
        </div>
        <SwitchField
          checked={Boolean(value.run_from_selected_enabled)}
          disabled={!canEnableRunFromSelected}
          label="Enable Run from selected"
          description={
            canEnableRunFromSelected
              ? "Show the Run from selected action when a matching browser session is retained."
              : "Requires Reuse login session and Run Policy browser retention set to retain."
          }
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              run_from_selected_enabled: canEnableRunFromSelected ? checked : false,
            })
          }
        />
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Proxy"
        description="Network route, credentials, and non-secret metadata used at browser launch."
      >
        <SwitchField
          checked={value.proxy_enabled}
          label="Use proxy"
          onCheckedChange={(checked) => onChange({ ...value, proxy_enabled: checked })}
        />
        {value.proxy_enabled ? (
          <>
            <label className="field">
              <span>Proxy server</span>
              <Input
                value={value.proxy_server ?? ""}
                onChange={(event) => onChange({ ...value, proxy_server: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Proxy username</span>
              <Input
                value={value.proxy_username ?? ""}
                onChange={(event) => onChange({ ...value, proxy_username: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Proxy password</span>
              <Input
                type="password"
                value={value.proxy_password ?? ""}
                onChange={(event) => onChange({ ...value, proxy_password: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Proxy label</span>
              <Input
                value={value.proxy_label ?? ""}
                onChange={(event) => onChange({ ...value, proxy_label: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Proxy region</span>
              <Input
                value={value.proxy_region ?? ""}
                onChange={(event) => onChange({ ...value, proxy_region: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Proxy provider</span>
              <Input
                value={value.proxy_provider ?? ""}
                onChange={(event) => onChange({ ...value, proxy_provider: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Test account binding</span>
              <Input
                value={value.test_account_binding ?? ""}
                onChange={(event) => onChange({ ...value, test_account_binding: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Proxy bypass</span>
              <Input
                placeholder=".internal.test"
                value={value.proxy_bypass ?? ""}
                onChange={(event) => onChange({ ...value, proxy_bypass: nullableText(event.currentTarget.value) })}
              />
            </label>
          </>
        ) : null}
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Location"
        description="Locale and proxy-derived geography used at browser launch."
      >
        <label className="field">
          <span>Timezone</span>
          <Input
            placeholder="America/New_York"
            value={value.timezone ?? ""}
            onChange={(event) => onChange({ ...value, timezone: nullableText(event.currentTarget.value) })}
          />
        </label>
        <label className="field">
          <span>Locale</span>
          <Input
            placeholder="en-US"
            value={value.locale ?? ""}
            onChange={(event) => onChange({ ...value, locale: nullableText(event.currentTarget.value) })}
          />
        </label>
        <SwitchField
          checked={Boolean(value.geoip)}
          label="GeoIP from proxy"
          onCheckedChange={(checked) => onChange({ ...value, geoip: checked })}
        />
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Fingerprint"
        description="Optional managed font inventory for launch-time fingerprint coherence."
      >
        <label className="field settings-field-group-wide">
          <span>Fingerprint fonts directory</span>
          <Input
            value={value.fingerprint_fonts_dir ?? ""}
            onChange={(event) => onChange({ ...value, fingerprint_fonts_dir: nullableText(event.currentTarget.value) })}
          />
        </label>
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Humanization"
        description="Controls for browser interaction timing and input behavior."
      >
        <SwitchField
          checked={value.humanize !== false}
          label="Humanize browser input"
          onCheckedChange={(checked) => onChange({ ...value, humanize: checked })}
        />
        <label className="field">
          <span>Humanize preset</span>
          <Select
            value={value.human_preset ?? "default"}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              onChange({
                ...value,
                human_preset: nextValue === "careful" ? "careful" : "default",
              });
            }}
          >
            <option value="default">Default</option>
            <option value="careful">Careful</option>
          </Select>
        </label>
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Preflight & launch"
        description="Optional fingerprint probe and final headed/headless launch mode."
      >
        <SwitchField
          checked={Boolean(value.preflight_enabled)}
          label="Fingerprint preflight"
          onCheckedChange={(checked) => onChange({ ...value, preflight_enabled: checked })}
        />
        {value.preflight_enabled ? (
          <>
            <label className="field">
              <span>Preflight probe URL</span>
              <Input
                value={value.preflight_probe_url ?? ""}
                onChange={(event) => onChange({ ...value, preflight_probe_url: nullableText(event.currentTarget.value) })}
              />
            </label>
            <label className="field">
              <span>Allowed probe origins</span>
              <Input
                value={value.preflight_allowed_origins.join(", ")}
                onChange={(event) =>
                  onChange({
                    ...value,
                    preflight_allowed_origins: event.currentTarget.value
                      .split(",")
                      .map((origin) => origin.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </>
        ) : null}
        <SwitchField
          checked={value.headless}
          label="Headless browser"
          onCheckedChange={(checked) => onChange({ ...value, headless: checked })}
        />
      </SettingsFieldGroup>
    </div>
  );
}

function GraphDefaultsSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsGraphDefaults;
  onChange: (value: WorkflowSettingsGraphDefaults) => void;
}) {
  const delay = value.default_edge_delay;
  const mode = delay?.type ?? "none";
  return (
    <SettingsFieldGroup
      title="New link wait"
      description="Choose the wait copied to new links after saving."
      footer="Existing links keep their own wait. Use Wait nodes for page or element conditions."
    >
      <label className="field">
        <span>Mode</span>
        <Select
          value={mode}
          onChange={(event) => {
            const nextMode = event.currentTarget.value;
            if (nextMode === "fixed") {
              onChange({ ...value, default_edge_delay: { type: "fixed", duration_ms: 1000 } });
              return;
            }
            if (nextMode === "random") {
              onChange({
                ...value,
                default_edge_delay: { type: "random", min_ms: 800, max_ms: 1500 },
              });
              return;
            }
            onChange({ ...value, default_edge_delay: null });
          }}
        >
          <option value="none">No default wait</option>
          <option value="fixed">Fixed duration</option>
          <option value="random">Random range</option>
        </Select>
      </label>
      {delay?.type === "fixed" ? (
        <NumberField
          label="Duration ms"
          value={delay.duration_ms}
          onChange={(next) =>
            onChange({
              ...value,
              default_edge_delay: { type: "fixed", duration_ms: next ?? 1000 },
            })
          }
        />
      ) : null}
      {delay?.type === "random" ? (
        <>
          <NumberField
            label="Minimum wait ms"
            value={delay.min_ms}
            onChange={(next) =>
              onChange({
                ...value,
                default_edge_delay: {
                  type: "random",
                  min_ms: next ?? 800,
                  max_ms: delay.max_ms,
                },
              })
            }
          />
          <NumberField
            label="Maximum wait ms"
            value={delay.max_ms}
            onChange={(next) =>
              onChange({
                ...value,
                default_edge_delay: {
                  type: "random",
                  min_ms: delay.min_ms,
                  max_ms: next ?? 1500,
                },
              })
            }
          />
        </>
      ) : null}
    </SettingsFieldGroup>
  );
}

function EnvironmentSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsEnvironment;
  onChange: (value: WorkflowSettingsEnvironment) => void;
}) {
  return (
    <SettingsFieldGroup
      title="Initial variables"
      description="Typed values available before the graph starts running."
    >
      <SetVariablesConfigFields
        config={{ variables: value.initial_variables }}
        onChange={(next) => onChange({ ...value, initial_variables: next.variables ?? [] })}
      />
    </SettingsFieldGroup>
  );
}

function NumberField({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled?: boolean;
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input
        min={1}
        type="number"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(numberOrNull(event.currentTarget.value))}
      />
    </label>
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resetBrowserIdentity(value: WorkflowSettingsBrowserLaunch): WorkflowSettingsBrowserLaunch {
  return applyNewBrowserIdentity(value, value.display_name);
}

function applyNewBrowserIdentity(
  value: WorkflowSettingsBrowserLaunch,
  displayName: string,
): WorkflowSettingsBrowserLaunch {
  const identityId = createBrowserIdentityId();
  const fingerprintSeed = createFingerprintSeed(value.fingerprint_seed);
  return {
    ...value,
    identity_id: identityId,
    display_name: displayName,
    profile_dir: identityId,
    profile_name: value.session_mode === "persistent_profile" ? identityId : null,
    fingerprint_seed: fingerprintSeed,
    run_from_selected_enabled: false,
  };
}

function createBrowserIdentityId() {
  const randomId = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12);
  return `bi_${randomId || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`}`;
}

function createFingerprintSeed(previousSeed: string) {
  const nextSeed = String(10000 + Math.floor(Math.random() * 90000));
  if (nextSeed !== previousSeed) return nextSeed;
  const parsed = Number(nextSeed);
  return String(parsed >= 99999 ? 10000 : parsed + 1).padStart(5, "0");
}
