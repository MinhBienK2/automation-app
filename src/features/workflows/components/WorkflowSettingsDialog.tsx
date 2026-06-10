import { useState, type ReactNode } from "react";
import { GitFork, HelpCircle, Save, Settings } from "lucide-react";
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
import { SegmentedControl } from "../../../components/ui/segmented-control";
import {
  tagsFromInput,
  tagsToInput,
  type WorkflowSettingsHelpLanguage,
  workflowSettingsHelp,
  workflowSettingsSections,
} from "../lib/workflowSettings";
import type { WorkflowSessionOption } from "../lib/workflowSessionOptions";
import { SetVariablesConfigFields } from "./VariableConfigFields";
import { HelpDisclosure } from "./HelpDisclosure";

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
  onResetBrowserIdentity?: () => void | Promise<void>;
  sessionOptions?: WorkflowSessionOption[];
  selectedSessionEnvironmentId?: string | null;
  onSelectWorkflowSession?: (environmentId: string) => void | Promise<void>;
  onForkWorkflowSession?: () => void | Promise<void>;
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
  onResetBrowserIdentity,
  sessionOptions = [],
  selectedSessionEnvironmentId,
  onSelectWorkflowSession,
  onForkWorkflowSession,
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
    const nextSettings: WorkflowSettings = { ...settings, [section]: value };
    if (
      section === "browser_launch" &&
      (value as WorkflowSettingsBrowserLaunch).session_mode !== "persistent_profile"
    ) {
      nextSettings.run_policy = {
        ...settings.run_policy,
        run_from_selected_enabled: false,
      };
    }
    onSettingsChange(nextSettings);
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
                    browserLaunch={settings.browser_launch}
                    value={settings.run_policy}
                    onChange={(value) => updateSection("run_policy", value)}
                  />
                ) : null}
                {activeSection === "browser_launch" ? (
                  <BrowserLaunchSettingsSection
                    value={settings.browser_launch}
                    onChange={(value) => updateSection("browser_launch", value)}
                    onResetBrowserIdentity={onResetBrowserIdentity}
                    sessionOptions={sessionOptions}
                    selectedSessionEnvironmentId={selectedSessionEnvironmentId}
                    onSelectWorkflowSession={onSelectWorkflowSession}
                    onForkWorkflowSession={onForkWorkflowSession}
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
          <SegmentedControl
            ariaLabel="Help language"
            className="workflow-settings-help-language"
            value={language}
            options={[
              { value: "en", label: "EN" },
              { value: "vi", label: "VI" },
            ]}
            onValueChange={setLanguage}
          />
        </DialogHeader>
        <div
          className="workflow-settings-help-body"
          data-testid="workflow-settings-help-body"
        >
          <WorkflowSettingsHelpList
            defaultOpen
            items={help.bestFor}
            title={help.uiLabels.bestFor}
          />
          {help.notFor?.length ? (
            <WorkflowSettingsHelpList
              items={help.notFor}
              title={help.uiLabels.notFor}
            />
          ) : null}
          {help.precedence?.length ? (
            <WorkflowSettingsHelpList
              items={help.precedence}
              title={help.uiLabels.precedence}
            />
          ) : null}
          <HelpDisclosure
            className="workflow-settings-help-disclosure workflow-settings-help-list workflow-settings-help-fields"
            defaultOpen
            title={help.uiLabels.fieldGuide}
          >
            {help.fieldGuide.map((field) => (
              <WorkflowSettingsHelpItem key={field.name} title={<strong>{field.name}</strong>}>
                <p>{field.description}</p>
                {field.whenToUse ? <span>{field.whenToUse}</span> : null}
                {field.overrideBehavior ? <span>{field.overrideBehavior}</span> : null}
              </WorkflowSettingsHelpItem>
            ))}
          </HelpDisclosure>
          <HelpDisclosure
            className="workflow-settings-help-disclosure workflow-settings-help-list workflow-settings-help-examples"
            title={language === "vi" ? "Ví dụ workflow" : "Workflow examples"}
          >
            {help.workflowExamples.map((example) => (
              <WorkflowSettingsHelpItem key={example.title} title={<strong>{example.title}</strong>}>
                <ul>
                  {example.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                  {example.notes?.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </WorkflowSettingsHelpItem>
            ))}
          </HelpDisclosure>
          {help.relatedGraphActions?.length ? (
            <HelpDisclosure
              className="workflow-settings-help-disclosure workflow-settings-help-list"
              title={language === "vi" ? "Action graph liên quan" : "Related graph actions"}
            >
              {help.relatedGraphActions.map((action) => (
                <WorkflowSettingsHelpItem
                  key={`${action.action}-${action.relationship}`}
                  title={<strong>{action.action}</strong>}
                >
                  <p>{action.explanation}</p>
                </WorkflowSettingsHelpItem>
              ))}
            </HelpDisclosure>
          ) : null}
          <HelpDisclosure
            className="workflow-settings-help-disclosure workflow-settings-help-list"
            title={help.uiLabels.commonMistakes}
          >
            {help.commonMistakes.map((mistake) => (
              <WorkflowSettingsHelpItem
                key={mistake.mistake}
                title={<strong>{mistake.mistake}</strong>}
              >
                <p>{mistake.fix}</p>
              </WorkflowSettingsHelpItem>
            ))}
          </HelpDisclosure>
          {help.safetyNotes?.length ? (
            <WorkflowSettingsHelpList
              items={help.safetyNotes}
              title={help.uiLabels.safetyNotes}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowSettingsHelpItem({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <HelpDisclosure
      className="workflow-settings-help-item"
      summaryClassName="workflow-settings-help-item-summary"
      title={title}
    >
      {children}
    </HelpDisclosure>
  );
}

function WorkflowSettingsHelpList({
  defaultOpen = false,
  items,
  title,
}: {
  defaultOpen?: boolean;
  items: string[];
  title: string;
}) {
  return (
    <HelpDisclosure
      className="workflow-settings-help-disclosure workflow-settings-help-list"
      defaultOpen={defaultOpen}
      title={title}
    >
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </HelpDisclosure>
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
  browserLaunch,
  value,
  onChange,
}: {
  browserLaunch: WorkflowSettingsBrowserLaunch;
  value: WorkflowSettingsRunPolicy;
  onChange: (value: WorkflowSettingsRunPolicy) => void;
}) {
  const canEnableRunFromSelected =
    browserLaunch.session_mode === "persistent_profile" &&
    Boolean(browserLaunch.profile_name) &&
    value.browser_retention === "retain";
  const runFromSelectedMode = value.run_from_selected_mode ?? "from_selected";
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
                run_from_selected_enabled:
                  event.currentTarget.value === "close"
                    ? false
                    : value.run_from_selected_enabled,
              })
            }
          >
            <option value="retain">Retain for inspection</option>
            <option value="close">Close after run</option>
          </Select>
        </label>
        <SwitchField
          checked={value.execute_js_enabled}
          label="Allow Run JavaScript"
          onCheckedChange={(checked) => onChange({ ...value, execute_js_enabled: checked })}
        />
        <div
          aria-label="Run from selected controls"
          className="workflow-run-from-selected-group"
          role="group"
        >
          <SwitchField
            checked={Boolean(value.run_from_selected_enabled)}
            disabled={!canEnableRunFromSelected}
            label="Enable Run from selected"
            description={
              canEnableRunFromSelected
                ? "Show the Run from selected action when a matching browser session is retained."
                : "Requires Reuse login session and Browser retention set to retain."
            }
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                run_from_selected_enabled: canEnableRunFromSelected ? checked : false,
                run_from_selected_mode: runFromSelectedMode,
              })
            }
          />
          {value.run_from_selected_enabled ? (
            <label className="field workflow-run-from-selected-scope">
              <span>Run from selected scope</span>
              <Select
                value={runFromSelectedMode}
                onChange={(event) =>
                  onChange({
                    ...value,
                    run_from_selected_mode:
                      event.currentTarget.value === "selected_only"
                        ? "selected_only"
                        : "from_selected",
                  })
                }
              >
                <option value="selected_only">Only rerun selected node</option>
                <option value="from_selected">Run from selected node onward</option>
              </Select>
            </label>
          ) : null}
        </div>
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

export function BrowserLaunchSettingsSection({
  value,
  onChange,
  onResetBrowserIdentity,
  sessionOptions = [],
  selectedSessionEnvironmentId,
  onSelectWorkflowSession,
  onForkWorkflowSession,
}: {
  value: WorkflowSettingsBrowserLaunch;
  onChange: (value: WorkflowSettingsBrowserLaunch) => void;
  onResetBrowserIdentity?: () => void | Promise<void>;
  sessionOptions?: WorkflowSessionOption[];
  selectedSessionEnvironmentId?: string | null;
  onSelectWorkflowSession?: (environmentId: string) => void | Promise<void>;
  onForkWorkflowSession?: () => void | Promise<void>;
}) {
  const [resetIdentityOpen, setResetIdentityOpen] = useState(false);
  const [resetIdentityPending, setResetIdentityPending] = useState(false);
  const [sessionActionPending, setSessionActionPending] = useState(false);
  const persistent = value.session_mode === "persistent_profile";
  const localEnvironment = detectedLocalBrowserEnvironment();
  const selectedSession =
    sessionOptions.find((option) => option.environment_id === selectedSessionEnvironmentId) ??
    sessionOptions.find((option) => option.browser_launch.identity_id === value.identity_id) ??
    null;
  const selectedSessionValue =
    selectedSession?.environment_id ?? selectedSessionEnvironmentId ?? "";
  const confirmResetIdentity = async () => {
    if (!onResetBrowserIdentity) return;
    setResetIdentityPending(true);
    try {
      await onResetBrowserIdentity();
      setResetIdentityOpen(false);
    } finally {
      setResetIdentityPending(false);
    }
  };
  const selectWorkflowSession = async (environmentId: string) => {
    if (!onSelectWorkflowSession || !environmentId) return;
    setSessionActionPending(true);
    try {
      await onSelectWorkflowSession(environmentId);
    } finally {
      setSessionActionPending(false);
    }
  };
  const forkWorkflowSession = async () => {
    if (!onForkWorkflowSession) return;
    setSessionActionPending(true);
    try {
      await onForkWorkflowSession();
    } finally {
      setSessionActionPending(false);
    }
  };
  return (
    <div className="settings-form-grid">
      <SettingsFieldGroup
        title="Session & identity"
        description="Persistent storage, browser identity, and operator controls for this launch environment."
      >
        {sessionOptions.length ? (
          <>
            <label className="field settings-field-group-wide">
              <span>Session source</span>
              <Select
                value={selectedSessionValue}
                disabled={!onSelectWorkflowSession || sessionActionPending}
                onChange={(event) => {
                  void selectWorkflowSession(event.currentTarget.value);
                }}
              >
                {sessionOptions.map((option) => (
                  <option key={option.environment_id} value={option.environment_id}>
                    {sessionOptionLabel(option)}
                  </option>
                ))}
              </Select>
            </label>
            {selectedSession ? (
              <div className="workflow-session-source-summary settings-field-group-wide">
                <span>{sessionUsageLabel(selectedSession)}</span>
                {selectedSession.description ? <span>{selectedSession.description}</span> : null}
              </div>
            ) : null}
          </>
        ) : null}
        <SwitchField
          checked={persistent}
          label="Reuse login session"
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              session_mode: checked ? "persistent_profile" : "temporary",
              profile_name: checked ? value.profile_dir : null,
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
            type="text"
            value={value.fingerprint_seed}
            readOnly
          />
        </label>
        <p className="workflow-settings-hint settings-field-group-wide">
          Fingerprint seed is part of the selected browser session identity.
        </p>
        {onResetBrowserIdentity || onForkWorkflowSession ? (
          <div className="settings-field-group-actions">
            {onForkWorkflowSession ? (
              <Button
                type="button"
                variant="secondary"
                disabled={sessionActionPending}
                onClick={() => {
                  void forkWorkflowSession();
                }}
              >
                <GitFork aria-hidden="true" />
                Fork current session
              </Button>
            ) : null}
            {onResetBrowserIdentity ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setResetIdentityOpen(true)}
              >
                Reset identity
              </Button>
            ) : null}
          </div>
        ) : null}
        <Dialog open={resetIdentityOpen} onOpenChange={setResetIdentityOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset browser identity</DialogTitle>
              <DialogDescription>
                This creates a new backend-generated identity id, profile
                directory, and fingerprint seed. Existing proxy, location,
                and font preferences are preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="dialog-footer-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={resetIdentityPending}
                onClick={() => setResetIdentityOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={resetIdentityPending}
                onClick={() => {
                  void confirmResetIdentity();
                }}
              >
                Reset identity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SettingsFieldGroup>
      <SettingsFieldGroup
        title="Proxy"
        description="Network route, credentials, and direct-connection bypasses used at browser launch."
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
              <span>Proxy bypass</span>
              <Input
                placeholder=".internal.test, localhost, 127.0.0.1"
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
        footer={`Detected on this machine: ${localEnvironment.timezone} / ${localEnvironment.locale}`}
      >
        <label className="field">
          <span>Timezone</span>
          <Input
            placeholder={localEnvironment.timezone}
            value={value.timezone ?? ""}
            onChange={(event) => onChange({ ...value, timezone: nullableText(event.currentTarget.value) })}
          />
        </label>
        <label className="field">
          <span>Locale</span>
          <Input
            placeholder={localEnvironment.locale}
            value={value.locale ?? ""}
            onChange={(event) => onChange({ ...value, locale: nullableText(event.currentTarget.value) })}
          />
        </label>
        <SwitchField
          checked={Boolean(value.geoip)}
          label="GeoIP location"
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
        title="Launch"
        description="Final headed/headless launch mode."
      >
        <SwitchField
          checked={value.headless}
          label="Headless browser"
          onCheckedChange={(checked) => onChange({ ...value, headless: checked })}
        />
      </SettingsFieldGroup>
    </div>
  );
}

function detectedLocalBrowserEnvironment() {
  const options = Intl.DateTimeFormat().resolvedOptions();
  return {
    timezone: options.timeZone || "UTC",
    locale: options.locale || "en-US",
  };
}

function sessionOptionLabel(option: WorkflowSessionOption) {
  const ownerLabel = option.workflow_names.length
    ? ` - ${option.workflow_names.join(", ")}`
    : "";
  return `${option.name}${ownerLabel}`;
}

function sessionUsageLabel(option: WorkflowSessionOption) {
  if (!option.workflow_names.length) {
    return option.is_default
      ? "Project default session"
      : "No workflows currently linked";
  }
  return `Shared with ${option.workflow_names.join(", ")}`;
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
    <>
      <SettingsFieldGroup
        title="Live run"
        description="Control whether Graph Builder shows active run progress."
        footer="Follow current is only available when Live Run is enabled."
      >
        <SwitchField
          checked={value.live_run_enabled}
          label="Live Run"
          description="Show the live run navigator in workflow detail while a saved run is active."
          onCheckedChange={(checked) =>
            onChange({
              ...value,
              live_run_enabled: checked,
              live_run_follow_current: checked ? value.live_run_follow_current : false,
            })
          }
        />
        {value.live_run_enabled ? (
          <SwitchField
            checked={value.live_run_follow_current}
            label="Follow current"
            description="Automatically select and center the current running node."
            onCheckedChange={(checked) =>
              onChange({ ...value, live_run_follow_current: checked })
            }
          />
        ) : null}
      </SettingsFieldGroup>
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
    </>
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
