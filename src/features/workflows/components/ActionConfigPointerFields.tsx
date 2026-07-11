import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { VariableNumericInput } from "./VariableNumericInput";
import { TemplateTextField } from "./TemplateTextField";
import {
  ElementTargetFields,
  ElementTargetSourceFields,
  StructuredTargetFields,
} from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";

const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function PointerActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "clear_input":
      return (
        <ActionConfigFieldGroup title="Element target">
          <ElementTargetSourceFields config={config} onChange={onChange} />
        </ActionConfigFieldGroup>
      );
    case "click":
    case "click_and_switch_tab":
      return (
        <ActionConfigFieldGroup title="Element target">
          <ElementTargetSourceFields config={config} onChange={onChange} />
        </ActionConfigFieldGroup>
      );
    case "find_element":
      return (
        <>
          <ActionConfigFieldGroup title="Element search">
            <ElementTargetFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Element result">
            <Label>
              Output name
              <Input
                value={config.config.output_name}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "output_name", event.currentTarget.value))
                }
              />
            </Label>
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Match ranking">
            <Label>
              In viewport
              <Select
                value={config.config.filter?.in_viewport === false ? "false" : "true"}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "in_viewport", event.currentTarget.value))
                }
              >
                <option value="true">Required</option>
                <option value="false">Any matched element</option>
              </Select>
            </Label>
            <Label>
              Rank
              <Select
                value={config.config.rank ?? "nearest_viewport_center"}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "rank", event.currentTarget.value))
                }
              >
                <option value="nearest_viewport_center">Nearest viewport center</option>
                <option value="largest_visible_area">Largest visible area</option>
                <option value="first">First match</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "scroll": {
      const mode = config.config.mode ?? "page";
      const usesTargetRef = config.config.target_ref != null;
      return (
        <>
          <ActionConfigFieldGroup title="Scroll mode">
            <Label>
              Mode
              <Select
                value={mode}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "mode", event.currentTarget.value))
                }
              >
                <option value="page">Page Scroll</option>
                <option value="into_view">Scroll To Element</option>
                <option value="until_element_visible">Scroll Until Element Visible</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
          {mode === "page" ? (
            <ActionConfigFieldGroup title="Page scroll gesture">
              <Label>
                Scroll style
                <Select
                  value={config.config.scroll_style ?? "human_like"}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "scroll_style", event.currentTarget.value),
                    )
                  }
                >
                  <option value="human_like">Human-like</option>
                  <option value="smooth_single">Smooth single wheel</option>
                </Select>
              </Label>
              <Label>
                Direction
                <Select
                  value={config.config.direction ?? "down"}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "direction", event.currentTarget.value),
                    )
                  }
                >
                  <option value="down">Down</option>
                  <option value="up">Up</option>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </Select>
              </Label>
              <VariableNumericInput
                label="Pixels"
                value={config.config.pixels}
                min={1}
                onChange={(nextVal) => {
                  const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                    ? typeof nextVal === "string" && nextVal.startsWith("{{")
                      ? nextVal
                      : Number(nextVal)
                    : null;
                  onChange(updateActionConfigField(config, "pixels", val));
                }}
              />
            </ActionConfigFieldGroup>
          ) : (
            <>
              <ActionConfigFieldGroup
                title={mode === "into_view" ? "Scroll target" : "Search target"}
              >
                {mode === "into_view" ? (
                  <ElementTargetSourceFields
                    config={config}
                    onChange={onChange}
                    showConstraints={false}
                  />
                ) : (
                  <StructuredTargetFields
                    config={config}
                    onChange={onChange}
                    showConstraints={false}
                  />
                )}
                {mode === "until_element_visible" || !usesTargetRef ? (
                  <TemplateTextField
                    label="Iframe XPath"
                    value={config.config.iframe_xpath ?? ""}
                    onChange={(val) =>
                      onChange(updateActionConfigField(config, "iframe_xpath", val))
                    }
                    placeholder="Optional iframe XPath"
                  />
                ) : null}
                <VariableNumericInput
                  label="Timeout ms"
                  value={config.config.timeout_ms ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS}
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
              {mode === "until_element_visible" ? (
                <ActionConfigFieldGroup title="Search scroll gesture">
                  <Label>
                    Direction
                    <Select
                      value={config.config.direction ?? "down"}
                      onChange={(event) =>
                        onChange(
                          updateActionConfigField(config, "direction", event.currentTarget.value),
                        )
                      }
                    >
                      <option value="down">Down</option>
                      <option value="up">Up</option>
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                    </Select>
                  </Label>
                  <VariableNumericInput
                    label="Pixels"
                    value={config.config.pixels}
                    min={1}
                    onChange={(nextVal) => {
                      const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                        ? typeof nextVal === "string" && nextVal.startsWith("{{")
                          ? nextVal
                          : Number(nextVal)
                        : null;
                      onChange(updateActionConfigField(config, "pixels", val));
                    }}
                  />
                </ActionConfigFieldGroup>
              ) : null}
            </>
          )}
        </>
      );
    }

    default:
      return null;
  }
}
