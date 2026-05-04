import type {
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import { RunStatusBar } from "../components/RunStatusBar";
import { WorkflowGraphEditor } from "../components/WorkflowGraphEditor";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  isRunning: boolean;
  appError: string;
  graphSaveStatus: string;
  runState: RunState;
  workflowGraph: WorkflowGraph | null;
  graphIssues: GraphValidationIssue[];
  onBack: () => void;
  onStopRun: () => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => void;
  onSaveGraph: () => void;
  onValidateGraph: () => void;
};

export function WorkflowDetailPage({
  detail,
  isRunning,
  appError,
  graphSaveStatus,
  runState,
  workflowGraph,
  graphIssues,
  onBack,
  onStopRun,
  onGraphChange,
  onRunGraph,
  onSaveGraph,
  onValidateGraph,
}: WorkflowDetailPageProps) {
  return (
    <section className="app-screen workflow-detail-screen">
      <PageHeader
        ariaLabel="Workflow detail header"
        backLabel="Back to Workflows"
        eyebrow="Workflow Detail"
        meta={["Graph workspace", graphSaveStatus, `Updated ${detail.workflow.updated_at}`]}
        status={<RunStatusBar state={runState} error={appError} />}
        title={detail.workflow.name}
        onBack={onBack}
        actions={
          <div className={isRunning ? "run-actions run-actions-with-stop" : "run-actions"}>
            <Button
              variant="secondary"
              type="button"
              onClick={onValidateGraph}
            >
              Validate
            </Button>
            <Button
              shape="pill"
              type="button"
              onClick={onRunGraph}
              disabled={isRunning}
            >
              Run
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={onSaveGraph}
            >
              Save
            </Button>
            {isRunning ? (
              <Button variant="destructive" type="button" onClick={onStopRun}>
                Stop
              </Button>
            ) : null}
          </div>
        }
      />

      {workflowGraph ? (
        <WorkflowGraphEditor
          graph={workflowGraph}
          runState={runState}
          validationIssues={graphIssues}
          onChange={onGraphChange}
          onRunGraph={onRunGraph}
          onSaveGraph={onSaveGraph}
          onValidateGraph={onValidateGraph}
        />
      ) : null}
    </section>
  );
}
