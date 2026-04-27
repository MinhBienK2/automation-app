import { useState } from "react";
import type { ActionConfig, WorkflowStep } from "../../types/workflow";
import { actionLabels, commandMessage } from "../../lib/workflowUi";

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
              onChange({
                type: "open_url",
                config: { url: event.currentTarget.value },
              })
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
              onChange({
                type: "sleep",
                config: { seconds: Number(event.currentTarget.value) },
              })
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
                onChange({
                  type: "type_text",
                  config: {
                    ...config.config,
                    xpath: event.currentTarget.value,
                  },
                })
              }
            />
          </label>
          <label>
            Text
            <textarea
              value={config.config.text}
              onChange={(event) =>
                onChange({
                  type: "type_text",
                  config: {
                    ...config.config,
                    text: event.currentTarget.value,
                  },
                })
              }
            />
          </label>
        </>
      );
    case "click":
      return (
        <label>
          XPath
          <input
            value={config.config.xpath}
            onChange={(event) =>
              onChange({
                type: "click",
                config: { xpath: event.currentTarget.value },
              })
            }
          />
        </label>
      );
    case "scroll":
      return (
        <>
          <label>
            Direction
            <select
              value={config.config.direction}
              onChange={(event) =>
                onChange({
                  type: "scroll",
                  config: {
                    ...config.config,
                    direction: event.currentTarget.value as "up" | "down",
                  },
                })
              }
            >
              <option value="down">Down</option>
              <option value="up">Up</option>
            </select>
          </label>
          <label>
            Pixels
            <input
              min="1"
              type="number"
              value={config.config.pixels}
              onChange={(event) =>
                onChange({
                  type: "scroll",
                  config: {
                    ...config.config,
                    pixels: Number(event.currentTarget.value),
                  },
                })
              }
            />
          </label>
        </>
      );
  }
}
