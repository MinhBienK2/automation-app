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
const arrangeColumnGap = 260;
const arrangeRowGap = 120;
const arrangeLaneGap = 180;
const arrangeColumnsPerLane = 8;

export function arrangeWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  const orderedNodeIds = graphExecutionNodeOrder(graph);
  const orderedNodeIdSet = new Set(orderedNodeIds);
  const nodeOrder = [
    ...orderedNodeIds,
    ...graph.nodes
      .map((node) => node.id)
      .filter((nodeId) => !orderedNodeIdSet.has(nodeId)),
  ];
  const nodeOrderIndex = new Map(nodeOrder.map((nodeId, index) => [nodeId, index]));
  const depths = graphNodeDepths(graph, nodeOrder);
  const columns = new Map<number, string[]>();

  for (const nodeId of nodeOrder) {
    const column = depths.get(nodeId) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), nodeId]);
  }

  for (const [column, nodeIds] of columns) {
    columns.set(
      column,
      [...nodeIds].sort(
        (left, right) =>
          (nodeOrderIndex.get(left) ?? 0) - (nodeOrderIndex.get(right) ?? 0),
      ),
    );
  }

  const positions = new Map<string, GraphPosition>();
  for (const [column, nodeIds] of columns) {
    nodeIds.forEach((nodeId, row) => {
      const lane = column <= 0 ? 0 : Math.floor((column - 1) / arrangeColumnsPerLane);
      const columnInLane = column <= 0 ? 0 : (column - 1) % arrangeColumnsPerLane;
      const displayColumn = column <= 0 ? 0 : columnInLane + 1;
      positions.set(nodeId, {
        x: displayColumn * arrangeColumnGap,
        y: lane * arrangeLaneGap + row * arrangeRowGap,
      });
    });
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
  };
}

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

function graphExecutionNodeOrder(graph: WorkflowGraph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesBySourcePort = new Map<string, GraphEdge[]>();
  const orderedNodeIds: string[] = [];
  const seenNodeIds = new Set<string>();
  const start = graph.nodes.find((node) => node.node_type === "start");
  if (!start) return orderedNodeIds;

  for (const edge of graph.edges) {
    const key = edgeSourcePortKey(edge.source_node_id, edge.source_port);
    edgesBySourcePort.set(key, [...(edgesBySourcePort.get(key) ?? []), edge]);
  }
  for (const edges of edgesBySourcePort.values()) {
    edges.sort((left, right) => left.id.localeCompare(right.id));
  }

  const stack = [start.id];
  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId) continue;
    const node = nodeById.get(nodeId);
    if (!node || seenNodeIds.has(node.id)) continue;
    seenNodeIds.add(node.id);
    orderedNodeIds.push(node.id);

    const nextNodeIds: string[] = [];
    for (const portId of orderedOutputPortIds(node)) {
      const edge = edgesBySourcePort.get(edgeSourcePortKey(node.id, portId))?.[0];
      if (edge && !seenNodeIds.has(edge.target_node_id)) {
        nextNodeIds.push(edge.target_node_id);
      }
    }
    for (let index = nextNodeIds.length - 1; index >= 0; index -= 1) {
      const nextNodeId = nextNodeIds[index];
      if (nextNodeId) stack.push(nextNodeId);
    }
  }
  return orderedNodeIds;
}

function graphNodeDepths(graph: WorkflowGraph, orderedNodeIds: string[]) {
  const depths = new Map<string, number>();
  const nodeOrderSet = new Set(orderedNodeIds);
  const edgesBySource = new Map<string, GraphEdge[]>();
  const start = graph.nodes.find((node) => node.node_type === "start");
  if (start) depths.set(start.id, 0);

  for (const edge of graph.edges) {
    if (!nodeOrderSet.has(edge.source_node_id) || !nodeOrderSet.has(edge.target_node_id)) {
      continue;
    }
    edgesBySource.set(edge.source_node_id, [
      ...(edgesBySource.get(edge.source_node_id) ?? []),
      edge,
    ]);
  }

  const queue = start ? [start.id] : [];
  const relaxCounts = new Map<string, number>();
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const nodeId = queue[queueIndex];
    if (!nodeId) continue;
    const sourceDepth = depths.get(nodeId);
    if (sourceDepth == null) continue;
    for (const edge of edgesBySource.get(nodeId) ?? []) {
      const nextDepth = sourceDepth + 1;
      if ((depths.get(edge.target_node_id) ?? -1) < nextDepth) {
        depths.set(edge.target_node_id, nextDepth);
        const relaxCount = (relaxCounts.get(edge.target_node_id) ?? 0) + 1;
        relaxCounts.set(edge.target_node_id, relaxCount);
        if (relaxCount <= graph.nodes.length) {
          queue.push(edge.target_node_id);
        }
      }
    }
  }

  const maxReachableDepth = Math.max(0, ...depths.values());
  orderedNodeIds.forEach((nodeId, index) => {
    if (!depths.has(nodeId)) {
      depths.set(nodeId, maxReachableDepth + 1 + index);
    }
  });
  return depths;
}

function edgeSourcePortKey(sourceNodeId: string, sourcePort: string) {
  return `${sourceNodeId}\u0000${sourcePort}`;
}

function orderedOutputPortIds(node: GraphNode) {
  const outputPortIds = node.ports
    .filter((port) => port.direction === "output")
    .map((port) => port.id);
  const preferred = preferredOutputPortOrder(node);
  return [
    ...preferred.filter((portId) => outputPortIds.includes(portId)),
    ...outputPortIds.filter((portId) => !preferred.includes(portId)),
  ];
}

function preferredOutputPortOrder(node: GraphNode) {
  switch (node.node_type) {
    case "start":
    case "action":
    case "merge":
    case "set_variable":
    case "set_json_variables":
    case "transform_variable":
    case "update_number_variable":
    case "update_text_variable":
    case "update_flag_variable":
    case "update_list_variable":
    case "create_empty_list":
    case "create_list_manual":
    case "split_text_to_list":
    case "generate_number_range":
    case "add_to_list":
    case "remove_from_list_by_index":
    case "remove_from_list_by_value":
    case "merge_lists":
    case "get_list_item":
    case "get_list_length":
    case "slice_list":
    case "join_list":
    case "filter_list":
    case "map_list_property":
    case "sort_reverse_list":
    case "execute_list_script":
    case "check_list_empty":
    case "check_list_contains":
    case "check_list_any_match":
    case "check_list_all_match":
    case "create_empty_object":
    case "create_object_manual":
    case "parse_json_to_object":
    case "set_object_property":
    case "remove_object_property":
    case "merge_objects":
    case "rename_object_property":
    case "get_object_property":
    case "get_object_keys":
    case "get_object_values":
    case "stringify_object":
    case "execute_object_script":
    case "check_object_key_exists":
    case "check_object_empty":
    case "assert_output":
    case "domain_allowlist":
      return ["out"];
    case "if":
      return ["true", "false", "done"];
    case "switch":
      return [
        ...casePortIds(node),
        "default",
        "done",
      ];
    case "router":
      return [
        ...routerCasePortIds(node),
        "default",
        "done",
      ];
    case "random_choice":
      return [
        ...randomChoicePortIds(node),
        "done",
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return ["loop", "done"];
    case "repeat_until":
      return ["loop", "timeout", "done"];
    case "retry":
      return ["try", "failed", "success"];
    case "try_catch":
      return ["try", "success", "error", "finally", "done"];
    case "fallback":
      return ["primary", "fallback", "done"];
    default:
      return [];
  }
}

function casePortIds(node: GraphNode) {
  return node.ports
    .filter((port) => port.direction === "output" && /^case_\d+$/.test(port.id))
    .map((port) => port.id)
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)));
}

function routerCasePortIds(node: GraphNode) {
  const cases = Array.isArray((node.config as { cases?: unknown } | null)?.cases)
    ? ((node.config as { cases: Array<{ id?: unknown }> }).cases)
    : [];
  const configured = cases
    .map((caseValue) => typeof caseValue.id === "string" ? `case_${caseValue.id}` : null)
    .filter((portId): portId is string => Boolean(portId));
  const portIds = node.ports
    .filter((port) => port.direction === "output" && port.id.startsWith("case_"))
    .map((port) => port.id);
  return [
    ...configured.filter((portId) => portIds.includes(portId)),
    ...portIds.filter((portId) => !configured.includes(portId)),
  ];
}

function randomChoicePortIds(node: GraphNode) {
  const choices = Array.isArray((node.config as { choices?: unknown } | null)?.choices)
    ? ((node.config as { choices: Array<{ id?: unknown }> }).choices)
    : [];
  const configured = choices
    .map((choice) => typeof choice.id === "string" ? `choice_${choice.id}` : null)
    .filter((portId): portId is string => Boolean(portId));
  const portIds = node.ports
    .filter((port) => port.direction === "output" && port.id.startsWith("choice_"))
    .map((port) => port.id);
  return [
    ...configured.filter((portId) => portIds.includes(portId)),
    ...portIds.filter((portId) => !configured.includes(portId)),
  ];
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
