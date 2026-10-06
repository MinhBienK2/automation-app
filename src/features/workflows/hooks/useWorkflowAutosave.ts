import { useEffect, useRef } from "react";
import type { WorkflowGraph } from "../../../types/workflow";
import type { GraphSaveStatus } from "../../../lib/appState";
import { saveWorkflowGraph } from "../../../lib/api/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";

export type UseWorkflowAutosaveProps = {
  workflowId?: string;
  workflowGraph: WorkflowGraph | null;
  graphAutosaveEnabled: boolean;
  graphAutosaveDelayMs: number;
  graphRevision: number;
  savedGraphRevision: number;
  graphExitDialogOpen: boolean;
  setSavedGraphRevision: (updater: (current: number) => number) => void;
  setGraphSaveStatus: (status: GraphSaveStatus) => void;
  setAppError: (error: string) => void;
};

export function useWorkflowAutosave(props: UseWorkflowAutosaveProps) {
  const {
    workflowId,
    workflowGraph,
    graphAutosaveEnabled,
    graphAutosaveDelayMs,
    graphRevision,
    savedGraphRevision,
    graphExitDialogOpen,
    setSavedGraphRevision,
    setGraphSaveStatus,
    setAppError,
  } = props;

  const graphRevisionRef = useRef(graphRevision);
  const isSavingRef = useRef(false);
  const savePendingRef = useRef(false);
  const workflowGraphRef = useRef(workflowGraph);

  useEffect(() => {
    graphRevisionRef.current = graphRevision;
  }, [graphRevision]);

  useEffect(() => {
    workflowGraphRef.current = workflowGraph;
  }, [workflowGraph]);

  useEffect(() => {
    if (
      !graphAutosaveEnabled ||
      !workflowId ||
      !workflowGraph ||
      graphRevision === savedGraphRevision ||
      graphExitDialogOpen
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const executeSave = async () => {
        if (isSavingRef.current) {
          savePendingRef.current = true;
          return;
        }

        isSavingRef.current = true;
        savePendingRef.current = false;
        setGraphSaveStatus("saving");

        const revisionBeingSaved = graphRevisionRef.current;
        try {
          const currentGraph = workflowGraphRef.current;
          if (currentGraph) {
            await saveWorkflowGraph(workflowId, currentGraph, { skipRevision: true });
          }
          setSavedGraphRevision((current) => Math.max(current, revisionBeingSaved));
          if (graphRevisionRef.current === revisionBeingSaved) {
            setGraphSaveStatus("saved");
            setAppError("");
          } else {
            setGraphSaveStatus("unsaved");
          }
        } catch (error) {
          if (graphRevisionRef.current === revisionBeingSaved) {
            setGraphSaveStatus("failed");
          }
          setAppError(commandMessage(error));
        } finally {
          isSavingRef.current = false;
          if (savePendingRef.current) {
            void executeSave();
          }
        }
      };

      void executeSave();
    }, graphAutosaveDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    workflowId,
    graphAutosaveEnabled,
    graphRevision,
    savedGraphRevision,
    workflowGraph,
    graphAutosaveDelayMs,
    graphExitDialogOpen,
    setGraphSaveStatus,
    setSavedGraphRevision,
    setAppError,
  ]);
}
