import type {
  GraphEdgeDelay,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphPosition,
  GraphViewport,
  GraphValidationIssue,
  WorkflowGraph,
  WorkflowStep,
} from "../../../types/workflow";
export { defaultActionConfig } from "./workflowActionDefaults";
import type { Edge, Node, Viewport } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

const graphIssueKey = "__graph__";

export type WorkflowFlowNodeStatus = "idle" | "running" | "completed" | "failed";

export type WorkflowFlowNodeData = {
  label: string;
  nodeType: GraphNodeType;
  ports: GraphPort[];
  status: WorkflowFlowNodeStatus;
  hasIssue: boolean;
};

export type WorkflowFlowEdgeData = {
  hasIssue: boolean;
  status: WorkflowFlowEdgeStatus;
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

  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: "workflow",
      position: node.position,
      initialHeight: 64,
      initialWidth: 160,
      selected: state.selectedNodeIds?.has(node.id) ?? state.selectedNodeId === node.id,
      data: {
        label: node.label,
        nodeType: node.node_type,
        ports: node.ports,
        status: graphNodeStatus(node.id, state),
        hasIssue: state.issueNodeIds?.has(node.id) ?? false,
      },
    })),
    edges: graph.edges.map((edge) => {
      const hasIssue = state.issueEdgeIds?.has(edge.id) ?? false;
      const isSelected =
        state.selectedEdgeIds?.has(edge.id) ?? state.selectedEdgeId === edge.id;
      const status = graphEdgeStatus(edge, state, hasIssue, isSelected);
      const stroke = graphEdgeStrokeForStatus(status);

      return {
        id: edge.id,
        source: edge.source_node_id,
        sourceHandle: edge.source_port,
        target: edge.target_node_id,
        targetHandle: edge.target_port,
        label: edgeOrders.get(edge.id)
          ? String(edgeOrders.get(edge.id))
          : edge.label ?? edge.source_port,
        selected: isSelected,
        ariaLabel: edgeOrders.get(edge.id)
          ? `Step ${edgeOrders.get(edge.id)}: ${
              nodeLabels.get(edge.source_node_id) ?? edge.source_node_id
            } to ${nodeLabels.get(edge.target_node_id) ?? edge.target_node_id} via ${
              edge.label ?? edge.source_port
            }`
          : `${nodeLabels.get(edge.source_node_id) ?? edge.source_node_id} to ${
              nodeLabels.get(edge.target_node_id) ?? edge.target_node_id
            } via ${edge.label ?? edge.source_port}`,
        className: [
          "graph-edge",
          hasIssue ? "graph-edge-has-issue" : "",
          status === "failed" ? "graph-edge-failed" : "",
          status === "running" ? "graph-edge-running" : "",
          status === "completed" ? "graph-edge-completed" : "",
          isSelected ? "graph-edge-selected" : "",
        ].filter(Boolean).join(" "),
        interactionWidth: 20,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
        },
        style: {
          stroke,
          strokeWidth: isSelected ? 3.5 : hasIssue ? 2.75 : 2.5,
        },
        data: {
          hasIssue,
          status,
          delay: edge.delay ?? null,
          delayLabel: graphEdgeDelayLabel(edge.delay ?? null),
        },
      };
    }),
    viewport: graph.viewport,
  };
}

function graphEdgeOrders(graph: WorkflowGraph) {
  const orders = new Map<string, number>();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesBySourcePort = new Map<string, typeof graph.edges>();
  const visitedNodeIds = new Set<string>();
  graph.edges.forEach((edge) => {
    const key = edgeSourcePortKey(edge.source_node_id, edge.source_port);
    edgesBySourcePort.set(key, [
      ...(edgesBySourcePort.get(key) ?? []),
      edge,
    ]);
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

export function mergeReactFlowNodeRuntimeState(
  nextNodes: WorkflowFlowNode[],
  previousNodes: WorkflowFlowNode[],
): WorkflowFlowNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    const previousNode = previousById.get(node.id);
    if (!previousNode) return node;

    return {
      ...node,
      dragging: previousNode.dragging ?? node.dragging,
      height: node.height ?? previousNode.height,
      measured: node.measured ?? previousNode.measured,
      resizing: previousNode.resizing ?? node.resizing,
      width: node.width ?? previousNode.width,
    };
  });
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
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: nodePositions.get(node.id) ?? node.position,
    })),
    edges: edges.map((edge) => {
      const existingEdge = graphEdges.get(edge.id);
      return {
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
    }).filter(
      (edge) =>
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
      return [outputPort("out", "Out")];
    case "end_success":
    case "end_failure":
      return [inputPort("in", "In")];
    case "merge":
      return [inputPort("in", "In"), outputPort("out", "Out")];
    case "router":
      return [
        inputPort("in", "In"),
        outputPort("case_1", "Case 1"),
        outputPort("default", "Default"),
        outputPort("done", "Done"),
      ];
    case "if":
      return [
        inputPort("in", "In"),
        outputPort("true", "True"),
        outputPort("false", "False"),
        outputPort("done", "Done"),
      ];
    case "switch":
      return [
        inputPort("in", "In"),
        outputPort("case_1", "Case 1"),
        outputPort("default", "Default"),
        outputPort("done", "Done"),
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [inputPort("in", "In"), outputPort("loop", "Loop"), outputPort("done", "Done")];
    case "repeat_until":
      return [
        inputPort("in", "In"),
        outputPort("loop", "Loop"),
        outputPort("done", "Done"),
        outputPort("timeout", "Timeout"),
      ];
    case "try_catch":
      return [
        inputPort("in", "In"),
        outputPort("try", "Try"),
        outputPort("success", "Success"),
        outputPort("error", "Error"),
        outputPort("finally", "Finally"),
        outputPort("done", "Done"),
      ];
    case "retry":
      return [
        inputPort("in", "In"),
        outputPort("try", "Try"),
        outputPort("success", "Success"),
        outputPort("failed", "Failed"),
      ];
    case "fallback":
      return [
        inputPort("in", "In"),
        outputPort("primary", "Primary"),
        outputPort("fallback", "Fallback"),
        outputPort("done", "Done"),
      ];
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
      return [inputPort("in", "In")];
    default:
      return [inputPort("in", "In"), outputPort("out", "Out")];
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

function graphEdgeStatus(
  edge: WorkflowGraph["edges"][number],
  state: ReactFlowGraphState,
  hasIssue: boolean,
  isSelected: boolean,
): WorkflowFlowEdgeStatus {
  if (state.failedNodeId && edge.target_node_id === state.failedNodeId) {
    return "failed";
  }
  if (hasIssue) return "issue";
  if (state.runningNodeId && edge.target_node_id === state.runningNodeId) {
    return "running";
  }
  if (isSelected) return "selected";
  if (state.completedNodeIds?.has(edge.target_node_id)) return "completed";
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

  return nodeType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultGraphNodeConfig(nodeType: GraphNodeType): unknown {
  switch (nodeType) {
    case "action":
      return null;
    case "if":
      return { condition: { kind: "output_equals", name: "name", value: "" } };
    case "repeat_until":
    case "while":
      return {
        condition: { kind: "output_equals", name: "name", value: "" },
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
            condition: { kind: "output_equals", name: "name", value: "" },
          },
        ],
        default_label: "Default",
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
    case "transform_variable":
      return { source_name: "input", target_name: "output", expression: "" };
    case "assert_output":
      return { name: "output", match: "equals", value: "" };
    case "domain_allowlist":
      return { domains: [] };
    default:
      return {};
  }
}

function inputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "input" };
}

function outputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "output" };
}
