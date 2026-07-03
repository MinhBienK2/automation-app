import { Select } from "../../../../components/ui/select";
import { SettingsFieldGroup } from "../../../../components/ui/settings-field-group";
import { SwitchField } from "../../../../components/ui/switch";
import { Input } from "../../../../components/ui/input";
import type { WorkflowSettingsRunPolicy } from "../../../../types/workflow";

type RunPolicySettingsSectionProps = {
  value: WorkflowSettingsRunPolicy;
  onChange: (value: WorkflowSettingsRunPolicy) => void;
};

export function RunPolicySettingsSection({
  value,
  onChange,
}: RunPolicySettingsSectionProps) {
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
        <SwitchField
          checked={value.execute_js_enabled}
          label="Allow Run JavaScript"
          onCheckedChange={(checked) => onChange({ ...value, execute_js_enabled: checked })}
        />
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

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
