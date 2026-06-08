import type { WorkflowGraph } from "../../../types/workflow";
import type { WorkflowGraphEdgeKind } from "./graphLayout";
import type { WorkflowFlowEdge, WorkflowFlowNode } from "./workflowGraph";

export function replacePortEdge(
  edges: WorkflowFlowEdge[],
  nextEdge: WorkflowFlowEdge,
  nodes: WorkflowFlowNode[],
): WorkflowFlowEdge[] {
  const sourceHandle = nextEdge.sourceHandle ?? "out";
  const targetHandle = nextEdge.targetHandle ?? "in";
  const targetNode = nodes.find((node) => node.id === nextEdge.target);
  const allowsMultipleIncoming =
    targetNode?.data.nodeType === "merge" && targetHandle === "in";

  return [
    ...edges.filter((edge) => {
      const sameOutput =
        edge.source === nextEdge.source &&
        (edge.sourceHandle ?? "out") === sourceHandle;
      const sameInput =
        edge.target === nextEdge.target &&
        (edge.targetHandle ?? "in") === targetHandle;
      return edge.id !== nextEdge.id && !sameOutput && (allowsMultipleIncoming || !sameInput);
    }),
    nextEdge,
  ];
}

export function edgeKindForFlowSource(
  nodes: WorkflowFlowNode[],
  sourceNodeId: string,
  sourcePortId: string,
): WorkflowGraphEdgeKind {
  const sourceNodeType = nodes.find((node) => node.id === sourceNodeId)?.data.nodeType;
  if (!sourceNodeType) return "main";
  if (
    ["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(sourceNodeType) &&
    sourcePortId === "loop"
  ) {
    return "loop";
  }
  if (
    (sourceNodeType === "retry" && (sourcePortId === "try" || sourcePortId === "failed")) ||
    (sourceNodeType === "try_catch" &&
      ["try", "error", "finally"].includes(sourcePortId)) ||
    (sourceNodeType === "fallback" && sourcePortId === "fallback") ||
    (sourceNodeType === "repeat_until" && sourcePortId === "timeout")
  ) {
    return "recovery";
  }
  if (
    (["if", "switch", "router", "random_choice", "try_catch", "fallback"].includes(sourceNodeType) &&
      sourcePortId === "done") ||
    (["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(sourceNodeType) &&
      sourcePortId === "done") ||
    (sourceNodeType === "retry" && sourcePortId === "success")
  ) {
    return "continuation";
  }
  if (
    (sourceNodeType === "if" && (sourcePortId === "true" || sourcePortId === "false")) ||
    ((sourceNodeType === "switch" || sourceNodeType === "router") &&
      (sourcePortId === "default" || sourcePortId.startsWith("case_"))) ||
    (sourceNodeType === "random_choice" && sourcePortId.startsWith("choice_")) ||
    (sourceNodeType === "fallback" && sourcePortId === "primary")
  ) {
    return "branch";
  }
  return "main";
}

export function edgePortsExist(
  graph: WorkflowGraph,
  edge: WorkflowGraph["edges"][number],
) {
  const source = graph.nodes.find((node) => node.id === edge.source_node_id);
  const target = graph.nodes.find((node) => node.id === edge.target_node_id);
  return Boolean(
    source?.ports.some((port) => port.direction === "output" && port.id === edge.source_port) &&
      target?.ports.some((port) => port.direction === "input" && port.id === edge.target_port),
  );
}
