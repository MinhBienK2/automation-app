import type {
  GraphEdgeDelay,
  WorkflowGraph,
} from "../../../types/workflow";
import type { GraphSelection } from "./graphEditorCommands";

export type GraphSelectionSummary = {
  nodeCount: number;
  edgeCount: number;
  protectedStartCount: number;
  copyableNodeCount: number;
  deletableNodeCount: number;
  selectedInternalLinkCount: number;
  canCopy: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  disabledReason: string | null;
};

export function summarizeGraphSelection(
  graph: WorkflowGraph,
  selection: GraphSelection,
): GraphSelectionSummary {
  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const selectedNodes = graph.nodes.filter((node) => selectedNodeIds.has(node.id));
  const copyableNodeCount = selectedNodes.filter((node) => node.node_type !== "start").length;
  const selectedInternalLinkCount = graph.edges.filter(
    (edge) =>
      selectedEdgeIds.has(edge.id) &&
      selectedNodeIds.has(edge.source_node_id) &&
      selectedNodeIds.has(edge.target_node_id),
  ).length;
  const protectedStartCount = selectedNodes.filter((node) => node.node_type === "start").length;
  const canDelete = copyableNodeCount > 0 || selection.edgeIds.length > 0;
  const canCopy = copyableNodeCount > 0;
  const canDuplicate = copyableNodeCount > 0;
  const disabledReason = !canDelete && protectedStartCount > 0
    ? "Start is protected and cannot be copied, duplicated, or deleted."
    : !canDelete
    ? "Select a copyable node or a link before using bulk actions."
    : null;

  return {
    nodeCount: selection.nodeIds.length,
    edgeCount: selection.edgeIds.length,
    protectedStartCount,
    copyableNodeCount,
    deletableNodeCount: copyableNodeCount,
    selectedInternalLinkCount,
    canCopy,
    canDuplicate,
    canDelete,
    disabledReason,
  };
}

export function describeLinkWait(delay: GraphEdgeDelay | null | undefined) {
  if (!delay) return "No transition wait";
  if (delay.type === "fixed") return `Fixed wait: ${delay.duration_ms} ms`;
  return `Random wait: ${delay.min_ms}-${delay.max_ms} ms`;
}

export function validateGraphEdgeDelay(delay: GraphEdgeDelay | null | undefined) {
  if (!delay) return null;
  if (delay.type === "fixed") {
    return delay.duration_ms >= 0 ? null : "Fixed duration must be non-negative.";
  }
  if (delay.min_ms < 0 || delay.max_ms < 0) {
    return "Random durations must be non-negative.";
  }
  if (delay.max_ms < delay.min_ms) {
    return "Random max must be greater than or equal to min.";
  }
  return null;
}
