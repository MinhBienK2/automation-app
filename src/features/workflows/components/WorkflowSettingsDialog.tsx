import { useState } from "react";
import { HelpCircle, Save, Settings } from "lucide-react";
import type {
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSettingsEnvironment,
  WorkflowSettingsGeneral,
  WorkflowSettingsOwnedTestGates,
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
import { SwitchField } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import {
  createDefaultBrowserProfileName,
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
                    value={settings.browser_launch}
                    onChange={(value) => updateSection("browser_launch", value)}
                  />
                ) : null}
                {activeSection === "environment" ? (
                  <EnvironmentSettingsSection
                    value={settings.environment}
                    onChange={(value) => updateSection("environment", value)}
                  />
                ) : null}
                {activeSection === "owned_test_gates" ? (
                  <OwnedTestGatesSettingsSection
                    browserLaunch={settings.browser_launch}
                    value={settings.owned_test_gates}
                    onChange={(value) => updateSection("owned_test_gates", value)}
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
    <div className="settings-form-grid">
      <label className="field">
        <span>Workflow name</span>
        <Input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
        />
      </label>
      <label className="field">
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
      <label className="field">
        <span>Notes</span>
        <Textarea
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.currentTarget.value })}
        />
      </label>
    </div>
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
      <p className="workflow-settings-hint">
        Batch controls are paused until Batch Run UI is ready.
      </p>
    </div>
  );
}

function BrowserLaunchSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsBrowserLaunch;
  onChange: (value: WorkflowSettingsBrowserLaunch) => void;
}) {
  const persistent = value.session_mode === "persistent_profile";
  return (
    <div className="settings-form-grid">
      <SwitchField
        checked={persistent}
        label="Reuse login session"
        onCheckedChange={(checked) =>
          onChange({
            ...value,
            session_mode: checked ? "persistent_profile" : "temporary",
            profile_name: checked
              ? value.profile_name ?? createDefaultBrowserProfileName()
              : null,
          })
        }
      />
      {persistent ? (
        <label className="field">
          <span>Profile name</span>
          <Input
            value={value.profile_name ?? ""}
            onChange={(event) => onChange({ ...value, profile_name: nullableText(event.currentTarget.value) })}
          />
        </label>
      ) : null}
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
        </>
      ) : null}
      <SwitchField
        checked={value.headless}
        label="Headless browser"
        onCheckedChange={(checked) => onChange({ ...value, headless: checked })}
      />
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
    <div className="settings-form-grid">
      <SetVariablesConfigFields
        config={{ variables: value.initial_variables }}
        onChange={(next) => onChange({ ...value, initial_variables: next.variables ?? [] })}
      />
    </div>
  );
}

function OwnedTestGatesSettingsSection({
  browserLaunch,
  value,
  onChange,
}: {
  browserLaunch: WorkflowSettingsBrowserLaunch;
  value: WorkflowSettingsOwnedTestGates;
  onChange: (value: WorkflowSettingsOwnedTestGates) => void;
}) {
  return (
    <div className="settings-form-grid">
      <SwitchField
        checked={value.fingerprint_preflight_enabled}
        label="Fingerprint preflight"
        onCheckedChange={(checked) =>
          onChange({ ...value, fingerprint_preflight_enabled: checked })
        }
      />
      <label className="field">
        <span>Probe URL</span>
        <Input
          value={value.fingerprint_probe_url ?? ""}
          onChange={(event) => onChange({ ...value, fingerprint_probe_url: nullableText(event.currentTarget.value) })}
        />
      </label>
      <label className="field">
        <span>Identity profile</span>
        <Input
          value={value.fingerprint_profile_id ?? ""}
          onChange={(event) => onChange({ ...value, fingerprint_profile_id: nullableText(event.currentTarget.value) })}
        />
      </label>
      <label className="field">
        <span>Allowed origins</span>
        <Textarea
          value={value.fingerprint_allowed_origins.join("\n")}
          onChange={(event) =>
            onChange({
              ...value,
              fingerprint_allowed_origins: event.currentTarget.value
                .split(/\r?\n/)
                .map((origin) => origin.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="field">
        <span>Proxy label</span>
        <Input
          value={value.fingerprint_proxy_label ?? ""}
          onChange={(event) => onChange({ ...value, fingerprint_proxy_label: nullableText(event.currentTarget.value) })}
        />
      </label>
      <label className="field">
        <span>Proxy region</span>
        <Input
          value={value.fingerprint_proxy_region ?? ""}
          onChange={(event) => onChange({ ...value, fingerprint_proxy_region: nullableText(event.currentTarget.value) })}
        />
      </label>
      {browserLaunch.headless && value.fingerprint_preflight_enabled ? (
        <p className="field-error">Fingerprint preflight requires headed browser mode.</p>
      ) : null}
    </div>
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
