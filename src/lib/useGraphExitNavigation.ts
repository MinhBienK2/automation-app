import { useEffect, useRef, useState } from "react";
import type { GraphSaveStatus } from "./appState";

export type GraphExitNavigation = () => void | Promise<void>;

type WorkflowGraphExitState = {
  active: boolean;
  graphAutosaveEnabled: boolean;
  graphSaveStatus: GraphSaveStatus;
  graphRevision: number;
  savedGraphRevision: number;
  persistCurrentGraph: () => Promise<unknown>;
  discardWorkflowGraph: (state: {
    savedGraphRevision: number;
    graphSaveStatus: GraphSaveStatus;
  }) => void;
};

type SubflowGraphExitState = {
  active: boolean;
  graphSaveStatus: GraphSaveStatus;
  saveCurrentSubflowGraph: () => Promise<unknown>;
  discardSubflowGraph: () => void;
};

export function useGraphExitNavigation({
  workflow,
  subflow,
}: {
  workflow: WorkflowGraphExitState;
  subflow: SubflowGraphExitState;
}) {
  const [graphExitDialogOpen, setGraphExitDialogOpen] = useState(false);
  const graphRevisionRef = useRef(workflow.graphRevision);
  const savedGraphRevisionRef = useRef(workflow.savedGraphRevision);
  const pendingGraphExitNavigationRef = useRef<GraphExitNavigation | null>(null);

  useEffect(() => {
    graphRevisionRef.current = workflow.graphRevision;
  }, [workflow.graphRevision]);

  useEffect(() => {
    savedGraphRevisionRef.current = workflow.savedGraphRevision;
  }, [workflow.savedGraphRevision]);

  function hasPendingWorkflowGraphChanges() {
    if (!workflow.active) return false;
    return (
      graphRevisionRef.current !== savedGraphRevisionRef.current ||
      (workflow.graphAutosaveEnabled && workflow.graphSaveStatus === "failed")
    );
  }

  function hasPendingSubflowGraphChanges() {
    return subflow.active && subflow.graphSaveStatus !== "saved";
  }

  function shouldConfirmGraphExit() {
    return hasPendingWorkflowGraphChanges() || hasPendingSubflowGraphChanges();
  }

  async function requestGraphExitNavigation(navigation: GraphExitNavigation) {
    if (shouldConfirmGraphExit()) {
      pendingGraphExitNavigationRef.current = navigation;
      setGraphExitDialogOpen(true);
      return false;
    }

    await navigation();
    return true;
  }

  function clearGraphExitNavigation() {
    pendingGraphExitNavigationRef.current = null;
    setGraphExitDialogOpen(false);
  }

  function discardGraphExitChanges() {
    if (hasPendingWorkflowGraphChanges()) {
      savedGraphRevisionRef.current = graphRevisionRef.current;
      workflow.discardWorkflowGraph({
        savedGraphRevision: graphRevisionRef.current,
        graphSaveStatus: workflow.graphAutosaveEnabled ? "saved" : "off",
      });
    }
    if (hasPendingSubflowGraphChanges()) {
      subflow.discardSubflowGraph();
    }
  }

  async function runPendingGraphExitNavigation() {
    const navigation = pendingGraphExitNavigationRef.current;
    clearGraphExitNavigation();
    await navigation?.();
  }

  async function saveGraphExitChanges() {
    if (hasPendingWorkflowGraphChanges()) {
      return Boolean(await workflow.persistCurrentGraph());
    }
    if (hasPendingSubflowGraphChanges()) {
      return Boolean(await subflow.saveCurrentSubflowGraph());
    }
    return true;
  }

  async function saveGraphExitChangesAndNavigate() {
    const saved = await saveGraphExitChanges();
    if (!saved) return false;
    await runPendingGraphExitNavigation();
    return true;
  }

  function discardGraphExitChangesAndNavigate() {
    discardGraphExitChanges();
    void runPendingGraphExitNavigation();
  }

  return {
    graphExitDialogOpen,
    requestGraphExitNavigation,
    clearGraphExitNavigation,
    discardGraphExitChangesAndNavigate,
    saveGraphExitChangesAndNavigate,
  };
}
