import { Button } from "../../../components/ui/button";
import type { RecordingWorkflowDraft } from "../../../types/workflow";
import {
  filterRecordingSteps,
  type RecordingStepFilter,
  summarizeRecordingDraft,
} from "../lib/recordingReview";

type RecordingReviewSummaryProps = {
  draft: RecordingWorkflowDraft;
  activeFilter: RecordingStepFilter;
  onFilterChange: (filter: RecordingStepFilter) => void;
};

const filterLabels: Array<{ filter: RecordingStepFilter; label: string }> = [
  { filter: "all", label: "All" },
  { filter: "included", label: "Included" },
  { filter: "excluded", label: "Excluded" },
  { filter: "warnings", label: "Warnings" },
  { filter: "needs_attention", label: "Needs attention" },
];

export function RecordingReviewSummary({
  draft,
  activeFilter,
  onFilterChange,
}: RecordingReviewSummaryProps) {
  const summary = summarizeRecordingDraft(draft);

  return (
    <section className="recording-review-summary" aria-label="Recording summary">
      <div className="recording-summary-metrics">
        <span>{summary.totalSteps} total steps</span>
        <span>{summary.includedSteps} included</span>
        <span>{summary.excludedSteps} excluded</span>
        <span>{summary.needsAttentionCount} needs attention</span>
      </div>
      <div className="recording-filter-tabs" aria-label="Recording step filters">
        {filterLabels.map(({ filter, label }) => (
          <Button
            key={filter}
            type="button"
            variant={activeFilter === filter ? "primary" : "secondary"}
            size="sm"
            aria-pressed={activeFilter === filter}
            onClick={() => onFilterChange(filter)}
          >
            {label} {filterRecordingSteps(draft.steps, filter).length}
          </Button>
        ))}
      </div>
    </section>
  );
}
