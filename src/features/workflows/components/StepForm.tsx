import { useState } from "react";
import type { ActionConfig, WorkflowStep } from "../../../types/workflow";
import { actionLabels, commandMessage } from "../../../lib/workflowUi";
import { updateActionConfigField } from "../lib/workflowStepForm";

type StepFormProps = {
  step: WorkflowStep;
  onDeleteStep: (stepId: string) => void;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
};

export function StepForm({ step, onDeleteStep, onSaveStep }: StepFormProps) {
  const [name, setName] = useState(step.name || actionLabels[step.action_type]);
  const [config, setConfig] = useState<ActionConfig>(step.config);
  const [fieldError, setFieldError] = useState("");

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
    <form className="step-form" onSubmit={saveStep}>
      <div>
        <p className="eyebrow">Step Detail</p>
        <h2>{actionLabels[step.action_type]}</h2>
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
  );
}

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

function ActionFields({ config, onChange }: ActionFieldsProps) {
  switch (config.type) {
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
  }
}
