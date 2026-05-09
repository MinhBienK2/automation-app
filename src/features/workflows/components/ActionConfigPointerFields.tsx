import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetFields } from "./ActionConfigElementSharedFields";

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
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <Label>
            Method
            <Select
              value={config.config.method ?? "select_all"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "method", event.currentTarget.value))
              }
            >
              <option value="select_all">Select all</option>
              <option value="backspace">Backspace</option>
              <option value="dom">DOM value</option>
            </Select>
          </Label>
        </>
      );
    case "click":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <Label>
            Mode
            <Select
              value={config.config.mode ?? "real"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "mode", event.currentTarget.value))
              }
            >
              <option value="real">Real click</option>
              <option value="force_dom">Force DOM click</option>
            </Select>
          </Label>
          <Label>
            Click count
            <Select
              value={config.config.click_count ?? 1}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "click_count", event.currentTarget.value),
                )
              }
            >
              <option value="1">Single</option>
              <option value="2">Double</option>
            </Select>
          </Label>
          <Label>
            Button
            <Select
              value={config.config.button ?? "left"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "button", event.currentTarget.value))
              }
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="middle">Middle</option>
            </Select>
          </Label>
          <Label>
            Scroll into view
            <Select
              value={String(config.config.scroll_into_view ?? true)}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "scroll_into_view",
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
            Block
            <Select
              value={config.config.block ?? "center"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "block", event.currentTarget.value))
              }
            >
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
              <option value="nearest">Nearest</option>
            </Select>
          </Label>
          <Label>
            Inline
            <Select
              value={config.config.inline ?? "nearest"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "inline", event.currentTarget.value))
              }
            >
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
              <option value="nearest">Nearest</option>
            </Select>
          </Label>
          <Label>
            Position
            <Select
              value={config.config.position ?? "center"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "position", event.currentTarget.value))
              }
            >
              <option value="center">Center</option>
              <option value="top_left">Top left</option>
              <option value="top_right">Top right</option>
              <option value="bottom_left">Bottom left</option>
              <option value="bottom_right">Bottom right</option>
              <option value="offset">Offset</option>
            </Select>
          </Label>
          {config.config.position === "offset" ? (
            <>
              <Label>
                Offset X
                <Input
                  type="number"
                  value={config.config.offset_x ?? 0}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "offset_x", event.currentTarget.value),
                    )
                  }
                />
              </Label>
              <Label>
                Offset Y
                <Input
                  type="number"
                  value={config.config.offset_y ?? 0}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "offset_y", event.currentTarget.value),
                    )
                  }
                />
              </Label>
            </>
          ) : null}
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
          <Label>
            Retry interval ms
            <Input
              min="0"
              type="number"
              value={config.config.retry_interval_ms ?? 100}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "retry_interval_ms",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <Label>
            Post-click wait ms
            <Input
              min="0"
              type="number"
              value={config.config.post_click_wait_ms ?? 0}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "post_click_wait_ms",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
        </>
      );
    case "scroll":
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
              <option value="page">Page</option>
              <option value="container">Container</option>
              <option value="into_view">Into View</option>
              <option value="until_visible">Until Visible</option>
            </Select>
          </Label>
          {mode !== "into_view" ? (
            <>
              <Label>
                Direction
                <Select
                  value={config.config.direction}
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
                  value={config.config.pixels}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "pixels", event.currentTarget.value),
                    )
                  }
                />
              </Label>
            </>
          ) : null}
          {mode !== "page" ? (
            <Label>
              XPath
              <Input
                value={config.config.xpath ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
                }
                placeholder="//*[@id='target']"
              />
            </Label>
          ) : null}
          {mode === "until_visible" ? (
            <>
              <Label>
                Max attempts
                <Input
                  min="1"
                  type="number"
                  value={config.config.max_attempts ?? 10}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "max_attempts", event.currentTarget.value),
                    )
                  }
                />
              </Label>
              <Label>
                Wait ms
                <Input
                  min="0"
                  type="number"
                  value={config.config.wait_ms ?? 250}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "wait_ms", event.currentTarget.value),
                    )
                  }
                />
              </Label>
            </>
          ) : null}
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
            Behavior
            <Select
              value={config.config.behavior ?? "instant"}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "behavior", event.currentTarget.value),
                )
              }
            >
              <option value="instant">Instant</option>
              <option value="smooth">Smooth</option>
            </Select>
          </Label>
          {mode === "into_view" ? (
            <>
              <Label>
                Block
                <Select
                  value={config.config.block ?? "center"}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "block", event.currentTarget.value),
                    )
                  }
                >
                  <option value="start">Start</option>
                  <option value="center">Center</option>
                  <option value="end">End</option>
                  <option value="nearest">Nearest</option>
                </Select>
              </Label>
              <Label>
                Inline
                <Select
                  value={config.config.inline ?? "nearest"}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "inline", event.currentTarget.value),
                    )
                  }
                >
                  <option value="start">Start</option>
                  <option value="center">Center</option>
                  <option value="end">End</option>
                  <option value="nearest">Nearest</option>
                </Select>
              </Label>
            </>
          ) : null}
        </>
      );

    default:
      return null;
  }
}
