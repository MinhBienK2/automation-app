import { KeyValueList } from "../../../components/patterns/KeyValueList";
import { StatusCluster } from "../../../components/patterns/StatusCluster";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { ReviewedRecordingStep } from "../../../types/workflow";
import {
  formatLocatorSummary,
  getActionTarget,
  getEditableRecordingValueField,
  getRecordingStepBadges,
  recordingActionLabel,
  safeRecordingValueSummary,
  splitFilePathInput,
} from "../lib/recordingReview";

type RecordingStepDetailProps = {
  step: ReviewedRecordingStep | null;
  sequence: number;
  onStepChange: (step: ReviewedRecordingStep) => void;
};

export function RecordingStepDetail({
  step,
  sequence,
  onStepChange,
}: RecordingStepDetailProps) {
  if (!step) {
    return (
      <section
        className="recording-step-detail"
        role="region"
        aria-label="Selected recording step"
      >
        <p>No recorded step selected.</p>
      </section>
    );
  }

  const valueSummary = safeRecordingValueSummary(step);

  return (
    <section
      className="recording-step-detail"
      role="region"
      aria-label="Selected recording step"
    >
      <div className="recording-step-detail-header">
        <div>
          <p className="eyebrow">Step {sequence}</p>
          <h3>{step.label}</h3>
        </div>
        <StatusCluster
          ariaLabel="Selected step status"
          items={getRecordingStepBadges(step)}
        />
      </div>

      <div className="recording-step-editor-grid">
        <label className="recording-step-include">
          <input
            aria-label={`Include ${step.label}`}
            type="checkbox"
            checked={step.included}
            onChange={(event) =>
              onStepChange({ ...step, included: event.currentTarget.checked })
            }
          />
          <span>Include in saved graph</span>
        </label>

        <Label htmlFor={`${step.id}-label`}>
          Step label
          <Input
            aria-label={`Step label ${step.label}`}
            id={`${step.id}-label`}
            value={step.label}
            onChange={(event) =>
              onStepChange({ ...step, label: event.currentTarget.value })
            }
          />
        </Label>

        {renderValueEditor(step, onStepChange)}
      </div>

      {valueSummary ? (
        <p className="recording-step-value">{valueSummary}</p>
      ) : null}

      <KeyValueList
        items={[
          { label: "Action type", value: recordingActionLabel(step.action) },
          {
            label: "Locator",
            value: formatLocatorSummary(getActionTarget(step.action)),
            monospace: true,
          },
          { label: "Locator confidence", value: step.locator_confidence ?? "not required" },
          {
            label: "Timing",
            value: step.timing
              ? "Backend-held timing captured"
              : "Backend-held timing not captured",
          },
        ]}
      />

      {step.warnings.length > 0 ? (
        <ul className="recording-warning-list">
          {step.warnings.map((warning, index) => (
            <li key={`${step.id}-${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      <details className="recording-source-events">
        <summary>Source event ids</summary>
        <p>{step.source_event_ids.join(", ")}</p>
      </details>
    </section>
  );
}

function renderValueEditor(
  step: ReviewedRecordingStep,
  onStepChange: (step: ReviewedRecordingStep) => void,
) {
  const field = getEditableRecordingValueField(step);
  const inputId = `${step.id}-value`;

  switch (field) {
    case "url": {
      if (step.action.type !== "navigate") return null;
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Target URL
          <Input
            id={inputId}
            value={action.config.url}
            onChange={(event) =>
              onStepChange({
                ...step,
                action: {
                  type: "navigate",
                  config: { ...action.config, url: event.currentTarget.value },
                },
              })
            }
          />
        </Label>
      );
    }
    case "text": {
      const action = step.action;
      if (
        action.type !== "input_text" &&
        action.type !== "set_contenteditable" &&
        action.type !== "type_sequence"
      ) {
        return null;
      }
      return (
        <Label htmlFor={inputId}>
          Text value
          <Input
            aria-label="Text value"
            id={inputId}
            value={action.config.text}
            onChange={(event) => {
              const text = event.currentTarget.value;
              if (action.type === "input_text") {
                onStepChange({
                  ...step,
                  action: {
                    type: "input_text",
                    config: { ...action.config, text },
                  },
                });
                return;
              }
              if (action.type === "set_contenteditable") {
                onStepChange({
                  ...step,
                  action: {
                    type: "set_contenteditable",
                    config: { ...action.config, text },
                  },
                });
                return;
              }
              onStepChange({
                ...step,
                action: {
                  type: "type_sequence",
                  config: { ...action.config, text },
                },
              });
            }}
          />
        </Label>
      );
    }
    case "select_value": {
      if (step.action.type !== "select_option") return null;
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Select value
          <Input
            id={inputId}
            value={action.config.value}
            onChange={(event) =>
              onStepChange({
                ...step,
                action: {
                  type: "select_option",
                  config: { ...action.config, value: event.currentTarget.value },
                },
              })
            }
          />
        </Label>
      );
    }
    case "scroll_pixels": {
      if (step.action.type !== "scroll") return null;
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Scroll pixels
          <Input
            id={inputId}
            min={0}
            type="number"
            value={action.config.pixels ?? 0}
            onChange={(event) =>
              onStepChange({
                ...step,
                action: {
                  type: "scroll",
                  config: {
                    ...action.config,
                    pixels: Number(event.currentTarget.value) || 0,
                  },
                },
              })
            }
          />
        </Label>
      );
    }
    case "upload_files": {
      if (step.action.type !== "upload_file") return null;
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Upload file paths
          <Input
            id={inputId}
            value={action.config.files.join(", ")}
            onChange={(event) =>
              onStepChange({
                ...step,
                action: {
                  type: "upload_file",
                  config: {
                    ...action.config,
                    files: splitFilePathInput(event.currentTarget.value),
                  },
                },
              })
            }
          />
        </Label>
      );
    }
    case "clipboard_text": {
      if (step.action.type !== "set_clipboard") return null;
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Clipboard text
          <Input
            id={inputId}
            value={action.config.text}
            onChange={(event) =>
              onStepChange({
                ...step,
                action: {
                  type: "set_clipboard",
                  config: { ...action.config, text: event.currentTarget.value },
                },
              })
            }
          />
        </Label>
      );
    }
    default:
      return null;
  }
}
