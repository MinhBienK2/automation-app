import { HelpCircle, Save, Settings } from "lucide-react";
import type {
  WorkflowBrowserChallengePolicy,
  WorkflowDebugLoggingLevel,
  WorkflowFailurePolicy,
  WorkflowInputValueType,
  WorkflowMissedRunPolicy,
  WorkflowSettings,
  WorkflowSettingsAdvanced,
  WorkflowSettingsBrowser,
  WorkflowSettingsEnvironment,
  WorkflowSettingsExecution,
  WorkflowSettingsGeneral,
  WorkflowSettingsInputs,
  WorkflowSettingsSectionId,
  WorkflowSettingsTriggers,
  WorkflowTriggerConcurrencyPolicy,
  WorkflowTriggerMode,
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
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import {
  tagsFromInput,
  tagsToInput,
  workflowSettingsHelp,
  workflowSettingsSections,
} from "../lib/workflowSettings";

type WorkflowSettingsDialogProps = {
  open: boolean;
  settings: WorkflowSettings | null;
  activeSection: WorkflowSettingsSectionId;
  saveStatuses: Partial<Record<WorkflowSettingsSectionId, string>>;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onActiveSectionChange: (section: WorkflowSettingsSectionId) => void;
  onSettingsChange: (settings: WorkflowSettings) => void;
  onSaveSection: (section: WorkflowSettingsSectionId) => void | Promise<void>;
};

export function WorkflowSettingsDialog({
  open,
  settings,
  activeSection,
  saveStatuses,
  error,
  onOpenChange,
  onActiveSectionChange,
  onSettingsChange,
  onSaveSection,
}: WorkflowSettingsDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {settings ? (
        <DialogContent className="workflow-settings-dialog">
          <DialogHeader className="workflow-settings-dialog-header">
            <div className="workflow-settings-title-row">
              <Settings aria-hidden="true" />
              <div>
                <p className="eyebrow">Workflow</p>
                <DialogTitle>Workflow Settings</DialogTitle>
              </div>
            </div>
            <DialogDescription>
              Configure identity, execution, browser, environment, inputs,
              triggers, and compatibility behavior for this workflow.
            </DialogDescription>
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
                  <p>{workflowSettingsHelp[activeSection].summary}</p>
                </div>
                <WorkflowSettingsHelpButton section={activeSection} />
              </div>

              <div className="workflow-settings-status-row">
                <span>Save status</span>
                <strong>{saveStatuses[activeSection] ?? "Saved"}</strong>
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

              <div className="workflow-settings-actions">
                <Button type="button" onClick={() => onSaveSection(activeSection)}>
                  <Save aria-hidden="true" />
                  Save {activeMeta.label}
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function WorkflowSettingsHelpButton({
  section,
}: {
  section: WorkflowSettingsSectionId;
}) {
  const help = workflowSettingsHelp[section];
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
          <DialogTitle>{help.title}</DialogTitle>
          <DialogDescription>{help.summary}</DialogDescription>
        </DialogHeader>
        <div className="workflow-settings-help-body">
          <HelpBlock title="Use it when" items={help.bestFor} />
          {help.notFor ? <HelpBlock title="Do not use it for" items={help.notFor} /> : null}
          {help.precedence ? (
            <HelpBlock title="Precedence and overrides" items={help.precedence} />
          ) : null}
          <div className="workflow-settings-help-list">
            <h3>Field guide</h3>
            {help.fieldGuide.map((field) => (
              <div key={field.name}>
                <strong>{field.name}</strong>
                <p>{field.description}</p>
                {field.overrideBehavior ? <p>{field.overrideBehavior}</p> : null}
              </div>
            ))}
          </div>
          <div className="workflow-settings-help-list">
            <h3>Common mistakes</h3>
            {help.commonMistakes.map((item) => (
              <div key={item.mistake}>
                <strong>{item.mistake}</strong>
                <p>{item.fix}</p>
              </div>
            ))}
          </div>
          {help.safetyNotes ? <HelpBlock title="Safety notes" items={help.safetyNotes} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
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
          value={value.default_action_timeout_ms}
          onChange={(next) => onChange({ ...value, default_action_timeout_ms: next })}
        />
        <NumberField
          id="workflow-settings-max-duration"
          label="Max workflow duration ms"
          value={value.max_workflow_duration_ms}
          onChange={(next) => onChange({ ...value, max_workflow_duration_ms: next })}
        />
        <NumberField
          id="workflow-settings-retry-attempts"
          label="Default retry attempts"
          value={value.default_retry_attempts}
          onChange={(next) => onChange({ ...value, default_retry_attempts: next })}
        />
        <NumberField
          id="workflow-settings-retry-interval"
          label="Default retry interval ms"
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
      <div className="workflow-settings-grid workflow-settings-grid-three">
        <NumberField
          id="workflow-settings-batch-concurrency"
          label="Batch concurrency limit"
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
  return (
    <div className="workflow-settings-form">
      <fieldset className="workflow-settings-fieldset">
        <legend>Launch</legend>
        <div className="workflow-settings-grid workflow-settings-grid-two">
          <Label htmlFor="browser-profile-name">
            Profile name
            <Input
              id="browser-profile-name"
              placeholder="qa-profile"
              value={value.profile_name ?? ""}
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
              placeholder="WorkflowBot/1.0"
              value={value.user_agent ?? ""}
              onChange={(event) =>
                onChange({ ...value, user_agent: nullableText(event.currentTarget.value) })
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
          <NumberField
            id="browser-viewport-width"
            label="Viewport width"
            value={value.viewport_width}
            onChange={(next) => onChange({ ...value, viewport_width: next })}
          />
          <NumberField
            id="browser-viewport-height"
            label="Viewport height"
            value={value.viewport_height}
            onChange={(next) => onChange({ ...value, viewport_height: next })}
          />
          <ToggleField
            id="browser-mobile"
            label="Mobile viewport"
            checked={value.mobile}
            onChange={(checked) => onChange({ ...value, mobile: checked })}
          />
          <ToggleField
            id="browser-touch"
            label="Touch input"
            checked={value.touch}
            onChange={(checked) => onChange({ ...value, touch: checked })}
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
  const schemaText = value.input_schema
    .map((row) =>
      [
        row.name,
        row.value_type,
        row.required ? "required" : "optional",
        row.default_value ?? "",
        row.description ?? "",
      ].join("|"),
    )
    .join("\n");

  const variablesText = value.initial_variables
    .map((row) => `${row.name}|${row.value_type}|${row.value}`)
    .join("\n");

  return (
    <div className="workflow-settings-form">
      <Label htmlFor="workflow-settings-input-schema">
        Input schema
        <Textarea
          id="workflow-settings-input-schema"
          placeholder="email|text|required|user@example.com|Login email"
          value={schemaText}
          onChange={(event) =>
            onChange({
              ...value,
              input_schema: event.currentTarget.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const [name, valueType, required, defaultValue, description] = line.split("|");
                  return {
                    name: name?.trim() ?? "",
                    value_type: (valueType?.trim() || "text") as WorkflowInputValueType,
                    required: required?.trim() === "required",
                    default_value: nullableText(defaultValue ?? ""),
                    description: nullableText(description ?? ""),
                  };
                }),
            })
          }
        />
      </Label>
      <Label htmlFor="workflow-settings-initial-variables">
        Initial variables
        <Textarea
          id="workflow-settings-initial-variables"
          placeholder="user.email|text|user@example.com"
          value={variablesText}
          onChange={(event) =>
            onChange({
              ...value,
              initial_variables: event.currentTarget.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const [name, valueType, variableValue] = line.split("|");
                  return {
                    name: name?.trim() ?? "",
                    value_type: (valueType?.trim() || "text") as "text",
                    value: variableValue ?? "",
                  };
                }),
            })
          }
        />
      </Label>
    </div>
  );
}

function TriggersSettingsSection({
  value,
  onChange,
}: {
  value: WorkflowSettingsTriggers;
  onChange: (value: WorkflowSettingsTriggers) => void;
}) {
  return (
    <div className="workflow-settings-form">
      <div className="workflow-settings-grid workflow-settings-grid-three">
        <ToggleField
          id="workflow-settings-trigger-enabled"
          label="Trigger enabled"
          checked={value.enabled}
          onChange={(checked) => onChange({ ...value, enabled: checked })}
        />
        <Label htmlFor="workflow-settings-trigger-mode">
          Mode
          <Select
            id="workflow-settings-trigger-mode"
            value={value.mode}
            onChange={(event) =>
              onChange({ ...value, mode: event.currentTarget.value as WorkflowTriggerMode })
            }
          >
            <option value="manual">Manual only</option>
            <option value="once">Once</option>
            <option value="interval">Interval</option>
            <option value="cron">Cron/calendar</option>
            <option value="event">Event</option>
          </Select>
        </Label>
        <NumberField
          id="workflow-settings-trigger-interval"
          label="Interval seconds"
          value={value.interval_seconds}
          onChange={(next) => onChange({ ...value, interval_seconds: next })}
        />
      </div>
      <div className="workflow-settings-grid workflow-settings-grid-two">
        <Label htmlFor="workflow-settings-trigger-once">
          Once at
          <Input
            id="workflow-settings-trigger-once"
            placeholder="2026-05-06T10:00:00Z"
            value={value.once_at ?? ""}
            onChange={(event) =>
              onChange({ ...value, once_at: nullableText(event.currentTarget.value) })
            }
          />
        </Label>
        <Label htmlFor="workflow-settings-trigger-concurrency">
          Concurrency policy
          <Select
            id="workflow-settings-trigger-concurrency"
            value={value.concurrency_policy}
            onChange={(event) =>
              onChange({
                ...value,
                concurrency_policy: event.currentTarget
                  .value as WorkflowTriggerConcurrencyPolicy,
              })
            }
          >
            <option value="skip_if_running">Skip if running</option>
            <option value="queue_one">Queue one</option>
            <option value="reject">Reject</option>
          </Select>
        </Label>
      </div>
      <Label htmlFor="workflow-settings-missed-run-policy">
        Missed-run policy
        <Select
          id="workflow-settings-missed-run-policy"
          value={value.missed_run_policy}
          onChange={(event) =>
            onChange({
              ...value,
              missed_run_policy: event.currentTarget.value as WorkflowMissedRunPolicy,
            })
          }
        >
          <option value="skip">Skip</option>
          <option value="run_next_eligible">Run next eligible instance</option>
        </Select>
      </Label>
    </div>
  );
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
    <Label htmlFor={id} className="workflow-settings-toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </Label>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
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
        min={0}
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
