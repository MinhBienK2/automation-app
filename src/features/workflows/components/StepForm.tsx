import { useState } from "react";
import type { ActionConfig, WorkflowStep } from "../../../types/workflow";
import { actionLabels, commandMessage } from "../../../lib/workflowUi";
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
          <button
            aria-label={`Open ${actionLabels[step.action_type]} help`}
            className="step-help-button"
            type="button"
            onClick={() => setIsHelpOpen(true)}
          >
            ?
          </button>
        </div>

        <label>
          Step name
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>

        <ActionFields config={config} onChange={setConfig} />

        {fieldError ? <p className="field-error">{fieldError}</p> : null}

        <div className="form-actions">
          <button className="primary-button" type="submit">
            Save Step
          </button>
          <button
            className="secondary-danger"
            type="button"
            onClick={() => onDeleteStep(step.id)}
          >
            Delete Step
          </button>
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
          <label>
            URL
            <input
              value={config.config.url}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "url", event.currentTarget.value))
              }
            />
          </label>
          <label>
            Wait until
            <select
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
            </select>
          </label>
          <label>
            Timeout ms
            <input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 30000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </label>
        </>
      );
    case "open_url":
      return (
        <label>
          URL
          <input
            value={config.config.url}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "url", event.currentTarget.value))
            }
          />
        </label>
      );
    case "sleep":
      return (
        <label>
          Seconds
          <input
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
        </label>
      );
    case "wait":
      return (
        <>
          <label>
            Condition
            <select
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
            </select>
          </label>
          {config.config.condition === "duration" ? (
            <label>
              Duration ms
              <input
                min="1"
                type="number"
                value={config.config.duration_ms ?? 1000}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "duration_ms", event.currentTarget.value),
                  )
                }
              />
            </label>
          ) : null}
          {config.config.condition.startsWith("element_") ? (
            <label>
              XPath
              <input
                value={config.config.xpath ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
                }
              />
            </label>
          ) : null}
          {config.config.condition === "text_visible" ? (
            <label>
              Text
              <input
                value={config.config.text ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "text", event.currentTarget.value))
                }
              />
            </label>
          ) : null}
          {config.config.condition === "url_contains" ? (
            <label>
              URL contains
              <input
                value={config.config.url ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "url", event.currentTarget.value))
                }
              />
            </label>
          ) : null}
          <label>
            Timeout ms
            <input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 5000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </label>
        </>
      );
    case "input_text":
      return (
        <>
          <label>
            XPath
            <input
              value={config.config.xpath}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
            />
          </label>
          <label>
            Text
            <textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "text", event.currentTarget.value))
              }
            />
          </label>
          <label>
            Clear before input
            <select
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
            </select>
          </label>
          <label>
            Typing mode
            <select
              value={config.config.typing_mode ?? "set_value"}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "typing_mode", event.currentTarget.value),
                )
              }
            >
              <option value="set_value">Set value</option>
              <option value="type">Type keys</option>
            </select>
          </label>
          <label>
            Iframe XPath
            <input
              value={config.config.iframe_xpath ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "iframe_xpath", event.currentTarget.value),
                )
              }
              placeholder="Optional iframe XPath"
            />
          </label>
          <label>
            Delay ms
            <input
              min="1"
              type="number"
              value={config.config.delay_ms ?? 1}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "delay_ms", event.currentTarget.value))
              }
            />
          </label>
          <label>
            Wait until
            <select
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
            </select>
          </label>
          <label>
            Timeout ms
            <input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 5000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </label>
        </>
      );
    case "type_text":
      return (
        <>
          <label>
            XPath
            <input
            value={config.config.xpath}
            onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "xpath", event.currentTarget.value),
                )
              }
            />
          </label>
          <label>
            Text
            <textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "text", event.currentTarget.value),
                )
              }
            />
          </label>
        </>
      );
    case "clear_input":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <label>
            Method
            <select
              value={config.config.method ?? "select_all"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "method", event.currentTarget.value))
              }
            >
              <option value="select_all">Select all</option>
              <option value="backspace">Backspace</option>
              <option value="dom">DOM value</option>
            </select>
          </label>
        </>
      );
    case "click":
      return (
        <>
          <label>
            XPath
            <input
              value={config.config.xpath}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
            />
          </label>
          <label>
            Mode
            <select
              value={config.config.mode ?? "real"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "mode", event.currentTarget.value))
              }
            >
              <option value="real">Real click</option>
              <option value="force_dom">Force DOM click</option>
            </select>
          </label>
          <label>
            Click count
            <select
              value={config.config.click_count ?? 1}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "click_count", event.currentTarget.value),
                )
              }
            >
              <option value="1">Single</option>
              <option value="2">Double</option>
            </select>
          </label>
          <label>
            Button
            <select
              value={config.config.button ?? "left"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "button", event.currentTarget.value))
              }
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="middle">Middle</option>
            </select>
          </label>
          <label>
            Iframe XPath
            <input
              value={config.config.iframe_xpath ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "iframe_xpath", event.currentTarget.value),
                )
              }
              placeholder="Optional iframe XPath"
            />
          </label>
          <label>
            Scroll into view
            <select
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
            </select>
          </label>
          <label>
            Block
            <select
              value={config.config.block ?? "center"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "block", event.currentTarget.value))
              }
            >
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
              <option value="nearest">Nearest</option>
            </select>
          </label>
          <label>
            Inline
            <select
              value={config.config.inline ?? "nearest"}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "inline", event.currentTarget.value))
              }
            >
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
              <option value="nearest">Nearest</option>
            </select>
          </label>
          <label>
            Position
            <select
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
            </select>
          </label>
          {config.config.position === "offset" ? (
            <>
              <label>
                Offset X
                <input
                  type="number"
                  value={config.config.offset_x ?? 0}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "offset_x", event.currentTarget.value),
                    )
                  }
                />
              </label>
              <label>
                Offset Y
                <input
                  type="number"
                  value={config.config.offset_y ?? 0}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "offset_y", event.currentTarget.value),
                    )
                  }
                />
              </label>
            </>
          ) : null}
          <label>
            Wait until
            <select
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
            </select>
          </label>
          <label>
            Timeout ms
            <input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 5000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </label>
          <label>
            Retry interval ms
            <input
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
          </label>
          <label>
            Post-click wait ms
            <input
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
          </label>
        </>
      );
    case "scroll":
      const mode = config.config.mode ?? "page";
      return (
        <>
          <label>
            Mode
            <select
              value={mode}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "mode", event.currentTarget.value))
              }
            >
              <option value="page">Page</option>
              <option value="container">Container</option>
              <option value="into_view">Into View</option>
              <option value="until_visible">Until Visible</option>
            </select>
          </label>
          {mode !== "into_view" ? (
            <>
              <label>
                Direction
                <select
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
                </select>
              </label>
              <label>
                Pixels
                <input
                  min="1"
                  type="number"
                  value={config.config.pixels}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "pixels", event.currentTarget.value),
                    )
                  }
                />
              </label>
            </>
          ) : null}
          {mode !== "page" ? (
            <label>
              XPath
              <input
                value={config.config.xpath ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
                }
                placeholder="//*[@id='target']"
              />
            </label>
          ) : null}
          {mode === "until_visible" ? (
            <>
              <label>
                Max attempts
                <input
                  min="1"
                  type="number"
                  value={config.config.max_attempts ?? 10}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "max_attempts", event.currentTarget.value),
                    )
                  }
                />
              </label>
              <label>
                Wait ms
                <input
                  min="0"
                  type="number"
                  value={config.config.wait_ms ?? 250}
                  onChange={(event) =>
                    onChange(
                      updateActionConfigField(config, "wait_ms", event.currentTarget.value),
                    )
                  }
                />
              </label>
            </>
          ) : null}
          <label>
            Iframe XPath
            <input
              value={config.config.iframe_xpath ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "iframe_xpath", event.currentTarget.value),
                )
              }
              placeholder="Optional iframe XPath"
            />
          </label>
          <label>
            Behavior
            <select
              value={config.config.behavior ?? "instant"}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "behavior", event.currentTarget.value),
                )
              }
            >
              <option value="instant">Instant</option>
              <option value="smooth">Smooth</option>
            </select>
          </label>
          {mode === "into_view" ? (
            <>
              <label>
                Block
                <select
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
                </select>
              </label>
              <label>
                Inline
                <select
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
                </select>
              </label>
            </>
          ) : null}
        </>
      );
    case "select_option":
      return (
        <>
          <label>
            XPath
            <input
              value={config.config.xpath}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
            />
          </label>
          <label>
            Match by
            <select
              value={config.config.match_by}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "match_by", event.currentTarget.value))
              }
            >
              <option value="label">Label</option>
              <option value="value">Value</option>
            </select>
          </label>
          <label>
            Value
            <input
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "set_checkbox":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <label>
            State
            <select
              value={config.config.state}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "state", event.currentTarget.value))
              }
            >
              <option value="checked">Checked</option>
              <option value="unchecked">Unchecked</option>
            </select>
          </label>
        </>
      );
    case "press_key":
      return (
        <label>
          Key
          <input
            value={config.config.key}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "key", event.currentTarget.value))
            }
          />
        </label>
      );
    case "hotkey":
      return (
        <label>
          Keys
          <input
            value={config.config.keys.join("+")}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "keys", event.currentTarget.value))
            }
            placeholder="Control+S"
          />
        </label>
      );
    case "hover":
      return <ElementTargetFields config={config} onChange={onChange} />;
  }
}

type ElementConfig = Extract<
  ActionConfig,
  { type: "clear_input" | "set_checkbox" | "hover" | "select_option" }
>;

function ElementTargetFields({
  config,
  onChange,
}: {
  config: Extract<ActionConfig, { type: "clear_input" | "set_checkbox" | "hover" }>;
  onChange: (config: ActionConfig) => void;
}) {
  return (
    <>
      <label>
        XPath
        <input
          value={config.config.xpath}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
          }
        />
      </label>
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
      <label>
        Iframe XPath
        <input
          value={config.config.iframe_xpath ?? ""}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "iframe_xpath", event.currentTarget.value))
          }
          placeholder="Optional iframe XPath"
        />
      </label>
      <label>
        Wait until
        <select
          value={config.config.wait_until ?? "clickable"}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "wait_until", event.currentTarget.value))
          }
        >
          <option value="clickable">Clickable</option>
          <option value="visible">Visible</option>
          <option value="enabled">Enabled</option>
          <option value="attached">Attached</option>
        </select>
      </label>
      <label>
        Timeout ms
        <input
          min="1"
          type="number"
          value={config.config.timeout_ms ?? 5000}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
          }
        />
      </label>
    </>
  );
}
