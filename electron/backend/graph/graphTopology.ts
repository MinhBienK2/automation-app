import type {
  GraphNode,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { migrateWorkflowGraph } from "./migration.js";
import { isLoopNode } from "./loopAnalysis.js";
import { isQuarantinedNode } from "./quarantine.js";
import { asRecord } from "../shared/records.js";

export function reachableNodeIds(graph: WorkflowGraph): Set<string> {
  const start = graph.nodes.find((node) => node.node_type === "start");
  if (!start) return new Set();
  const reachable = new Set<string>();
  const stack = [start.id];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    for (const edgeValue of graph.edges.filter((edgeValue) => edgeValue.source_node_id === current)) {
      stack.push(edgeValue.target_node_id);
    }
  }
  return reachable;
}

export function graphHasExecutableSteps(graph: WorkflowGraph): boolean {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const reachable = reachableNodeIds(normalizedGraph);
  return normalizedGraph.nodes.some(
    (node) => reachable.has(node.id) && nodeProducesCompiledStep(node),
  );
}

function nodeProducesCompiledStep(node: GraphNode): boolean {
  if (node.node_type === "start") return false;
  if (isQuarantinedNode(node)) return false;
  if (node.node_type === "end_success") {
    return asRecord(node.config).close_browser === true;
  }
  return true;
}

export function unsupportedCycleNodeIds(graph: WorkflowGraph): Set<string> {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles = new Set<string>();
  for (const node of graph.nodes) {
    collectCycleNodes(graph, node.id, visiting, visited, cycles);
  }
  return cycles;
}

function collectCycleNodes(
  graph: WorkflowGraph,
  nodeId: string,
  visiting: Set<string>,
  visited: Set<string>,
  cycles: Set<string>,
) {
  if (visiting.has(nodeId)) {
    cycles.add(nodeId);
    return;
  }
  if (visited.has(nodeId)) return;
  visiting.add(nodeId);
  for (const edgeValue of graph.edges.filter((edge) => edge.source_node_id === nodeId)) {
    collectCycleNodes(graph, edgeValue.target_node_id, visiting, visited, cycles);
  }
  visiting.delete(nodeId);
  visited.add(nodeId);
}

export function loopControlOutsideLoopNodeIds(graph: WorkflowGraph): Set<string> {
  const start = graph.nodes.find((node) => node.node_type === "start");
  if (!start) return new Set();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const invalid = new Set<string>();
  const seen = new Set<string>();
  const stack: Array<{ nodeId: string; insideLoop: boolean }> = [{ nodeId: start.id, insideLoop: false }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const seenKey = `${current.nodeId}\u0000${current.insideLoop ? "1" : "0"}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const node = nodeById.get(current.nodeId);
    if (!node) continue;
    if ((node.node_type === "break_loop" || node.node_type === "continue_loop") && !current.insideLoop) {
      invalid.add(node.id);
      continue;
    }

    for (const edgeValue of graph.edges.filter((edge) => edge.source_node_id === node.id)) {
      stack.push({
        nodeId: edgeValue.target_node_id,
        insideLoop: current.insideLoop || (isLoopNode(node.node_type) && edgeValue.source_port === "loop"),
      });
    }
  }
  return invalid;
}
