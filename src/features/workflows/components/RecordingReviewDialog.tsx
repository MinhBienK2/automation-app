import { useRef } from "react";
import { Save, Square, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Alert } from "../../../components/ui/alert";
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
      <DialogContent className="max-w-3xl max-h-[85vh] h-[650px] grid grid-rows-[auto_1fr_auto] gap-4">
        <DialogHeader className="border-b border-base-300 pb-2">
          <p className="eyebrow">Browser Recorder</p>
          <DialogTitle className="font-bold text-base-content">
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
            className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 py-1"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="flex flex-col gap-1 w-full shrink-0">
              <Label htmlFor="recording-workflow-name">Workflow name</Label>
              <Input
                id="recording-workflow-name"
                value={workflowName}
                onChange={(event) => onWorkflowNameChange(event.currentTarget.value)}
                className="input-sm border-base-300 w-full"
              />
            </div>

            <div className="flex flex-col gap-4 mt-2" aria-label="Recorded steps">
              {draft.steps.map((step) => (
                <RecordingStepEditor
                  key={step.id}
                  step={step}
                  onChange={onStepChange}
                />
              ))}
            </div>

            {draft.warnings.length > 0 ? (
              <Alert variant="warning" className="text-xs p-3 shrink-0 flex flex-col items-start gap-1">
                <span className="font-bold">Warnings:</span>
                <ul className="list-disc list-inside pl-1 flex flex-col gap-0.5">
                  {draft.warnings.map((warning, index) => (
                    <li key={`${warning.code}-${warning.event_id ?? index}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            {error ? <Alert variant="error" className="text-xs p-2.5 shrink-0">{error}</Alert> : null}
            <DialogFooter className="flex gap-2 border-t border-base-300 pt-3 mt-4 shrink-0">
              <Button type="submit" disabled={busy} className="btn-primary">
                <Save aria-hidden="true" size={14} className="mr-1" />
                {draft.mode === "replace_current_graph" ? "Replace Graph" : "Save Workflow"}
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={onDiscard}
              >
                <Trash2 aria-hidden="true" size={14} className="mr-1" />
                Discard
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col justify-between h-full py-2">
            <div className="stats bg-base-200 border border-base-300 shadow w-full">
              <div className="stat p-4">
                <div className="stat-title text-xs font-semibold uppercase tracking-wider text-secondary">Status</div>
                <div className="stat-value text-base font-bold text-success mt-1">{session?.status ?? "recording"}</div>
              </div>
              <div className="stat p-4">
                <div className="stat-title text-xs font-semibold uppercase tracking-wider text-secondary">Events</div>
                <div className="stat-value text-base font-bold text-primary mt-1">{session?.event_count ?? 0}</div>
              </div>
              <div className="stat p-4">
                <div className="stat-title text-xs font-semibold uppercase tracking-wider text-secondary">Identity</div>
                <div className="stat-value text-base font-bold text-base-content/80 mt-1 truncate max-w-[200px]" title={session?.browser_identity.display_name}>
                  {session?.browser_identity.display_name ?? "Recording"}
                </div>
              </div>
            </div>
            {error ? <Alert variant="error" className="text-xs p-2.5 my-3">{error}</Alert> : null}
            <DialogFooter className="flex gap-2 border-t border-base-300 pt-3 mt-auto shrink-0">
              <Button type="button" disabled={busy} onClick={onStopRecording} className="btn-primary">
                <Square aria-hidden="true" size={14} className="mr-1" />
                Stop Recording
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={onDiscard}
              >
                <Trash2 aria-hidden="true" size={14} className="mr-1" />
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
    <article className={`card bg-base-200 border card-body p-4 gap-3 ${step.included ? "border-base-300" : "border-base-300 opacity-60"}`}>
      <div className="flex items-center justify-between border-b border-base-300 pb-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            aria-label={`Include ${step.label}`}
            type="checkbox"
            checked={step.included}
            onChange={(event) =>
              onChange({ ...step, included: event.currentTarget.checked })
            }
            className="checkbox checkbox-primary checkbox-xs shrink-0"
          />
          <span className="text-sm font-bold text-base-content">{step.label}</span>
        </label>
        <Badge variant="secondary" className="badge-xs uppercase tracking-wider font-bold">
          {actionLabel(step.action)}
        </Badge>
      </div>

      <div className="flex flex-col gap-1 w-full">
        <Label htmlFor={labelInputId}>Step label</Label>
        <Input
          aria-label={`Step label ${initialLabel.current}`}
          id={labelInputId}
          value={step.label}
          onChange={(event) =>
            onChange({ ...step, label: event.currentTarget.value })
          }
          className="input-xs border-base-300 w-full"
        />
      </div>

      {recordedValueSummary(step.action) ? (
        <p className="text-secondary text-xs italic font-medium bg-base-100 p-2 rounded border border-base-300">
          {recordedValueSummary(step.action)}
        </p>
      ) : null}

      {valueEditor}

      <div className="grid grid-cols-2 gap-2 mt-1 text-[11px] text-secondary font-medium">
        <div className="flex flex-col gap-0.5">
          <span className="uppercase text-[9px] tracking-wider text-secondary/60">Locator Confidence</span>
          <span className="text-base-content font-bold">{step.locator_confidence ?? "not required"}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="uppercase text-[9px] tracking-wider text-secondary/60">Source Events</span>
          <span className="text-base-content font-bold">{step.source_event_ids.join(", ")}</span>
        </div>
      </div>
      {step.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-warning/20 pt-2 mt-1">
          {step.warnings.map((warning, index) => (
            <li key={`${step.id}-${warning.code}-${index}`} className="text-warning text-[11px] font-medium flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-warning shrink-0" />
              <span>{warning.message}</span>
            </li>
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
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor={inputId}>Target URL</Label>
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
            className="input-xs border-base-300 w-full"
          />
        </div>
      );
    }
    case "input_text": {
      const action = step.action;
      return (
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor={inputId}>Text value</Label>
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
            className="input-xs border-base-300 w-full"
          />
        </div>
      );
    }
    case "select_option": {
      const action = step.action;
      return (
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor={inputId}>Select value</Label>
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
            className="input-xs border-base-300 w-full"
          />
        </div>
      );
    }
    case "scroll": {
      const action = step.action;
      return (
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor={inputId}>Scroll pixels</Label>
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
            className="input-xs border-base-300 w-full"
          />
        </div>
      );
    }
    case "upload_file": {
      const action = step.action;
      return (
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor={inputId}>Upload file paths</Label>
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
            className="input-xs border-base-300 w-full"
          />
        </div>
      );
    }
    case "set_clipboard": {
      const action = step.action;
      return (
        <div className="flex flex-col gap-1 w-full">
          <Label htmlFor={inputId}>Clipboard text</Label>
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
            className="input-xs border-base-300 w-full"
          />
        </div>
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
