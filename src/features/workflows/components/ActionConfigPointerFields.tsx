import { useEffect, useState, type ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SegmentedControl } from "../../../components/ui/segmented-control";
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
      return <ClickTargetFields config={config} onChange={onChange} />;
    case "find_element":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <Label>
            Output name
            <Input
              value={config.config.output_name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "output_name", event.currentTarget.value))
              }
            />
          </Label>
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
        </>
      );
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

function ClickTargetFields({
  config,
  onChange,
}: {
  config: Extract<ActionConfig, { type: "click" }>;
  onChange: (config: ActionConfig) => void;
}) {
  const [targetSource, setTargetSource] = useState<"locator" | "ref">(
    config.config.target_ref?.trim() ? "ref" : "locator",
  );

  useEffect(() => {
    if (config.config.target_ref?.trim()) setTargetSource("ref");
  }, [config.config.target_ref]);

  return (
    <>
      <div className="grid gap-1.5">
        <Label>Target source</Label>
        <SegmentedControl
          ariaLabel="Target source"
          value={targetSource}
          options={[
            { label: "Use locator", value: "locator" },
            { label: "Use Find Element ref", value: "ref" },
          ]}
          onValueChange={(value) => {
            setTargetSource(value);
            onChange({
              type: "click",
              config: {
                ...config.config,
                target_ref: value === "ref" ? (config.config.target_ref ?? "") : null,
              },
            });
          }}
        />
      </div>
      {targetSource === "ref" ? (
        <>
          <Label>
            Target ref
            <Input
              value={config.config.target_ref ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "target_ref", event.currentTarget.value))
              }
              placeholder="Output name from Find Element"
            />
          </Label>
          <p className="text-xs leading-5 text-[var(--app-text-muted)]">
            Click uses the element resolved by a previous Find Element node in this run.
          </p>
        </>
      ) : (
        <ElementTargetFields config={config} onChange={onChange} />
      )}
    </>
  );
}
