import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Save, Settings } from "lucide-react";
import type {
  GraphValidationIssue,
  GraphEdgeDelay,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { buildRunIssues } from "../../../lib/workflowUi";
import { RunProgressNavigator } from "../components/RunProgressNavigator";
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
  defaultEdgeDelay?: GraphEdgeDelay | null;
  onBack: () => void;
  onOpenWorkflowSettings: () => void;
  onStopRun: () => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => void;
  onRunGraphFromSelected: () => void;
  onSelectedGraphNodeChange: (nodeId: string | null) => void;
  showRunGraphFromSelected: boolean;
  canRunGraphFromSelected: boolean;
  runGraphFromSelectedReason: string;
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
  defaultEdgeDelay,
  onBack,
  onOpenWorkflowSettings,
  onStopRun,
  onGraphChange,
  onRunGraph,
  onRunGraphFromSelected,
  onSelectedGraphNodeChange,
  showRunGraphFromSelected,
  canRunGraphFromSelected,
  runGraphFromSelectedReason,
  onSaveGraph,
  onValidateGraph,
}: WorkflowDetailPageProps) {
  const [selectionRequest, setSelectionRequest] =
    useState<GraphSelectionRequest | null>(null);
  const [followCurrentNode, setFollowCurrentNode] = useState(true);
  const selectionRequestIdRef = useRef(0);
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
  const requestNodeSelection = useCallback((nodeId: string) => {
    selectionRequestIdRef.current += 1;
    setSelectionRequest({
      requestId: selectionRequestIdRef.current,
      nodeId,
      edgeId: null,
    });
  }, []);
  const requestEdgeSelection = (edgeId: string) => {
    selectionRequestIdRef.current += 1;
    setSelectionRequest({
      requestId: selectionRequestIdRef.current,
      nodeId: null,
      edgeId,
    });
  };
  const currentRunNodeId =
    runState.status === "failed"
      ? runState.error?.step_id ?? null
      : runState.status === "running"
        ? runState.current_step_id
        : null;

  useEffect(() => {
    if (!followCurrentNode || !currentRunNodeId || !workflowGraph) return;
    requestNodeSelection(currentRunNodeId);
  }, [currentRunNodeId, followCurrentNode, requestNodeSelection, workflowGraph]);

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
          />
        }
        title={detail.workflow.name}
        onBack={onBack}
        actions={
          <div className={isRunning ? "run-actions run-actions-with-stop" : "run-actions"}>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Settings"
              onClick={onOpenWorkflowSettings}
            >
              <Settings aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Validate"
              onClick={onValidateGraph}
            >
              <CheckCircle2 aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Save"
              onClick={onSaveGraph}
            >
              <Save aria-hidden="true" />
            </IconButton>
            {showRunGraphFromSelected ? (
              <Button
                className="workflow-command-secondary"
                variant="secondary"
                size="sm"
                type="button"
                onClick={onRunGraphFromSelected}
                disabled={!canRunGraphFromSelected}
                title={runGraphFromSelectedReason}
              >
                Run from selected
              </Button>
            ) : null}
            <Button
              className="workflow-command-primary"
              size="sm"
              type="button"
              onClick={onRunGraph}
              disabled={isRunning}
            >
              Launch Run
            </Button>
            {isRunning ? (
              <Button
                className="workflow-command-stop"
                variant="destructive"
                size="sm"
                type="button"
                onClick={onStopRun}
              >
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
        <>
          <RunProgressNavigator
            graph={workflowGraph}
            runState={runState}
            followCurrentNode={followCurrentNode}
            onFollowCurrentNodeChange={setFollowCurrentNode}
            onFocusNode={requestNodeSelection}
          />
          <WorkflowGraphEditor
            graph={workflowGraph}
            runState={runState}
            validationIssues={graphIssues}
            selectionRequest={selectionRequest}
            defaultEdgeDelay={defaultEdgeDelay}
            onChange={onGraphChange}
            onRunGraph={onRunGraph}
            onSelectedNodeChange={onSelectedGraphNodeChange}
            onSaveGraph={onSaveGraph}
            onValidateGraph={onValidateGraph}
          />
        </>
      ) : null}

    </section>
  );
}
