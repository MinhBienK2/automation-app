import { Select } from "../../../../components/ui/select";
import { SettingsFieldGroup } from "../../../../components/ui/settings-field-group";
import { SwitchField } from "../../../../components/ui/switch";
import { Input } from "../../../../components/ui/input";
import type { WorkflowSettingsGraphDefaults } from "../../../../types/workflow";

type GraphDefaultsSettingsSectionProps = {
  value: WorkflowSettingsGraphDefaults;
  onChange: (value: WorkflowSettingsGraphDefaults) => void;
};

export function GraphDefaultsSettingsSection({
  value,
  onChange,
}: GraphDefaultsSettingsSectionProps) {
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
