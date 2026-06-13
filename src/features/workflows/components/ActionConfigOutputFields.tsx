import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetSourceFields } from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextareaField, type VariableOption } from "./TemplateTextField";
import { SetVariablesConfigFields } from "./VariableConfigFields";
import { VariableNumericInput } from "./VariableNumericInput";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
};

export function OutputActionFields({
  config,
  onChange,
  variableOptions,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "set_variable":
      return (
        <ActionConfigFieldGroup title="Variable rows">
          <SetVariablesConfigFields
            config={config.config}
            onChange={(nextConfig) => onChange({ type: "set_variable", config: nextConfig })}
          />
        </ActionConfigFieldGroup>
      );
    case "set_json_variables":
      return (
        <ActionConfigFieldGroup title="JSON variables">
          <TemplateTextareaField
            label="JSON variables"
            value={config.config.json}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "json", val))
            }
          />
        </ActionConfigFieldGroup>
      );
    case "assert_element":
      return (
        <>
          <ActionConfigFieldGroup title="Assertion target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Element state">
            <Label>
              State
              <Select
                value={config.config.state}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "state", event.currentTarget.value))
                }
              >
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="attached">Attached</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "assert_text":
      return (
        <>
          <ActionConfigFieldGroup title="Assertion target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Text assertion">
            <TemplateTextareaField
              label="Text"
              value={config.config.text}
              onChange={(value) => onChange(updateActionConfigField(config, "text", value))}
              variableOptions={variableOptions}
            />
            <Label>
              Match mode
              <Select
                value={config.config.match_mode}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "match_mode", event.currentTarget.value),
                  )
                }
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
              </Select>
            </Label>
            <VariableNumericInput
              label="Timeout ms"
              value={config.config.timeout_ms}
              min={1}
              onChange={(nextVal) => {
                const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                  ? typeof nextVal === "string" && nextVal.startsWith("{{")
                    ? nextVal
                    : Number(nextVal)
                  : null;
                onChange(updateActionConfigField(config, "timeout_ms", val));
              }}
            />
          </ActionConfigFieldGroup>
        </>
      );

    default:
      return null;
  }
}
