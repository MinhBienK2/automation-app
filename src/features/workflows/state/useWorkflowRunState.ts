import { useCallback, useState } from "react";
import type {
  WorkflowRunStateAPI,
} from "../../../shared/types/workspaceContracts";
import type {
  WorkflowDetail,
  WorkflowGraph,
  GraphValidationIssue,
  RunState,
  WorkflowRunSnapshot,
  WorkflowSummary,
} from "../../../types/workflow";
import {
  runWorkflow as runWorkflowCommand,
  runWorkflowFromNode as runWorkflowFromNodeCommand,
  stopRun as stopRunCommand,
  listRunStates,
  getRunState,
  validateWorkflowGraph,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import {
  normalizeRunSnapshot,
  normalizeRunState,
} from "../../../lib/workflowUi";
import {
  latestRunForWorkflow,
  latestRunSnapshot,
  legacyRunId,
} from "../../../lib/appState";

export interface WorkflowRunStateDeps {
  detail: WorkflowDetail | null;
  workflowGraph: WorkflowGraph | null;
  selectedGraphNodeId: string | null;
  selectedWorkflowId: string | null;
  activeRunWorkflowName: string | null;
  setAppError: (error: string) => void;
  loadOperationsOverview: () => Promise<any>;
  persistCurrentGraph: () => Promise<boolean>;
  persistDirtyWorkflowSettings: () => Promise<boolean>;
  setGraphIssues: (issues: GraphValidationIssue[]) => void;
  setGraphIssuesNeedRecheck: (needRecheck: boolean) => void;

  runState: RunState;
  setRunState: React.Dispatch<React.SetStateAction<RunState>>;
  runSnapshots: WorkflowRunSnapshot[];
  setRunSnapshots: React.Dispatch<React.SetStateAction<WorkflowRunSnapshot[]>>;
  setActiveRunWorkflowName: (name: string | null) => void;
}

export function useWorkflowRunState(deps: WorkflowRunStateDeps): WorkflowRunStateAPI {
  const {
    detail,
    workflowGraph,
    selectedGraphNodeId,
    selectedWorkflowId,
    activeRunWorkflowName,
    setAppError,
    loadOperationsOverview,
    persistCurrentGraph,
    persistDirtyWorkflowSettings,
    setGraphIssues,
    setGraphIssuesNeedRecheck,

    runState,
    setRunState,
    runSnapshots,
    setRunSnapshots,
    setActiveRunWorkflowName,
  } = deps;

  const [startingWorkflowId, setStartingWorkflowId] = useState<string | null>(null);
  const isStartingRun = Boolean(startingWorkflowId);

  const refreshRunStates = useCallback(async () => {
    try {
      const snapshots = (await listRunStates()).map(normalizeRunSnapshot);
      setRunSnapshots(snapshots);
      const selectedSnapshot = selectedWorkflowId
        ? latestRunForWorkflow(snapshots, selectedWorkflowId)
        : latestRunSnapshot(snapshots);
      if (selectedSnapshot) {
        setRunState(selectedSnapshot.state);
        setActiveRunWorkflowName(selectedSnapshot.workflow_name);
        return;
      }
    } catch {
      // Fall back to the legacy single-run state when older test bridges omit listRunStates.
    }
    const state = await getRunState();
    const normalizedState = normalizeRunState(state);
    setRunState(normalizedState);
    if (selectedWorkflowId) {
      setRunSnapshots((current) =>
        current.map((snapshot) =>
          snapshot.run_id === legacyRunId(selectedWorkflowId)
            ? normalizeRunSnapshot({
                ...snapshot,
                state: normalizedState,
              })
            : snapshot,
        ),
      );
    }
  }, [selectedWorkflowId, setRunSnapshots, setRunState, setActiveRunWorkflowName]);

  const upsertRunSnapshot = useCallback((
    snapshot: WorkflowRunSnapshot | RunState,
    context?: { workflowId: string; workflowName: string },
  ) => {
    const fallbackWorkflowId =
      "workflow_id" in snapshot && snapshot.workflow_id
        ? snapshot.workflow_id
        : (context?.workflowId ?? selectedWorkflowId ?? detail?.workflow.id ?? null);
    const fallbackWorkflowName =
      "workflow_name" in snapshot && snapshot.workflow_name
        ? snapshot.workflow_name
        : (context?.workflowName ?? detail?.workflow.name ?? activeRunWorkflowName ?? "");
    const normalized = normalizeRunSnapshot({
      ...snapshot,
      run_id:
        "run_id" in snapshot && snapshot.run_id
          ? snapshot.run_id
          : legacyRunId(fallbackWorkflowId),
      workflow_id: fallbackWorkflowId,
      workflow_name: fallbackWorkflowName,
      source: "source" in snapshot && snapshot.source ? snapshot.source : "manual",
      started_at:
        "started_at" in snapshot && snapshot.started_at
          ? snapshot.started_at
          : new Date().toISOString(),
      state: "state" in snapshot && snapshot.state ? snapshot.state : snapshot,
    } as WorkflowRunSnapshot);
    setRunSnapshots((current) => [
      ...current.filter((item) => item.run_id !== normalized.run_id),
      normalized,
    ]);
    setRunState(normalized.state);
    setActiveRunWorkflowName(normalized.workflow_name);
    return normalized;
  }, [selectedWorkflowId, detail, activeRunWorkflowName, setRunSnapshots, setRunState, setActiveRunWorkflowName]);

  const runGraph = useCallback(async () => {
    if (!detail || !workflowGraph) return;
    setAppError("");
    setStartingWorkflowId(detail.workflow.id);

    try {
      const saved = await persistCurrentGraph();
      if (!saved) {
        setStartingWorkflowId(null);
        return;
      }
      const settingsSaved = await persistDirtyWorkflowSettings();
      if (!settingsSaved) {
        setStartingWorkflowId(null);
        return;
      }
      setActiveRunWorkflowName(detail.workflow.name);
      const snapshot = await runWorkflowCommand(detail.workflow.id);
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      upsertRunSnapshot(snapshot, {
        workflowId: detail.workflow.id,
        workflowName: detail.workflow.name,
      });
      await loadOperationsOverview();
    } catch (error) {
      setAppError(commandMessage(error));
      await loadOperationsOverview();
      if (workflowGraph) {
        try {
          setGraphIssues(await validateWorkflowGraph(workflowGraph));
          setGraphIssuesNeedRecheck(false);
        } catch {
          // Keep the command error as the primary system issue when validation cannot run.
        }
      }
    } finally {
      setStartingWorkflowId(null);
    }
  }, [
    detail,
    workflowGraph,
    persistCurrentGraph,
    persistDirtyWorkflowSettings,
    upsertRunSnapshot,
    loadOperationsOverview,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    setActiveRunWorkflowName,
    setAppError,
  ]);

  const runSavedWorkflow = useCallback(async (workflow: WorkflowSummary) => {
    setAppError("");
    setActiveRunWorkflowName(workflow.name);
    setStartingWorkflowId(workflow.id);

    try {
      const state = await runWorkflowCommand(workflow.id);
      upsertRunSnapshot(state, {
        workflowId: workflow.id,
        workflowName: workflow.name,
      });
      await loadOperationsOverview();
    } catch (error) {
      setAppError(commandMessage(error));
      await loadOperationsOverview();
    } finally {
      setStartingWorkflowId(null);
    }
  }, [upsertRunSnapshot, loadOperationsOverview, setActiveRunWorkflowName, setAppError]);

  const runGraphFromSelectedNode = useCallback(async (mode?: "selected_only" | "from_selected") => {
    if (!detail || !workflowGraph || !selectedGraphNodeId) return;
    setAppError("");
    setStartingWorkflowId(detail.workflow.id);

    try {
      const saved = await persistCurrentGraph();
      if (!saved) {
        setStartingWorkflowId(null);
        return;
      }
      const settingsSaved = await persistDirtyWorkflowSettings();
      if (!settingsSaved) {
        setStartingWorkflowId(null);
        return;
      }
      setActiveRunWorkflowName(detail.workflow.name);
      const state = await runWorkflowFromNodeCommand(
        detail.workflow.id,
        selectedGraphNodeId,
        mode,
      );
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      upsertRunSnapshot(state, {
        workflowId: detail.workflow.id,
        workflowName: detail.workflow.name,
      });
    } catch (error) {
      setAppError(commandMessage(error));
      if (workflowGraph) {
        try {
          setGraphIssues(await validateWorkflowGraph(workflowGraph));
          setGraphIssuesNeedRecheck(false);
        } catch {
          // Keep the command error as the primary system issue when validation cannot run.
        }
      }
    } finally {
      setStartingWorkflowId(null);
    }
  }, [
    detail,
    workflowGraph,
    selectedGraphNodeId,
    persistCurrentGraph,
    persistDirtyWorkflowSettings,
    upsertRunSnapshot,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    setActiveRunWorkflowName,
    setAppError,
  ]);

  const stopRun = useCallback(async (runId: string) => {
    setAppError("");

    try {
      const snapshot = await stopRunCommand(runId);
      upsertRunSnapshot(snapshot);
      // Wait for backend cleanup and refresh run states
      setTimeout(() => {
        void refreshRunStates();
      }, 500);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [upsertRunSnapshot, refreshRunStates, setAppError]);


  return {
    runState,
    runSnapshots,
    activeRunWorkflowName,
    isStartingRun,
    startingWorkflowId,
    setRunState,
    setRunSnapshots,
    setActiveRunWorkflowName,
    refreshRunStates,
    upsertRunSnapshot,
    runGraph,
    runSavedWorkflow,
    runGraphFromSelectedNode,
    stopRun,
  };
}
