import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import {
  ElementTargetFields,
  StructuredTargetFields,
} from "./ActionConfigElementSharedFields";

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
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "click":
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "scroll": {
      const mode = config.config.mode ?? "page";
      return (
        <>
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
          {mode === "page" ? (
            <>
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
              <Label>
                Pixels
                <Input
                  min="1"
                  type="number"
                  value={config.config.pixels ?? 500}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "pixels", event.currentTarget.value),
                    )
                  }
                />
              </Label>
            </>
          ) : (
            <>
              <StructuredTargetFields
                config={config}
                onChange={onChange}
                showConstraints={false}
              />
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
                Timeout ms
                <Input
                  min="1"
                  type="number"
                  value={config.config.timeout_ms ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                    )
                  }
                />
              </Label>
              {mode === "until_element_visible" ? (
                <>
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
                  <Label>
                    Pixels
                    <Input
                      min="1"
                      type="number"
                      value={config.config.pixels ?? 700}
                      onChange={(event) =>
                        onChange(
                          updateActionConfigField(config, "pixels", event.currentTarget.value),
                        )
                      }
                    />
                  </Label>
                </>
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
