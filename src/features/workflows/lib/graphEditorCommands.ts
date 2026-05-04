import type {
  GraphEdge,
  GraphNode,
  GraphPosition,
  WorkflowGraph,
} from "../../../types/workflow";

export type GraphSelection = {
  nodeIds: string[];
  edgeIds: string[];
};

export type GraphClipboard = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphCommandOptions = {
  offset?: GraphPosition;
  createNodeId?: (node: GraphNode, index: number) => string;
};

export type GraphHistoryState = {
  past: WorkflowGraph[];
  present: WorkflowGraph;
  future: WorkflowGraph[];
  limit: number;
};

const defaultOffset: GraphPosition = { x: 48, y: 48 };

export function deleteGraphSelection(
  graph: WorkflowGraph,
  selection: GraphSelection,
): { graph: WorkflowGraph; selection: GraphSelection } {
  const deletableNodeIds = new Set(
    selection.nodeIds.filter((nodeId) => nodeId !== "start"),
  );
  const selectedEdgeIds = new Set(selection.edgeIds);

  const nextGraph = {
    ...graph,
    nodes: graph.nodes.filter((node) => !deletableNodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) =>
        !selectedEdgeIds.has(edge.id) &&
        !deletableNodeIds.has(edge.source_node_id) &&
        !deletableNodeIds.has(edge.target_node_id),
    ),
  };

  return {
    graph: nextGraph,
    selection: { nodeIds: [], edgeIds: [] },
  };
}

export function duplicateGraphSelection(
  graph: WorkflowGraph,
  selection: GraphSelection,
  options: GraphCommandOptions = {},
): { graph: WorkflowGraph; selection: GraphSelection } {
  const sourceNodes = selectedCopyableNodes(graph, selection);
  if (sourceNodes.length === 0) {
    return { graph, selection: { nodeIds: [], edgeIds: [] } };
  }

  const { nodes, edges, selection: nextSelection } = cloneGraphFragment(
    graph,
    sourceNodes,
    internalEdges(graph, sourceNodes),
    {
      ...options,
      labelCopies: true,
    },
  );

  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...nodes],
      edges: [...graph.edges, ...edges],
    },
    selection: nextSelection,
  };
}

export function copyGraphSelection(
  graph: WorkflowGraph,
  selection: GraphSelection,
): GraphClipboard | null {
  const nodes = selectedCopyableNodes(graph, selection).map(cloneNode);
  if (nodes.length === 0) return null;

  return {
    nodes,
    edges: internalEdges(graph, nodes).map(cloneEdge),
  };
}

export function pasteGraphClipboard(
  graph: WorkflowGraph,
  clipboard: GraphClipboard | null,
  options: GraphCommandOptions = {},
): { graph: WorkflowGraph; selection: GraphSelection } {
  if (!clipboard || clipboard.nodes.length === 0) {
    return { graph, selection: { nodeIds: [], edgeIds: [] } };
  }

  const { nodes, edges, selection } = cloneGraphFragment(
    graph,
    clipboard.nodes,
    clipboard.edges,
    options,
  );

  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...nodes],
      edges: [...graph.edges, ...edges],
    },
    selection,
  };
}

export function pushGraphHistory(
  history: GraphHistoryState,
  nextGraph: WorkflowGraph,
): GraphHistoryState {
  if (history.present === nextGraph) return history;

  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: nextGraph,
    future: [],
  };
}

export function undoGraphHistory(history: GraphHistoryState): GraphHistoryState {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;

  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoGraphHistory(history: GraphHistoryState): GraphHistoryState {
  const next = history.future[0];
  if (!next) return history;

  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future: history.future.slice(1),
  };
}

function selectedCopyableNodes(
  graph: WorkflowGraph,
  selection: GraphSelection,
): GraphNode[] {
  const selectedNodeIds = new Set(selection.nodeIds);
  return graph.nodes.filter(
    (node) => node.node_type !== "start" && selectedNodeIds.has(node.id),
  );
}

function internalEdges(graph: WorkflowGraph, nodes: GraphNode[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return graph.edges.filter(
    (edge) =>
      nodeIds.has(edge.source_node_id) && nodeIds.has(edge.target_node_id),
  );
}

function cloneGraphFragment(
  graph: WorkflowGraph,
  sourceNodes: GraphNode[],
  sourceEdges: GraphEdge[],
  options: GraphCommandOptions & { labelCopies?: boolean },
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selection: GraphSelection;
} {
  const offset = options.offset ?? defaultOffset;
  const nodeIdMap = new Map<string, string>();
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));

  const nodes = sourceNodes.map((node, index) => {
    const requestedId =
      options.createNodeId?.(node, index) ?? `${node.id}-copy`;
    const id = uniqueId(requestedId, existingNodeIds);
    existingNodeIds.add(id);
    nodeIdMap.set(node.id, id);

    return {
      ...cloneNode(node),
      id,
      label: options.labelCopies ? `${node.label} Copy` : node.label,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
    };
  });

  const existingEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const edges = sourceEdges.flatMap((edge) => {
    const sourceNodeId = nodeIdMap.get(edge.source_node_id);
    const targetNodeId = nodeIdMap.get(edge.target_node_id);
    if (!sourceNodeId || !targetNodeId) return [];

    const id = uniqueId(
      edgeId(sourceNodeId, edge.source_port, targetNodeId, edge.target_port),
      existingEdgeIds,
    );
    existingEdgeIds.add(id);

    return [
      {
        ...cloneEdge(edge),
        id,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
      },
    ];
  });

  return {
    nodes,
    edges,
    selection: {
      nodeIds: nodes.map((node) => node.id),
      edgeIds: edges.map((edge) => edge.id),
    },
  };
}

function edgeId(
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  targetPort: string,
) {
  return `edge-${sourceNodeId}-${sourcePort}-${targetNodeId}-${targetPort}`;
}

function uniqueId(requestedId: string, existingIds: Set<string>) {
  if (!existingIds.has(requestedId)) return requestedId;

  let suffix = 2;
  let nextId = `${requestedId}-${suffix}`;
  while (existingIds.has(nextId)) {
    suffix += 1;
    nextId = `${requestedId}-${suffix}`;
  }
  return nextId;
}

function cloneNode(node: GraphNode): GraphNode {
  return cloneValue(node);
}

function cloneEdge(edge: GraphEdge): GraphEdge {
  return cloneValue(edge);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
