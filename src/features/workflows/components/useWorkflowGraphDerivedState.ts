import { useMemo } from "react";
import type {
  GraphValidationIssue,
  RunState,
  SubflowSummary,
  WorkflowGraph,
} from "../../../types/workflow";
import type { GraphSelection } from "../lib/graphEditorCommands";
import {
  callSubflowIdFromNode,
  graphIssuesByNode,
  toReactFlowGraph,
} from "../lib/workflowGraph";

type GraphContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

type UseWorkflowGraphDerivedStateInput = {
  graph: WorkflowGraph;
  selection: GraphSelection;
  contextMenu: GraphContextMenuState;
  subflowOptions: SubflowSummary[];
  runState: RunState;
  validationIssues: GraphValidationIssue[];
};

export function useWorkflowGraphDerivedState({
  graph,
  selection,
  contextMenu,
  subflowOptions,
  runState,
  validationIssues,
}: UseWorkflowGraphDerivedStateInput) {
  const selectionCount = selection.nodeIds.length + selection.edgeIds.length;
  const selectionSummary =
    selectionCount > 1
      ? {
          nodeCount: selection.nodeIds.length,
          edgeCount: selection.edgeIds.length,
        }
      : null;
  const selectedNodeId =
    !selectionSummary && selection.nodeIds.length === 1 && selection.edgeIds.length === 0
      ? selection.nodeIds[0]
      : null;
  const selectedEdgeId =
    !selectionSummary && selection.edgeIds.length === 1 && selection.nodeIds.length === 0
      ? selection.edgeIds[0]
      : null;
  const selectedNode = selectedNodeId
    ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;
  const contextMenuNode = contextMenu
    ? graph.nodes.find((node) => node.id === contextMenu.nodeId) ?? null
    : null;
  const contextMenuSubflowId = callSubflowIdFromNode(contextMenuNode);
  const contextMenuSubflowName = contextMenuSubflowId
    ? subflowOptions.find((subflow) => subflow.id === contextMenuSubflowId)?.name ??
      contextMenuNode?.label ??
      null
    : null;
  const inspectorOpen = Boolean(selectionSummary || selectedEdge || selectedNode);
  const nodeLabels = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.label])),
    [graph.nodes],
  );
  const completedNodeIds = useMemo(
    () => new Set(runState.completed_step_ids),
    [runState.completed_step_ids],
  );
  const issueGroups = useMemo(
    () => graphIssuesByNode(validationIssues),
    [validationIssues],
  );
  const issueNodeIds = useMemo(
    () =>
      new Set(
        validationIssues
          .map((issue) => issue.node_id)
          .filter((nodeId): nodeId is string => Boolean(nodeId)),
      ),
    [validationIssues],
  );
  const issueEdgeIds = useMemo(
    () =>
      new Set(
        validationIssues
          .map((issue) => issue.edge_id)
          .filter((edgeId): edgeId is string => Boolean(edgeId)),
      ),
    [validationIssues],
  );
  const flowGraph = useMemo(
    () =>
      toReactFlowGraph(graph, {
        selectedNodeIds: new Set(selection.nodeIds),
        runningNodeId: runState.current_step_id,
        completedNodeIds,
        failedNodeId: runState.error?.step_id ?? null,
        issueNodeIds,
        issueEdgeIds,
        selectedEdgeIds: new Set(selection.edgeIds),
      }),
    [
      graph,
      selection.edgeIds,
      selection.nodeIds,
      runState.current_step_id,
      completedNodeIds,
      runState.error?.step_id,
      issueNodeIds,
      issueEdgeIds,
    ],
  );

  return {
    selectionSummary,
    selectedNodeId,
    selectedEdgeId,
    selectedNode,
    selectedEdge,
    contextMenuNode,
    contextMenuSubflowId,
    contextMenuSubflowName,
    inspectorOpen,
    nodeLabels,
    issueGroups,
    flowGraph,
  };
}
