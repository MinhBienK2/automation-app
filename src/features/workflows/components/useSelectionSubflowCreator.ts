import { useState, type MutableRefObject } from "react";
import type { Subflow, WorkflowGraph } from "../../../types/workflow";
import type { GraphSelection } from "../lib/graphEditorCommands";
import {
  buildSelectedSubflowPlan,
  replaceSelectionWithSubflowNode,
} from "../lib/subflowSelection";

export type SelectionSubflowMode = "create_only" | "create_and_replace";

type UseSelectionSubflowCreatorInput = {
  graphKind: "workflow" | "subflow";
  graphRef: MutableRefObject<WorkflowGraph>;
  selectionRef: MutableRefObject<GraphSelection>;
  onCreateSubflowFromSelection?: (input: {
    name: string;
    graph: WorkflowGraph;
  }) => Promise<Pick<Subflow, "id" | "name">>;
  onCommitGraphChange: (graph: WorkflowGraph, selection: GraphSelection) => void;
};

function graphEditorCommandMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Could not create subflow from the selected nodes.";
}

export function useSelectionSubflowCreator({
  graphKind,
  graphRef,
  selectionRef,
  onCreateSubflowFromSelection,
  onCommitGraphChange,
}: UseSelectionSubflowCreatorInput) {
  const [isSelectionSubflowDialogOpen, setIsSelectionSubflowDialogOpen] = useState(false);
  const [selectionSubflowName, setSelectionSubflowName] = useState("");
  const [selectionSubflowError, setSelectionSubflowError] = useState<string | null>(null);
  const [isCreatingSelectionSubflow, setIsCreatingSelectionSubflow] = useState(false);

  function resetSelectionSubflowDialog() {
    setSelectionSubflowName("");
    setSelectionSubflowError(null);
  }

  function openSelectionSubflowDialog() {
    if (!onCreateSubflowFromSelection || graphKind !== "workflow") return;
    resetSelectionSubflowDialog();
    setIsSelectionSubflowDialogOpen(true);
  }

  async function createSubflowFromSelection(mode: SelectionSubflowMode) {
    if (!onCreateSubflowFromSelection || isCreatingSelectionSubflow) return;
    const name = selectionSubflowName.trim();
    if (!name) {
      setSelectionSubflowError("Subflow name is required.");
      return;
    }

    const sourceGraph = graphRef.current;
    const sourceSelection = selectionRef.current;
    const plan = buildSelectedSubflowPlan(sourceGraph, sourceSelection);
    if (!plan.ok) {
      setSelectionSubflowError(plan.message);
      return;
    }
    if (
      mode === "create_and_replace" &&
      (plan.externalIncomingEdges.length > 1 || plan.externalOutgoingEdges.length > 1)
    ) {
      setSelectionSubflowError(
        "Replace supports selections with at most one incoming link and one outgoing link.",
      );
      return;
    }

    setIsCreatingSelectionSubflow(true);
    setSelectionSubflowError(null);
    try {
      const createdSubflow = await onCreateSubflowFromSelection({
        name,
        graph: plan.subflowGraph,
      });
      if (mode === "create_and_replace") {
        const replacement = replaceSelectionWithSubflowNode(
          sourceGraph,
          sourceSelection,
          createdSubflow,
        );
        if (!replacement.ok) {
          setSelectionSubflowError(replacement.message);
          return;
        }
        onCommitGraphChange(replacement.graph, replacement.selection);
      }
      setIsSelectionSubflowDialogOpen(false);
      resetSelectionSubflowDialog();
    } catch (error) {
      setSelectionSubflowError(graphEditorCommandMessage(error));
    } finally {
      setIsCreatingSelectionSubflow(false);
    }
  }

  return {
    isSelectionSubflowDialogOpen,
    selectionSubflowName,
    selectionSubflowError,
    isCreatingSelectionSubflow,
    setIsSelectionSubflowDialogOpen,
    setSelectionSubflowName,
    resetSelectionSubflowDialog,
    openSelectionSubflowDialog,
    createSubflowFromSelection,
  };
}
