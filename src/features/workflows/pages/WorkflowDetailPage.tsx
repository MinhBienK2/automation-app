import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivitySquare, CheckCircle2, Save, Settings, Sliders, MoreHorizontal } from "lucide-react";
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
import { getVariablesStateAtStep } from "../components/RunMonitorEnvironment";
import { RunVariablesDrawer } from "../components/RunVariablesDrawer";
import {
  WorkflowGraphEditor,
  type GraphSelectionRequest,
} from "../components/WorkflowGraphEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

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
  onSelectedGraphNodeChange: (nodeId: string | null) => void;
  showRunGraphFromSelected: boolean;
  canRunGraphFromSelected: boolean;
  runGraphFromSelectedReason: string;
  onSaveGraph: () => void;
  onValidateGraph: () => void;
  onRestoreRevision?: (graph: WorkflowGraph) => void | Promise<void>;
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
  isSavingGraph?: boolean;
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
  onSelectedGraphNodeChange,
  showRunGraphFromSelected,
  canRunGraphFromSelected,
  runGraphFromSelectedReason,
  onSaveGraph,
  onValidateGraph,
  onRestoreRevision,
  initialVariables,
  profileVariables,
  isSavingGraph = false,
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
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [localSelectedNodeId, setLocalSelectedNodeId] = useState<string | null>(null);
  
  const selectionRequestIdRef = useRef(0);
  const monitorManuallyClosedRef = useRef(false);
  const variablesManuallyClosedRef = useRef(false);

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
  const requestNodeSelection = useCallback((nodeId: string | null) => {
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
    setVariablesOpen(false);
    monitorManuallyClosedRef.current = false;
    variablesManuallyClosedRef.current = false;
  }, [detail.workflow.id, liveRunFollowCurrent]);

  useEffect(() => {
    if (!liveRunEnabled || runState.status !== "running") {
      return;
    }
    if (!monitorManuallyClosedRef.current) {
      setMonitorOpen(true);
    }
    if (!variablesManuallyClosedRef.current) {
      setVariablesOpen(true);
    }
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

  const toggleVariables = () => {
    setVariablesOpen((current) => {
      const next = !current;
      variablesManuallyClosedRef.current = !next;
      return next;
    });
  };

  const closeVariables = () => {
    variablesManuallyClosedRef.current = true;
    setVariablesOpen(false);
  };

  const handleSelectedNodeChange = useCallback((nodeId: string | null) => {
    setLocalSelectedNodeId(nodeId);
    onSelectedGraphNodeChange(nodeId);
  }, [onSelectedGraphNodeChange]);

  const handleBackToLive = () => {
    requestNodeSelection(null);
    handleSelectedNodeChange(null);
  };

  const resolvedVariablesInfo = useMemo(() => {
    const traces = Array.isArray(runState.outputs?.__action_traces)
      ? (runState.outputs.__action_traces as any[])
      : [];

    const getVars = (stepIdx: number) => {
      return getVariablesStateAtStep(initialVariables, traces, stepIdx, profileVariables);
    };

    if (localSelectedNodeId && workflowGraph) {
      const graphNodeIds = new Set(workflowGraph.nodes.map((node) => node.id));
      const resolvedId = resolveMainGraphNodeId(localSelectedNodeId, graphNodeIds);

      let matchedTraceIndex = -1;
      for (let i = traces.length - 1; i >= 0; i--) {
        const traceNodeId = resolveMainGraphNodeId(traces[i].node_id, graphNodeIds);
        if (traceNodeId === resolvedId) {
          matchedTraceIndex = i;
          break;
        }
      }

      if (matchedTraceIndex !== -1) {
        const trace = traces[matchedTraceIndex];
        const highlighted = new Set([
          ...(trace.output_summary?.added_keys || []),
          ...(trace.output_summary?.changed_keys || []),
        ]);
        const node = workflowGraph.nodes.find((n) => n.id === resolvedId);
        return {
          variables: getVars(matchedTraceIndex),
          isSnapshot: true,
          snapshotNodeName: node?.label || resolvedId,
          highlightedKeys: highlighted,
        };
      }
    }

    const latestTraceIndex = traces.length - 1;
    let highlighted = new Set<string>();
    if (latestTraceIndex >= 0) {
      const trace = traces[latestTraceIndex];
      highlighted = new Set([
        ...(trace.output_summary?.added_keys || []),
        ...(trace.output_summary?.changed_keys || []),
      ]);
    }
    return {
      variables: getVars(latestTraceIndex),
      isSnapshot: false,
      snapshotNodeName: null,
      highlightedKeys: highlighted,
    };
  }, [runState, workflowGraph, localSelectedNodeId, initialVariables, profileVariables]);

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  variant="secondary"
                  label="More actions"
                  type="button"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpenWorkflowSettings}>
                  <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                  Workflow Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onValidateGraph}>
                  <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Validate Graph
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Save"
              onClick={onSaveGraph}
              disabled={!canSaveGraph || isSavingGraph}
              loading={isSavingGraph}
            >
              <Save aria-hidden="true" />
            </IconButton>
            {liveRunEnabled ? (
              <>
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
                <Button
                  className="workflow-command-variables"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={toggleVariables}
                  aria-pressed={variablesOpen}
                >
                  <Sliders className="h-4 w-4" aria-hidden="true" />
                  Variables
                </Button>
              </>
            ) : null}
            {showRunGraphFromSelected ? (
              <div ref={dropdownRef} className="run-from-selected-container">
                <Button
                  className="workflow-command-secondary"
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsRunFromSelectedOpen((prev) => !prev)}
                  disabled={!canRunGraphFromSelected}
                  title={runGraphFromSelectedReason}
                  aria-haspopup="menu"
                  aria-expanded={isRunFromSelectedOpen}
                >
                  Run from selected
                </Button>
                {isRunFromSelectedOpen && (
                  <div
                    className="run-from-selected-menu"
                    role="menu"
                    aria-label="Run from selected options"
                  >
                    <button
                      className="run-from-selected-item"
                      role="menuitem"
                      onClick={() => {
                        setIsRunFromSelectedOpen(false);
                        onRunGraphFromSelected("selected_only");
                      }}
                    >
                      <span>Only rerun selected node</span>
                    </button>
                    <button
                      className="run-from-selected-item"
                      role="menuitem"
                      onClick={() => {
                        setIsRunFromSelectedOpen(false);
                        onRunGraphFromSelected("from_selected");
                      }}
                    >
                      <span>Run from selected node onward</span>
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
              Run
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
          {liveRunEnabled && (
            <>
              <RunMonitorDrawer
                open={monitorOpen}
                graph={workflowGraph}
                runState={graphRunState}
                initialVariables={initialVariables}
                profileVariables={profileVariables}
                onFocusNode={requestNodeSelection}
                onClose={closeMonitor}
              />
              <RunVariablesDrawer
                open={variablesOpen}
                variables={resolvedVariablesInfo.variables}
                isSnapshot={resolvedVariablesInfo.isSnapshot}
                snapshotNodeName={resolvedVariablesInfo.snapshotNodeName}
                onBackToLive={handleBackToLive}
                highlightedKeys={resolvedVariablesInfo.highlightedKeys}
                onClose={closeVariables}
              />
            </>
          )}
          <WorkflowGraphEditor
            graph={workflowGraph}
            runState={graphRunState}
            validationIssues={graphIssues}
            subflowOptions={subflowOptions}
            selectionRequest={selectionRequest}
            defaultEdgeDelay={defaultEdgeDelay}
            ownerId={detail.workflow.id}
            onCreateSubflowFromSelection={onCreateSubflowFromSelection}
            onLoadSubflowGraph={onLoadSubflowGraph}
            onChange={onGraphChange}
            onOpenSubflowDetail={onOpenSubflowDetail}
            onRunGraph={onRunGraph}
            onSelectedNodeChange={handleSelectedNodeChange}
            onSaveGraph={onSaveGraph}
            onValidateGraph={onValidateGraph}
            onRestoreRevision={onRestoreRevision}
            initialVariables={initialVariables}
            profileVariables={profileVariables}
          />
        </>
      ) : (
        <div className="flex flex-col gap-2 flex-grow min-h-[400px]">
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="skeleton flex-grow w-full rounded-lg mt-1" aria-label="Visual Graph Loading" />
        </div>
      )}

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
  let cleanNodeId = nodeId;
  if (cleanNodeId.startsWith("__prelude:loop_item:")) {
    cleanNodeId = cleanNodeId.slice("__prelude:loop_item:".length);
  } else if (cleanNodeId.startsWith("__prelude:loop_indices:")) {
    cleanNodeId = cleanNodeId.slice("__prelude:loop_indices:".length);
  }
  if (graphNodeIds.has(cleanNodeId)) return cleanNodeId;
  const subflowCallerNodeId = cleanNodeId.split("::", 1)[0];
  if (subflowCallerNodeId && graphNodeIds.has(subflowCallerNodeId)) {
    return subflowCallerNodeId;
  }
  return cleanNodeId;
}
