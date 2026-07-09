import { useState, useRef, useEffect } from "react";
import type { WorkflowGraph } from "../../../types/workflow";
import {
  copyGraphSelection,
  pasteGraphClipboard,
  duplicateGraphSelection,
  type GraphClipboard,
  type GraphSelection,
} from "../lib/graphEditorCommands";

export function useWorkflowGraphClipboard() {
  const [clipboard, setClipboard] = useState<GraphClipboard | null>(null);
  const clipboardRef = useRef(clipboard);

  useEffect(() => {
    clipboardRef.current = clipboard;
  }, [clipboard]);

  const copySelection = (graph: WorkflowGraph, selection: GraphSelection) => {
    const nextClipboard = copyGraphSelection(graph, selection);
    if (nextClipboard) {
      setClipboard(nextClipboard);
      return nextClipboard;
    }
    return null;
  };

  const pasteClipboard = (graph: WorkflowGraph) => {
    if (!clipboardRef.current) return null;
    return pasteGraphClipboard(graph, clipboardRef.current);
  };

  const duplicateSelection = (graph: WorkflowGraph, selection: GraphSelection) => {
    return duplicateGraphSelection(graph, selection);
  };

  return {
    clipboard,
    clipboardRef,
    copySelection,
    pasteClipboard,
    duplicateSelection,
  };
}
