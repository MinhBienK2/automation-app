import { Button } from "../../../components/ui/button";
import type {
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
} from "../../../types/workflow";
import {
  graphIssueStatusLabel,
  summarizeGraphHealth,
} from "../lib/graphIssuePresentation";

type WorkflowGraphEmptyInspectorProps = {
  graph: WorkflowGraph;
  issues: GraphValidationIssue[];
  issuesNeedRecheck: boolean;
  runState: RunState;
  onAddAction: () => void;
  onAddLogic: () => void;
  onAutoArrange: () => void;
  onFitView: () => void;
  onValidateGraph: () => void;
};

export function WorkflowGraphEmptyInspector({
  graph,
  issues,
  issuesNeedRecheck,
  runState,
  onAddAction,
  onAddLogic,
  onAutoArrange,
  onFitView,
  onValidateGraph,
}: WorkflowGraphEmptyInspectorProps) {
  const health = summarizeGraphHealth({ graph, issues, issuesNeedRecheck, runState });

  return (
    <section className="graph-empty-inspector" aria-label="Graph health">
      <div>
        <h2>Graph health</h2>
        <p className="muted">
          {graphIssueStatusLabel({
            issueCount: health.validationIssueCount,
            issuesNeedRecheck,
          })}
        </p>
      </div>

      <dl className="graph-health-metrics">
        <div>
          <dt>Nodes</dt>
          <dd>{health.totalNodes} nodes</dd>
        </div>
        <div>
          <dt>Links</dt>
          <dd>{health.totalLinks} links</dd>
        </div>
        <div>
          <dt>Draft nodes</dt>
          <dd>{health.unconfiguredActionNodes} unconfigured</dd>
        </div>
        <div>
          <dt>Last run</dt>
          <dd>{health.lastRunStatus}</dd>
        </div>
      </dl>

      <div className="graph-empty-actions" aria-label="Graph next actions">
        <Button type="button" variant="secondary" onClick={onAddAction}>
          Add Action
        </Button>
        <Button type="button" variant="secondary" onClick={onAddLogic}>
          Add Logic
        </Button>
        <Button type="button" variant="secondary" onClick={onValidateGraph}>
          Validate
        </Button>
        <Button type="button" variant="secondary" onClick={onFitView}>
          Fit view
        </Button>
        <Button type="button" variant="secondary" onClick={onAutoArrange}>
          Auto arrange
        </Button>
      </div>
    </section>
  );
}
