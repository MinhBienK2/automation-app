import type {
  GraphEdgeDelay,
  GraphNode,
  GraphPosition,
  Subflow,
  WorkflowGraph,
} from "../../../types/workflow";
import type { GraphSelection } from "./graphEditorCommands";
import {
  createDefaultGraphNode,
  nodePorts,
} from "./workflowGraph";

export type SelectionSubflowPlan =
  | {
      ok: true;
      entryNode: GraphNode;
      selectedNodes: GraphNode[];
      internalEdges: WorkflowGraph["edges"];
      externalIncomingEdges: WorkflowGraph["edges"];
      externalOutgoingEdges: WorkflowGraph["edges"];
      subflowGraph: WorkflowGraph;
      replacementPosition: GraphPosition;
    }
  | { ok: false; message: string };

export type ReplaceSelectionPlan =
  | { ok: true; graph: WorkflowGraph; selection: GraphSelection }
  | { ok: false; message: string };

export type InsertSubflowNodesPlan =
  | { ok: true; graph: WorkflowGraph; selection: GraphSelection }
  | { ok: false; message: string };

const graphNodeDimensions = {
  width: 160,
  height: 82,
};

export function buildSelectedSubflowPlan(
  graph: WorkflowGraph,
  selection: GraphSelection,
): SelectionSubflowPlan {
  const selectedNodeIdSet = new Set(selection.nodeIds);
  const selectedNodes = graph.nodes.filter((node) => selectedNodeIdSet.has(node.id));

  if (selectedNodes.length === 0) {
    return { ok: false, message: "Select at least one node to create a subflow." };
  }
  if (selectedNodes.some((node) => node.node_type === "start")) {
    return { ok: false, message: "Start cannot be included in a reusable subflow." };
  }
  if (selectedNodes.some((node) => node.node_type === "call_subflow")) {
    return {
      ok: false,
      message: "Call Subflow nodes cannot be nested inside MVP subflows.",
    };
  }

  const internalEdges = graph.edges.filter(
    (edge) =>
      selectedNodeIdSet.has(edge.source_node_id) &&
      selectedNodeIdSet.has(edge.target_node_id),
  );
  const externalIncomingEdges = graph.edges.filter(
    (edge) =>
      !selectedNodeIdSet.has(edge.source_node_id) &&
      selectedNodeIdSet.has(edge.target_node_id),
  );
  const externalOutgoingEdges = graph.edges.filter(
    (edge) =>
      selectedNodeIdSet.has(edge.source_node_id) &&
      !selectedNodeIdSet.has(edge.target_node_id),
  );

  const entryNode = selectedSubflowEntryNode(selectedNodes, internalEdges, externalIncomingEdges);
  if (!entryNode) {
    return {
      ok: false,
      message: "Selection needs one clear first node before it can become a subflow.",
    };
  }
  const reachableNodeIds = reachableSelectedNodeIds(entryNode.id, internalEdges);
  if (selectedNodes.some((node) => !reachableNodeIds.has(node.id))) {
    return {
      ok: false,
      message: "Selection must form one connected block from its first node.",
    };
  }

  const minX = Math.min(...selectedNodes.map((node) => node.position.x));
  const minY = Math.min(...selectedNodes.map((node) => node.position.y));
  const replacementPosition = selectedNodesReplacementPosition(selectedNodes);
  const copiedNodes = selectedNodes.map((node) => ({
    ...cloneGraphNode(node),
    position: {
      x: Math.round(node.position.x - minX + 220),
      y: Math.round(node.position.y - minY),
    },
  }));
  const startNode: GraphNode = {
    id: "start",
    node_type: "start",
    label: "Start",
    position: { x: 0, y: 0 },
    config: {},
    ports: nodePorts("start"),
    group_id: null,
  };
  const startEdge = {
    id: uniqueGraphEdgeId(
      `edge-start-${entryNode.id}`,
      new Set(internalEdges.map((edge) => edge.id)),
    ),
    source_node_id: "start",
    source_port: "out",
    target_node_id: entryNode.id,
    target_port: firstInputPort(entryNode),
    label: "next",
    condition: null,
  };

  return {
    ok: true,
    entryNode,
    selectedNodes,
    internalEdges,
    externalIncomingEdges,
    externalOutgoingEdges,
    replacementPosition,
    subflowGraph: {
      version: graph.version,
      nodes: [startNode, ...copiedNodes],
      edges: [startEdge, ...internalEdges.map(cloneGraphEdge)],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

export function replaceSelectionWithSubflowNode(
  graph: WorkflowGraph,
  selection: GraphSelection,
  subflow: Pick<Subflow, "id" | "name">,
): ReplaceSelectionPlan {
  const plan = buildSelectedSubflowPlan(graph, selection);
  if (!plan.ok) return plan;
  if (plan.externalIncomingEdges.length > 1 || plan.externalOutgoingEdges.length > 1) {
    return {
      ok: false,
      message:
        "Replace supports selections with at most one incoming link and one outgoing link.",
    };
  }
  const internalOutgoingNodeIds = new Set(
    plan.internalEdges.map((edge) => edge.source_node_id),
  );
  if (
    plan.externalOutgoingEdges.some((edge) =>
      internalOutgoingNodeIds.has(edge.source_node_id),
    )
  ) {
    return {
      ok: false,
      message:
        "Replace cannot safely rewire selections where a selected node has both internal links and links to the outside graph.",
    };
  }

  const selectedNodeIdSet = new Set(plan.selectedNodes.map((node) => node.id));
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const replacementNode = {
    ...createDefaultGraphNode("call_subflow", plan.replacementPosition),
    label: subflow.name,
    config: {
      subflow_id: subflow.id,
      input_mapping: [],
      output_prefix: null,
    },
  };
  replacementNode.id = uniqueGraphNodeId(replacementNode.id, existingNodeIds);

  const nextEdges = graph.edges.filter(
    (edge) =>
      !selectedNodeIdSet.has(edge.source_node_id) &&
      !selectedNodeIdSet.has(edge.target_node_id),
  );
  const edgeIds = new Set(nextEdges.map((edge) => edge.id));
  const incomingEdge = plan.externalIncomingEdges[0];
  if (incomingEdge) {
    const edge = {
      ...cloneGraphEdge(incomingEdge),
      id: uniqueGraphEdgeId(
        `edge-${incomingEdge.source_node_id}-${incomingEdge.source_port}-${replacementNode.id}-in`,
        edgeIds,
      ),
      target_node_id: replacementNode.id,
      target_port: "in",
    };
    edgeIds.add(edge.id);
    nextEdges.push(edge);
  }
  const outgoingEdge = plan.externalOutgoingEdges[0];
  if (outgoingEdge) {
    const edge = {
      ...cloneGraphEdge(outgoingEdge),
      id: uniqueGraphEdgeId(
        `edge-${replacementNode.id}-out-${outgoingEdge.target_node_id}-${outgoingEdge.target_port}`,
        edgeIds,
      ),
      source_node_id: replacementNode.id,
      source_port: "out",
    };
    edgeIds.add(edge.id);
    nextEdges.push(edge);
  }

  return {
    ok: true,
    graph: {
      ...graph,
      nodes: [
        ...graph.nodes.filter((node) => !selectedNodeIdSet.has(node.id)),
        replacementNode,
      ],
      edges: nextEdges,
    },
    selection: { nodeIds: [replacementNode.id], edgeIds: [] },
  };
}

export function insertSubflowGraphNodes(
  graph: WorkflowGraph,
  subflowGraph: WorkflowGraph,
  insertionPosition: GraphPosition,
): InsertSubflowNodesPlan {
  const sourceNodes = subflowGraph.nodes.filter((node) => node.node_type !== "start");
  if (sourceNodes.length === 0) {
    return { ok: false, message: "Subflow has no nodes to insert." };
  }
  if (sourceNodes.some((node) => node.node_type === "call_subflow")) {
    return {
      ok: false,
      message: "Nested Call Subflow nodes cannot be inserted from a subflow.",
    };
  }

  const minX = Math.min(...sourceNodes.map((node) => node.position.x));
  const minY = Math.min(...sourceNodes.map((node) => node.position.y));
  const sourceNodeIds = new Set(sourceNodes.map((node) => node.id));
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const nodeIdMap = new Map<string, string>();

  const nodes = sourceNodes.map((node) => {
    const id = uniqueGraphNodeId(node.id, existingNodeIds);
    existingNodeIds.add(id);
    nodeIdMap.set(node.id, id);

    return {
      ...cloneGraphNode(node),
      id,
      position: {
        x: Math.round(insertionPosition.x + node.position.x - minX),
        y: Math.round(insertionPosition.y + node.position.y - minY),
      },
    };
  });

  const existingEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const edges = subflowGraph.edges.flatMap((edge) => {
    if (
      !sourceNodeIds.has(edge.source_node_id) ||
      !sourceNodeIds.has(edge.target_node_id)
    ) {
      return [];
    }
    const sourceNodeId = nodeIdMap.get(edge.source_node_id);
    const targetNodeId = nodeIdMap.get(edge.target_node_id);
    if (!sourceNodeId || !targetNodeId) return [];

    const id = uniqueGraphEdgeId(
      graphEdgeId(sourceNodeId, edge.source_port, targetNodeId, edge.target_port),
      existingEdgeIds,
    );
    existingEdgeIds.add(id);

    return [
      {
        ...cloneGraphEdge(edge),
        id,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
      },
    ];
  });

  return {
    ok: true,
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...nodes],
      edges: [...graph.edges, ...edges],
    },
    selection: {
      nodeIds: nodes.map((node) => node.id),
      edgeIds: edges.map((edge) => edge.id),
    },
  };
}

export function cloneGraphEdgeDelay(delay: GraphEdgeDelay | null): GraphEdgeDelay | null {
  return delay ? { ...delay } : null;
}

function selectedSubflowEntryNode(
  selectedNodes: GraphNode[],
  internalEdges: WorkflowGraph["edges"],
  externalIncomingEdges: WorkflowGraph["edges"],
) {
  const externalIncomingTargetIds = new Set(
    externalIncomingEdges.map((edge) => edge.target_node_id),
  );
  if (externalIncomingTargetIds.size === 1) {
    return selectedNodes.find((node) => externalIncomingTargetIds.has(node.id)) ?? null;
  }
  if (externalIncomingTargetIds.size > 1) return null;

  const internalTargetIds = new Set(internalEdges.map((edge) => edge.target_node_id));
  const roots = selectedNodes.filter((node) => !internalTargetIds.has(node.id));
  if (roots.length !== 1) return null;
  return roots[0];
}

function reachableSelectedNodeIds(entryNodeId: string, internalEdges: WorkflowGraph["edges"]) {
  const reachable = new Set([entryNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of internalEdges) {
      if (reachable.has(edge.source_node_id) && !reachable.has(edge.target_node_id)) {
        reachable.add(edge.target_node_id);
        changed = true;
      }
    }
  }
  return reachable;
}

function selectedNodesReplacementPosition(nodes: GraphNode[]): GraphPosition {
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + graphNodeDimensions.width));
  const maxY = Math.max(...nodes.map((node) => node.position.y + graphNodeDimensions.height));
  return {
    x: Math.round((minX + maxX) / 2 - graphNodeDimensions.width / 2),
    y: Math.round((minY + maxY) / 2 - graphNodeDimensions.height / 2),
  };
}

function firstInputPort(node: GraphNode) {
  return node.ports.find((port) => port.direction === "input")?.id ?? "in";
}

function cloneGraphNode(node: GraphNode): GraphNode {
  return {
    ...node,
    position: { ...node.position },
    ports: node.ports.map((port) => ({ ...port })),
    config: cloneStructuredValue(node.config),
  };
}

function cloneGraphEdge(edge: WorkflowGraph["edges"][number]): WorkflowGraph["edges"][number] {
  return {
    ...edge,
    condition: edge.condition ? cloneStructuredValue(edge.condition) : null,
    delay: cloneGraphEdgeDelay(edge.delay ?? null),
  };
}

function cloneStructuredValue<T>(value: T): T {
  if (typeof value === "undefined") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueGraphNodeId(baseId: string, existingIds: Set<string>) {
  if (!existingIds.has(baseId)) return baseId;
  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  return nextId;
}

function uniqueGraphEdgeId(baseId: string, existingIds: Set<string>) {
  if (!existingIds.has(baseId)) return baseId;
  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  return nextId;
}

function graphEdgeId(
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  targetPort: string,
) {
  return `edge-${sourceNodeId}-${sourcePort}-${targetNodeId}-${targetPort}`;
}
