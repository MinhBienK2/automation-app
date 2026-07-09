import { useRef } from "react";
import type { WorkflowGraph } from "../../../types/workflow";
import {
  pushGraphHistory,
  undoGraphHistory,
  redoGraphHistory,
  type GraphHistoryState,
} from "../lib/graphEditorCommands";

export function useWorkflowGraphHistory(initialGraph: WorkflowGraph) {
  const historyRef = useRef<GraphHistoryState>({
    past: [],
    present: initialGraph,
    future: [],
    limit: 50,
  });

  const commitHistoryChange = (nextGraph: WorkflowGraph) => {
    historyRef.current = pushGraphHistory(historyRef.current, nextGraph);
  };

  const undo = () => {
    const nextHistory = undoGraphHistory(historyRef.current);
    if (nextHistory === historyRef.current) return null;
    historyRef.current = nextHistory;
    return nextHistory.present;
  };

  const redo = () => {
    const nextHistory = redoGraphHistory(historyRef.current);
    if (nextHistory === historyRef.current) return null;
    historyRef.current = nextHistory;
    return nextHistory.present;
  };

  const updatePresent = (newGraph: WorkflowGraph) => {
    historyRef.current = {
      ...historyRef.current,
      present: newGraph,
    };
  };

  const resetHistory = (newGraph: WorkflowGraph) => {
    historyRef.current = {
      past: [],
      present: newGraph,
      future: [],
      limit: 50,
    };
  };

  return {
    historyRef,
    commitHistoryChange,
    undo,
    redo,
    updatePresent,
    resetHistory,
  };
}
