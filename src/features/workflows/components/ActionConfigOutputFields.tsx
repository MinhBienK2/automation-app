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
          />
        </ActionConfigFieldGroup>
      );
    case "update_number_variable": {
      const operation = config.config.operation ?? "increment";
      const showValue = ["add", "subtract", "multiply", "divide"].includes(operation);
      return (
        <ActionConfigFieldGroup title="Update Number Variable Settings">
          <TemplateTextField
            label="Variable name"
            value={config.config.name ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "name", val))}
            placeholder="e.g. counter"
            variableOptions={variableOptions}
          />
          <Label>
            Operation
            <Select
              value={operation}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "operation", event.currentTarget.value))
              }
            >
              <option value="increment">Increment (+1)</option>
              <option value="decrement">Decrement (-1)</option>
              <option value="add">Add</option>
              <option value="subtract">Subtract</option>
              <option value="multiply">Multiply</option>
              <option value="divide">Divide</option>
            </Select>
          </Label>
          {showValue && (
            <TemplateTextField
              label="Value"
              value={config.config.value ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "value", val))}
              placeholder="Value"
              variableOptions={variableOptions}
            />
          )}
        </ActionConfigFieldGroup>
      );
    }
    case "update_text_variable": {
      const operation = config.config.operation ?? "append";
      const showValue = ["append", "prepend", "replace"].includes(operation);
      const showSearch = operation === "replace";
      return (
        <ActionConfigFieldGroup title="Update Text Variable Settings">
          <TemplateTextField
            label="Variable name"
            value={config.config.name ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "name", val))}
            placeholder="e.g. message"
            variableOptions={variableOptions}
          />
          <Label>
            Operation
            <Select
              value={operation}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "operation", event.currentTarget.value))
              }
            >
              <option value="append">Append</option>
              <option value="prepend">Prepend</option>
              <option value="replace">Replace</option>
              <option value="uppercase">To Uppercase</option>
              <option value="lowercase">To Lowercase</option>
              <option value="trim">Trim Whitespace</option>
            </Select>
          </Label>
          {showSearch && (
            <TemplateTextField
              label="Search pattern (string or /regex/)"
              value={config.config.search_pattern ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "search_pattern", val))}
              placeholder="pattern"
              variableOptions={variableOptions}
            />
          )}
          {showValue && (
            <TemplateTextareaField
              label="Replacement / Value"
              value={config.config.value ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "value", val))}
              placeholder="Value"
              variableOptions={variableOptions}
            />
          )}
        </ActionConfigFieldGroup>
      );
    }
    case "update_flag_variable": {
      const operation = config.config.operation ?? "toggle";
      return (
        <ActionConfigFieldGroup title="Update Flag Variable Settings">
          <TemplateTextField
            label="Variable name"
            value={config.config.name ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "name", val))}
            placeholder="e.g. isLoggedIn"
            variableOptions={variableOptions}
          />
          <Label>
            Operation
            <Select
              value={operation}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "operation", event.currentTarget.value))
              }
            >
              <option value="toggle">Toggle</option>
              <option value="set_true">Set True</option>
              <option value="set_false">Set False</option>
            </Select>
          </Label>
        </ActionConfigFieldGroup>
      );
    }
    case "update_list_variable": {
      const operation = config.config.operation ?? "push";
      const value_type = config.config.value_type ?? "text";
      const showValue = ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(operation);
      const showValueType = showValue;
      const showIndex = operation === "remove_by_index";
      return (
        <ActionConfigFieldGroup title="Update List Variable Settings">
          <TemplateTextField
            label="Variable name"
            value={config.config.name ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "name", val))}
            placeholder="e.g. items"
            variableOptions={variableOptions}
          />
          <Label>
            Operation
            <Select
              value={operation}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "operation", event.currentTarget.value))
              }
            >
              <option value="push">Push (Add to end)</option>
              <option value="unshift">Unshift (Add to start)</option>
              <option value="push_unique">Push Unique</option>
              <option value="pop">Pop (Remove from end)</option>
              <option value="shift">Shift (Remove from start)</option>
              <option value="remove_by_index">Remove by index</option>
              <option value="remove_by_value">Remove by value</option>
              <option value="merge">Merge</option>
              <option value="merge_unique">Merge Unique</option>
            </Select>
          </Label>
          {showValueType && (
            <Label>
              Value type
              <Select
                value={value_type}
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
          {showValue && (
            <TemplateTextareaField
              label="Value"
              value={config.config.value ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "value", val))}
              placeholder="Value"
              variableOptions={variableOptions}
            />
          )}
          {showIndex && (
            <TemplateTextField
              label="Index (0-based number or variable)"
              value={config.config.index !== undefined && config.config.index !== null ? String(config.config.index) : ""}
              onChange={(val) => onChange(updateActionConfigField(config, "index", val))}
              placeholder="0"
              variableOptions={variableOptions}
            />
          )}
        </ActionConfigFieldGroup>
      );
    }

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
