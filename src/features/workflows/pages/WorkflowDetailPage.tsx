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
  projectName?: string | null;
  isRunning: boolean;
  appError: string;
  graphSaveStatus: string;
  canSaveGraph: boolean;
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
  onLoadSubflowGraph?: (subflowId: string) => Promise<WorkflowGraph>;
  onOpenSubflowDetail?: (subflowId: string) => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => void;
  onRunGraphFromSelected: (mode: "selected_only" | "from_selected") => void;
  runFromSelectedMode?: "selected_only" | "from_selected";
  onSelectedGraphNodeChange: (nodeId: string | null) => void;
  showRunGraphFromSelected: boolean;
  canRunGraphFromSelected: boolean;
  runGraphFromSelectedReason: string;
  onSaveGraph: () => void;
  onValidateGraph: () => void;
  initialVariables?: Array<{ name: string; value: string }> | null;
};

export function WorkflowDetailPage({
  detail,
  projectName = null,
  isRunning,
  appError,
  graphSaveStatus,
  canSaveGraph,
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
  onLoadSubflowGraph,
  onOpenSubflowDetail,
  onGraphChange,
  onRunGraph,
  onRunGraphFromSelected,
  runFromSelectedMode = "from_selected",
  onSelectedGraphNodeChange,
  showRunGraphFromSelected,
  canRunGraphFromSelected,
  runGraphFromSelectedReason,
  onSaveGraph,
  onValidateGraph,
  initialVariables,
}: WorkflowDetailPageProps) {
  const [selectionRequest, setSelectionRequest] =
    useState<GraphSelectionRequest | null>(null);
  const [isRunFromSelectedOpen, setIsRunFromSelectedOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRunFromSelectedOpen(false);
      }
    }
    if (isRunFromSelectedOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRunFromSelectedOpen]);

  useEffect(() => {
    setIsRunFromSelectedOpen(false);
  }, [isRunning, detail.workflow.id]);
  const [followCurrentNode, setFollowCurrentNode] = useState(liveRunFollowCurrent);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const selectionRequestIdRef = useRef(0);
  const monitorManuallyClosedRef = useRef(false);
  const graphRunState = useMemo(
    () => mapRunStateToMainGraph(runState, workflowGraph),
    [runState, workflowGraph],
  );
  const runIssues = useMemo(
    () =>
      buildRunIssues({
        appError,
        graphIssues,
        graphIssuesNeedRecheck,
        runState: graphRunState,
      }),
    [appError, graphIssues, graphIssuesNeedRecheck, graphRunState],
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
    graphRunState.status === "failed"
      ? graphRunState.error?.step_id ?? null
      : graphRunState.status === "running"
        ? graphRunState.current_step_id
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
          ...(projectName ? [`Project: ${projectName}`] : []),
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
              disabled={!canSaveGraph}
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
              <div ref={dropdownRef} className="run-from-selected-container" style={{ position: "relative" }}>
                <Button
                  className="workflow-command-secondary"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsRunFromSelectedOpen((prev) => !prev)}
                  disabled={!canRunGraphFromSelected}
                  title={runGraphFromSelectedReason}
                  aria-haspopup="listbox"
                  aria-expanded={isRunFromSelectedOpen}
                >
                  Run from selected
                </Button>
                {isRunFromSelectedOpen && (
                  <div
                    className="run-from-selected-menu"
                    role="listbox"
                    aria-label="Run from selected options"
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "4px",
                      zIndex: 50,
                      width: "240px",
                      backgroundColor: "var(--app-surface, #121c26)",
                      border: "1px solid var(--app-border, #233240)",
                      borderRadius: "var(--app-radius-sm, 8px)",
                      padding: "4px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <button
                      className="run-from-selected-item"
                      role="option"
                      aria-selected={runFromSelectedMode === "selected_only"}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: "8px 12px",
                        fontSize: "13px",
                        color: "var(--app-text, #e7eef5)",
                        borderRadius: "var(--app-radius-xs, 4px)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onClick={() => {
                        setIsRunFromSelectedOpen(false);
                        onRunGraphFromSelected("selected_only");
                      }}
                    >
                      <span>Only rerun selected node</span>
                      {runFromSelectedMode === "selected_only" && (
                        <span style={{ color: "var(--app-active-control, #32d3e6)" }}>✓</span>
                      )}
                    </button>
                    <button
                      className="run-from-selected-item"
                      role="option"
                      aria-selected={runFromSelectedMode === "from_selected"}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: "8px 12px",
                        fontSize: "13px",
                        color: "var(--app-text, #e7eef5)",
                        borderRadius: "var(--app-radius-xs, 4px)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onClick={() => {
                        setIsRunFromSelectedOpen(false);
                        onRunGraphFromSelected("from_selected");
                      }}
                    >
                      <span>Run from selected node onward</span>
                      {runFromSelectedMode === "from_selected" && (
                        <span style={{ color: "var(--app-active-control, #32d3e6)" }}>✓</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
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
              runState={graphRunState}
              initialVariables={initialVariables}
              onFocusNode={requestNodeSelection}
              onClose={closeMonitor}
            />
          ) : null}
          <WorkflowGraphEditor
            graph={workflowGraph}
            runState={graphRunState}
            validationIssues={graphIssues}
            subflowOptions={subflowOptions}
            selectionRequest={selectionRequest}
            defaultEdgeDelay={defaultEdgeDelay}
            onCreateSubflowFromSelection={onCreateSubflowFromSelection}
            onLoadSubflowGraph={onLoadSubflowGraph}
            onChange={onGraphChange}
            onOpenSubflowDetail={onOpenSubflowDetail}
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

function mapRunStateToMainGraph(runState: RunState, graph: WorkflowGraph | null): RunState {
  if (!graph) return runState;
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  return {
    ...runState,
    current_step_id: resolveMainGraphNodeId(runState.current_step_id, graphNodeIds),
    completed_step_ids: runState.completed_step_ids.map((nodeId) =>
      resolveMainGraphNodeId(nodeId, graphNodeIds) ?? nodeId,
    ),
    error: runState.error
      ? {
          ...runState.error,
          diagnostics: runState.error.diagnostics ?? runtimeDiagnosticsFromStepId(runState.error.step_id),
          step_id: resolveMainGraphNodeId(runState.error.step_id, graphNodeIds),
        }
      : null,
  };
}

function runtimeDiagnosticsFromStepId(stepId: string | null | undefined) {
  if (!stepId) return null;
  const separatorIndex = stepId.indexOf("::");
  if (separatorIndex < 0) return null;
  return {
    compiled_step_id: stepId,
    parent_step_id: stepId.slice(0, separatorIndex) || null,
    subflow_node_id: stepId.slice(separatorIndex + 2) || null,
  };
}

function resolveMainGraphNodeId(
  nodeId: string | null | undefined,
  graphNodeIds: Set<string>,
) {
  if (!nodeId) return nodeId ?? null;
  if (graphNodeIds.has(nodeId)) return nodeId;
  const subflowCallerNodeId = nodeId.split("::", 1)[0];
  if (subflowCallerNodeId && graphNodeIds.has(subflowCallerNodeId)) {
    return subflowCallerNodeId;
  }
  return nodeId;
}
