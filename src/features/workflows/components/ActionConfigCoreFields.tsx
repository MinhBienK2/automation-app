import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetSourceFields } from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
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
        <ActionConfigFieldGroup title="Navigation target">
          <Label>
            URL
            <Input
              value={config.config.url}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "url", event.currentTarget.value))
              }
            />
          </Label>
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
            </ActionConfigFieldGroup>
          ) : null}
          {config.config.condition.startsWith("element_") ? (
            <ActionConfigFieldGroup title="Element wait target">
              <ElementTargetSourceFields config={config} onChange={onChange} />
            </ActionConfigFieldGroup>
          ) : null}
          {config.config.condition === "text_visible" ? (
            <ActionConfigFieldGroup title="Text wait">
              <Label>
                Text
                <Input
                  value={config.config.text ?? ""}
                  onChange={(event) =>
                    onChange(updateActionConfigField(config, "text", event.currentTarget.value))
                  }
                />
              </Label>
            </ActionConfigFieldGroup>
          ) : null}
          {config.config.condition === "url_contains" ? (
            <ActionConfigFieldGroup title="URL wait">
              <Label>
                URL contains
                <Input
                  value={config.config.url ?? ""}
                  onChange={(event) =>
                    onChange(updateActionConfigField(config, "url", event.currentTarget.value))
                  }
                />
              </Label>
            </ActionConfigFieldGroup>
          ) : null}
        </>
      );
    case "random_wait":
      return (
        <ActionConfigFieldGroup title="Wait range">
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
