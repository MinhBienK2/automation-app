import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivitySquare, CheckCircle2, Save, Settings } from "lucide-react";
import type {
  GraphValidationIssue,
  GraphEdgeDelay,
  RunState,
  SubflowSummary,
  WorkflowGraph,
  WorkflowDetail,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { buildRunIssues } from "../../../lib/workflowUi";
import { RunMonitorDrawer } from "../components/RunMonitorDrawer";
import { RunIssuePanel } from "../components/RunIssuePanel";
import { RunStatusBar } from "../components/RunStatusBar";
import {
  WorkflowGraphEditor,
  type GraphSelectionRequest,
} from "../components/WorkflowGraphEditor";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  environmentName?: string | null;
  isRunning: boolean;
  appError: string;
  graphSaveStatus: string;
  runState: RunState;
  workflowGraph: WorkflowGraph | null;
  graphIssues: GraphValidationIssue[];
  subflowOptions?: SubflowSummary[];
  graphIssuesNeedRecheck: boolean;
  defaultEdgeDelay?: GraphEdgeDelay | null;
  liveRunEnabled: boolean;
  liveRunFollowCurrent: boolean;
  onBack: () => void;
  onOpenWorkflowSettings: () => void;
  onStopRun: () => void;
  onCreateSubflowFromSelection?: (input: {
    name: string;
    graph: WorkflowGraph;
  }) => Promise<{ id: string; name: string }>;
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
  environmentName = null,
  isRunning,
  appError,
  graphSaveStatus,
  runState,
  workflowGraph,
  graphIssues,
  subflowOptions = [],
  graphIssuesNeedRecheck,
  defaultEdgeDelay,
  liveRunEnabled,
  liveRunFollowCurrent,
  onBack,
  onOpenWorkflowSettings,
  onStopRun,
  onCreateSubflowFromSelection,
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
  const [followCurrentNode, setFollowCurrentNode] = useState(liveRunFollowCurrent);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const selectionRequestIdRef = useRef(0);
  const monitorManuallyClosedRef = useRef(false);
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
    setFollowCurrentNode(liveRunFollowCurrent);
    setMonitorOpen(false);
    monitorManuallyClosedRef.current = false;
  }, [detail.workflow.id, liveRunFollowCurrent]);

  useEffect(() => {
    if (!liveRunEnabled || runState.status !== "running" || monitorManuallyClosedRef.current) {
      return;
    }
    setMonitorOpen(true);
  }, [liveRunEnabled, runState.status]);

  useEffect(() => {
    if (!liveRunEnabled || !followCurrentNode || !currentRunNodeId || !workflowGraph) return;
    requestNodeSelection(currentRunNodeId);
  }, [currentRunNodeId, followCurrentNode, liveRunEnabled, requestNodeSelection, workflowGraph]);

  const toggleMonitor = () => {
    setMonitorOpen((current) => {
      const next = !current;
      monitorManuallyClosedRef.current = !next;
      return next;
    });
  };

  const closeMonitor = () => {
    monitorManuallyClosedRef.current = true;
    setMonitorOpen(false);
  };

  return (
    <section className="app-screen workflow-detail-screen">
      <PageHeader
        ariaLabel="Workflow detail header"
        backLabel="Back to Workflows"
        eyebrow="Workflow Detail"
        meta={[
          graphSaveStatus,
          ...(environmentName ? [`Environment: ${environmentName}`] : []),
        ]}
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
            {liveRunEnabled ? (
              <Button
                className="workflow-command-monitor"
                variant="secondary"
                size="sm"
                type="button"
                onClick={toggleMonitor}
                aria-pressed={monitorOpen}
              >
                <ActivitySquare aria-hidden="true" />
                Monitor
              </Button>
            ) : null}
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
          {liveRunEnabled && monitorOpen ? (
            <RunMonitorDrawer
              graph={workflowGraph}
              runState={runState}
              onFocusNode={requestNodeSelection}
              onClose={closeMonitor}
            />
          ) : null}
          <WorkflowGraphEditor
            graph={workflowGraph}
            runState={runState}
            validationIssues={graphIssues}
            subflowOptions={subflowOptions}
            selectionRequest={selectionRequest}
            defaultEdgeDelay={defaultEdgeDelay}
            onCreateSubflowFromSelection={onCreateSubflowFromSelection}
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
