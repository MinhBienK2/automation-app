import { useCallback, useRef, useEffect } from "react";
import type {
  WorkflowGraphStateAPI,
} from "../../../shared/types/workspaceContracts";
import type {
  WorkflowDetail,
  WorkflowGraph,
  GraphValidationIssue,
} from "../../../types/workflow";
import {
  saveWorkflowGraph,
  validateWorkflowGraph,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import { hasEditableGraphChange, type GraphSaveStatus } from "../../../lib/appState";

export interface WorkflowGraphStateDeps {
  detail: WorkflowDetail | null;
  workflowGraph: WorkflowGraph | null;
  setWorkflowGraph: (graph: WorkflowGraph | null) => void;
  graphAutosaveEnabled: boolean;
  setGraphAutosaveEnabled: (enabled: boolean) => void;
  graphSaveStatus: GraphSaveStatus;
  setGraphSaveStatus: (status: GraphSaveStatus) => void;
  graphRevision: number;
  setGraphRevision: React.Dispatch<React.SetStateAction<number>>;
  savedGraphRevision: number;
  setSavedGraphRevision: React.Dispatch<React.SetStateAction<number>>;
  graphIssues: GraphValidationIssue[];
  setGraphIssues: (issues: GraphValidationIssue[]) => void;
  selectedGraphNodeId: string | null;
  setSelectedGraphNodeId: (nodeId: string | null) => void;
  setAppError: (error: string) => void;
  loadWorkflows: () => Promise<void>;
  graphIssuesNeedRecheck: boolean;
  setGraphIssuesNeedRecheck: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useWorkflowGraphState(deps: WorkflowGraphStateDeps): WorkflowGraphStateAPI {
  const {
    detail,
    workflowGraph,
    setWorkflowGraph,
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    graphSaveStatus,
    setGraphSaveStatus,
    graphRevision,
    setGraphRevision,
    savedGraphRevision,
    setSavedGraphRevision,
    graphIssues,
    setGraphIssues,
    selectedGraphNodeId,
    setSelectedGraphNodeId,
    setAppError,
    loadWorkflows,
    graphIssuesNeedRecheck: _graphIssuesNeedRecheck,
    setGraphIssuesNeedRecheck,
  } = deps;

  const graphRevisionRef = useRef(graphRevision);
  const savedGraphRevisionRef = useRef(savedGraphRevision);
  const workflowGraphRef = useRef(workflowGraph);
  const graphIssuesRef = useRef(graphIssues);

  useEffect(() => {
    graphRevisionRef.current = graphRevision;
  }, [graphRevision]);

  useEffect(() => {
    savedGraphRevisionRef.current = savedGraphRevision;
  }, [savedGraphRevision]);

  useEffect(() => {
    workflowGraphRef.current = workflowGraph;
  }, [workflowGraph]);

  useEffect(() => {
    graphIssuesRef.current = graphIssues;
  }, [graphIssues]);

  const changeWorkflowGraph = useCallback((nextGraph: WorkflowGraph) => {
    const hasEditableChange = hasEditableGraphChange(workflowGraphRef.current, nextGraph);
    setWorkflowGraph(nextGraph);
    if (!hasEditableChange) return;
    setGraphIssuesNeedRecheck((current) => current || graphIssuesRef.current.length > 0);
    setGraphRevision((current) => {
      const nextRevision = current + 1;
      graphRevisionRef.current = nextRevision;
      return nextRevision;
    });
    setGraphSaveStatus(graphAutosaveEnabled ? "pending" : "unsaved");
  }, [graphAutosaveEnabled, setWorkflowGraph, setGraphIssuesNeedRecheck, setGraphRevision, setGraphSaveStatus]);

  const persistCurrentGraph = useCallback(async (options?: { comment?: string; tag?: string }) => {
    if (!detail || !workflowGraph) return false;
    if (graphRevisionRef.current === savedGraphRevisionRef.current) {
      return true;
    }
    setAppError("");
    setGraphSaveStatus("saving");

    try {
      await saveWorkflowGraph(detail.workflow.id, workflowGraph, options);
      setSavedGraphRevision(graphRevisionRef.current);
      savedGraphRevisionRef.current = graphRevisionRef.current;
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      await loadWorkflows();
      return true;
    } catch (error) {
      setGraphSaveStatus("failed");
      setAppError(commandMessage(error));
      return false;
    }
  }, [detail, workflowGraph, graphAutosaveEnabled, loadWorkflows, setSavedGraphRevision, setGraphSaveStatus, setAppError]);

  const validateGraph = useCallback(async () => {
    if (!workflowGraph) return;
    setAppError("");

    try {
      setGraphIssues(await validateWorkflowGraph(workflowGraph));
      setGraphIssuesNeedRecheck(false);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [workflowGraph, setGraphIssues, setGraphIssuesNeedRecheck, setAppError]);

  const saveGraph = useCallback(async (options?: { comment?: string; tag?: string }) => {
    await persistCurrentGraph(options);
  }, [persistCurrentGraph]);

  return {
    workflowGraph,
    graphAutosaveEnabled,
    graphSaveStatus,
    graphRevision,
    savedGraphRevision,
    graphIssues,
    selectedGraphNodeId,
    setWorkflowGraph,
    setGraphAutosaveEnabled,
    setGraphSaveStatus,
    setGraphRevision,
    setSavedGraphRevision,
    setGraphIssues,
    setSelectedGraphNodeId,
    changeWorkflowGraph,
    persistCurrentGraph,
    validateGraph,
    saveGraph,
  };
}
