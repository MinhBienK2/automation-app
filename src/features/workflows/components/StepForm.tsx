import { useState } from "react";
import type { ActionConfig, WorkflowStep } from "../../../types/workflow";
import { actionLabels, commandMessage } from "../../../lib/workflowUi";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";
import type { StepHelpLanguage } from "../lib/stepHelpContent";
import { StepHelpModal } from "./StepHelpModal";

type StepFormProps = {
  step: WorkflowStep;
  onDeleteStep: (stepId: string) => void;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
};

export function StepForm({ step, onDeleteStep, onSaveStep }: StepFormProps) {
  const [name, setName] = useState(step.name || actionLabels[step.action_type]);
  const [config, setConfig] = useState<ActionConfig>(step.config);
  const [fieldError, setFieldError] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpLanguage, setHelpLanguage] = useState<StepHelpLanguage>("vi");

  async function saveStep(event: React.FormEvent) {
    event.preventDefault();
    setFieldError("");

    try {
      await onSaveStep(step.id, name, config);
    } catch (error) {
      setFieldError(commandMessage(error));
    }
  }

  return (
    <>
      <form className="step-form" onSubmit={saveStep}>
        <div className="step-form-header">
          <div>
            <p className="eyebrow">Step Detail</p>
            <h2>{actionLabels[step.action_type]}</h2>
          </div>
          <Button
            aria-label={`Open ${actionLabels[step.action_type]} help`}
            className="step-help-button"
            type="button"
            onClick={() => setIsHelpOpen(true)}
          >
            ?
          </Button>
        </div>

        <Label>
          Step name
          <Input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Label>

        <ActionFields config={config} onChange={setConfig} />

        {fieldError ? <p className="field-error">{fieldError}</p> : null}

        <div className="form-actions">
          <Button shape="pill" type="submit">
            Save Step
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => onDeleteStep(step.id)}
          >
            Delete Step
          </Button>
        </div>
      </form>
      {isHelpOpen ? (
        <StepHelpModal
          actionType={config.type}
          language={helpLanguage}
          onClose={() => setIsHelpOpen(false)}
          onLanguageChange={setHelpLanguage}
        />
      ) : null}
    </>
  );
}

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

function ActionFields({ config, onChange }: ActionFieldsProps) {
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
    case "open_url":
      return (
        <Label>
          URL
          <Input
            value={config.config.url}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "url", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "sleep":
      return (
        <Label>
          Seconds
          <Input
            min="0"
            step="0.1"
            type="number"
            value={config.config.seconds}
            onChange={(event) =>
              onChange(
                updateActionConfigField(config, "seconds", event.currentTarget.value),
              )
            }
          />
        </Label>
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
          <Label>
            Text
            <Textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "text", event.currentTarget.value))
              }
            />
          </Label>
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
    case "type_text":
      return (
        <>
          <Label>
            XPath
            <Input
            value={config.config.xpath}
            onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "xpath", event.currentTarget.value),
                )
              }
            />
          </Label>
          <Label>
            Text
            <Textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "text", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
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
          <Label>
            XPath
            <Input
              value={config.config.xpath}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
            />
          </Label>
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
    case "select_option":
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
          <Label>
            Match by
            <Select
              value={config.config.match_by}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "match_by", event.currentTarget.value))
              }
            >
              <option value="label">Label</option>
              <option value="value">Value</option>
            </Select>
          </Label>
          <Label>
            Value
            <Input
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "set_checkbox":
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
              <option value="checked">Checked</option>
              <option value="unchecked">Unchecked</option>
            </Select>
          </Label>
        </>
      );
    case "press_key":
      return (
        <Label>
          Key
          <Input
            value={config.config.key}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "key", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "hotkey":
      return (
        <Label>
          Keys
          <Input
            value={config.config.keys.join("+")}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "keys", event.currentTarget.value))
            }
            placeholder="Control+S"
          />
        </Label>
      );
    case "hover":
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "drag_and_drop":
      return (
        <>
          <Label>
            Source XPath
            <Input
              value={config.config.source_xpath}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "source_xpath",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <Label>
            Target XPath
            <Input
              value={config.config.target_xpath}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "target_xpath",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "type_sequence":
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
          <Label>
            Text
            <Textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "text", event.currentTarget.value))
              }
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
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "set_clipboard":
      return (
        <Label>
          Text
          <Textarea
            value={config.config.text}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "text", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "upload_file":
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
          <Label>
            Files
            <Textarea
              value={config.config.files.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "files", event.currentTarget.value))
              }
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "submit_form":
      return (
        <>
          <Label>
            XPath
            <Input
              value={config.config.xpath ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
              placeholder="Optional form or field XPath"
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "select_custom_option":
      return (
        <>
          <Label>
            Trigger XPath
            <Input
              value={config.config.trigger_xpath}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "trigger_xpath",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <Label>
            Option text
            <Input
              value={config.config.option_text}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "option_text", event.currentTarget.value),
                )
              }
            />
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
    case "set_contenteditable":
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
          <Label>
            Text
            <Textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "text", event.currentTarget.value))
              }
            />
          </Label>
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
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return <DataCaptureFields config={config} onChange={onChange} />;
    case "extract_attribute":
      return (
        <>
          <DataCaptureFields config={config} onChange={onChange} />
          <Label>
            Attribute
            <Input
              value={config.config.attribute}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "attribute", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "take_screenshot":
      return (
        <>
          <Label>
            Path
            <Input
              value={config.config.path}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "path", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Output name
            <Input
              value={config.config.output_name ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "output_name", event.currentTarget.value),
                )
              }
            />
          </Label>
          <Label>
            Full page
            <Select
              value={String(config.config.full_page)}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "full_page", event.currentTarget.value),
                )
              }
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </Label>
        </>
      );
    case "go_back":
    case "go_forward":
    case "reload":
      return null;
    case "open_new_tab":
      return (
        <Label>
          URL
          <Input
            value={config.config.url ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "url", event.currentTarget.value))
            }
            placeholder="Optional URL"
          />
        </Label>
      );
    case "switch_tab":
      return (
        <Label>
          Tab index
          <Input
            min="0"
            type="number"
            value={config.config.index}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "index", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "close_tab":
      return (
        <Label>
          Tab index
          <Input
            min="0"
            type="number"
            value={config.config.index ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "index", event.currentTarget.value))
            }
            placeholder="Current tab"
          />
        </Label>
      );
    case "switch_frame":
      return (
        <Label>
          XPath
          <Input
            value={config.config.xpath ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
            }
            placeholder="Blank uses top frame"
          />
        </Label>
      );
    case "accept_dialog":
      return (
        <Label>
          Prompt text
          <Input
            value={config.config.prompt_text ?? ""}
            onChange={(event) =>
              onChange(
                updateActionConfigField(config, "prompt_text", event.currentTarget.value),
              )
            }
            placeholder="Optional prompt response"
          />
        </Label>
      );
    case "dismiss_dialog":
      return null;
    case "set_download_directory":
      return (
        <Label>
          Path
          <Input
            value={config.config.path}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "path", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "wait_for_download":
      return (
        <>
          <Label>
            Output name
            <Input
              value={config.config.output_name}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "output_name", event.currentTarget.value),
                )
              }
            />
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
  }
}

type ElementConfig = Extract<
  ActionConfig,
  {
    type:
      | "clear_input"
      | "set_checkbox"
      | "hover"
      | "select_option"
      | "double_click"
      | "right_click"
      | "drag_and_drop"
      | "focus_element"
      | "blur_element"
      | "type_sequence"
      | "paste_clipboard"
      | "check"
      | "uncheck"
      | "toggle_checkbox"
      | "select_radio"
      | "upload_file"
      | "submit_form"
      | "set_contenteditable";
  }
>;

type DataCaptureConfig = Extract<
  ActionConfig,
  {
    type:
      | "extract_text"
      | "extract_attribute"
      | "extract_input_value"
      | "extract_table"
      | "extract_list";
  }
>;

function ElementTargetFields({
  config,
  onChange,
}: {
  config: Extract<
    ActionConfig,
    {
      type:
        | "clear_input"
        | "set_checkbox"
        | "hover"
        | "double_click"
        | "right_click"
        | "focus_element"
        | "blur_element"
        | "paste_clipboard"
        | "check"
        | "uncheck"
        | "toggle_checkbox"
        | "select_radio";
    }
  >;
  onChange: (config: ActionConfig) => void;
}) {
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
      <ElementOptionalFields config={config} onChange={onChange} />
    </>
  );
}

function ElementOptionalFields({
  config,
  onChange,
}: {
  config: ElementConfig;
  onChange: (config: ActionConfig) => void;
}) {
  return (
    <>
      <Label>
        Iframe XPath
        <Input
          value={config.config.iframe_xpath ?? ""}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "iframe_xpath", event.currentTarget.value))
          }
          placeholder="Optional iframe XPath"
        />
      </Label>
      <Label>
        Wait until
        <Select
          value={config.config.wait_until ?? "clickable"}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "wait_until", event.currentTarget.value))
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
            onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
          }
        />
      </Label>
    </>
  );
}

function DataCaptureFields({
  config,
  onChange,
}: {
  config: DataCaptureConfig;
  onChange: (config: ActionConfig) => void;
}) {
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
      <Label>
        Output name
        <Input
          value={config.config.output_name}
          onChange={(event) =>
            onChange(
              updateActionConfigField(config, "output_name", event.currentTarget.value),
            )
          }
        />
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
}
