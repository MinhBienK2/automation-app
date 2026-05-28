import { StatusCluster } from "../../../components/patterns/StatusCluster";
import type { ReviewedRecordingStep } from "../../../types/workflow";
import {
  filterRecordingSteps,
  getRecordingStepBadges,
  recordingActionLabel,
  safeRecordingValueSummary,
  type RecordingStepFilter,
} from "../lib/recordingReview";

type RecordingStepListProps = {
  steps: ReviewedRecordingStep[];
  filter: RecordingStepFilter;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onStepChange: (step: ReviewedRecordingStep) => void;
};

export function RecordingStepList({
  steps,
  filter,
  selectedStepId,
  onSelectStep,
  onStepChange,
}: RecordingStepListProps) {
  const visibleSteps = filterRecordingSteps(steps, filter);

  if (visibleSteps.length === 0) {
    return (
      <div className="recording-empty-filter" role="status">
        No recorded steps match this filter.
      </div>
    );
  }

  return (
    <ol className="recording-step-list" aria-label="Recorded steps">
      {visibleSteps.map((step) => {
        const sequence = steps.findIndex((candidate) => candidate.id === step.id) + 1;
        const summary = safeRecordingValueSummary(step);

        return (
          <li
            key={step.id}
            className="recording-step-row"
            data-selected={selectedStepId === step.id}
            data-included={step.included}
          >
            <button
              type="button"
              aria-label={`Step ${sequence} ${step.label}`}
              aria-pressed={selectedStepId === step.id}
              onClick={() => onSelectStep(step.id)}
            >
              <span className="recording-step-row-index">Step {sequence}</span>
              <span className="recording-step-row-main">
                <strong>{step.label}</strong>
                <span>{recordingActionLabel(step.action)}</span>
                {summary ? <small>{summary}</small> : null}
              </span>
              <StatusCluster
                ariaLabel={`Step ${sequence} status`}
                items={getRecordingStepBadges(step)}
              />
            </button>
            <label className="recording-step-row-toggle">
              <input
                aria-label={`Include row Step ${sequence} ${step.label}`}
                type="checkbox"
                checked={step.included}
                onChange={(event) =>
                  onStepChange({ ...step, included: event.currentTarget.checked })
                }
              />
            </label>
          </li>
        );
      })}
    </ol>
  );
}
