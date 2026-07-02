import type {
  ActionConfig,
  ActionType,
  GraphEdge,
  GraphEdgeDelay,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphPortShape,
  GraphPosition,
  GraphViewport,
  GraphValidationIssue,
  WorkflowGraph,
  WorkflowStep,
} from "../../../types/workflow";
export { defaultActionConfig } from "./workflowActionDefaults";
import type { Edge, Node, Viewport } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { actionLabels } from "../../../lib/workflowUi";
import {
  classifyWorkflowGraphEdgeFromSource,
  type WorkflowGraphEdgeKind,
} from "./graphLayout";
import { objectConfig } from "./configUtils";
import { graphNodeHeightForPorts, graphNodeWidth } from "./graphNodeDimensions";
import { displayPositionsForGraphNodes } from "./workflowGraphPositions";

const graphIssueKey = "__graph__";

export type WorkflowFlowNodeStatus = "idle" | "running" | "completed" | "failed";

export type WorkflowFlowNodeData = {
  label: string;
  kindLabel: string;
  metaLabel: string | null;
  nodeType: GraphNodeType;
  ports: GraphPort[];
  status: WorkflowFlowNodeStatus;
  hasIssue: boolean;
};

export type WorkflowFlowEdgeData = {
  hasIssue: boolean;
  status: WorkflowFlowEdgeStatus;
  kind: WorkflowGraphEdgeKind;
  delay?: GraphEdgeDelay | null;
  delayLabel?: string | null;
};

export type WorkflowFlowNode = Node<WorkflowFlowNodeData, "workflow">;
export type WorkflowFlowEdge = Edge<WorkflowFlowEdgeData>;
export type WorkflowFlowEdgeStatus =
  | "idle"
  | "selected"
  | "running"
  | "completed"
  | "failed"
  | "issue";

const graphEdgeStroke = "#3e5668";
const graphSelectedEdgeStroke = "#32d3e6";
const graphRunningEdgeStroke = "#32d3e6";
const graphCompletedEdgeStroke = "#39d98a";
const graphIssueEdgeStroke = "#f4b740";
const graphFailedEdgeStroke = "#f06467";

type ReactFlowGraphState = {
  selectedNodeId?: string | null;
  selectedNodeIds?: Set<string>;
  runningNodeId?: string | null;
  completedNodeIds?: Set<string>;
  failedNodeId?: string | null;
  issueNodeIds?: Set<string>;
  issueEdgeIds?: Set<string>;
  selectedEdgeId?: string | null;
  selectedEdgeIds?: Set<string>;
};

type WorkflowReactFlowGraph = {
  nodes: WorkflowFlowNode[];
  edges: WorkflowFlowEdge[];
  viewport: Viewport;
};

export function linearGraphFromSteps(steps: WorkflowStep[]): WorkflowGraph {
  const startNode: GraphNode = {
    id: "start",
    node_type: "start",
    label: "Start",
    position: { x: 0, y: 0 },
    config: {},
    ports: nodePorts("start"),
    group_id: null,
  };

  if (steps.length === 0) {
    const newNode: GraphNode = {
      id: "new-node",
      node_type: "action",
      label: "New node",
      position: { x: 220, y: 0 },
      config: null,
      ports: nodePorts("action"),
      group_id: null,
    };

    return {
      version: 2,
      nodes: [startNode, newNode],
      edges: [
        {
          id: "edge-start-new-node",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "new-node",
          target_port: "in",
          label: "next",
          condition: null,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }

  const nodes: GraphNode[] = [
    startNode,
    {
      id: steps[0].id,
      node_type: "action" as const,
      label: steps[0].name,
      position: { x: 220, y: 0 },
      config: steps[0].config,
      ports: nodePorts("action"),
      group_id: null,
    },
    ...steps.slice(1).map((step, index) => ({
      id: step.id,
      node_type: "action" as const,
      label: step.name,
      position: { x: (index + 2) * 220, y: 0 },
      config: step.config,
      ports: nodePorts("action"),
      group_id: null,
    })),
    {
      id: "end_success",
      node_type: "end_success",
      label: "End Success",
      position: { x: (steps.length + 1) * 220, y: 0 },
      config: {},
      ports: nodePorts("end_success"),
      group_id: null,
    },
  ];

  const sequence = nodes.map((node) => node.id);
  const edges = sequence.slice(0, -1).map((sourceNodeId, index) => ({
    id: `edge-${sourceNodeId}-${sequence[index + 1]}`,
    source_node_id: sourceNodeId,
    source_port: "out",
    target_node_id: sequence[index + 1],
    target_port: "in",
    label: "next",
    condition: null,
  }));

  return {
    version: 2,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function toReactFlowGraph(
  graph: WorkflowGraph,
  state: ReactFlowGraphState = {},
): WorkflowReactFlowGraph {
  const edgeOrders = graphEdgeOrders(graph);
  const nodeLabels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodePositions = displayPositionsForGraphNodes(graph.nodes, graph.edges);

  const baseFlowGraph: WorkflowReactFlowGraph = {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: "workflow",
      position: nodePositions.get(node.id) ?? node.position,
      initialHeight: graphNodeHeightForPorts(node.ports),
      initialWidth: graphNodeWidth,
      selected: false,
      data: {
        label: node.label,
        kindLabel: graphCanvasNodeKindLabel(node),
        metaLabel: graphCanvasNodeMetaLabel(node),
        nodeType: node.node_type,
        ports: node.ports,
        status: "idle",
        hasIssue: false,
      },
    })),
    edges: graph.edges.map((edge) => {
      const status = "idle";
      const stroke = graphEdgeStrokeForStatus(status);
      const kind = classifyWorkflowGraphEdgeFromSource(nodeById.get(edge.source_node_id), edge);

      return {
        id: edge.id,
        type: "workflow",
        source: edge.source_node_id,
        sourceHandle: edge.source_port,
        target: edge.target_node_id,
        targetHandle: edge.target_port,
        label: edgeOrders.get(edge.id)
          ? String(edgeOrders.get(edge.id))
          : edge.label ?? edge.source_port,
        selected: false,
        ariaLabel: edgeOrders.get(edge.id)
          ? `Step ${edgeOrders.get(edge.id)}: ${
              nodeLabels.get(edge.source_node_id) ?? edge.source_node_id
            } to ${nodeLabels.get(edge.target_node_id) ?? edge.target_node_id} via ${
              edge.label ?? edge.source_port
            }`
          : `${nodeLabels.get(edge.source_node_id) ?? edge.source_node_id} to ${
              nodeLabels.get(edge.target_node_id) ?? edge.target_node_id
            } via ${edge.label ?? edge.source_port}`,
        className: ["graph-edge", `graph-edge-${kind}`].join(" "),
        interactionWidth: 20,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
        },
        style: {
          stroke,
          strokeWidth: 2.5,
        },
        data: {
          hasIssue: false,
          status,
          kind,
          delay: edge.delay ?? null,
          delayLabel: graphEdgeDelayLabel(edge.delay ?? null),
        },
      };
    }),
    viewport: graph.viewport,
  };

  return isIdleReactFlowGraphState(state)
    ? baseFlowGraph
    : applyReactFlowGraphState(baseFlowGraph, state);
}

export function applyReactFlowGraphState(
  flowGraph: WorkflowReactFlowGraph,
  state: ReactFlowGraphState = {},
): WorkflowReactFlowGraph {
  let changed = false;
  const nodes = flowGraph.nodes.map((node) => {
    const selected =
      state.selectedNodeIds?.has(node.id) ?? state.selectedNodeId === node.id;
    const status = graphNodeStatus(node.id, state);
    const hasIssue = state.issueNodeIds?.has(node.id) ?? false;
    if (
      node.selected === selected &&
      node.data.status === status &&
      node.data.hasIssue === hasIssue
    ) {
      return node;
    }
    changed = true;
    return {
      ...node,
      selected,
      data: {
        ...node.data,
        status,
        hasIssue,
      },
    };
  });
  const edges = flowGraph.edges.map((edge) => {
    const nextEdge = applyReactFlowEdgeState(edge, state);
    if (nextEdge !== edge) changed = true;
    return nextEdge;
  });

  if (!changed) return flowGraph;
  return {
    ...flowGraph,
    nodes,
    edges,
  };
}


function applyReactFlowEdgeState(
  edge: WorkflowFlowEdge,
  state: ReactFlowGraphState,
): WorkflowFlowEdge {
  const hasIssue = state.issueEdgeIds?.has(edge.id) ?? false;
  const isSelected =
    state.selectedEdgeIds?.has(edge.id) ?? state.selectedEdgeId === edge.id;
  const status = graphEdgeStatusForTarget(
    edge.target,
    state,
    hasIssue,
    isSelected,
  );
  const stroke = graphEdgeStrokeForStatus(status);
  const strokeWidth = isSelected ? 3.5 : hasIssue ? 2.75 : 2.5;
  const kind = edge.data?.kind ?? "main";
  const className = [
    "graph-edge",
    `graph-edge-${kind}`,
    hasIssue ? "graph-edge-has-issue" : "",
    status === "failed" ? "graph-edge-failed" : "",
    status === "running" ? "graph-edge-running" : "",
    status === "completed" ? "graph-edge-completed" : "",
    isSelected ? "graph-edge-selected" : "",
  ].filter(Boolean).join(" ");

  if (
    edge.selected === isSelected &&
    edge.className === className &&
    reactFlowEdgeMarkerColor(edge) === stroke &&
    edge.style?.stroke === stroke &&
    edge.style?.strokeWidth === strokeWidth &&
    edge.data?.hasIssue === hasIssue &&
    edge.data?.status === status
  ) {
    return edge;
  }

  return {
    ...edge,
    selected: isSelected,
    className,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: stroke,
    },
    style: {
      stroke,
      strokeWidth,
    },
    data: {
      ...edge.data,
      kind,
      hasIssue,
      status,
    },
  };
}

function isIdleReactFlowGraphState(state: ReactFlowGraphState) {
  return (
    !state.selectedNodeId &&
    !state.selectedEdgeId &&
    !state.runningNodeId &&
    !state.failedNodeId &&
    !state.selectedNodeIds?.size &&
    !state.selectedEdgeIds?.size &&
    !state.completedNodeIds?.size &&
    !state.issueNodeIds?.size &&
    !state.issueEdgeIds?.size
  );
}

function graphEdgeOrders(graph: WorkflowGraph) {
  const orders = new Map<string, number>();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesBySourcePort = new Map<string, typeof graph.edges>();
  const visitedNodeIds = new Set<string>();
  graph.edges.forEach((edge) => {
    const key = edgeSourcePortKey(edge.source_node_id, edge.source_port);
    const edgesForPort = edgesBySourcePort.get(key);
    if (edgesForPort) {
      edgesForPort.push(edge);
    } else {
      edgesBySourcePort.set(key, [edge]);
    }
  });

  for (const edges of edgesBySourcePort.values()) {
    edges.sort((left, right) => left.id.localeCompare(right.id));
  }

  let order = 1;
  const start = graph.nodes.find((node) => node.node_type === "start");
  if (!start) return orders;

  const stack = [start.id];
  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId || visitedNodeIds.has(nodeId)) continue;
    const node = nodeById.get(nodeId);
    if (!node) continue;
    visitedNodeIds.add(nodeId);

    const nextNodeIds: string[] = [];
    for (const portId of orderedOutputPortIds(node)) {
      const edge = edgesBySourcePort.get(edgeSourcePortKey(node.id, portId))?.[0];
      if (!edge) continue;
      if (!orders.has(edge.id)) {
        orders.set(edge.id, order);
        order += 1;
      }
      if (!visitedNodeIds.has(edge.target_node_id)) {
        nextNodeIds.push(edge.target_node_id);
      }
    }
    for (let index = nextNodeIds.length - 1; index >= 0; index -= 1) {
      const nextNodeId = nextNodeIds[index];
      if (nextNodeId) stack.push(nextNodeId);
    }
  }

  return orders;
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
    case "check_conditions":
    case "calculate_value":
    case "update_number_variable":
    case "update_text_variable":
    case "update_flag_variable":
    case "update_list_variable":
    case "update_object_variable":
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

export function mergeReactFlowNodeRuntimeState(
  nextNodes: WorkflowFlowNode[],
  previousNodes: WorkflowFlowNode[],
): WorkflowFlowNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    const previousNode = previousById.get(node.id);
    if (!previousNode) return node;
    const canPreserveMeasuredDimensions =
      node.initialHeight === previousNode.initialHeight &&
      node.initialWidth === previousNode.initialWidth;
    const dragging = previousNode.dragging ?? node.dragging;
    const height = canPreserveMeasuredDimensions
      ? node.height ?? previousNode.height
      : node.height;
    const measured = canPreserveMeasuredDimensions
      ? node.measured ?? previousNode.measured
      : node.measured;
    const resizing = previousNode.resizing ?? node.resizing;
    const width = canPreserveMeasuredDimensions
      ? node.width ?? previousNode.width
      : node.width;
    const nextNode = {
      ...node,
      ...(dragging !== undefined ? { dragging } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(measured !== undefined ? { measured } : {}),
      ...(resizing !== undefined ? { resizing } : {}),
      ...(width !== undefined ? { width } : {}),
    };

    return workflowFlowNodesEqual(previousNode, nextNode) ? previousNode : nextNode;
  });
}

function workflowFlowNodesEqual(
  left: WorkflowFlowNode,
  right: WorkflowFlowNode,
) {
  return (
    left.id === right.id &&
    left.type === right.type &&
    left.position === right.position &&
    left.initialHeight === right.initialHeight &&
    left.initialWidth === right.initialWidth &&
    left.selected === right.selected &&
    workflowFlowNodeDataEqual(left.data, right.data) &&
    left.dragging === right.dragging &&
    left.height === right.height &&
    left.measured === right.measured &&
    left.resizing === right.resizing &&
    left.width === right.width
  );
}

function workflowFlowNodeDataEqual(
  left: WorkflowFlowNode["data"],
  right: WorkflowFlowNode["data"],
) {
  return (
    left.label === right.label &&
    left.kindLabel === right.kindLabel &&
    left.metaLabel === right.metaLabel &&
    left.nodeType === right.nodeType &&
    left.ports === right.ports &&
    left.status === right.status &&
    left.hasIssue === right.hasIssue
  );
}

export function fromReactFlowGraph(
  graph: WorkflowGraph,
  nodes: Array<Node>,
  edges: Array<Edge>,
  viewport: Viewport | GraphViewport,
): WorkflowGraph {
  const nodePositions = new Map(nodes.map((node) => [node.id, node.position]));
  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const graphEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = nodePositions.get(node.id) ?? node.position;
      if (position.x === node.position.x && position.y === node.position.y) return node;
      return {
        ...node,
        position,
      };
    }),
    edges: edges.map((edge) => {
      const existingEdge = graphEdges.get(edge.id);
      const nextEdge: GraphEdge = {
        id: edge.id,
        source_node_id: edge.source,
        source_port: edge.sourceHandle ?? "out",
        target_node_id: edge.target,
        target_port: edge.targetHandle ?? "in",
        label:
          existingEdge?.label ??
          (typeof edge.label === "string"
            ? cleanEdgeLabel(edge.label)
            : edge.sourceHandle ?? null),
        condition: existingEdge?.condition ?? null,
        delay: existingEdge?.delay ?? graphEdgeDelayFromData(edge.data?.delay),
      };
      return graphEdgesEqual(existingEdge, nextEdge) ? existingEdge : nextEdge;
    }).filter(
      (edge): edge is GraphEdge =>
        graphNodes.has(edge.source_node_id) &&
        graphNodes.has(edge.target_node_id),
    ),
    viewport: {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    },
  };
}

function reactFlowEdgeMarkerColor(edge: WorkflowFlowEdge) {
  const markerEnd = edge.markerEnd;
  if (!markerEnd || typeof markerEnd !== "object") return undefined;
  return markerEnd.color;
}

function graphEdgesEqual(
  left: GraphEdge | undefined,
  right: GraphEdge,
): left is GraphEdge {
  if (!left) return false;
  return (
    left.id === right.id &&
    left.source_node_id === right.source_node_id &&
    left.source_port === right.source_port &&
    left.target_node_id === right.target_node_id &&
    left.target_port === right.target_port &&
    (left.label ?? null) === (right.label ?? null) &&
    (left.condition ?? null) === (right.condition ?? null) &&
    (left.delay ?? null) === (right.delay ?? null)
  );
}

function graphEdgeDelayLabel(delay: GraphEdgeDelay | null) {
  if (!delay) return null;
  if (delay.type === "fixed") return `${delay.duration_ms}ms`;
  return `${delay.min_ms}-${delay.max_ms}ms`;
}

function graphEdgeDelayFromData(value: unknown): GraphEdgeDelay | null {
  if (!value || typeof value !== "object") return null;
  const delay = value as Partial<GraphEdgeDelay>;
  if (
    delay.type === "fixed" &&
    typeof delay.duration_ms === "number"
  ) {
    return { type: "fixed", duration_ms: delay.duration_ms };
  }
  if (
    delay.type === "random" &&
    typeof delay.min_ms === "number" &&
    typeof delay.max_ms === "number"
  ) {
    return { type: "random", min_ms: delay.min_ms, max_ms: delay.max_ms };
  }
  return null;
}

function cleanEdgeLabel(label: string) {
  return label.replace(/^\d+\.\s+/, "");
}

export function createDefaultGraphNode(
  nodeType: GraphNodeType,
  position: GraphPosition,
): GraphNode {
  return {
    id: `node-${nodeType}-${Date.now()}`,
    node_type: nodeType,
    label: graphNodeLabel(nodeType),
    position,
    config: defaultGraphNodeConfig(nodeType),
    ports: nodePorts(nodeType),
    group_id: null,
  };
}

export function nodePorts(nodeType: GraphNodeType): GraphPort[] {
  switch (nodeType) {
    case "start":
      return [outputPort("out", "Out", "circle")];
    case "end_success":
    case "end_failure":
      return [inputPort("in", "In", "circle")];
    case "merge":
      return [inputPort("in", "In", "circle"), outputPort("out", "Out", "circle")];
    case "call_subflow":
      return [inputPort("in", "In", "circle"), outputPort("out", "Out", "circle")];
    case "router":
      return [
        inputPort("in", "In", "circle"),
        outputPort("case_1", "Case 1", "diamond"),
        outputPort("default", "Default", "diamond"),
        outputPort("done", "Done", "square"),
      ];
    case "random_choice":
      return [
        inputPort("in", "In", "circle"),
        outputPort("choice_1", "Choice 1", "diamond"),
        outputPort("choice_2", "Choice 2", "diamond"),
        outputPort("done", "Done", "square"),
      ];
    case "if":
      return [
        inputPort("in", "In", "circle"),
        outputPort("true", "True", "diamond"),
        outputPort("false", "False", "diamond"),
        outputPort("done", "Done", "square"),
      ];
    case "switch":
      return [
        inputPort("in", "In", "circle"),
        outputPort("case_1", "Case 1", "diamond"),
        outputPort("default", "Default", "diamond"),
        outputPort("done", "Done", "square"),
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [
        inputPort("in", "In", "circle"),
        outputPort("loop", "Loop", "circle"),
        outputPort("done", "Done", "square"),
      ];
    case "repeat_until":
      return [
        inputPort("in", "In", "circle"),
        outputPort("loop", "Loop", "circle"),
        outputPort("done", "Done", "square"),
        outputPort("timeout", "Timeout", "triangle"),
      ];
    case "try_catch":
      return [
        inputPort("in", "In", "circle"),
        outputPort("try", "Try", "hexagon"),
        outputPort("success", "Success", "square"),
        outputPort("error", "Error", "triangle"),
        outputPort("finally", "Finally", "square"),
        outputPort("done", "Done", "square"),
      ];
    case "retry":
      return [
        inputPort("in", "In", "circle"),
        outputPort("try", "Try", "hexagon"),
        outputPort("success", "Success", "square"),
        outputPort("failed", "Failed", "triangle"),
      ];
    case "fallback":
      return [
        inputPort("in", "In", "circle"),
        outputPort("primary", "Primary", "circle"),
        outputPort("fallback", "Fallback", "triangle"),
        outputPort("done", "Done", "square"),
      ];
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
      return [inputPort("in", "In", "circle")];
    default:
      return [inputPort("in", "In", "circle"), outputPort("out", "Out", "circle")];
  }
}

export function graphIssuesByNode(issues: GraphValidationIssue[]) {
  return issues.reduce((grouped, issue) => {
    const key = issue.node_id ?? graphIssueKey;
    grouped.set(key, [...(grouped.get(key) ?? []), issue]);
    return grouped;
  }, new Map<string, GraphValidationIssue[]>());
}

function graphNodeStatus(
  nodeId: string,
  state: ReactFlowGraphState,
): WorkflowFlowNodeStatus {
  if (state.failedNodeId === nodeId) return "failed";
  if (state.runningNodeId === nodeId) return "running";
  if (state.completedNodeIds?.has(nodeId)) return "completed";
  return "idle";
}

function graphEdgeStatusForTarget(
  targetNodeId: string,
  state: ReactFlowGraphState,
  hasIssue: boolean,
  isSelected: boolean,
): WorkflowFlowEdgeStatus {
  if (state.failedNodeId && targetNodeId === state.failedNodeId) {
    return "failed";
  }
  if (hasIssue) return "issue";
  if (state.runningNodeId && targetNodeId === state.runningNodeId) {
    return "running";
  }
  if (isSelected) return "selected";
  if (state.completedNodeIds?.has(targetNodeId)) return "completed";
  return "idle";
}

function graphEdgeStrokeForStatus(status: WorkflowFlowEdgeStatus) {
  switch (status) {
    case "failed":
      return graphFailedEdgeStroke;
    case "issue":
      return graphIssueEdgeStroke;
    case "running":
      return graphRunningEdgeStroke;
    case "selected":
      return graphSelectedEdgeStroke;
    case "completed":
      return graphCompletedEdgeStroke;
    default:
      return graphEdgeStroke;
  }
}

export function graphNodeLabel(nodeType: GraphNodeType) {
  if (nodeType === "set_variable") return "Set Variables";
  if (nodeType === "set_json_variables") return "Set JSON Variables";
  if (nodeType === "random_choice") return "Random Choice";
  if (nodeType === "call_subflow") return "Call Subflow";
  if (nodeType === "check_conditions") return "Check Conditions";
  if (nodeType === "calculate_value") return "Calculate Value";
  if (nodeType === "update_flag_variable") return "Update Flag Variable (Yes/No)";
  if (nodeType === "update_object_variable") return "Update Object Variable (JSON)";
  if (nodeType === "get_current_url") return "Get Current URL";

  return nodeType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function graphCanvasNodeKindLabel(node: GraphNode) {
  if (node.node_type !== "action") return graphNodeLabel(node.node_type);

  const actionConfig = actionConfigOrNull(node.config);
  return actionConfig ? actionLabels[actionConfig.type as ActionType] ?? actionConfig.type : graphNodeLabel(node.node_type);
}

export function callSubflowIdFromNode(node: GraphNode | null | undefined) {
  if (!node || node.node_type !== "call_subflow") return null;
  const config = objectConfig(node.config);
  return typeof config.subflow_id === "string" && config.subflow_id.trim()
    ? config.subflow_id.trim()
    : null;
}

function graphCanvasNodeMetaLabel(node: GraphNode) {
  if (node.node_type === "action") {
    return actionMetaLabel(actionConfigOrNull(node.config));
  }

  const config = objectConfig(node.config);
  switch (node.node_type) {
    case "if":
    case "while":
    case "repeat_until":
      return conditionMetaLabel(config.condition);
    case "check_conditions":
    case "calculate_value":
      return typeof config.output_name === "string" && config.output_name.trim()
        ? `-> ${config.output_name.trim()}`
        : null;
    case "repeat_times":
      return typeof config.times === "number" ? `${config.times}x` : null;
    case "repeat_for_each":
      return typeof config.array_variable === "string" && config.array_variable.trim()
        ? `{{${config.array_variable.trim()}}}`
        : null;
    case "router":
      return Array.isArray(config.cases) ? `${config.cases.length} cases` : null;
    case "random_choice":
      return Array.isArray(config.choices) ? `${config.choices.length} choices` : null;
    case "set_variable":
      return Array.isArray(config.variables) ? `${config.variables.length} vars` : null;
    case "call_subflow":
      return typeof config.subflow_id === "string" && config.subflow_id.trim()
        ? compactText(config.subflow_id.trim(), 28)
        : "No subflow";
    default:
      return null;
  }
}

function actionMetaLabel(action: ActionConfig | null) {
  if (!action) return null;
  const config = objectConfig(action.config);

  switch (action.type) {
    case "wait":
      return typeof config.duration_ms === "number"
        ? compactDurationLabel(config.duration_ms)
        : null;
    case "random_wait":
      return typeof config.min_ms === "number" && typeof config.max_ms === "number"
        ? `${compactDurationLabel(config.min_ms)}-${compactDurationLabel(config.max_ms)}`
        : null;
    case "navigate":
    case "open_new_tab":
      return typeof config.url === "string" && config.url.trim()
        ? compactText(config.url.trim(), 36)
        : null;
    case "press_key":
      return typeof config.key === "string" && config.key.trim()
        ? compactText(config.key.trim(), 24)
        : null;
    case "hotkey":
      return Array.isArray(config.keys)
        ? compactText(config.keys.filter((key) => typeof key === "string").join("+"), 28)
        : null;
    default:
      return targetMetaLabel(config.target);
  }
}

function actionConfigOrNull(config: unknown): ActionConfig | null {
  if (!isRecord(config)) return null;
  if (typeof config.type !== "string") return null;
  if (!(config.type in actionLabels)) return null;
  return config as ActionConfig & { type: ActionType };
}

function conditionMetaLabel(condition: unknown) {
  if (!isRecord(condition)) return null;
  const name = typeof condition.name === "string" ? condition.name.trim() : "";
  const value = typeof condition.value === "string" ? condition.value.trim() : "";
  if (!value) return null;

  return compactText(`${name || "output"} = ${value}`, 34);
}

function targetMetaLabel(target: unknown) {
  if (!isRecord(target) || !Array.isArray(target.locators)) return null;
  const locator = target.locators.find(isRecord);
  if (!locator) return null;

  const value = typeof locator.value === "string" ? locator.value.trim() : "";
  if (value) return compactText(value, 36);
  const role = typeof locator.role === "string" ? locator.role.trim() : "";
  return role ? compactText(role, 36) : null;
}

function compactDurationLabel(durationMs: number) {
  if (durationMs >= 1000) {
    return `${Number((durationMs / 1000).toFixed(1))}s`;
  }

  return `${durationMs}ms`;
}

function compactText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function defaultGraphNodeConfig(nodeType: GraphNodeType): unknown {
  switch (nodeType) {
    case "action":
      return null;
    case "if":
      return { condition: { kind: "variable_is_true", name: "name" } };
    case "repeat_until":
    case "while":
      return {
        condition: { kind: "variable_is_true", name: "name" },
        max_attempts: 10,
        timeout_ms: null,
      };
    case "switch":
      return { expression: "", cases: ["case"] };
    case "router":
      return {
        mode: "first_match",
        cases: [
          {
            id: "1",
            label: "Case 1",
            condition: { kind: "variable_is_true", name: "name" },
          },
        ],
        default_label: "Default",
      };
    case "random_choice":
      return {
        choices: [
          { id: "1", label: "Choice 1", weight: 1 },
          { id: "2", label: "Choice 2", weight: 1 },
        ],
        output_name: "random_choice",
      };
    case "repeat_times":
      return { times: 1 };
    case "repeat_for_each":
      return { item_name: "item", array_variable: null, items: ["item"] };
    case "retry":
      return { max_attempts: 3, delay_ms: 100 };
    case "end_success":
      return { close_browser: false };
    case "end_failure":
      return { reason: "Graph reached failure end", close_browser: false };
    case "stop_workflow":
      return { status: "success", reason: "", close_browser: false };
    case "set_variable":
      return { variables: [{ name: "name", value_type: "text", value: "" }] };
    case "set_json_variables":
      return { json: "{\n  \"name\": \"value\"\n}" };
    case "update_number_variable":
      return { name: "", operation: "increment", value: "" };
    case "update_text_variable":
      return { name: "", operation: "append", value: "", search_pattern: "" };
    case "update_flag_variable":
      return { name: "", operation: "toggle" };
    case "update_list_variable":
      return { name: "", operation: "push", value: "", value_type: "text", index: null };
    case "update_object_variable":
      return { name: "", operation: "merge", value: "{\n  \"key\": \"value\"\n}", property_key: "", property_value: "", property_value_type: "text" };
    case "transform_variable":
      return { source_name: "input", target_name: "output", expression: "" };
    case "assert_output":
      return { name: "output", match: "equals", value: "" };
    case "domain_allowlist":
      return { domains: [] };
    case "get_current_url":
      return {};
    case "call_subflow":
      return { subflow_id: "", input_mapping: [], output_prefix: null };
    default:
      return {};
  }
}

function inputPort(id: string, label: string, shape?: GraphPortShape): GraphPort {
  return { id, label, direction: "input", shape };
}

function outputPort(id: string, label: string, shape?: GraphPortShape): GraphPort {
  return { id, label, direction: "output", shape };
}

export function portShape(portId: string): GraphPortShape {
  if (portId === "true" || portId === "false") return "diamond";
  if (portId === "done" || portId === "success" || portId === "finally") return "square";
  if (portId === "error" || portId === "failed" || portId === "timeout") return "triangle";
  if (portId === "try") return "hexagon";
  if (portId.startsWith("case_") || portId.startsWith("choice_") || portId === "default") return "diamond";
  return "circle";
}
