import type {
  GraphValidationIssue,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { migrateWorkflowGraph } from "./migration.js";
import {
  reachableNodeIds,
  unsupportedCycleNodeIds,
  loopControlOutsideLoopNodeIds,
  graphHasExecutableSteps,
} from "./graphTopology.js";
import {
  hasPort,
  pushNodeSemanticIssues,
  pushBranchContinuationIssues,
} from "./validateNodeSemantics.js";

export type WorkflowGraphValidationOptions = {
  graphKind?: "workflow" | "subflow";
  projectId?: string | null;
  resolveSubflow?: (subflowId: string) => {
    id: string;
    project_id: string;
    graph: WorkflowGraph;
  } | null;
};

export function validateWorkflowGraph(
  graph: WorkflowGraph,
  options: WorkflowGraphValidationOptions = {},
): GraphValidationIssue[] {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const issues: GraphValidationIssue[] = [];
  if (normalizedGraph.version !== 1 && normalizedGraph.version !== 2 && normalizedGraph.version !== 3 && normalizedGraph.version !== 4 && normalizedGraph.version !== 5) {
    issues.push(error(null, null, "Unsupported graph version"));
  }

  const graphToValidate = normalizedGraph.version > 5 ? graph : normalizedGraph;
  const startCount = graphToValidate.nodes.filter((node) => node.node_type === "start").length;
  if (startCount !== 1) {
    issues.push(error(null, null, "Graph must contain exactly one start node"));
  }

  const nodeById = new Map(graphToValidate.nodes.map((node) => [node.id, node]));
  const seenNodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  for (const node of graphToValidate.nodes) {
    if (!node.id.trim()) {
      issues.push(error(null, null, "Graph node id is required"));
    }
    if (seenNodeIds.has(node.id)) {
      duplicateNodeIds.add(node.id);
    }
    seenNodeIds.add(node.id);
  }
  for (const nodeId of duplicateNodeIds) {
    issues.push(error(nodeId, null, "Graph node id must be unique"));
  }

  pushBranchContinuationIssues(graphToValidate, nodeById, issues);

  const seenEdgeIds = new Set<string>();
  const seenExactEdges = new Set<string>();
  const usedOutputPorts = new Set<string>();
  const usedInputPorts = new Set<string>();

  for (const edge of graphToValidate.edges) {
    if (edge.source_node_id === edge.target_node_id) {
      issues.push(error(edge.source_node_id, edge.id, "Self-links are not allowed"));
    }
    const edgeDelayMessage = validateGraphEdgeDelay(edge.delay);
    if (edgeDelayMessage) {
      issues.push(error(edge.source_node_id, edge.id, edgeDelayMessage));
    }

    const source = nodeById.get(edge.source_node_id);
    if (!source) {
      issues.push(error(null, edge.id, `Edge ${edge.id} source node does not exist`));
    } else if (!hasPort(source, edge.source_port, "output")) {
      issues.push(error(source.id, edge.id, `Edge ${edge.id} source port does not exist`));
    }

    const target = nodeById.get(edge.target_node_id);
    if (!target) {
      issues.push(error(null, edge.id, `Edge ${edge.id} target node does not exist`));
    } else if (!hasPort(target, edge.target_port, "input")) {
      issues.push(error(target.id, edge.id, `Edge ${edge.id} target port does not exist`));
    }

    if (seenEdgeIds.has(edge.id)) {
      issues.push(error(null, edge.id, `Edge id ${edge.id} must be unique`));
    }
    seenEdgeIds.add(edge.id);

    const exactEdgeKey = [
      edge.source_node_id,
      edge.source_port,
      edge.target_node_id,
      edge.target_port,
    ].join("\u0000");
    if (seenExactEdges.has(exactEdgeKey)) {
      issues.push(
        error(edge.source_node_id, edge.id, "Duplicate edge between the same source and target ports"),
      );
    }
    seenExactEdges.add(exactEdgeKey);

    const outputPortKey = `${edge.source_node_id}\u0000${edge.source_port}`;
    if (usedOutputPorts.has(outputPortKey)) {
      issues.push(error(edge.source_node_id, edge.id, "Only one edge can leave an output port"));
    }
    usedOutputPorts.add(outputPortKey);

    const inputPortKey = `${edge.target_node_id}\u0000${edge.target_port}`;
    const targetAllowsMultipleIncoming =
      target?.node_type === "merge" && edge.target_port === "in";
    if (!targetAllowsMultipleIncoming && usedInputPorts.has(inputPortKey)) {
      issues.push(error(edge.target_node_id, edge.id, "Only one edge can enter an input port"));
    }
    usedInputPorts.add(inputPortKey);
  }

  for (const node of graphToValidate.nodes) {
    pushNodeSemanticIssues(graphToValidate, node, issues, options);
  }

  if (startCount === 1) {
    const reachable = reachableNodeIds(graphToValidate);
    for (const node of graphToValidate.nodes) {
      if (node.node_type !== "start" && !reachable.has(node.id)) {
        issues.push(error(node.id, null, `Node ${node.label} is unreachable`));
      }
    }
    for (const nodeId of unsupportedCycleNodeIds(graphToValidate)) {
      issues.push(error(nodeId, null, `Graph contains an unsupported cycle at node ${nodeId}`));
    }

    const invalidLoopControls = loopControlOutsideLoopNodeIds(graphToValidate);
    for (const nodeId of invalidLoopControls) {
      const node = nodeById.get(nodeId);
      const controlName = node?.node_type === "break_loop" ? "Break Loop" : "Continue Loop";
      issues.push(error(
        nodeId,
        null,
        `${controlName} can only be used inside a loop body`,
      ));
    }
  }

  if (options.graphKind !== "subflow" && !issues.some((issue) => issue.level === "error")) {
    if (!graphHasExecutableSteps(graphToValidate)) {
      issues.push(warning(null, null, "Graph contains no executable workflow steps"));
    }
  }

  return issues;
}

function validateGraphEdgeDelay(delay: unknown): string | null {
  if (delay == null) return null;
  if (typeof delay !== "object") return "Edge wait range is invalid";
  const record = delay as Record<string, unknown>;
  const min = record.min_ms;
  const max = record.max_ms;
  if (min != null && (typeof min !== "number" || min < 0)) {
    return "Edge wait range is invalid";
  }
  if (max != null && (typeof max !== "number" || max < (min ?? 0))) {
    return "Edge wait range is invalid";
  }
  return null;
}

function error(
  node_id: string | null,
  edge_id: string | null,
  message: string,
): GraphValidationIssue {
  return { level: "error", node_id, edge_id, message };
}

function warning(
  node_id: string | null,
  edge_id: string | null,
  message: string,
): GraphValidationIssue {
  return { level: "warning", node_id, edge_id, message };
}
