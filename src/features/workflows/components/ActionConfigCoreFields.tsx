import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetSourceFields } from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
};

export function CoreActionFields({
  config,
  onChange,
  variableOptions,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "navigate":
      return (
        <ActionConfigFieldGroup title="Navigation target">
          <TemplateTextField
            label="URL"
            value={config.config.url}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "url", val))
            }
          />
        </ActionConfigFieldGroup>
      );
    case "wait":
      return (
        <>
          <ActionConfigFieldGroup title="Wait condition">
            <Label>
              Condition
              <Select
                value={config.config.condition}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "condition", event.currentTarget.value))
                }
              >
                <option value="duration">Duration</option>
                <option value="element_visible">Element visible</option>
                <option value="element_hidden">Element hidden</option>
                <option value="element_attached">Element attached</option>
                <option value="element_detached">Element detached</option>
                <option value="text_visible">Text visible</option>
                <option value="url_contains">URL contains</option>
                <option value="page_load">Page load</option>
                <option value="element_enabled">Element enabled</option>
                <option value="element_disabled">Element disabled</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
          {config.config.condition === "duration" ? (
            <ActionConfigFieldGroup title="Duration wait">
              <VariableNumericInput
                label="Duration ms"
                value={config.config.duration_ms}
                min={1}
                onChange={(nextVal) => {
                  const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                    ? typeof nextVal === "string" && nextVal.startsWith("{{")
                      ? nextVal
                      : Number(nextVal)
                    : null;
                  onChange(updateActionConfigField(config, "duration_ms", val));
                }}
              />
            </ActionConfigFieldGroup>
          ) : null}
          {config.config.condition.startsWith("element_") ? (
            <ActionConfigFieldGroup title="Element wait target">
              <ElementTargetSourceFields config={config} onChange={onChange} />
            </ActionConfigFieldGroup>
          ) : null}
          {config.config.condition === "text_visible" ? (
            <ActionConfigFieldGroup title="Text wait">
              <TemplateTextField
                label="Text"
                value={config.config.text ?? ""}
                onChange={(val) =>
                  onChange(updateActionConfigField(config, "text", val))
                }
              />
            </ActionConfigFieldGroup>
          ) : null}
          {config.config.condition === "url_contains" ? (
            <ActionConfigFieldGroup title="URL wait">
              <TemplateTextField
                label="URL contains"
                value={config.config.url ?? ""}
                onChange={(val) =>
                  onChange(updateActionConfigField(config, "url", val))
                }
              />
            </ActionConfigFieldGroup>
          ) : null}
        </>
      );
    case "random_wait":
      return (
        <ActionConfigFieldGroup title="Wait range">
          <VariableNumericInput
            label="Minimum wait ms"
            value={config.config.min_ms}
            min={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "min_ms", val));
            }}
          />
          <VariableNumericInput
            label="Maximum wait ms"
            value={config.config.max_ms}
            min={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "max_ms", val));
            }}
          />
        </ActionConfigFieldGroup>
      );
    case "input_text":
      return (
        <>
          <ActionConfigFieldGroup title="Fill target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Text entry">
            <TemplateTextareaField
              label="Text"
              value={config.config.text}
              onChange={(value) => onChange(updateActionConfigField(config, "text", value))}
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </>
      );

    default:
      return null;
  }
}
