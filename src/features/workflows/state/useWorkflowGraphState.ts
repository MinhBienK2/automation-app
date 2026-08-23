import { useCallback, useRef, useEffect, useState } from "react";
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
} from "../../../lib/api/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import { hasEditableGraphChange, type GraphSaveStatus } from "../../../lib/appState";

export interface WorkflowGraphStateDeps {
  getDetail: () => WorkflowDetail | null;
  graphAutosaveEnabled: boolean;
  setGraphAutosaveEnabled: (enabled: boolean) => void;
  setAppError: (error: string) => void;
  loadWorkflows: () => Promise<void>;
}

export function useWorkflowGraphState(deps: WorkflowGraphStateDeps): WorkflowGraphStateAPI {
  const {
    getDetail,
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    setAppError,
    loadWorkflows,
  } = deps;

  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [graphSaveStatus, setGraphSaveStatus] = useState<GraphSaveStatus>(graphAutosaveEnabled ? "saved" : "off");
  const [graphRevision, setGraphRevision] = useState(0);
  const [savedGraphRevision, setSavedGraphRevision] = useState(0);
  const [graphIssues, setGraphIssues] = useState<GraphValidationIssue[]>([]);
  const [graphIssuesNeedRecheck, setGraphIssuesNeedRecheck] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);

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
    if (!getDetail() || !workflowGraph) return false;
    if (graphRevisionRef.current === savedGraphRevisionRef.current && !options?.comment && !options?.tag) {
      return true;
    }
    setAppError("");
    setGraphSaveStatus("saving");

    try {
      await saveWorkflowGraph(getDetail()!.workflow.id, workflowGraph, options);
      setSavedGraphRevision(graphRevisionRef.current);
      savedGraphRevisionRef.current = graphRevisionRef.current;
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      void loadWorkflows();
      return true;
    } catch (error) {
      setGraphSaveStatus("failed");
      setAppError(commandMessage(error));
      return false;
    }
  }, [getDetail, workflowGraph, graphAutosaveEnabled, loadWorkflows, setSavedGraphRevision, setGraphSaveStatus, setAppError]);

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
    graphIssuesNeedRecheck,
    selectedGraphNodeId,
    setWorkflowGraph,
    setGraphAutosaveEnabled,
    setGraphSaveStatus,
    setGraphRevision,
    setSavedGraphRevision,
    setGraphIssues,
    setGraphIssuesNeedRecheck: setGraphIssuesNeedRecheck as (value: boolean | ((current: boolean) => boolean)) => void,
    setSelectedGraphNodeId,
    changeWorkflowGraph,
    persistCurrentGraph,
    validateGraph,
    saveGraph,
  };
}
