import { validateWorkflowCondition } from "./validateCondition.js";
import type {
  ActionConfig,
  ActionType,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphPortDirection,
  GraphValidationIssue,
  WorkflowCondition,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { validateActionConfig } from "../actions/validation/index.js";
import {
  nodeCondition,
  routerGraphConfigOrNull,
  setVariableActionConfig,
  stringArrayOrNull,
  switchGraphConfig,
  switchGraphConfigOrNull,
  unsupportedGraphNodeTypeMessage,
} from "./nodeConfigReaders.js";
import {
  outputNameRequired,
  outputVariableNameRequired,
  sourceOutputRequired,
} from "../shared/validationMessages.js";
import { validateWorkflowGraph, type WorkflowGraphValidationOptions } from "./validateGraph.js";
import { graphHasExecutableSteps } from "./graphTopology.js";
import { pushActionNodeSemanticIssues } from "./validateActionNodeSemantics.js";
import { hasOutgoing, pushStaleSwitchCaseIssues } from "./validateBranchContinuation.js";
import {
  asRecord,
  stringField,
  validationError,
  type ValidationErrorLike,
} from "../shared/records.js";
import { supportedGraphNodeTypes } from "./supportedNodeTypes.js";
type ValidationError = ValidationErrorLike;


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

  if (pushActionNodeSemanticIssues(graph, node, issues, options)) return;

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

export { pushBranchContinuationIssues, hasPort, expectedPorts } from "./validateBranchContinuation.js";
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

export function warnMissingContinuation(
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


function numberField(config: unknown, field: string): number | null {
  const value = asRecord(config)[field];
  return typeof value === "number" ? value : null;
}

function positiveNumberField(config: unknown, field: string): boolean {
  const value = numberField(config, field);
  return value != null && value > 0;
}


function positive(value: number | null | undefined) {
  return value != null && value > 0;
}

export function error(
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
