import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetSourceFields } from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "./TemplateTextField";
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
            showMath={false}
          />
        </ActionConfigFieldGroup>
      );
    case "update_variable":
      return (
        <ActionConfigFieldGroup title="Update Variable Settings">
          <TemplateTextField
            label="Variable name"
            value={config.config.name ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "name", val))
            }
            variableOptions={variableOptions}
          />
          <Label>
            Operation
            <Select
              value={config.config.operation ?? "push"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "operation", event.currentTarget.value))
              }
            >
              <option value="push">Push (append to array)</option>
              <option value="merge">Merge (merge JSON object)</option>
            </Select>
          </Label>
          {(config.config.operation ?? "push") === "push" && (
            <Label>
              Value type
              <Select
                value={config.config.value_type ?? "text"}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "value_type", event.currentTarget.value))
                }
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
          )}
          <TemplateTextareaField
            label={(config.config.operation ?? "push") === "merge" ? "JSON value to merge" : "Value to push"}
            value={config.config.value ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "value", val))
            }
            variableOptions={variableOptions}
            showMath={(config.config.operation ?? "push") === "push" && config.config.value_type === "number"}
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
