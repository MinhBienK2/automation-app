import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { KeyValueList } from "../../../components/patterns/KeyValueList";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type {
  ReviewedRecordingStep,
  RecordingSession,
  RecordingWorkflowDraft,
} from "../../../types/workflow";
import {
  filterRecordingSteps,
  findFirstBlockedRecordingStepId,
  getRecordingSaveBlockers,
  recordingStepNeedsAttention,
  type RecordingStepFilter,
} from "../lib/recordingReview";
import { RecordingDiscardDialog } from "./RecordingDiscardDialog";
import { RecordingReviewSummary } from "./RecordingReviewSummary";
import { RecordingSessionPanel } from "./RecordingSessionPanel";
import { RecordingStepDetail } from "./RecordingStepDetail";
import { RecordingStepList } from "./RecordingStepList";

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
  const [discardGuardOpen, setDiscardGuardOpen] = useState(false);
  const [filter, setFilter] = useState<RecordingStepFilter>("all");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) {
      setFilter("all");
      setSelectedStepId(null);
      return;
    }
    const firstAttention = draft.steps.find(recordingStepNeedsAttention);
    setSelectedStepId((current) =>
      current && draft.steps.some((step) => step.id === current)
        ? current
        : firstAttention?.id ?? draft.steps[0]?.id ?? null,
    );
  }, [draft]);

  const visibleSteps = useMemo(
    () => (draft ? filterRecordingSteps(draft.steps, filter) : []),
    [draft, filter],
  );
  const selectedStep = useMemo(() => {
    if (!draft) return null;
    const visibleSelected = visibleSteps.find((step) => step.id === selectedStepId);
    if (visibleSelected) return visibleSelected;
    return draft.steps.find((step) => step.id === selectedStepId) ??
      visibleSteps[0] ??
      draft.steps[0] ??
      null;
  }, [draft, selectedStepId, visibleSteps]);
  const selectedSequence = draft && selectedStep
    ? draft.steps.findIndex((step) => step.id === selectedStep.id) + 1
    : 0;
  const saveBlockers = getRecordingSaveBlockers({
    draft,
    workflowName,
    busy,
  });
  const saveLabel = draft?.mode === "replace_current_graph"
    ? "Replace Graph"
    : "Save Workflow";

  function requestDiscard() {
    setDiscardGuardOpen(true);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (session || draft) {
      setDiscardGuardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleFilterChange(nextFilter: RecordingStepFilter) {
    setFilter(nextFilter);
    if (!draft) return;
    const nextVisibleSteps = filterRecordingSteps(draft.steps, nextFilter);
    if (!nextVisibleSteps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(nextVisibleSteps[0]?.id ?? draft.steps[0]?.id ?? null);
    }
  }

  function selectFirstBlocker() {
    const blockedStepId = findFirstBlockedRecordingStepId(saveBlockers);
    if (blockedStepId) setSelectedStepId(blockedStepId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveBlockers.length > 0) {
      selectFirstBlocker();
      return;
    }
    onSave();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="fullscreen-ish" className="recording-review-dialog">
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

          <DialogBody className="recording-review-body">
            {draft ? (
              <form className="recording-review-form" onSubmit={handleSubmit}>
                <div className="recording-review-topbar">
                  {draft.mode === "replace_current_graph" ? (
                    <div className="recording-replace-copy">
                      <KeyValueList
                        items={[{ label: "Workflow", value: workflowName || "Current workflow" }]}
                      />
                      <p>
                        This replaces only the current workflow graph and keeps settings,
                        schedule, and browser identity unchanged.
                      </p>
                      <p>It does not create a new workflow.</p>
                    </div>
                  ) : (
                    <Label htmlFor="recording-workflow-name">
                      Workflow name
                      <Input
                        aria-label="Workflow name"
                        id="recording-workflow-name"
                        value={workflowName}
                        onChange={(event) =>
                          onWorkflowNameChange(event.currentTarget.value)
                        }
                      />
                    </Label>
                  )}
                  <RecordingReviewSummary
                    draft={draft}
                    activeFilter={filter}
                    onFilterChange={handleFilterChange}
                  />
                </div>

                <div className="recording-review-workspace">
                  <RecordingStepList
                    steps={draft.steps}
                    filter={filter}
                    selectedStepId={selectedStep?.id ?? null}
                    onSelectStep={setSelectedStepId}
                    onStepChange={onStepChange}
                  />
                  <RecordingStepDetail
                    step={selectedStep}
                    sequence={selectedSequence}
                    onStepChange={onStepChange}
                  />
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
                  <div className="recording-save-status" aria-live="polite">
                    {saveBlockers.length > 0 ? (
                      <>
                        <span>
                          {saveBlockers.length}{" "}
                          {saveBlockers.length === 1 ? "blocker" : "blockers"} before save
                        </span>
                        <Button
                          type="button"
                          variant="quiet"
                          size="sm"
                          onClick={selectFirstBlocker}
                        >
                          Review first blocker
                        </Button>
                      </>
                    ) : (
                      <span>Ready to save reviewed recording</span>
                    )}
                  </div>
                  <Button
                    shape="pill"
                    type="submit"
                    disabled={busy || saveBlockers.length > 0}
                  >
                    <Save aria-hidden="true" />
                    {saveLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={busy}
                    onClick={requestDiscard}
                  >
                    <Trash2 aria-hidden="true" />
                    Discard
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <RecordingSessionPanel
                session={session}
                busy={busy}
                error={error}
                onStopRecording={onStopRecording}
                onRequestDiscard={requestDiscard}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <RecordingDiscardDialog
        open={discardGuardOpen}
        onOpenChange={setDiscardGuardOpen}
        onConfirm={() => {
          setDiscardGuardOpen(false);
          onDiscard();
        }}
      />
    </>
  );
}
