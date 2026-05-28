import { Button } from "../../../components/ui/button";
import type { WorkflowGraph } from "../../../types/workflow";
import type { GraphSelection } from "../lib/graphEditorCommands";
import { summarizeGraphSelection } from "../lib/graphSelectionPresentation";

type WorkflowGraphSelectionSummaryProps = {
  graph: WorkflowGraph;
  selection: GraphSelection;
  onCopySelection: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
};

export function WorkflowGraphSelectionSummary({
  graph,
  selection,
  onCopySelection,
  onDeleteSelection,
  onDuplicateSelection,
}: WorkflowGraphSelectionSummaryProps) {
  const summary = summarizeGraphSelection(graph, selection);

  return (
    <section className="graph-selected-edge" aria-label="Graph selection summary">
      <h2>Selection</h2>
      <p>
        {summary.nodeCount} nodes selected / {summary.edgeCount} links selected
      </p>
      <dl className="graph-selection-metrics">
        <div>
          <dt>Copyable</dt>
          <dd>{summary.copyableNodeCount} nodes</dd>
        </div>
        <div>
          <dt>Deletable</dt>
          <dd>{summary.deletableNodeCount} nodes</dd>
        </div>
        <div>
          <dt>Internal links</dt>
          <dd>{summary.selectedInternalLinkCount} links</dd>
        </div>
        <div>
          <dt>Protected</dt>
          <dd>{summary.protectedStartCount} Start</dd>
        </div>
      </dl>
      {summary.disabledReason ? (
        <p className="muted">{summary.disabledReason}</p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={!summary.canDuplicate}
        onClick={onDuplicateSelection}
      >
        Duplicate selection
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={!summary.canCopy}
        onClick={onCopySelection}
      >
        Copy selection
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={!summary.canDelete}
        onClick={onDeleteSelection}
      >
        Delete selection
      </Button>
    </section>
  );
}
