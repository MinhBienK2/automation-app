import { useEffect, useRef, useState } from "react";
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
  onDuplicateStep: (step: WorkflowStep, name: string, config: ActionConfig) => Promise<void>;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
};

export function StepForm({
  step,
  onDeleteStep,
  onDuplicateStep,
  onSaveStep,
}: StepFormProps) {
  const [name, setName] = useState(step.name || actionLabels[step.action_type]);
  const [config, setConfig] = useState<ActionConfig>(step.config);
  const [fieldError, setFieldError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpLanguage, setHelpLanguage] = useState<StepHelpLanguage>("vi");
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  function showSuccessMessage(message: string) {
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
    }
    setSuccessMessage(message);
    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage("");
      successTimeoutRef.current = null;
    }, 2500);
  }

  async function saveStep(event: React.FormEvent) {
    event.preventDefault();
    setFieldError("");
    setSuccessMessage("");

    try {
      await onSaveStep(step.id, name, config);
      showSuccessMessage("Step saved successfully.");
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

        <ActionConfigEditor config={config} onChange={setConfig} />

        {fieldError ? <p className="field-error">{fieldError}</p> : null}

        <div className="form-actions">
          <Button shape="pill" type="submit">
            Save Step
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setFieldError("");
              void onDuplicateStep(step, name, config).catch((error) => {
                setFieldError(commandMessage(error));
              });
            }}
          >
            Duplicate Step
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
      {successMessage ? (
        <div className="toast-alert" role="status">
          {successMessage}
        </div>
      ) : null}
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

export function ActionConfigEditor({ config, onChange }: ActionFieldsProps) {
  return <ActionFields config={config} onChange={onChange} />;
}

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
    case "set_variable":
      return (
        <>
          <Label>
            Name
            <Input
              value={config.config.name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Value
            <Textarea
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "assert_element":
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
              value={config.config.timeout_ms ?? 3000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "assert_text":
      return (
        <>
          <Label>
            XPath
            <Input
              value={config.config.xpath ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
              placeholder="Blank checks whole page"
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
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 3000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "if_condition":
      return null;
    case "repeat_times":
      return (
        <Label>
          Times
          <Input
            min="1"
            type="number"
            value={config.config.times}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "times", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "repeat_for_each":
      return (
        <>
          <Label>
            Item name
            <Input
              value={config.config.item_name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "item_name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Items
            <Textarea
              value={config.config.items.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "items", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "retry_block":
      return (
        <>
          <Label>
            Max attempts
            <Input
              min="1"
              type="number"
              value={config.config.max_attempts}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "max_attempts", event.currentTarget.value),
                )
              }
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="0"
              type="number"
              value={config.config.delay_ms ?? 0}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "delay_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "stop_workflow":
      return (
        <>
          <Label>
            Status
            <Select
              value={config.config.status}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "status", event.currentTarget.value))
              }
            >
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </Select>
          </Label>
          <Label>
            Reason
            <Textarea
              value={config.config.reason ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "reason", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "use_profile":
      return (
        <Label>
          Name
          <Input
            value={config.config.name}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "name", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "save_session":
    case "load_session":
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
    case "set_cookie":
      return (
        <>
          <Label>
            Name
            <Input
              value={config.config.name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Value
            <Textarea
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Domain
            <Input
              value={config.config.domain ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "domain", event.currentTarget.value))
              }
              placeholder="Current host"
            />
          </Label>
          <Label>
            Path
            <Input
              value={config.config.path ?? "/"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "path", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "clear_cookies":
      return (
        <Label>
          Domain
          <Input
            value={config.config.domain ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "domain", event.currentTarget.value))
            }
            placeholder="Blank clears visible cookies"
          />
        </Label>
      );
    case "set_secret":
      return (
        <>
          <Label>
            Name
            <Input
              value={config.config.name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Value
            <Textarea
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "use_proxy":
      return (
        <>
          <Label>
            Server
            <Input
              value={config.config.server}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "server", event.currentTarget.value))
              }
              placeholder="http://127.0.0.1:8080"
            />
          </Label>
          <Label>
            Username
            <Input
              value={config.config.username ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "username", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Password
            <Input
              value={config.config.password ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "password", event.currentTarget.value))
              }
              type="password"
            />
          </Label>
        </>
      );
    case "set_user_agent":
      return (
        <Label>
          User agent
          <Textarea
            value={config.config.user_agent}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "user_agent", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "set_viewport":
      return (
        <>
          <Label>
            Width
            <Input
              min="1"
              type="number"
              value={config.config.width}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "width", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Height
            <Input
              min="1"
              type="number"
              value={config.config.height}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "height", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Device scale factor
            <Input
              min="0.1"
              step="0.1"
              type="number"
              value={config.config.device_scale_factor ?? 1}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "device_scale_factor",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <Label>
            Mobile
            <Select
              value={String(config.config.mobile)}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "mobile", event.currentTarget.value))
              }
            >
              <option value="false">False</option>
              <option value="true">True</option>
            </Select>
          </Label>
          <Label>
            Touch
            <Select
              value={String(config.config.touch)}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "touch", event.currentTarget.value))
              }
            >
              <option value="false">False</option>
              <option value="true">True</option>
            </Select>
          </Label>
        </>
      );
    case "set_geolocation":
      return (
        <>
          <Label>
            Latitude
            <Input
              step="0.000001"
              type="number"
              value={config.config.latitude}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "latitude", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Longitude
            <Input
              step="0.000001"
              type="number"
              value={config.config.longitude}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "longitude", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Accuracy
            <Input
              min="0"
              step="1"
              type="number"
              value={config.config.accuracy ?? 100}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "accuracy", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "set_extra_headers":
      return (
        <Label>
          Headers
          <Textarea
            value={config.config.headers
              .map((header) => `${header.name}: ${header.value}`)
              .join("\n")}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "headers", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "grant_permission":
      return (
        <>
          <Label>
            Origin
            <Input
              value={config.config.origin ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "origin", event.currentTarget.value))
              }
              placeholder="Current origin"
            />
          </Label>
          <Label>
            Permissions
            <Textarea
              value={config.config.permissions.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "permissions", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "detect_challenge":
      return (
        <>
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
            Patterns
            <Textarea
              value={config.config.patterns.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "patterns", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 1000}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "pause_for_human":
      return (
        <>
          <Label>
            Reason
            <Textarea
              value={config.config.reason}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "reason", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 0}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "resume_when_condition":
      return (
        <Label>
          Timeout ms
          <Input
            min="1"
            type="number"
            value={config.config.timeout_ms ?? 60000}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "fallback_selector":
      return (
        <>
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
            XPaths
            <Textarea
              value={config.config.xpaths.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpaths", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 1000}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "retry_step":
      return (
        <>
          <Label>
            Max attempts
            <Input
              min="1"
              type="number"
              value={config.config.max_attempts}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "max_attempts", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="1"
              type="number"
              value={config.config.delay_ms ?? 100}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "delay_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "checkpoint":
      return (
        <>
          <Label>
            Name
            <Input
              value={config.config.name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Screenshot path
            <Input
              value={config.config.screenshot_path ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "screenshot_path", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "execute_js":
      return (
        <>
          <Label>
            Script
            <Textarea
              value={config.config.script}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "script", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Output name
            <Input
              value={config.config.output_name ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "output_name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 1000}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "wait_for_request":
      return (
        <NetworkWaitFields config={config} onChange={onChange} includeStatus={false} />
      );
    case "wait_for_response":
      return <NetworkWaitFields config={config} onChange={onChange} includeStatus />;
    case "block_request":
      return (
        <Label>
          URL patterns
          <Textarea
            value={config.config.url_patterns.join("\n")}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "url_patterns", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "mock_response":
      return (
        <>
          <Label>
            URL contains
            <Input
              value={config.config.url_contains}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "url_contains", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Status
            <Input
              min="100"
              max="599"
              type="number"
              value={config.config.status}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "status", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Body
            <Textarea
              value={config.config.body}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "body", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Content type
            <Input
              value={config.config.content_type ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "content_type", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "set_local_storage":
    case "set_session_storage":
      return (
        <>
          <Label>
            Key
            <Input
              value={config.config.key}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "key", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Value
            <Textarea
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
  }
}

function NetworkWaitFields({
  config,
  onChange,
  includeStatus,
}: {
  config: Extract<ActionConfig, { type: "wait_for_request" | "wait_for_response" }>;
  onChange: (config: ActionConfig) => void;
  includeStatus: boolean;
}) {
  return (
    <>
      <Label>
        URL contains
        <Input
          value={config.config.url_contains}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "url_contains", event.currentTarget.value))
          }
        />
      </Label>
      {includeStatus && config.type === "wait_for_response" ? (
        <Label>
          Status
          <Input
            min="100"
            max="599"
            type="number"
            value={config.config.status ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "status", event.currentTarget.value))
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
            onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
          }
        />
      </Label>
    </>
  );
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
