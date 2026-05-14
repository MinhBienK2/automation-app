import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetFields } from "./ActionConfigElementSharedFields";
import { TemplateTextareaField, type VariableOption } from "./TemplateTextField";

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
        <>
          <Label>
            URL
            <Input
              value={config.config.url}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "url", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "wait":
      return (
        <>
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
          {config.config.condition === "duration" ? (
            <Label>
              Duration ms
              <Input
                min="1"
                type="number"
                value={config.config.duration_ms ?? 1000}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "duration_ms", event.currentTarget.value),
                  )
                }
              />
            </Label>
          ) : null}
          {config.config.condition.startsWith("element_") ? (
            <ElementTargetFields config={config} onChange={onChange} />
          ) : null}
          {config.config.condition === "text_visible" ? (
            <Label>
              Text
              <Input
                value={config.config.text ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "text", event.currentTarget.value))
                }
              />
            </Label>
          ) : null}
          {config.config.condition === "url_contains" ? (
            <Label>
              URL contains
              <Input
                value={config.config.url ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "url", event.currentTarget.value))
                }
              />
            </Label>
          ) : null}
        </>
      );
    case "random_wait":
      return (
        <>
          <Label>
            Minimum wait ms
            <Input
              min="1"
              type="number"
              value={config.config.min_ms}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "min_ms", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Maximum wait ms
            <Input
              min="1"
              type="number"
              value={config.config.max_ms}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "max_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "input_text":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <TemplateTextareaField
            label="Text"
            value={config.config.text}
            onChange={(value) => onChange(updateActionConfigField(config, "text", value))}
            variableOptions={variableOptions}
          />
        </>
      );

    default:
      return null;
  }
}
