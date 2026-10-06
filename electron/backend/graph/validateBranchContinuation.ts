import type {
  GraphNode,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import type { GraphValidationIssue } from "./validateGraph.js";
import { error } from "./validateNodeSemantics.js";
import {
  randomChoiceGraphConfigOrNull,
  routerGraphConfigOrNull,
  switchGraphConfig,
  switchGraphConfigOrNull,
} from "./nodeConfigReaders.js";

export function pushBranchContinuationIssues(
  graph: WorkflowGraph,
  nodeById: Map<string, GraphNode>,
  issues: GraphValidationIssue[],
) {
  for (const node of graph.nodes) {
    const semantics = branchContinuationSemantics(node);
    if (!semantics) continue;

    const branchReachable = reachableFromPorts(graph, nodeById, node.id, semantics.branchPorts);
    const continuationReachable = reachableFromPorts(graph, nodeById, node.id, semantics.continuationPorts);
    for (const nodeId of branchReachable) {
      if (!continuationReachable.has(nodeId)) continue;
      const shared = nodeById.get(nodeId);
      if (shared?.node_type === "merge") continue;
      issues.push(error(
        nodeId,
        null,
        `Node ${shared?.label ?? nodeId} is reachable from both a branch path and an explicit continuation path`,
      ));
    }
  }
}

function branchContinuationSemantics(node: GraphNode): {
  branchPorts: string[];
  continuationPorts: string[];
} | null {
  switch (node.node_type) {
    case "if":
      return { branchPorts: ["true", "false"], continuationPorts: ["done"] };
    case "switch": {
      const switchNodeConfig = switchGraphConfigOrNull(node);
      const casePorts = switchNodeConfig?.cases.map((c) => `case_${c.id}`) ?? [];
      return { branchPorts: [...casePorts, "default"], continuationPorts: ["done"] };
    }
    case "router": {
      const router = routerGraphConfigOrNull(node);
      const casePorts = router?.cases.map((caseValue) => `case_${caseValue.id}`) ?? [];
      return { branchPorts: [...casePorts, "default"], continuationPorts: ["done"] };
    }
    case "random_choice": {
      const choice = randomChoiceGraphConfigOrNull(node);
      const choicePorts = choice?.choices.map((choiceValue) => `choice_${choiceValue.id}`) ?? [];
      return { branchPorts: choicePorts, continuationPorts: ["done"] };
    }
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return { branchPorts: ["loop"], continuationPorts: ["done"] };
    case "repeat_until":
      return { branchPorts: ["loop", "timeout"], continuationPorts: ["done"] };
    case "retry":
      return { branchPorts: ["try", "failed"], continuationPorts: ["success"] };
    case "try_catch":
      return { branchPorts: ["try", "success", "error", "finally"], continuationPorts: ["done"] };
    case "fallback":
      return { branchPorts: ["primary", "fallback"], continuationPorts: ["done"] };
    default:
      return null;
  }
}

function reachableFromPorts(
  graph: WorkflowGraph,
  nodeById: Map<string, GraphNode>,
  nodeId: string,
  sourcePorts: string[],
) {
  const reachable = new Set<string>();
  const stack = graph.edges
    .filter((edge) => edge.source_node_id === nodeId && sourcePorts.includes(edge.source_port))
    .map((edge) => edge.target_node_id);
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);

    const currentNode = nodeById.get(current);
    if (currentNode && isTerminalBranchBoundary(currentNode.node_type)) {
      continue;
    }

    for (const edge of graph.edges.filter((edgeValue) => edgeValue.source_node_id === current)) {
      stack.push(edge.target_node_id);
    }
  }
  return reachable;
}

function isTerminalBranchBoundary(nodeType: GraphNodeType): boolean {
  return ["end_success", "end_failure", "break_loop", "continue_loop", "stop_workflow"].includes(nodeType);
}

export function hasOutgoing(graph: WorkflowGraph, sourceNodeId: string, sourcePort: string): boolean {
  return graph.edges.some((edge) => edge.source_node_id === sourceNodeId && edge.source_port === sourcePort);
}

function pushCallSubflowIssues(
  node: GraphNode,
  issues: GraphValidationIssue[],
  options: WorkflowGraphValidationOptions,
) {
  if (options.graphKind === "subflow") {
    issues.push(error(node.id, null, "Subflows cannot call subflows in the MVP"));
    return;
  }
  const subflowId = stringField(node.config, "subflow_id");
  if (!subflowId) {
    issues.push(error(node.id, null, "Call Subflow requires a subflow"));
    return;
  }
  if (!options.resolveSubflow) return;
  const subflow = options.resolveSubflow(subflowId);
  if (!subflow) {
    issues.push(error(node.id, null, "Call Subflow references a missing subflow"));
    return;
  }
  if (options.projectId && subflow.project_id !== options.projectId) {
    issues.push(error(node.id, null, "Call Subflow must reference a subflow in the same project"));
    return;
  }
  const subflowIssues = validateWorkflowGraph(subflow.graph, {
    ...options,
    graphKind: "subflow",
    projectId: subflow.project_id,
  });
  if (subflowIssues.some((issue) => issue.level === "error")) {
    issues.push(error(node.id, null, "Referenced subflow has blocking validation errors"));
    return;
  }
  if (!graphHasExecutableSteps(subflow.graph)) {
    issues.push(error(node.id, null, "Referenced subflow has no executable steps"));
  }
}

export function expectedPorts(node: GraphNode): GraphPort[] {
  switch (node.node_type) {
    case "start":
      return [outputPort("out", "Out")];
    case "end_success":
    case "end_failure":
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
      return [inputPort("in", "In")];
    case "call_subflow":
      return [inputPort("in", "In"), outputPort("out", "Out")];
    case "merge":
      return [inputPort("in", "In"), outputPort("out", "Out")];
    case "router": {
      const router = routerGraphConfigOrNull(node);
      const cases = router?.cases.length
        ? router.cases
        : [{ id: "1", label: "Case 1", condition: { kind: "output_equals", name: "name", value: "" } as const }];
      return [
        inputPort("in", "In"),
        ...cases.map((caseValue) => outputPort(`case_${caseValue.id}`, caseValue.label)),
        outputPort("default", router?.default_label || "Default"),
        outputPort("done", "Done"),
      ];
    }
    case "random_choice": {
      const choices = randomChoiceGraphConfigOrNull(node);
      const choiceValues = choices?.choices.length
        ? choices.choices
        : [
            { id: "1", label: "Choice 1", weight: 1 },
            { id: "2", label: "Choice 2", weight: 1 },
          ];
      return [
        inputPort("in", "In"),
        ...choiceValues.map((choice) => outputPort(`choice_${choice.id}`, choice.label)),
        outputPort("done", "Done"),
      ];
    }
    case "if":
      return [inputPort("in", "In"), outputPort("true", "True"), outputPort("false", "False"), outputPort("done", "Done")];
    case "switch": {
      const switchNodeConfig = switchGraphConfigOrNull(node);
      const cases = switchNodeConfig?.cases ?? [];
      const ports = cases.map((c) => outputPort(`case_${c.id}`, c.value || `Case ${c.id}`));
      const existingPorts = node.ports
        .filter((port) => port.direction === "output" && port.id.startsWith("case_"))
        .map((port) => outputPort(port.id, port.label));
      const mergedPortsMap = new Map<string, GraphPort>();
      for (const p of [...ports, ...existingPorts]) {
        mergedPortsMap.set(p.id, p);
      }
      return [
        inputPort("in", "In"),
        ...Array.from(mergedPortsMap.values()),
        outputPort("default", "Default"),
        outputPort("done", "Done"),
      ];
    }
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [inputPort("in", "In"), outputPort("loop", "Loop"), outputPort("done", "Done")];
    case "repeat_until":
      return [inputPort("in", "In"), outputPort("loop", "Loop"), outputPort("done", "Done"), outputPort("timeout", "Timeout")];
    case "retry":
      return [inputPort("in", "In"), outputPort("try", "Try"), outputPort("success", "Success"), outputPort("failed", "Failed")];
    case "try_catch":
      return [inputPort("in", "In"), outputPort("try", "Try"), outputPort("success", "Success"), outputPort("error", "Error"), outputPort("finally", "Finally"), outputPort("done", "Done")];
    case "fallback":
      return [inputPort("in", "In"), outputPort("primary", "Primary"), outputPort("fallback", "Fallback"), outputPort("done", "Done")];
    default:
      return [inputPort("in", "In"), outputPort("out", "Out")];
  }
}

export function hasPort(node: GraphNode, portId: string, direction: GraphPortDirection): boolean {
  return expectedPorts(node).some((port) => port.id === portId && port.direction === direction);
}


function inputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "input" };
}

function outputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "output" };
}

export function pushStaleSwitchCaseIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
) {
  const switchNodeConfig = switchGraphConfig(node);
  const caseIds = new Set(switchNodeConfig.cases.map(c => c.id));
  for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === node.id)) {
    const match = /^case_(.+)$/.exec(edgeValue.source_port);
    if (!match) continue;
    const caseId = match[1];
    if (caseIds.has(caseId)) continue;
    issues.push(error(
      node.id,
      edgeValue.id,
      `Switch ${edgeValue.source_port} no longer matches a configured case`,
    ));
  }
}

