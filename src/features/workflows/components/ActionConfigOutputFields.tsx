import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetFields } from "./ActionConfigElementSharedFields";
import { TemplateTextareaField, type VariableOption } from "./TemplateTextField";
import { SetVariablesConfigFields } from "./VariableConfigFields";

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
        <SetVariablesConfigFields
          config={config.config}
          onChange={(nextConfig) => onChange({ type: "set_variable", config: nextConfig })}
        />
      );
    case "set_json_variables":
      return (
        <Label>
          JSON variables
          <Textarea
            value={config.config.json}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "json", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "assert_element":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
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
        </>
      );
    case "assert_text":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
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
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 3000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );

    default:
      return null;
  }
}
