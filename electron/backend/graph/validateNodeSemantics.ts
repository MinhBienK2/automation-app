import type {
  ActionConfig,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphPortDirection,
  GraphValidationIssue,
  RouterGraphCase,
  RouterGraphConfig,
  VariableAssignment,
  WorkflowCondition,
  WorkflowGraph,
  SwitchGraphCase,
  SwitchGraphConfig,
} from "../../../src/types/workflow.js";
import { validateActionConfig } from "../actions/validation.js";
import { validateWorkflowGraph, type WorkflowGraphValidationOptions } from "./validateGraph.js";
import { graphHasExecutableSteps } from "./graphTopology.js";
import {
  arrayField,
  asRecord,
  stringField,
  validationError,
  type ValidationErrorLike,
} from "../shared/records.js";

type ValidationError = ValidationErrorLike;

const supportedGraphNodeTypes = new Set<string>([
  "start",
  "end_success",
  "end_failure",
  "action",
  "call_subflow",
  "merge",
  "router",
  "random_choice",
  "if",
  "switch",
  "repeat_times",
  "repeat_for_each",
  "repeat_until",
  "while",
  "retry",
  "try_catch",
  "fallback",
  "break_loop",
  "continue_loop",
  "stop_workflow",
  "set_variable",
  "set_json_variables",
  "check_conditions",
  "calculate_value",
  "update_number_variable",
  "update_text_variable",
  "update_flag_variable",
  "update_list_variable",
  "update_object_variable",
  "transform_variable",
  "assert_output",
  "domain_allowlist",
  "quarantined",
]);

export function pushNodeSemanticIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
  options: WorkflowGraphValidationOptions,
) {
  if (!supportedGraphNodeTypes.has(String(node.node_type))) {
    issues.push(error(node.id, null, unsupportedGraphNodeTypeMessage(node.node_type)));
    return;
  }

  switch (node.node_type) {
    case "start":
      if (!hasOutgoing(graph, node.id, "out")) {
        if (options.graphKind === "subflow") {
          issues.push(error(node.id, null, "Subflow must have a valid start path"));
        } else {
          issues.push(warning(node.id, null, "Start is not connected; this draft has no executable work"));
        }
      }
      break;
    case "action":
      if (node.config == null) {
        issues.push(error(node.id, null, "Choose an action type before running this node"));
      } else {
        const actionConfig = node.config as ActionConfig;
        const validation = validateActionConfig(actionConfig);
        if (validation) {
          issues.push(error(node.id, null, `Node ${node.label} has invalid action config: ${validation.message}`));
        }
      }
      break;
    case "call_subflow":
      pushCallSubflowIssues(node, issues, options);
      warnMissingContinuation(graph, node, "out", "Call Subflow out is unconnected; workflow ends successfully here", issues);
      break;
    case "if":
      pushConditionIssue(node, issues);
      warnMissingBranch(graph, node, "true", "If true branch is unconnected and will no-op", issues);
      warnMissingBranch(graph, node, "false", "If false branch is unconnected and will no-op", issues);
      warnMissingContinuation(graph, node, "done", "If done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "switch": {
      const switchNodeConfig = switchGraphConfig(node);
      if (!switchNodeConfig.expression.trim()) {
        issues.push(error(node.id, null, "Switch expression is required"));
      }
      if (switchNodeConfig.cases.length === 0 || !switchNodeConfig.cases.some((c) => c.value.trim())) {
        issues.push(error(node.id, null, "Switch cases are required"));
      }
      pushStaleSwitchCaseIssues(graph, node, issues);
      warnMissingBranch(graph, node, "default", "Switch default branch is unconnected and will no-op", issues);
      warnMissingContinuation(graph, node, "done", "Switch done continuation is unconnected; workflow ends successfully here", issues);
      break;
    }
    case "merge":
      warnMissingContinuation(graph, node, "out", "Merge out is unconnected; workflow path ends successfully here", issues);
      break;
    case "end_success":
    case "end_failure":
    case "break_loop":
    case "continue_loop":
      break;
    case "router":
      pushRouterSemanticIssues(graph, node, issues);
      break;
    case "random_choice":
      pushRandomChoiceSemanticIssues(graph, node, issues);
      break;
    case "repeat_times":
      if (!positiveNumberField(node.config, "times")) {
        issues.push(error(node.id, null, "Repeat times must be greater than 0"));
      }
      requireBodyPort(graph, node, "loop", "Repeat loop branch is required", issues);
      warnMissingContinuation(graph, node, "done", "Repeat done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "repeat_for_each":
      if (!stringField(node.config, "item_name")) {
        issues.push(error(node.id, null, "Item name is required"));
      }
      if (!stringField(node.config, "array_variable") && stringArrayOrNull(node.config, "items") == null) {
        issues.push(error(node.id, null, "Items are required"));
      }
      requireBodyPort(graph, node, "loop", "Repeat loop branch is required", issues);
      warnMissingContinuation(graph, node, "done", "Repeat done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "while":
      pushConditionIssue(node, issues);
      if (!positiveNumberField(node.config, "max_attempts") && !positiveNumberField(node.config, "timeout_ms")) {
        issues.push(error(node.id, null, "Loop nodes require max attempts or timeout"));
      }
      requireBodyPort(graph, node, "loop", "While loop branch is required", issues);
      warnMissingContinuation(graph, node, "done", "While done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "repeat_until":
      pushConditionIssue(node, issues);
      if (!positiveNumberField(node.config, "max_attempts") && !positiveNumberField(node.config, "timeout_ms")) {
        issues.push(error(node.id, null, "Loop nodes require max attempts or timeout"));
      }
      requireBodyPort(graph, node, "loop", "Repeat Until loop branch is required", issues);
      warnMissingBranch(graph, node, "timeout", "Repeat Until timeout branch is unconnected; timeout path will end successfully", issues);
      warnMissingContinuation(graph, node, "done", "Repeat Until done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "retry":
      if (!positiveNumberField(node.config, "max_attempts")) {
        issues.push(error(node.id, null, "Max attempts must be greater than 0"));
      }
      requireBodyPort(graph, node, "try", "Retry try branch is required", issues);
      warnMissingBranch(graph, node, "failed", "Retry failed branch is unconnected; retry failure will fail the workflow", issues);
      warnMissingContinuation(graph, node, "success", "Retry success continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "try_catch":
      requireBodyPort(graph, node, "try", "Try branch is required", issues);
      warnMissingBranch(graph, node, "success", "Try/Catch success branch is unconnected and will no-op", issues);
      warnMissingBranch(graph, node, "error", "Try/Catch error branch is unconnected; try failure will fail the workflow", issues);
      warnMissingContinuation(graph, node, "done", "Try/Catch done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "fallback":
      requireBodyPort(graph, node, "primary", "Fallback primary branch is required", issues);
      warnMissingBranch(graph, node, "fallback", "Fallback branch is unconnected; primary failure will fail the workflow", issues);
      warnMissingContinuation(graph, node, "done", "Fallback done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "stop_workflow":
      if (!["success", "failure"].includes(stringField(node.config, "status") ?? "")) {
        issues.push(error(node.id, null, "Stop workflow status must be success or failure"));
      }
      break;
    case "set_variable": {
      const validation = validateActionConfig(setVariableActionConfig(node));
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "set_json_variables": {
      const json = stringField(node.config, "json");
      if (!json) {
        issues.push(error(node.id, null, "JSON variables are required"));
      } else {
        const validation = validateActionConfig({ type: "set_json_variables", config: { json } });
        if (validation) issues.push(error(node.id, null, validation.message));
      }
      break;
    }
    case "check_conditions": {
      const output_name = stringField(node.config, "output_name");
      if (!output_name) {
        issues.push(error(node.id, null, "Output variable name is required"));
      } else {
        const validation = validateActionConfig({
          type: "check_conditions",
          config: {
            output_name,
            mode: stringField(node.config, "mode") === "script" ? "script" : "visual",
            script: stringField(node.config, "script"),
            rules_group: asRecord(node.config).rules_group,
          },
        } as any);
        if (validation) issues.push(error(node.id, null, validation.message));
      }
      break;
    }
    case "calculate_value": {
      const output_name = stringField(node.config, "output_name");
      if (!output_name) {
        issues.push(error(node.id, null, "Output variable name is required"));
      } else {
        const validation = validateActionConfig({
          type: "calculate_value",
          config: {
            output_name,
            expression: stringField(node.config, "expression"),
            evaluation_type: stringField(node.config, "evaluation_type") as any,
          },
        } as any);
        if (validation) issues.push(error(node.id, null, validation.message));
      }
      break;
    }
    case "update_number_variable": {
      const name = stringField(node.config, "name") ?? "";
      const operation = stringField(node.config, "operation") ?? "";
      const value = stringField(node.config, "value") ?? "";
      const validation = validateActionConfig({
        type: "update_number_variable",
        config: { name, operation: operation as any, value },
      });
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "update_text_variable": {
      const name = stringField(node.config, "name") ?? "";
      const operation = stringField(node.config, "operation") ?? "";
      const value = stringField(node.config, "value") ?? "";
      const search_pattern = stringField(node.config, "search_pattern") ?? "";
      const validation = validateActionConfig({
        type: "update_text_variable",
        config: { name, operation: operation as any, value, search_pattern },
      });
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "update_flag_variable": {
      const name = stringField(node.config, "name") ?? "";
      const operation = stringField(node.config, "operation") ?? "";
      const validation = validateActionConfig({
        type: "update_flag_variable",
        config: { name, operation: operation as any },
      });
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "update_list_variable": {
      const name = stringField(node.config, "name") ?? "";
      const operation = stringField(node.config, "operation") ?? "";
      const value = stringField(node.config, "value") ?? "";
      const value_type = stringField(node.config, "value_type") ?? "";
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : null) as any;
      const validation = validateActionConfig({
        type: "update_list_variable",
        config: { name, operation: operation as any, value, value_type: value_type as any, index },
      });
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "update_object_variable": {
      const name = stringField(node.config, "name") ?? "";
      const operation = stringField(node.config, "operation") ?? "";
      const value = stringField(node.config, "value") ?? "";
      const property_key = stringField(node.config, "property_key") ?? "";
      const property_value = stringField(node.config, "property_value") ?? "";
      const property_value_type = stringField(node.config, "property_value_type") ?? "";
      const validation = validateActionConfig({
        type: "update_object_variable",
        config: { name, operation: operation as any, value, property_key, property_value, property_value_type: property_value_type as any },
      });
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "transform_variable":
      if (!stringField(node.config, "source_name")) issues.push(error(node.id, null, "Source output is required"));
      if (!stringField(node.config, "target_name")) issues.push(error(node.id, null, "Target output is required"));
      break;
    case "assert_output":
      if (!stringField(node.config, "name")) issues.push(error(node.id, null, "Output name is required"));
      if (!stringField(node.config, "value")) issues.push(error(node.id, null, "Expected output value is required"));
      break;
    case "domain_allowlist":
      if (stringArrayOrNull(node.config, "domains") == null) {
        issues.push(error(node.id, null, "Allowed domains are required"));
      }
      break;
    case "quarantined": {
      const config = node.config as { config?: { original_type?: string | null; reason?: string; message?: string } } | null;
      const inner = config?.config;
      issues.push(warning(
        node.id,
        null,
        `Quarantined node skipped: original_type=${inner?.original_type ?? "unknown"}, reason=${inner?.reason ?? "unknown"}`,
      ));
      break;
    }
    default:
      issues.push(error(node.id, null, unsupportedGraphNodeTypeMessage(node.node_type)));
  }
}

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

function pushStaleSwitchCaseIssues(
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

function pushRouterSemanticIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
) {
  const router = routerGraphConfigOrNull(node);
  if (!router || router.cases.length === 0) {
    issues.push(error(node.id, null, "Router cases are required"));
    return;
  }

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const caseValue of router.cases) {
    if (seenIds.has(caseValue.id)) duplicateIds.add(caseValue.id);
    seenIds.add(caseValue.id);
    if (!caseValue.label.trim()) {
      issues.push(error(node.id, null, "Router case labels are required"));
    }
    try {
      validateWorkflowCondition(caseValue.condition);
    } catch (caught) {
      issues.push(error(node.id, null, serializeValidationError(caught).message));
    }
  }
  if (duplicateIds.size > 0) {
    issues.push(error(node.id, null, "Router case ids must be unique"));
  }

  warnMissingBranch(graph, node, "default", "Router default branch is unconnected and will no-op", issues);
  warnMissingContinuation(graph, node, "done", "Router done continuation is unconnected; workflow ends successfully here", issues);
}

function pushRandomChoiceSemanticIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
) {
  const randomChoice = randomChoiceGraphConfigOrNull(node);
  if (!randomChoice || randomChoice.choices.length === 0) {
    issues.push(error(node.id, null, "Random choices are required"));
    return;
  }

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const choice of randomChoice.choices) {
    if (seenIds.has(choice.id)) duplicateIds.add(choice.id);
    seenIds.add(choice.id);
    if (!choice.label.trim()) {
      issues.push(error(node.id, null, "Random choice labels are required"));
    }
    if (!positive(choice.weight)) {
      issues.push(error(node.id, null, "Random choice weight must be greater than 0"));
    }
  }
  if (duplicateIds.size > 0) {
    issues.push(error(node.id, null, "Random choice ids must be unique"));
  }

  for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === node.id)) {
    const match = /^choice_(.+)$/.exec(edgeValue.source_port);
    if (!match) continue;
    const choiceId = match[1];
    if (randomChoice.choices.some((choice) => choice.id === choiceId)) continue;
    issues.push(error(
      node.id,
      edgeValue.id,
      `Random Choice ${edgeValue.source_port} no longer matches a configured choice`,
    ));
  }

  for (const choice of randomChoice.choices) {
    warnMissingBranch(
      graph,
      node,
      `choice_${choice.id}`,
      `Random Choice ${choice.label || choice.id} branch is unconnected and will no-op if selected`,
      issues,
    );
  }
  warnMissingContinuation(graph, node, "done", "Random Choice done continuation is unconnected; workflow ends successfully here", issues);
}

function switchGraphConfig(node: GraphNode): SwitchGraphConfig {
  const switchConfigValue = switchGraphConfigOrNull(node);
  if (!switchConfigValue || switchConfigValue.cases.length === 0) {
    throw validationError("cases", "Switch cases are required");
  }
  return switchConfigValue;
}

function switchGraphConfigOrNull(node: GraphNode): SwitchGraphConfig | null {
  const record = asRecord(node.config);
  const rawCases = Array.isArray(record.cases) ? record.cases : [];
  const cases = rawCases.map((item, index): SwitchGraphCase => {
    if (typeof item === "string") {
      return {
        id: String(index + 1),
        value: item,
      };
    }
    const caseRecord = asRecord(item);
    return {
      id: stringField(caseRecord, "id") ?? String(index + 1),
      value: stringField(caseRecord, "value") ?? "",
    };
  });
  return {
    expression: stringField(record, "expression") ?? "",
    cases,
  };
}

function routerGraphConfigOrNull(node: GraphNode): RouterGraphConfig | null {
  const record = asRecord(node.config);
  if (record.mode != null && record.mode !== "first_match") return null;
  const rawCases = Array.isArray(record.cases) ? record.cases : [];
  const cases = rawCases.map((item): RouterGraphCase => {
    const caseValue = asRecord(item);
    return {
      id: stringField(caseValue, "id") ?? "",
      label: typeof caseValue.label === "string" ? caseValue.label : "",
      condition: caseValue.condition as WorkflowCondition,
    };
  });
  return {
    mode: "first_match",
    cases,
    default_label: stringField(record, "default_label") ?? "Default",
  };
}

function randomChoiceGraphConfigOrNull(node: GraphNode): { choices: Array<{ id: string; label: string; weight: number }> } | null {
  const record = asRecord(node.config);
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  const choices = rawChoices.map((item) => {
    const choice = asRecord(item);
    return {
      id: stringField(choice, "id") ?? "",
      label: typeof choice.label === "string" ? choice.label : "",
      weight: numberField(choice, "weight") ?? 0,
    };
  });
  return { choices };
}

function requireBodyPort(
  graph: WorkflowGraph,
  node: GraphNode,
  sourcePort: string,
  message: string,
  issues: GraphValidationIssue[],
) {
  if (!hasOutgoing(graph, node.id, sourcePort)) issues.push(error(node.id, null, message));
}

function warnMissingBranch(
  graph: WorkflowGraph,
  node: GraphNode,
  sourcePort: string,
  message: string,
  issues: GraphValidationIssue[],
) {
  if (!hasOutgoing(graph, node.id, sourcePort)) issues.push(warning(node.id, null, message));
}

function warnMissingContinuation(
  graph: WorkflowGraph,
  node: GraphNode,
  sourcePort: string,
  message: string,
  issues: GraphValidationIssue[],
) {
  if (!hasOutgoing(graph, node.id, sourcePort)) issues.push(warning(node.id, null, message));
}

function pushConditionIssue(node: GraphNode, issues: GraphValidationIssue[]) {
  try {
    validateWorkflowCondition(nodeCondition(node));
  } catch (caught) {
    issues.push(error(node.id, null, serializeValidationError(caught).message));
  }
}

function nodeCondition(node: GraphNode): WorkflowCondition {
  const condition = asRecord(node.config).condition;
  if (!condition) throw validationError("condition", "Condition is required");
  return condition as WorkflowCondition;
}

function validateWorkflowCondition(condition: WorkflowCondition) {
  const conditionRecord = condition as { kind?: unknown; target_ref?: unknown };
  switch (condition.kind) {
    case "variable_is_true":
      if (!condition.name.trim()) throw validationError("name", "Condition variable name is required");
      break;
    case "text_visible":
      if (!condition.text.trim()) throw validationError("text", "Condition text is required");
      break;
    case "url_contains":
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "element_visible":
      if (
        Object.prototype.hasOwnProperty.call(conditionRecord, "target_ref") &&
        conditionRecord.target_ref != null
      ) {
        if (typeof conditionRecord.target_ref !== "string" || !conditionRecord.target_ref.trim()) {
          throw validationError("target_ref", "Target ref is required");
        }
      } else if (!condition.target && !condition.xpath?.trim()) {
        throw validationError("xpath", "Condition XPath is required");
      }
      break;
    default:
      throw validationError(
        "kind",
        `Unsupported condition kind: ${conditionKindLabel(conditionRecord.kind)}`,
      );
  }
}

function unsupportedGraphNodeTypeMessage(nodeType: unknown) {
  return `Unsupported graph node type: ${typeof nodeType === "string" && nodeType ? nodeType : "unknown"}`;
}

function conditionKindLabel(kind: unknown) {
  return typeof kind === "string" && kind ? kind : "unknown";
}

function setVariableActionConfig(node: GraphNode): ActionConfig {
  const variables = asRecord(node.config).variables;
  if (Array.isArray(variables)) {
    return {
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: variables as VariableAssignment[],
      },
    };
  }
  return {
    type: "set_variable",
    config: {
      name: stringField(node.config, "name") ?? "",
      value: stringField(node.config, "value") ?? "",
      value_type: null,
      variables: [],
    },
  };
}

function numberField(config: unknown, field: string): number | null {
  const value = asRecord(config)[field];
  return typeof value === "number" ? value : null;
}

function positiveNumberField(config: unknown, field: string): boolean {
  const value = numberField(config, field);
  return value != null && value > 0;
}

function stringArrayOrNull(config: unknown, field: string): string[] | null {
  const values = arrayField(config, field)
    .filter((value) => typeof value === "string")
    .map((value) => (value as string).trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

function positive(value: number | null | undefined) {
  return value != null && value > 0;
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

function serializeValidationError(error: unknown): ValidationError {
  return error && typeof error === "object" && "message" in error
    ? (error as ValidationError)
    : validationError("graph", "Invalid graph");
}
