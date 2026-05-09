import type {
  Point,
  RunPlan,
  RunnerActionConfig,
  RunnerActionType,
  Viewport,
} from "../shared/product.js";

export type GraphNodeType =
  | "start"
  | "action"
  | "logic"
  | "variable"
  | "checkpoint"
  | "terminal"
  | "subworkflow";

export type GraphPorts = {
  inputs?: string[];
  outputs?: string[];
};

export type ElectronGraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  position: Point;
  config: RunnerActionConfig | Record<string, unknown> | null;
  ports: GraphPorts;
  ui?: Record<string, unknown>;
};

export type ElectronGraphEdge = {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

export type ElectronWorkflowGraph = {
  schemaVersion: 1;
  nodes: ElectronGraphNode[];
  edges: ElectronGraphEdge[];
  viewport: Viewport;
  metadata: Record<string, unknown>;
};

export type GraphValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  field?: string;
};

const executableActionTypes = new Set<RunnerActionType>([
  "navigate",
  "click",
  "fill",
  "wait",
  "take_screenshot",
  "extract_text",
]);

export function createDraftGraph(seed: string): ElectronWorkflowGraph {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: `${seed}-start`,
        type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: { outputs: ["out"] },
      },
      {
        id: `${seed}-draft`,
        type: "action",
        label: "New node",
        position: { x: 240, y: 0 },
        config: null,
        ports: { inputs: ["in"], outputs: ["out"] },
      },
    ],
    edges: [
      {
        id: `${seed}-edge-start-draft`,
        sourceNodeId: `${seed}-start`,
        sourcePort: "out",
        targetNodeId: `${seed}-draft`,
        targetPort: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {},
  };
}

export function validateGraph(graph: ElectronWorkflowGraph): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const startNodes = graph.nodes.filter((node) => node.type === "start");

  if (graph.schemaVersion !== 1) {
    issues.push({
      level: "error",
      code: "unsupported_schema_version",
      message: `Unsupported graph schema version ${String(graph.schemaVersion)}`,
    });
  }

  if (startNodes.length !== 1) {
    issues.push({
      level: "error",
      code: "invalid_start_count",
      message: "Graph must contain exactly one start node.",
    });
  }

  for (const node of graph.nodes) {
    if (node.type === "action") {
      if (!node.config) {
        issues.push({
          level: "error",
          code: "missing_action_config",
          nodeId: node.id,
          field: "config",
          message: "Action node must be configured before the graph can run.",
        });
        continue;
      }

      const type = String((node.config as { type?: unknown }).type ?? "");
      if (!executableActionTypes.has(type as RunnerActionType)) {
        issues.push({
          level: "error",
          code: "unsupported_action_type",
          nodeId: node.id,
          field: "config.type",
          message: `Unsupported action type '${type}'.`,
        });
      }
    }
  }

  const outputPorts = new Map<string, string>();
  const inputPorts = new Map<string, string>();

  for (const edge of graph.edges) {
    const source = nodesById.get(edge.sourceNodeId);
    const target = nodesById.get(edge.targetNodeId);

    if (!source) {
      issues.push({
        level: "error",
        code: "missing_source_node",
        edgeId: edge.id,
        message: "Edge source node is missing.",
      });
      continue;
    }

    if (!target) {
      issues.push({
        level: "error",
        code: "missing_target_node",
        edgeId: edge.id,
        message: "Edge target node is missing.",
      });
      continue;
    }

    if (!source.ports.outputs?.includes(edge.sourcePort)) {
      issues.push({
        level: "error",
        code: "missing_source_port",
        edgeId: edge.id,
        message: "Edge source port is not defined on the source node.",
      });
    }

    if (!target.ports.inputs?.includes(edge.targetPort)) {
      issues.push({
        level: "error",
        code: "missing_target_port",
        edgeId: edge.id,
        message: "Edge target port is not defined on the target node.",
      });
    }

    const outputKey = `${edge.sourceNodeId}:${edge.sourcePort}`;
    const existingOutputEdge = outputPorts.get(outputKey);
    if (existingOutputEdge) {
      issues.push({
        level: "error",
        code: "duplicate_output_port",
        edgeId: edge.id,
        message: "Only one outgoing edge is allowed from each output port.",
      });
    } else {
      outputPorts.set(outputKey, edge.id);
    }

    const inputKey = `${edge.targetNodeId}:${edge.targetPort}`;
    const existingInputEdge = inputPorts.get(inputKey);
    if (existingInputEdge) {
      issues.push({
        level: "error",
        code: "duplicate_input_port",
        edgeId: edge.id,
        message: "Only one incoming edge is allowed for each input port.",
      });
    } else {
      inputPorts.set(inputKey, edge.id);
    }
  }

  if (!graph.nodes.some((node) => node.type === "action" && node.config)) {
    issues.push({
      level: "error",
      code: "no_executable_actions",
      message: "Graph must contain at least one configured executable action.",
    });
  }

  return issues;
}

export function compileGraphToRunPlan(input: {
  workflowId: string;
  graphVersionId: string;
  graph: ElectronWorkflowGraph;
}): RunPlan {
  const issues = validateGraph(input.graph).filter((issue) => issue.level === "error");
  if (issues.length > 0) {
    throw new Error(`Cannot compile invalid graph: ${issues[0]?.message ?? "validation failed"}`);
  }

  const nodesById = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const start = input.graph.nodes.find((node) => node.type === "start");
  if (!start) {
    throw new Error("Cannot compile graph without a start node.");
  }

  const steps: RunPlan["steps"] = [];
  const nodeMap: Record<string, string> = {};
  const visited = new Set<string>();
  let current = start;

  while (current) {
    if (visited.has(current.id)) {
      throw new Error(`Cycle detected at node '${current.id}'.`);
    }
    visited.add(current.id);

    if (current.type === "action" && current.config) {
      const actionConfig = current.config as RunnerActionConfig;
      const stepId = `step_${steps.length + 1}_${current.id}`;
      steps.push({
        id: stepId,
        sourceNodeId: current.id,
        actionType: actionConfig.type,
        label: current.label,
        config: actionConfig,
        timeoutMs: "timeoutMs" in actionConfig ? (actionConfig.timeoutMs ?? null) : null,
        retry: null,
        evidenceTags: [],
      });
      nodeMap[current.id] = stepId;
    }

    const nextEdge = input.graph.edges.find(
      (edge) => edge.sourceNodeId === current.id && edge.sourcePort === "out",
    );
    if (!nextEdge) break;

    const nextNode = nodesById.get(nextEdge.targetNodeId);
    if (!nextNode) break;
    current = nextNode;
  }

  if (steps.length === 0) {
    throw new Error("Compiled graph has no executable steps.");
  }

  return {
    schemaVersion: 1,
    workflowId: input.workflowId,
    graphVersionId: input.graphVersionId,
    steps,
    nodeMap,
  };
}
