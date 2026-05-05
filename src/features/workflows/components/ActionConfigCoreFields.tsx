import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
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
          <Label>
            Wait until
            <Select
              value={config.config.wait_until ?? "load"}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "wait_until", event.currentTarget.value),
                )
              }
            >
              <option value="load">Load</option>
              <option value="dom_content_loaded">DOMContentLoaded</option>
              <option value="network_idle">Network idle</option>
            </Select>
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 30000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
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
            <Label>
              XPath
              <Input
                value={config.config.xpath ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
                }
              />
            </Label>
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
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 5000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "input_text":
      return (
        <>
          <Label>
            XPath
            <Input
              value={config.config.xpath}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
            />
          </Label>
          <TemplateTextareaField
            label="Text"
            value={config.config.text}
            onChange={(value) => onChange(updateActionConfigField(config, "text", value))}
            variableOptions={variableOptions}
          />
          <Label>
            Clear before input
            <Select
              value={String(config.config.clear_before_input)}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "clear_before_input",
                    event.currentTarget.value,
                  ),
                )
              }
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </Label>
          <Label>
            Typing mode
            <Select
              value={config.config.typing_mode ?? "set_value"}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "typing_mode", event.currentTarget.value),
                )
              }
            >
              <option value="set_value">Set value</option>
              <option value="type">Type keys</option>
            </Select>
          </Label>
          <Label>
            Iframe XPath
            <Input
              value={config.config.iframe_xpath ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "iframe_xpath", event.currentTarget.value),
                )
              }
              placeholder="Optional iframe XPath"
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="1"
              type="number"
              value={config.config.delay_ms ?? 1}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "delay_ms", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Wait until
            <Select
              value={config.config.wait_until ?? "clickable"}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "wait_until", event.currentTarget.value),
                )
              }
            >
              <option value="clickable">Clickable</option>
              <option value="visible">Visible</option>
              <option value="enabled">Enabled</option>
              <option value="attached">Attached</option>
            </Select>
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 5000}
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
