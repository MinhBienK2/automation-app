import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import type {
  ElectronRunEvent,
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import { buildRunIssues } from "../../../lib/workflowUi";
import { RunIssuePanel } from "../components/RunIssuePanel";
import { RunStatusBar } from "../components/RunStatusBar";
import {
  WorkflowGraphEditor,
  type GraphSelectionRequest,
} from "../components/WorkflowGraphEditor";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  isRunning: boolean;
  appError: string;
  graphSaveStatus: string;
  runState: RunState;
  workflowGraph: WorkflowGraph | null;
  graphIssues: GraphValidationIssue[];
  graphIssuesNeedRecheck: boolean;
  runEvents: ElectronRunEvent[];
  onBack: () => void;
  onOpenWorkflowSettings: () => void;
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
  graphIssuesNeedRecheck,
  runEvents,
  onBack,
  onOpenWorkflowSettings,
  onStopRun,
  onGraphChange,
  onRunGraph,
  onSaveGraph,
  onValidateGraph,
}: WorkflowDetailPageProps) {
  const [selectionRequest, setSelectionRequest] =
    useState<GraphSelectionRequest | null>(null);
  const runIssues = useMemo(
    () =>
      buildRunIssues({
        appError,
        graphIssues,
        graphIssuesNeedRecheck,
        runState,
      }),
    [appError, graphIssues, graphIssuesNeedRecheck, runState],
  );
  const totalBlockingIssues = graphIssues.filter((issue) => issue.level === "error").length;
  const hasBlockingIssues = totalBlockingIssues > 0;
  const requestNodeSelection = (nodeId: string) => {
    setSelectionRequest({
      requestId: Date.now(),
      nodeId,
      edgeId: null,
    });
  };
  const requestEdgeSelection = (edgeId: string) => {
    setSelectionRequest({
      requestId: Date.now(),
      nodeId: null,
      edgeId,
    });
  };
  return (
    <section className="app-screen workflow-detail-screen">
      <PageHeader
        ariaLabel="Workflow detail header"
        backLabel="Back to Workflows"
        eyebrow="Workflow Detail"
        meta={[graphSaveStatus]}
        status={
          <RunStatusBar
            state={runState}
            error={appError}
            hasBlockingIssues={hasBlockingIssues}
            runEvents={runEvents}
          />
        }
        title={detail.workflow.name}
        onBack={onBack}
        actions={
          <div className={isRunning ? "run-actions run-actions-with-stop" : "run-actions"}>
            <Button
              variant="secondary"
              type="button"
              onClick={onOpenWorkflowSettings}
            >
              <Settings aria-hidden="true" />
              Settings
            </Button>
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

      <RunIssuePanel
        issues={runIssues}
        issuesNeedRecheck={graphIssuesNeedRecheck}
        totalBlockingIssues={totalBlockingIssues}
        onRunAgain={onRunGraph}
        onSaveAgain={onSaveGraph}
        onSelectEdge={requestEdgeSelection}
        onSelectNode={requestNodeSelection}
        onValidateAgain={onValidateGraph}
      />

      {workflowGraph ? (
        <WorkflowGraphEditor
          graph={workflowGraph}
          runState={runState}
          validationIssues={graphIssues}
          selectionRequest={selectionRequest}
          onChange={onGraphChange}
          onRunGraph={onRunGraph}
          onSaveGraph={onSaveGraph}
          onValidateGraph={onValidateGraph}
        />
      ) : null}
    </section>
  );
}
