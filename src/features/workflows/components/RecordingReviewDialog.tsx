import { useRef } from "react";
import { Save, Square, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type {
  ActionConfig,
  ReviewedRecordingStep,
  RecordingSession,
  RecordingWorkflowDraft,
} from "../../../types/workflow";

type RecordingReviewDialogProps = {
  open: boolean;
  session: RecordingSession | null;
  draft: RecordingWorkflowDraft | null;
  workflowName: string;
  busy: boolean;
  error: string;
  onWorkflowNameChange: (value: string) => void;
  onStopRecording: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onStepChange: (step: ReviewedRecordingStep) => void;
  onOpenChange: (open: boolean) => void;
};

export function RecordingReviewDialog({
  open,
  session,
  draft,
  workflowName,
  busy,
  error,
  onWorkflowNameChange,
  onStopRecording,
  onDiscard,
  onSave,
  onStepChange,
  onOpenChange,
}: RecordingReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="recording-review-dialog">
        <DialogHeader>
          <p className="eyebrow">Browser Recorder</p>
          <DialogTitle>
            {draft ? "Review Recording" : "Recording Workflow"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {draft
              ? "Review captured actions before saving the workflow."
              : "Recorder browser session is active."}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <form
            className="recording-review-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <Label htmlFor="recording-workflow-name">
              Workflow name
              <Input
                id="recording-workflow-name"
                value={workflowName}
                onChange={(event) => onWorkflowNameChange(event.currentTarget.value)}
              />
            </Label>

            <div className="recording-step-list" aria-label="Recorded steps">
              {draft.steps.map((step) => (
                <RecordingStepEditor
                  key={step.id}
                  step={step}
                  onChange={onStepChange}
                />
              ))}
            </div>

            {draft.warnings.length > 0 ? (
              <ul className="recording-warning-list">
                {draft.warnings.map((warning, index) => (
                  <li key={`${warning.code}-${warning.event_id ?? index}`}>
                    {warning.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {error ? <p className="field-error">{error}</p> : null}
            <DialogFooter className="form-actions recording-review-actions">
              <Button shape="pill" type="submit" disabled={busy}>
                <Save aria-hidden="true" />
                {draft.mode === "replace_current_graph" ? "Replace Graph" : "Save Workflow"}
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={onDiscard}
              >
                <Trash2 aria-hidden="true" />
                Discard
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="recording-session-panel">
            <dl className="recording-session-summary">
              <div>
                <dt>Status</dt>
                <dd>{session?.status ?? "recording"}</dd>
              </div>
              <div>
                <dt>Events</dt>
                <dd>{session?.event_count ?? 0}</dd>
              </div>
              <div>
                <dt>Identity</dt>
                <dd>{session?.browser_identity.display_name ?? "Recording"}</dd>
              </div>
            </dl>
            {error ? <p className="field-error">{error}</p> : null}
            <DialogFooter className="form-actions recording-review-actions">
              <Button shape="pill" type="button" disabled={busy} onClick={onStopRecording}>
                <Square aria-hidden="true" />
                Stop Recording
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={onDiscard}
              >
                <Trash2 aria-hidden="true" />
                Discard
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecordingStepEditor({
  step,
  onChange,
}: {
  step: ReviewedRecordingStep;
  onChange: (step: ReviewedRecordingStep) => void;
}) {
  const labelInputId = `${step.id}-label`;
  const valueInputId = `${step.id}-value`;
  const initialLabel = useRef(step.label);
  const valueEditor = valueEditorForAction(step, valueInputId, onChange);

  return (
    <article className="recording-step" data-included={step.included}>
      <div className="recording-step-header">
        <label className="recording-step-include">
          <input
            aria-label={`Include ${step.label}`}
            type="checkbox"
            checked={step.included}
            onChange={(event) =>
              onChange({ ...step, included: event.currentTarget.checked })
            }
          />
          <span>{step.label}</span>
        </label>
        <span className="recording-action-pill">{actionLabel(step.action)}</span>
      </div>

      <Label htmlFor={labelInputId}>
        Step label
        <Input
          aria-label={`Step label ${initialLabel.current}`}
          id={labelInputId}
          value={step.label}
          onChange={(event) =>
            onChange({ ...step, label: event.currentTarget.value })
          }
        />
      </Label>

      {recordedValueSummary(step.action) ? (
        <p className="recording-step-value">{recordedValueSummary(step.action)}</p>
      ) : null}

      {valueEditor}

      <dl className="recording-step-meta">
        <div>
          <dt>Locator</dt>
          <dd>{step.locator_confidence ?? "not required"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{step.source_event_ids.join(", ")}</dd>
        </div>
      </dl>
      {step.warnings.length > 0 ? (
        <ul className="recording-warning-list">
          {step.warnings.map((warning, index) => (
            <li key={`${step.id}-${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function valueEditorForAction(
  step: ReviewedRecordingStep,
  inputId: string,
  onChange: (step: ReviewedRecordingStep) => void,
) {
  switch (step.action.type) {
    case "navigate": {
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Target URL
          <Input
            id={inputId}
            value={action.config.url}
            onChange={(event) =>
              onChange({
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
    case "input_text": {
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Text value
          <Input
            id={inputId}
            value={action.config.text}
            onChange={(event) =>
              onChange({
                ...step,
                action: {
                  type: "input_text",
                  config: { ...action.config, text: event.currentTarget.value },
                },
              })
            }
          />
        </Label>
      );
    }
    case "select_option": {
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Select value
          <Input
            id={inputId}
            value={action.config.value}
            onChange={(event) =>
              onChange({
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
    case "scroll": {
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
              onChange({
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
    case "upload_file": {
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Upload file paths
          <Input
            id={inputId}
            value={action.config.files.join(", ")}
            onChange={(event) =>
              onChange({
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
    case "set_clipboard": {
      const action = step.action;
      return (
        <Label htmlFor={inputId}>
          Clipboard text
          <Input
            id={inputId}
            value={action.config.text}
            onChange={(event) =>
              onChange({
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

function actionLabel(action: ActionConfig) {
  switch (action.type) {
    case "navigate":
      return "Navigate";
    case "click":
      return "Click";
    case "input_text":
      return "Input";
    case "select_option":
      return "Select";
    case "check":
      return "Check";
    case "uncheck":
      return "Uncheck";
    case "select_radio":
      return "Radio";
    case "scroll":
      return "Scroll";
    case "press_key":
      return "Key";
    case "hotkey":
      return "Hotkey";
    case "set_clipboard":
      return "Set Clipboard";
    case "paste_clipboard":
      return "Paste";
    case "upload_file":
      return "Upload";
    case "double_click":
      return "Double Click";
    case "right_click":
      return "Right Click";
    case "switch_tab":
      return "Tab";
    case "wait_for_download":
      return "Download";
    case "accept_dialog":
      return "Accept Dialog";
    case "dismiss_dialog":
      return "Dismiss Dialog";
    case "take_screenshot":
      return "Screenshot";
    default:
      return action.type;
  }
}

function recordedValueSummary(action: ActionConfig) {
  switch (action.type) {
    case "navigate":
      return action.config.url;
    case "input_text":
      return action.config.text;
    case "select_option":
      return action.config.value;
    case "scroll":
      return `${action.config.pixels ?? 0}px ${action.config.direction ?? "down"}`;
    case "press_key":
      return action.config.key;
    case "hotkey":
      return action.config.keys.join(" + ");
    case "set_clipboard":
      return action.config.text;
    case "paste_clipboard":
      return "Paste clipboard";
    case "upload_file":
      return action.config.files.length
        ? action.config.files.join(", ")
        : "Requires reviewed local file paths";
    case "wait_for_download":
      return action.config.output_name;
    case "take_screenshot":
      return action.config.output_name ?? action.config.path;
    default:
      return null;
  }
}

function splitFilePathInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
