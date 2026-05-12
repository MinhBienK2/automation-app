import { useState } from "react";
import { HelpCircle, Save, Settings } from "lucide-react";
import type {
  VariableAssignment,
  WorkflowBrowserChallengePolicy,
  WorkflowDebugLoggingLevel,
  WorkflowDirectDomFallback,
  WorkflowFailurePolicy,
  WorkflowInteractionFidelity,
  WorkflowSettings,
  WorkflowSettingsAdvanced,
  WorkflowSettingsBrowser,
  WorkflowSettingsEnvironment,
  WorkflowSettingsExecution,
  WorkflowSettingsGeneral,
  WorkflowSettingsInputs,
  WorkflowSettingsSectionId,
  WorkflowTimingProfile,
  WorkflowSettingsTriggers,
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
import { Label } from "../../../components/ui/label";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { Select } from "../../../components/ui/select";
import { SwitchField } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import {
  applyBrowserDeviceProfile,
  browserDeviceProfileOptions,
  createDefaultBrowserProfileName,
  detectBrowserDeviceProfile,
  tagsFromInput,
  tagsToInput,
  variableRowsFromJsonText,
  variablesJsonFromRows,
  type BrowserDeviceProfileId,
  type WorkflowSettingsHelpLanguage,
  workflowSettingsHelp,
  workflowSettingsSections,
} from "../lib/workflowSettings";
import {
  SetVariablesConfigFields,
  variableRowsFromConfig,
} from "./VariableConfigFields";

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
                  <p>{workflowSettingsHelp[activeSection].en.summary}</p>
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
              {activeSection === "execution" ? (
                <ExecutionSettingsSection
                  value={settings.execution}
                  onChange={(value) => updateSection("execution", value)}
                />
              ) : null}
              {activeSection === "browser" ? (
                <BrowserSettingsSection
                  value={settings.browser}
                  onChange={(value) => updateSection("browser", value)}
                />
              ) : null}
              {activeSection === "environment" ? (
                <EnvironmentSettingsSection
                  value={settings.environment}
                  onChange={(value) => updateSection("environment", value)}
                />
              ) : null}
              {activeSection === "inputs" ? (
                <InputsSettingsSection
                  value={settings.inputs}
                  onChange={(value) => updateSection("inputs", value)}
                />
              ) : null}
              {activeSection === "triggers" ? (
                <TriggersSettingsSection
                  value={settings.triggers}
                  onChange={(value) => updateSection("triggers", value)}
                />
              ) : null}
              {activeSection === "advanced" ? (
                <AdvancedSettingsSection
                  value={settings.advanced}
                  onChange={(value) => updateSection("advanced", value)}
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

function WorkflowSettingsHelpButton({
  section,
}: {
  section: WorkflowSettingsSectionId;
}) {
  const [language, setLanguage] = useState<WorkflowSettingsHelpLanguage>("en");
  const help = workflowSettingsHelp[section][language];
  const labels = help.uiLabels;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label={`${workflowSettingsSections.find((item) => item.id === section)?.label} help`}
          className="workflow-settings-help-trigger"
          size="icon"
          type="button"
          variant="secondary"
        >
          <HelpCircle aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="workflow-settings-help-dialog">
        <DialogHeader>
          <div className="workflow-settings-help-header">
            <DialogTitle>{help.title}</DialogTitle>
            <SegmentedControl
              ariaLabel="Help language"
              className="workflow-settings-help-language"
              value={language}
              options={[
                { value: "en", label: "English" },
                { value: "vi", label: "Tiếng Việt" },
              ]}
              onValueChange={setLanguage}
            />
          </div>
          <DialogDescription>{help.summary}</DialogDescription>
        </DialogHeader>
        <div className="workflow-settings-help-body">
          <div className="workflow-settings-help-overview">
            <HelpBlock title={labels.bestFor} items={help.bestFor} />
            {help.notFor ? <HelpBlock title={labels.notFor} items={help.notFor} /> : null}
            {help.precedence ? (
              <HelpBlock title={labels.precedence} items={help.precedence} />
            ) : null}
          </div>
          <div className="workflow-settings-help-list workflow-settings-help-fields">
            <h3>{labels.fieldGuide}</h3>
            {help.fieldGuide.map((field, index) => (
              <div key={field.name}>
                <strong>{settingsHelpFieldName(section, field.name, index)}</strong>
                {settingsHelpFieldName(section, field.name, index) !== field.name ? (
                  <span>{field.name}</span>
                ) : null}
                <p>{field.description}</p>
                {field.whenToUse ? <p>{field.whenToUse}</p> : null}
                {field.overrideBehavior ? <p>{field.overrideBehavior}</p> : null}
              </div>
            ))}
          </div>
          {help.workflowExamples.length > 0 ? (
            <div className="workflow-settings-help-list workflow-settings-help-examples">
              <h3>Examples</h3>
              {help.workflowExamples.map((example) => (
                <div key={example.title}>
                  <strong>{example.title}</strong>
                  <ul>
                    {example.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          <div className="workflow-settings-help-list">
            <h3>{labels.commonMistakes}</h3>
            {help.commonMistakes.map((item) => (
              <div key={item.mistake}>
                <strong>{item.mistake}</strong>
                <p>{item.fix}</p>
              </div>
            ))}
          </div>
          {help.safetyNotes ? <HelpBlock title={labels.safetyNotes} items={help.safetyNotes} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function settingsHelpFieldName(
  section: WorkflowSettingsSectionId,
  fallbackName: string,
  index: number,
) {
  if (section !== "browser") return fallbackName;

  return [
    "reuse_login_session",
    "profile_name",
    "proxy_enabled",
    "proxy_server",
    "proxy_username",
    "proxy_password",
    "device_profile",
    "user_agent",
    "viewport_width / viewport_height",
    "mobile",
    "touch",
    "challenge_policy",
    "headless",
  ][index] ?? fallbackName;
}

function HelpBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="workflow-settings-help-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
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
    <div className="workflow-settings-form">
      <Label htmlFor="workflow-settings-name">
        Workflow name
        <Input
          id="workflow-settings-name"
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
        />
      </Label>
      <Label htmlFor="workflow-settings-description">
        Description
        <Textarea
          id="workflow-settings-description"
          value={value.description}
          onChange={(event) =>
            onChange({ ...value, description: event.currentTarget.value })
          }
        />
      </Label>
      <Label htmlFor="workflow-settings-tags">
        Tags
        <Input
          id="workflow-settings-tags"
          placeholder="qa, login, smoke"
          value={tagsToInput(value.tags)}
          onChange={(event) =>
            onChange({ ...value, tags: tagsFromInput(event.currentTarget.value) })
          }
        />
      </Label>
      <Label htmlFor="workflow-settings-notes">
        Notes
        <Textarea
          id="workflow-settings-notes"
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.currentTarget.value })}
        />
      </Label>
    </div>
  );
}

function ExecutionSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsExecution;
  onChange: (value: WorkflowSettingsExecution) => void;
}) {
  return (
    <div className="workflow-settings-form">
      <div className="workflow-settings-grid workflow-settings-grid-two">
        <NumberField
          id="workflow-settings-action-timeout"
          label="Default action timeout ms"
          min={1}
          value={value.default_action_timeout_ms}
          onChange={(next) => onChange({ ...value, default_action_timeout_ms: next })}
        />
        <NumberField
          id="workflow-settings-max-duration"
          label="Max workflow duration ms"
          min={1}
          value={value.max_workflow_duration_ms}
          onChange={(next) => onChange({ ...value, max_workflow_duration_ms: next })}
        />
        <NumberField
          id="workflow-settings-retry-attempts"
          label="Default retry attempts"
          min={1}
          value={value.default_retry_attempts}
          onChange={(next) => onChange({ ...value, default_retry_attempts: next })}
        />
        <NumberField
          id="workflow-settings-retry-interval"
          label="Default retry interval ms"
          min={1}
          value={value.default_retry_interval_ms}
          onChange={(next) => onChange({ ...value, default_retry_interval_ms: next })}
        />
      </div>
      <div className="workflow-settings-grid workflow-settings-grid-two">
        <Label htmlFor="workflow-settings-retention">
          Browser retention
          <Select
            id="workflow-settings-retention"
            value={value.browser_retention}
            onChange={(event) =>
              onChange({
                ...value,
                browser_retention: event.currentTarget.value as "retain" | "close",
              })
            }
          >
            <option value="retain">Retain</option>
            <option value="close">Close</option>
          </Select>
        </Label>
        <Label htmlFor="workflow-settings-failure-policy">
          Failure policy
          <Select
            id="workflow-settings-failure-policy"
            value={value.failure_policy}
            onChange={(event) =>
              onChange({
                ...value,
                failure_policy: event.currentTarget.value as WorkflowFailurePolicy,
              })
            }
          >
            <option value="stop_on_first_failure">Stop on first failure</option>
          </Select>
        </Label>
      </div>
      <fieldset className="workflow-settings-fieldset">
        <legend>Interaction fidelity</legend>
        <div className="workflow-settings-grid workflow-settings-grid-three">
          <Label htmlFor="workflow-settings-interaction-fidelity">
            Fidelity
            <Select
              id="workflow-settings-interaction-fidelity"
              value={value.interaction_fidelity ?? "standard"}
              onChange={(event) =>
                onChange({
                  ...value,
                  interaction_fidelity: event.currentTarget.value as WorkflowInteractionFidelity,
                })
              }
            >
              <option value="standard">Standard</option>
              <option value="high">High</option>
            </Select>
          </Label>
          <Label htmlFor="workflow-settings-dom-fallback">
            DOM fallback
            <Select
              id="workflow-settings-dom-fallback"
              value={value.direct_dom_fallback ?? "explicit"}
              onChange={(event) =>
                onChange({
                  ...value,
                  direct_dom_fallback: event.currentTarget.value as WorkflowDirectDomFallback,
                })
              }
            >
              <option value="allowed_with_trace">Allowed with trace</option>
              <option value="explicit">Explicit only</option>
              <option value="disabled">Disabled</option>
            </Select>
          </Label>
          <Label htmlFor="workflow-settings-timing-profile">
            Timing profile
            <Select
              id="workflow-settings-timing-profile"
              value={value.timing_profile ?? "balanced"}
              onChange={(event) =>
                onChange({
                  ...value,
                  timing_profile: event.currentTarget.value as WorkflowTimingProfile,
                })
              }
            >
              <option value="balanced">Balanced</option>
              <option value="slow_realistic">Slow realistic</option>
              <option value="custom">Custom</option>
            </Select>
          </Label>
        </div>
      </fieldset>
      <fieldset className="workflow-settings-fieldset">
        <legend>Wait between nodes</legend>
        <div className="workflow-settings-grid workflow-settings-grid-two">
          <ToggleField
            id="workflow-settings-node-wait-enabled"
            label="Enable wait between nodes"
            checked={value.wait_between_nodes_enabled ?? false}
            onChange={(checked) =>
              onChange({ ...value, wait_between_nodes_enabled: checked })
            }
          />
          <ToggleField
            id="workflow-settings-node-wait-random"
            label="Randomize wait time"
            checked={value.wait_between_nodes_random ?? false}
            onChange={(checked) => onChange({ ...value, wait_between_nodes_random: checked })}
          />
        </div>
        {value.wait_between_nodes_random ? (
          <div className="workflow-settings-grid workflow-settings-grid-two">
            <NumberField
              id="workflow-settings-node-wait-min"
              label="Minimum wait ms"
              min={1}
              value={value.wait_between_nodes_min_ms}
              onChange={(next) => onChange({ ...value, wait_between_nodes_min_ms: next })}
            />
            <NumberField
              id="workflow-settings-node-wait-max"
              label="Maximum wait ms"
              min={1}
              value={value.wait_between_nodes_max_ms}
              onChange={(next) => onChange({ ...value, wait_between_nodes_max_ms: next })}
            />
          </div>
        ) : (
          <div className="workflow-settings-grid workflow-settings-grid-two">
            <NumberField
              id="workflow-settings-node-wait-duration"
              label="Wait between nodes ms"
              min={1}
              value={value.wait_between_nodes_ms}
              onChange={(next) => onChange({ ...value, wait_between_nodes_ms: next })}
            />
          </div>
        )}
        <span className="workflow-settings-hint">
          Explicit Wait and Random Wait nodes override this global wait at their position.
        </span>
      </fieldset>
      <div className="workflow-settings-grid workflow-settings-grid-three">
        <NumberField
          id="workflow-settings-batch-concurrency"
          label="Batch concurrency limit"
          min={1}
          value={value.batch_concurrency_limit}
          onChange={(next) => onChange({ ...value, batch_concurrency_limit: next })}
        />
        <ToggleField
          id="workflow-settings-batch-headless"
          label="Batch headless default"
          checked={value.batch_headless}
          onChange={(checked) => onChange({ ...value, batch_headless: checked })}
        />
        <ToggleField
          id="workflow-settings-batch-stop"
          label="Stop batch on first failed row"
          checked={value.batch_stop_on_first_failed_row}
          onChange={(checked) =>
            onChange({ ...value, batch_stop_on_first_failed_row: checked })
          }
        />
      </div>
    </div>
  );
}

function BrowserSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsBrowser;
  onChange: (value: WorkflowSettingsBrowser) => void;
}) {
  const detectedDeviceProfile = detectBrowserDeviceProfile(value);
  const [selectedDeviceProfile, setSelectedDeviceProfile] =
    useState<BrowserDeviceProfileId | null>(null);
  const [reuseSession, setReuseSession] = useState(Boolean(value.profile_name));
  const deviceProfile = selectedDeviceProfile ?? detectedDeviceProfile;
  const updateDevice = (
    patch: Pick<
      Partial<WorkflowSettingsBrowser>,
      "user_agent" | "viewport_width" | "viewport_height" | "mobile" | "touch"
    >,
  ) => {
    setSelectedDeviceProfile("custom");
    onChange({ ...value, ...patch });
  };
  const updateDeviceProfile = (profileId: BrowserDeviceProfileId) => {
    setSelectedDeviceProfile(profileId);
    onChange(applyBrowserDeviceProfile(value, profileId));
  };
  const updateReuseSession = (enabled: boolean) => {
    setReuseSession(enabled);
    onChange({
      ...value,
      profile_name: enabled
        ? value.profile_name ?? createDefaultBrowserProfileName()
        : null,
    });
  };

  return (
    <div className="workflow-settings-form">
      <fieldset className="workflow-settings-fieldset">
        <legend>Launch</legend>
        <div className="workflow-settings-grid workflow-settings-grid-two">
          <ToggleField
            id="browser-reuse-session"
            label="Reuse login session"
            checked={reuseSession}
            onChange={updateReuseSession}
          />
          <Label htmlFor="browser-profile-name">
            Profile name
            <Input
              id="browser-profile-name"
              placeholder="Generated when reuse is enabled"
              value={value.profile_name ?? ""}
              disabled={!reuseSession}
              onChange={(event) =>
                onChange({
                  ...value,
                  profile_name: nullableText(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label htmlFor="browser-user-agent">
            User agent
            <Input
              id="browser-user-agent"
              placeholder="Select Custom user agent to edit"
              value={value.user_agent ?? ""}
              disabled={deviceProfile !== "custom"}
              onChange={(event) =>
                updateDevice({ user_agent: nullableText(event.currentTarget.value) })
              }
            />
          </Label>
        </div>
      </fieldset>

      <fieldset className="workflow-settings-fieldset">
        <legend>Network</legend>
        <div className="workflow-settings-grid workflow-settings-grid-proxy">
          <ToggleField
            id="browser-proxy-enabled"
            label="Proxy enabled"
            checked={value.proxy_enabled}
            onChange={(checked) => onChange({ ...value, proxy_enabled: checked })}
          />
          <Label htmlFor="browser-proxy-server" className="workflow-settings-span-two">
            Proxy server
            <Input
              id="browser-proxy-server"
              placeholder="http://proxy.local:8080"
              value={value.proxy_server ?? ""}
              onChange={(event) =>
                onChange({ ...value, proxy_server: nullableText(event.currentTarget.value) })
              }
            />
            <span className="workflow-settings-hint">
              Full proxy URLs with credentials are accepted for authorized routing.
            </span>
          </Label>
          <Label htmlFor="browser-proxy-username">
            Proxy username
            <Input
              id="browser-proxy-username"
              placeholder="agent"
              value={value.proxy_username ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  proxy_username: nullableText(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label htmlFor="browser-proxy-password">
            Proxy password
            <Input
              id="browser-proxy-password"
              placeholder="secret"
              type="password"
              value={value.proxy_password ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  proxy_password: event.currentTarget.value || null,
                })
              }
            />
          </Label>
        </div>
      </fieldset>

      <fieldset className="workflow-settings-fieldset">
        <legend>Device</legend>
        <div className="workflow-settings-grid workflow-settings-grid-four">
          <Label htmlFor="browser-device-profile">
            Device profile
            <Select
              id="browser-device-profile"
              value={deviceProfile}
              onChange={(event) =>
                updateDeviceProfile(event.currentTarget.value as BrowserDeviceProfileId)
              }
            >
              {browserDeviceProfileOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Label>
          <NumberField
            id="browser-viewport-width"
            label="Viewport width"
            min={1}
            value={value.viewport_width}
            onChange={(next) => updateDevice({ viewport_width: next })}
          />
          <NumberField
            id="browser-viewport-height"
            label="Viewport height"
            min={1}
            value={value.viewport_height}
            onChange={(next) => updateDevice({ viewport_height: next })}
          />
          <ToggleField
            id="browser-mobile"
            label="Mobile viewport"
            checked={value.mobile}
            onChange={(checked) => updateDevice({ mobile: checked })}
          />
          <ToggleField
            id="browser-touch"
            label="Touch input"
            checked={value.touch}
            onChange={(checked) => updateDevice({ touch: checked })}
          />
        </div>
      </fieldset>

      <div className="workflow-settings-grid workflow-settings-grid-two">
        <Label htmlFor="browser-challenge-policy">
          Challenge policy
          <Select
            id="browser-challenge-policy"
            value={value.challenge_policy}
            onChange={(event) =>
              onChange({
                ...value,
                challenge_policy: event.currentTarget
                  .value as WorkflowBrowserChallengePolicy,
              })
            }
          >
            <option value="none">None</option>
            <option value="detect_only">Detect only</option>
            <option value="pause_for_human">Pause for human</option>
          </Select>
        </Label>
        <ToggleField
          id="browser-headless-default"
          label="Headless default"
          checked={value.headless}
          onChange={(checked) => onChange({ ...value, headless: checked })}
        />
      </div>
      <fieldset className="workflow-settings-fieldset">
        <legend>Fingerprint preflight</legend>
        <div className="workflow-settings-grid workflow-settings-grid-two">
          <ToggleField
            id="browser-fingerprint-preflight"
            label="Enable preflight"
            checked={value.fingerprint_preflight_enabled ?? false}
            onChange={(checked) =>
              onChange({ ...value, fingerprint_preflight_enabled: checked })
            }
          />
          <Label htmlFor="browser-fingerprint-profile">
            Identity profile
            <Input
              id="browser-fingerprint-profile"
              value={value.fingerprint_profile_id ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  fingerprint_profile_id: nullableText(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label htmlFor="browser-fingerprint-probe" className="workflow-settings-span-two">
            Probe URL
            <Input
              id="browser-fingerprint-probe"
              value={value.fingerprint_probe_url ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  fingerprint_probe_url: nullableText(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label htmlFor="browser-fingerprint-origins" className="workflow-settings-span-two">
            Allowed origins
            <Input
              id="browser-fingerprint-origins"
              placeholder="https://prod-owned.example, https://staging-owned.example"
              value={(value.fingerprint_allowed_origins ?? []).join(", ")}
              onChange={(event) =>
                onChange({
                  ...value,
                  fingerprint_allowed_origins: tagsFromInput(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label htmlFor="browser-fingerprint-proxy-label">
            Proxy label
            <Input
              id="browser-fingerprint-proxy-label"
              value={value.fingerprint_proxy_label ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  fingerprint_proxy_label: nullableText(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label htmlFor="browser-fingerprint-proxy-region">
            Proxy region
            <Input
              id="browser-fingerprint-proxy-region"
              value={value.fingerprint_proxy_region ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  fingerprint_proxy_region: nullableText(event.currentTarget.value),
                })
              }
            />
          </Label>
        </div>
      </fieldset>
    </div>
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
    <div className="workflow-settings-form">
      <div className="workflow-settings-grid workflow-settings-grid-two">
        <Label htmlFor="workflow-settings-locale">
          Locale
          <Input
            id="workflow-settings-locale"
            placeholder="en-US"
            value={value.locale ?? ""}
            onChange={(event) => onChange({ ...value, locale: nullableText(event.currentTarget.value) })}
          />
        </Label>
        <Label htmlFor="workflow-settings-timezone">
          Timezone
          <Input
            id="workflow-settings-timezone"
            placeholder="America/New_York"
            value={value.timezone ?? ""}
            onChange={(event) =>
              onChange({ ...value, timezone: nullableText(event.currentTarget.value) })
            }
          />
        </Label>
      </div>
      <div className="workflow-settings-grid workflow-settings-grid-three">
        <NumberField
          id="workflow-settings-latitude"
          label="Latitude"
          min={-90}
          max={90}
          value={value.geolocation?.latitude ?? null}
          onChange={(next) =>
            onChange({
              ...value,
              geolocation:
                next == null && value.geolocation?.longitude == null
                  ? null
                  : {
                      latitude: next ?? 0,
                      longitude: value.geolocation?.longitude ?? 0,
                      accuracy: value.geolocation?.accuracy ?? null,
                    },
            })
          }
        />
        <NumberField
          id="workflow-settings-longitude"
          label="Longitude"
          min={-180}
          max={180}
          value={value.geolocation?.longitude ?? null}
          onChange={(next) =>
            onChange({
              ...value,
              geolocation:
                next == null && value.geolocation?.latitude == null
                  ? null
                  : {
                      latitude: value.geolocation?.latitude ?? 0,
                      longitude: next ?? 0,
                      accuracy: value.geolocation?.accuracy ?? null,
                    },
            })
          }
        />
        <Label htmlFor="workflow-settings-permissions">
          Permissions
          <Input
            id="workflow-settings-permissions"
            placeholder="geolocation, notifications"
            value={value.permissions.join(", ")}
            onChange={(event) =>
              onChange({ ...value, permissions: commaList(event.currentTarget.value) })
            }
          />
        </Label>
      </div>
      <Label htmlFor="workflow-settings-download-directory">
        Download directory
        <Input
          id="workflow-settings-download-directory"
          value={value.download_directory ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              download_directory: nullableText(event.currentTarget.value),
            })
          }
        />
      </Label>
      <Label htmlFor="workflow-settings-headers">
        Extra HTTP headers
        <Textarea
          id="workflow-settings-headers"
          placeholder="X-Test-Run: smoke"
          value={value.extra_http_headers.map((header) => `${header.name}: ${header.value}`).join("\n")}
          onChange={(event) =>
            onChange({
              ...value,
              extra_http_headers: headerLines(event.currentTarget.value),
            })
          }
        />
      </Label>
    </div>
  );
}

function InputsSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsInputs;
  onChange: (value: WorkflowSettingsInputs) => void;
}) {
  const [mode, setMode] = useState<"rows" | "json">("rows");
  const [draftRows, setDraftRows] = useState<VariableAssignment[]>(() =>
    value.initial_variables.length ? value.initial_variables : [emptyVariableRow()],
  );
  const [jsonText, setJsonText] = useState(() =>
    variablesJsonFromRows(value.initial_variables),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const rows = draftRows.length ? draftRows : [emptyVariableRow()];

  function updateVariables(rows: VariableAssignment[]) {
    const nextRows = rows.length ? rows : [emptyVariableRow()];
    setDraftRows(nextRows);
    onChange({
      ...value,
      input_schema: [],
      batch_mapping: [],
      initial_variables: nextRows.filter((row) => row.name.trim()),
    });
  }

  function switchMode(nextMode: "rows" | "json") {
    if (nextMode === mode) return;
    if (nextMode === "json") {
      setJsonText(variablesJsonFromRows(rows.filter((row) => row.name.trim())));
      setJsonError(null);
      setMode("json");
      return;
    }

    const parsed = variableRowsFromJsonText(jsonText);
    setJsonError(parsed.error);
    if (!parsed.error) {
      updateVariables(parsed.rows);
      setMode("rows");
    }
  }

  return (
    <div className="workflow-settings-form">
      <SegmentedControl
        ariaLabel="Variable edit mode"
        className="workflow-settings-mode-toggle"
        value={mode}
        options={[
          { value: "rows", label: "Rows" },
          { value: "json", label: "JSON" },
        ]}
        onValueChange={switchMode}
      />

      {mode === "rows" ? (
        <SetVariablesConfigFields
          config={{ variables: rows }}
          onChange={(config) => updateVariables(variableRowsFromConfig(config))}
        />
      ) : (
        <Label htmlFor="workflow-settings-variables-json">
          Variables JSON
          <Textarea
            id="workflow-settings-variables-json"
            placeholder={`{\n  "user": { "email": "user@example.com" }\n}`}
            value={jsonText}
            onChange={(event) => {
              const nextText = event.currentTarget.value;
              setJsonText(nextText);
              const parsed = variableRowsFromJsonText(nextText);
              setJsonError(parsed.error);
              if (!parsed.error) updateVariables(parsed.rows);
            }}
          />
          {jsonError ? <span className="workflow-settings-error">{jsonError}</span> : null}
        </Label>
      )}
    </div>
  );
}

function emptyVariableRow(): VariableAssignment {
  return { name: "", value_type: "text", value: "" };
}

function TriggersSettingsSection({
  value,
  onChange: _onChange,
}: {
  value: WorkflowSettingsTriggers;
  onChange: (value: WorkflowSettingsTriggers) => void;
}) {
  return (
    <div className="workflow-settings-form">
      <section className="workflow-settings-planned-panel" aria-label="Trigger status">
        <p>
          Triggers are saved for compatibility, but automatic scheduling is not
          active in this build.
        </p>
        <dl>
          <div>
            <dt>Saved mode</dt>
            <dd>{triggerModeLabel(value.mode)}</dd>
          </div>
          <div>
            <dt>Saved state</dt>
            <dd>{value.enabled ? "Enabled in saved data" : "Disabled"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function triggerModeLabel(mode: WorkflowSettingsTriggers["mode"]) {
  switch (mode) {
    case "once":
      return "Once";
    case "interval":
      return "Interval";
    case "cron":
      return "Cron/calendar";
    case "event":
      return "Event";
    case "manual":
      return "Manual only";
  }
}

function AdvancedSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsAdvanced;
  onChange: (value: WorkflowSettingsAdvanced) => void;
}) {
  return (
    <div className="workflow-settings-form">
      <Label htmlFor="workflow-settings-debug-logging">
        Debug logging level
        <Select
          id="workflow-settings-debug-logging"
          value={value.debug_logging_level}
          onChange={(event) =>
            onChange({
              ...value,
              debug_logging_level: event.currentTarget.value as WorkflowDebugLoggingLevel,
            })
          }
        >
          <option value="off">Off</option>
          <option value="error">Error</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </Select>
      </Label>
      <Label htmlFor="workflow-settings-compatibility-warnings">
        Compatibility warnings
        <Textarea
          id="workflow-settings-compatibility-warnings"
          readOnly
          value={value.compatibility_warnings.join("\n")}
          placeholder="No compatibility warnings"
        />
      </Label>
      <Label htmlFor="workflow-settings-experimental-flags">
        Experimental flags
        <Input
          id="workflow-settings-experimental-flags"
          value={value.experimental_flags.join(", ")}
          onChange={(event) =>
            onChange({ ...value, experimental_flags: commaList(event.currentTarget.value) })
          }
        />
      </Label>
    </div>
  );
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SwitchField
      id={id}
      checked={checked}
      label={label}
      onCheckedChange={onChange}
    />
  );
}

function NumberField({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min?: number;
  max?: number;
  value?: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Label htmlFor={id}>
      {label}
      <Input
        id={id}
        inputMode="numeric"
        type="number"
        min={min}
        max={max}
        value={value == null ? "" : String(value)}
        onChange={(event) => onChange(nullableNumber(event.currentTarget.value))}
      />
    </Label>
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function commaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function headerLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...valueParts] = line.split(":");
      return {
        name: name.trim(),
        value: valueParts.join(":").trim(),
      };
    })
    .filter((header) => header.name && header.value);
}
