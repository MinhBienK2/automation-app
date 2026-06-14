import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type {
  GraphEdge,
  GraphNode,
  GraphPosition,
  WorkflowGraph,
} from "../../../types/workflow";
import {
  graphNodeHeightForPorts,
  graphNodeMinHeight,
  graphNodeWidth,
} from "./graphNodeDimensions";

export type WorkflowGraphEdgeKind =
  | "main"
  | "branch"
  | "continuation"
  | "loop"
  | "recovery";

export type GraphLayoutResult = {
  graph: WorkflowGraph;
  edgeKinds: Map<string, WorkflowGraphEdgeKind>;
};

const layoutColumnGap = 260;
const layoutRowGap = 120;
const layoutLaneGap = 180;
const layoutColumnsPerRow = 8;
const layoutRowVerticalGap = Math.max(0, layoutRowGap - graphNodeMinHeight);
const layoutLaneVerticalGap = Math.max(0, layoutLaneGap - graphNodeMinHeight);

const elk = new ELK({
  defaultLayoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.spacing.nodeNode": "80",
    "elk.layered.spacing.nodeNodeBetweenLayers": "120",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.portConstraints": "FIXED_SIDE",
  },
});

export async function layoutWorkflowGraph(
  graph: WorkflowGraph,
): Promise<GraphLayoutResult> {
  const edgeKinds = new Map(
    graph.edges.map((edge) => [edge.id, classifyWorkflowGraphEdge(graph, edge)]),
  );

  const elkPositions = await runElkLayoutForGraph(graph);
  const positionsBeforePortOrder = usesWrappedMainRows(graph)
    ? fullGraphPositions(graph)
    : normalizeElkPositions(elkPositions);
  const positionsAfterPortOrder = applyPortOrderToPositions(
    graph,
    positionsBeforePortOrder,
  );
  const positions = applyPortOrderToPositions(
    graph,
    alignBranchLanePositions(graph, positionsAfterPortOrder),
    { includeBranchLaneConstraints: false },
  );
  return {
    graph: {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
      })),
    },
    edgeKinds,
  };
}

export function classifyWorkflowGraphEdge(
  graph: WorkflowGraph,
  edge: GraphEdge,
): WorkflowGraphEdgeKind {
  const source = graph.nodes.find((node) => node.id === edge.source_node_id);
  return classifyWorkflowGraphEdgeFromSource(source, edge);
}

export function classifyWorkflowGraphEdgeFromSource(
  source: GraphNode | undefined,
  edge: GraphEdge,
): WorkflowGraphEdgeKind {
  if (!source) return "main";

  if (isLoopPort(source, edge.source_port)) return "loop";
  if (isRecoveryPort(source, edge.source_port)) return "recovery";
  if (isContinuationPort(source, edge.source_port)) return "continuation";
  if (isBranchPort(source, edge.source_port)) return "branch";
  return "main";
}

function fullGraphPositions(graph: WorkflowGraph) {
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

  const nodeHeights = new Map(
    graph.nodes.map((node) => [node.id, graphNodeHeightForPorts(node.ports)]),
  );
  const laneIndexes = [
    ...new Set([...columns.keys()].map((column) => layoutLaneForColumn(column))),
  ].sort((left, right) => left - right);
  const laneTopOffsets = new Map<number, number>();
  let nextLaneTop = 0;
  for (const lane of laneIndexes) {
    laneTopOffsets.set(lane, nextLaneTop);
    const laneHeight = Math.max(
      0,
      ...[...columns]
        .filter(([column]) => layoutLaneForColumn(column) === lane)
        .map(([, nodeIds]) => nodeColumnHeight(nodeIds, nodeHeights)),
    );
    nextLaneTop += laneHeight + layoutLaneVerticalGap;
  }

  const positions = new Map<string, GraphPosition>();
  for (const [column, nodeIds] of columns) {
    const lane = layoutLaneForColumn(column);
    const displayColumn = layoutDisplayColumn(column);
    let rowTop = laneTopOffsets.get(lane) ?? 0;
    nodeIds.forEach((nodeId) => {
      positions.set(nodeId, {
        x: displayColumn * layoutColumnGap,
        y: rowTop,
      });
      rowTop += (nodeHeights.get(nodeId) ?? graphNodeMinHeight) + layoutRowVerticalGap;
    });
  }

  return positions;
}

function layoutLaneForColumn(column: number) {
  return column <= 0 ? 0 : Math.floor((column - 1) / layoutColumnsPerRow);
}

function layoutDisplayColumn(column: number) {
  if (column <= 0) return 0;
  return ((column - 1) % layoutColumnsPerRow) + 1;
}

function nodeColumnHeight(nodeIds: string[], nodeHeights: Map<string, number>) {
  return nodeIds.reduce((height, nodeId, index) => {
    const rowGap = index === 0 ? 0 : layoutRowVerticalGap;
    return height + rowGap + (nodeHeights.get(nodeId) ?? graphNodeMinHeight);
  }, 0);
}

async function runElkLayoutForGraph(
  graph: WorkflowGraph,
  selectedNodeIds?: Set<string>,
): Promise<Map<string, GraphPosition>> {
  const result = await elk.layout(toElkGraph(graph, selectedNodeIds));
  return new Map(
    (result.children ?? []).map((node) => [
      node.id,
      { x: Math.round(node.x ?? 0), y: Math.round(node.y ?? 0) },
    ]),
  );
}

function usesWrappedMainRows(graph: WorkflowGraph) {
  if (graph.nodes.length === 0) return true;
  return graph.edges.every((edge) => classifyWorkflowGraphEdge(graph, edge) === "main");
}

function normalizeElkPositions(positions: Map<string, GraphPosition>) {
  if (positions.size === 0) return positions;
  const positionValues = [...positions.values()];
  const minX = Math.min(...positionValues.map((position) => position.x));
  const minY = Math.min(...positionValues.map((position) => position.y));
  return new Map(
    [...positions].map(([nodeId, position]) => [
      nodeId,
      {
        x: Math.round(position.x - minX),
        y: Math.round(position.y - minY),
      },
    ]),
  );
}

function applyPortOrderToPositions(
  graph: WorkflowGraph,
  positions: Map<string, GraphPosition>,
  options: { includeBranchLaneConstraints?: boolean } = {},
) {
  const constraints = portOrderConstraintsByColumn(graph, positions, options);
  if (constraints.size === 0) return positions;

  const nextPositions = new Map(positions);
  for (const columnConstraints of constraints.values()) {
    const nodeIds = [...new Set(columnConstraints.flatMap(([above, below]) => [above, below]))];
    const yValues = nodeIds
      .map((nodeId) => positions.get(nodeId)?.y)
      .filter((value): value is number => typeof value === "number")
      .sort((left, right) => left - right);
    const orderedNodeIds = topologicalPortOrder(nodeIds, columnConstraints, positions);

    orderedNodeIds.forEach((nodeId, index) => {
      const position = nextPositions.get(nodeId);
      const y = yValues[index];
      if (!position || y == null) return;
      nextPositions.set(nodeId, { ...position, y });
    });
  }

  return nextPositions;
}

function alignBranchLanePositions(
  graph: WorkflowGraph,
  positions: Map<string, GraphPosition>,
) {
  const branchLaneY = branchLaneYByNodeId(graph, positions);
  if (branchLaneY.size === 0) return positions;

  const nodeHeights = new Map(
    graph.nodes.map((node) => [node.id, graphNodeHeightForPorts(node.ports)]),
  );
  const nodeIdsByColumn = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const column = columnKey(positions.get(node.id));
    if (!column) continue;
    nodeIdsByColumn.set(column, [...(nodeIdsByColumn.get(column) ?? []), node.id]);
  }

  const nextPositions = new Map(positions);
  for (const nodeIds of nodeIdsByColumn.values()) {
    if (!nodeIds.some((nodeId) => branchLaneY.has(nodeId))) continue;

    const orderedNodeIds = [...nodeIds].sort((left, right) => {
      const leftY = branchLaneY.get(left) ?? positions.get(left)?.y ?? 0;
      const rightY = branchLaneY.get(right) ?? positions.get(right)?.y ?? 0;
      const desiredDiff = leftY - rightY;
      if (desiredDiff !== 0) return desiredDiff;
      return comparePositionOrder(left, right, positions);
    });

    let previousBottom: number | null = null;
    for (const nodeId of orderedNodeIds) {
      const position = nextPositions.get(nodeId);
      if (!position) continue;
      const desiredY = branchLaneY.get(nodeId) ?? positions.get(nodeId)?.y ?? 0;
      const y = Math.round(
        previousBottom == null
          ? desiredY
          : Math.max(desiredY, previousBottom + layoutRowVerticalGap),
      );
      nextPositions.set(nodeId, { ...position, y });
      previousBottom = y + (nodeHeights.get(nodeId) ?? graphNodeMinHeight);
    }
  }

  return nextPositions;
}

function branchLaneYByNodeId(
  graph: WorkflowGraph,
  positions: Map<string, GraphPosition>,
) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesBySourcePort = new Map<string, GraphEdge[]>();
  const incomingCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    const key = edgeSourcePortKey(edge.source_node_id, edge.source_port);
    edgesBySourcePort.set(key, [...(edgesBySourcePort.get(key) ?? []), edge]);
    incomingCounts.set(edge.target_node_id, (incomingCounts.get(edge.target_node_id) ?? 0) + 1);
  }
  for (const edges of edgesBySourcePort.values()) {
    edges.sort((left, right) => left.id.localeCompare(right.id));
  }

  const laneY = new Map<string, number>();
  const queue: string[] = [];
  const assignLaneY = (nodeId: string, y: number) => {
    if ((incomingCounts.get(nodeId) ?? 0) > 1) return;
    const currentY = laneY.get(nodeId);
    if (currentY != null && currentY <= y) return;
    laneY.set(nodeId, y);
    queue.push(nodeId);
  };

  for (const node of graph.nodes) {
    for (const portId of branchLaneOutputPortIds(node)) {
      for (const edge of edgesBySourcePort.get(edgeSourcePortKey(node.id, portId)) ?? []) {
        const targetY = positions.get(edge.target_node_id)?.y;
        if (targetY == null) continue;
        assignLaneY(edge.target_node_id, targetY);
      }
    }
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const nodeId = queue[queueIndex];
    if (!nodeId) continue;
    const node = nodeById.get(nodeId);
    const y = laneY.get(nodeId);
    if (!node || y == null) continue;
    for (const edge of linearLaneOutputEdges(node, edgesBySourcePort)) {
      assignLaneY(edge.target_node_id, y);
    }
  }

  return laneY;
}

function linearLaneOutputEdges(
  node: GraphNode,
  edgesBySourcePort: Map<string, GraphEdge[]>,
) {
  const edges = orderedOutputPortIds(node).flatMap((portId) =>
    edgesBySourcePort.get(edgeSourcePortKey(node.id, portId)) ?? [],
  );
  if (edges.length !== 1) return [];
  const edge = edges[0];
  if (!edge) return [];
  if (
    isBranchPort(node, edge.source_port) ||
    isLoopPort(node, edge.source_port) ||
    isRecoveryPort(node, edge.source_port)
  ) {
    return [];
  }
  return [edge];
}

function portOrderConstraintsByColumn(
  graph: WorkflowGraph,
  positions: Map<string, GraphPosition>,
  options: { includeBranchLaneConstraints?: boolean } = {},
) {
  const constraints = new Map<string, Array<[string, string]>>();
  const edgesBySourcePort = new Map<string, GraphEdge[]>();
  const edgesByTargetPort = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const sourceKey = edgeSourcePortKey(edge.source_node_id, edge.source_port);
    edgesBySourcePort.set(sourceKey, [
      ...(edgesBySourcePort.get(sourceKey) ?? []),
      edge,
    ]);
    const targetKey = edgeTargetPortKey(edge.target_node_id, edge.target_port);
    edgesByTargetPort.set(targetKey, [
      ...(edgesByTargetPort.get(targetKey) ?? []),
      edge,
    ]);
  }
  for (const edges of [...edgesBySourcePort.values(), ...edgesByTargetPort.values()]) {
    edges.sort((left, right) => left.id.localeCompare(right.id));
  }

  for (const node of graph.nodes) {
    const outputTargets = orderedOutputPortIds(node).flatMap((portId) =>
      (edgesBySourcePort.get(edgeSourcePortKey(node.id, portId)) ?? [])
        .map((edge) => edge.target_node_id),
    );
    addColumnConstraints(outputTargets, positions, constraints);

    const inputSourceGroups = orderedInputPortIds(node).map((portId) =>
      (edgesByTargetPort.get(edgeTargetPortKey(node.id, portId)) ?? [])
        .map((edge) => edge.source_node_id),
    );
    addColumnGroupConstraints(inputSourceGroups, positions, constraints);
  }

  if (options.includeBranchLaneConstraints !== false) {
    addBranchLaneConstraints(graph, positions, constraints, edgesBySourcePort);
  }

  return constraints;
}

function addBranchLaneConstraints(
  graph: WorkflowGraph,
  positions: Map<string, GraphPosition>,
  constraints: Map<string, Array<[string, string]>>,
  edgesBySourcePort: Map<string, GraphEdge[]>,
) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    incomingCounts.set(edge.target_node_id, (incomingCounts.get(edge.target_node_id) ?? 0) + 1);
  }

  const laneRanks = new Map<string, number>();
  const queue: string[] = [];
  const assignLaneRank = (nodeId: string, rank: number) => {
    if ((incomingCounts.get(nodeId) ?? 0) > 1) return;
    const currentRank = laneRanks.get(nodeId);
    if (currentRank != null && currentRank <= rank) return;
    laneRanks.set(nodeId, rank);
    queue.push(nodeId);
  };

  for (const node of graph.nodes) {
    const branchTargets = branchLaneOutputPortIds(node).flatMap((portId) =>
      (edgesBySourcePort.get(edgeSourcePortKey(node.id, portId)) ?? [])
        .map((edge) => edge.target_node_id),
    );
    branchTargets.forEach((targetNodeId, index) => assignLaneRank(targetNodeId, index));
  }

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const nodeId = queue[queueIndex];
    if (!nodeId) continue;
    const node = nodeById.get(nodeId);
    const rank = laneRanks.get(nodeId);
    if (!node || rank == null) continue;
    for (const portId of sameLaneOutputPortIds(node)) {
      for (const edge of edgesBySourcePort.get(edgeSourcePortKey(node.id, portId)) ?? []) {
        assignLaneRank(edge.target_node_id, rank);
      }
    }
  }

  const rankedNodeIdsByColumn = new Map<string, string[]>();
  for (const [nodeId] of laneRanks) {
    const column = columnKey(positions.get(nodeId));
    if (!column) continue;
    rankedNodeIdsByColumn.set(column, [...(rankedNodeIdsByColumn.get(column) ?? []), nodeId]);
  }

  for (const nodeIds of rankedNodeIdsByColumn.values()) {
    addColumnConstraints(
      [...nodeIds].sort((left, right) => {
        const rankDiff = (laneRanks.get(left) ?? 0) - (laneRanks.get(right) ?? 0);
        if (rankDiff !== 0) return rankDiff;
        return comparePositionOrder(left, right, positions);
      }),
      positions,
      constraints,
    );
  }
}

function branchLaneOutputPortIds(node: GraphNode) {
  return orderedOutputPortIds(node).filter((portId) =>
    isBranchPort(node, portId) || isRecoveryPort(node, portId),
  );
}

function sameLaneOutputPortIds(node: GraphNode) {
  const branchPortCount = branchLaneOutputPortIds(node).length;
  return branchPortCount > 1 ? [] : orderedOutputPortIds(node);
}

function addColumnConstraints(
  orderedNodeIds: string[],
  positions: Map<string, GraphPosition>,
  constraints: Map<string, Array<[string, string]>>,
) {
  const seen = new Set<string>();
  const uniqueNodeIds = orderedNodeIds.filter((nodeId) => {
    if (seen.has(nodeId)) return false;
    seen.add(nodeId);
    return true;
  });

  for (let index = 0; index < uniqueNodeIds.length - 1; index += 1) {
    const above = uniqueNodeIds[index];
    const below = uniqueNodeIds[index + 1];
    if (!above || !below) continue;
    addColumnConstraint(above, below, positions, constraints);
  }
}

function addColumnGroupConstraints(
  orderedNodeIdGroups: string[][],
  positions: Map<string, GraphPosition>,
  constraints: Map<string, Array<[string, string]>>,
) {
  const uniqueGroups = orderedNodeIdGroups
    .map((nodeIds) => [...new Set(nodeIds)])
    .filter((nodeIds) => nodeIds.length > 0);

  for (let leftIndex = 0; leftIndex < uniqueGroups.length - 1; leftIndex += 1) {
    const aboveGroup = uniqueGroups[leftIndex];
    if (!aboveGroup) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < uniqueGroups.length; rightIndex += 1) {
      const belowGroup = uniqueGroups[rightIndex];
      if (!belowGroup) continue;
      for (const above of aboveGroup) {
        for (const below of belowGroup) {
          addColumnConstraint(above, below, positions, constraints);
        }
      }
    }
  }
}

function addColumnConstraint(
  above: string,
  below: string,
  positions: Map<string, GraphPosition>,
  constraints: Map<string, Array<[string, string]>>,
) {
  if (above === below) return;
  const aboveColumn = columnKey(positions.get(above));
  const belowColumn = columnKey(positions.get(below));
  if (!aboveColumn || aboveColumn !== belowColumn) return;
  constraints.set(aboveColumn, [...(constraints.get(aboveColumn) ?? []), [above, below]]);
}

function topologicalPortOrder(
  nodeIds: string[],
  constraints: Array<[string, string]>,
  positions: Map<string, GraphPosition>,
) {
  const nodeIdSet = new Set(nodeIds);
  const baselineOrder = [...nodeIds].sort((left, right) =>
    comparePositionOrder(left, right, positions),
  );
  const outgoing = new Map<string, Set<string>>();
  const incomingCounts = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const [above, below] of constraints) {
    if (!nodeIdSet.has(above) || !nodeIdSet.has(below) || above === below) continue;
    const next = outgoing.get(above) ?? new Set<string>();
    if (next.has(below)) continue;
    next.add(below);
    outgoing.set(above, next);
    incomingCounts.set(below, (incomingCounts.get(below) ?? 0) + 1);
  }

  const ready = baselineOrder.filter((nodeId) => (incomingCounts.get(nodeId) ?? 0) === 0);
  const ordered: string[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => comparePositionOrder(left, right, positions));
    const nodeId = ready.shift();
    if (!nodeId) continue;
    ordered.push(nodeId);
    for (const nextNodeId of outgoing.get(nodeId) ?? []) {
      incomingCounts.set(nextNodeId, (incomingCounts.get(nextNodeId) ?? 0) - 1);
      if ((incomingCounts.get(nextNodeId) ?? 0) === 0) {
        ready.push(nextNodeId);
      }
    }
  }

  if (ordered.length === nodeIds.length) return ordered;

  const orderedSet = new Set(ordered);
  return [
    ...ordered,
    ...baselineOrder.filter((nodeId) => !orderedSet.has(nodeId)),
  ];
}

function comparePositionOrder(
  left: string,
  right: string,
  positions: Map<string, GraphPosition>,
) {
  const leftPosition = positions.get(left);
  const rightPosition = positions.get(right);
  const yDiff = (leftPosition?.y ?? 0) - (rightPosition?.y ?? 0);
  if (yDiff !== 0) return yDiff;
  return left.localeCompare(right);
}

function columnKey(position?: GraphPosition) {
  return position ? String(Math.round(position.x)) : null;
}

function toElkGraph(graph: WorkflowGraph, selectedNodeIds?: Set<string>): ElkNode {
  const includedNodeIds = selectedNodeIds ?? new Set(graph.nodes.map((node) => node.id));
  const nodes = graph.nodes.filter((node) => includedNodeIds.has(node.id));

  return {
    id: "workflow-graph",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.portConstraints": "FIXED_SIDE",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: graphNodeWidth,
      height: graphNodeHeightForPorts(node.ports),
      ports: node.ports.map((port) => ({
        id: elkPortId(node.id, port.id),
        width: 8,
        height: 8,
        layoutOptions: {
          "elk.port.side": port.direction === "input" ? "WEST" : "EAST",
        },
      })),
      layoutOptions: {
        "elk.portConstraints": "FIXED_SIDE",
      },
    })),
    edges: graph.edges
      .filter(
        (edge) =>
          includedNodeIds.has(edge.source_node_id) &&
          includedNodeIds.has(edge.target_node_id),
      )
      .map((edge) => ({
        id: edge.id,
        sources: [elkPortId(edge.source_node_id, edge.source_port)],
        targets: [elkPortId(edge.target_node_id, edge.target_port)],
      })),
  };
}

function elkPortId(nodeId: string, portId: string) {
  return `${nodeId}__${portId}`;
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

function edgeTargetPortKey(targetNodeId: string, targetPort: string) {
  return `${targetNodeId}\u0000${targetPort}`;
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

function orderedInputPortIds(node: GraphNode) {
  return node.ports
    .filter((port) => port.direction === "input")
    .map((port) => port.id);
}

function preferredOutputPortOrder(node: GraphNode) {
  switch (node.node_type) {
    case "start":
    case "action":
    case "merge":
    case "set_variable":
    case "set_json_variables":
    case "update_variable":
    case "transform_variable":
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

function isLoopPort(node: GraphNode, portId: string) {
  return (
    ["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(node.node_type) &&
    portId === "loop"
  );
}

function isRecoveryPort(node: GraphNode, portId: string) {
  if (node.node_type === "retry") return portId === "try" || portId === "failed";
  if (node.node_type === "try_catch") {
    return portId === "try" || portId === "error" || portId === "finally";
  }
  if (node.node_type === "fallback") return portId === "fallback";
  return node.node_type === "repeat_until" && portId === "timeout";
}

function isContinuationPort(node: GraphNode, portId: string) {
  if (["if", "switch", "router", "random_choice", "try_catch", "fallback"].includes(node.node_type)) {
    return portId === "done";
  }
  if (["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(node.node_type)) {
    return portId === "done";
  }
  return node.node_type === "retry" && portId === "success";
}

function isBranchPort(node: GraphNode, portId: string) {
  if (node.node_type === "if") return portId === "true" || portId === "false";
  if (node.node_type === "switch" || node.node_type === "router") {
    return portId === "default" || portId.startsWith("case_");
  }
  if (node.node_type === "random_choice") return portId.startsWith("choice_");
  return node.node_type === "fallback" && portId === "primary";
}
