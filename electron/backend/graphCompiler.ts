import path from "node:path";
import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphPortDirection,
  GraphValidationIssue,
  VariableAssignment,
  WorkflowCondition,
  WorkflowGraph,
  WorkflowSettings,
} from "../../src/types/workflow.js";
import { migrateWorkflowGraph } from "./workflowGraphMigration.js";

type ValidationError = {
  field: string;
  message: string;
};

const nestedStepKeys = [
  "then_steps",
  "else_steps",
  "steps",
  "failed_steps",
  "default_steps",
  "try_steps",
  "success_steps",
  "error_steps",
  "finally_steps",
  "primary_steps",
  "fallback_steps",
  "timeout_steps",
] as const;

export function validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const issues: GraphValidationIssue[] = [];
  if (normalizedGraph.version !== 1 && normalizedGraph.version !== 2) {
    issues.push(error(null, null, "Unsupported graph version"));
  }

  const graphToValidate = normalizedGraph.version > 2 ? graph : normalizedGraph;
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
    if (usedInputPorts.has(inputPortKey)) {
      issues.push(error(edge.target_node_id, edge.id, "Only one edge can enter an input port"));
    }
    usedInputPorts.add(inputPortKey);
  }

  for (const node of graphToValidate.nodes) {
    pushNodeSemanticIssues(graphToValidate, node, issues);
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
    for (const nodeId of loopControlOutsideLoopNodeIds(graphToValidate)) {
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const label =
        node.node_type === "break_loop"
          ? "Break Loop"
          : node.node_type === "continue_loop"
            ? "Continue Loop"
            : node.label;
      issues.push(error(node.id, null, `${label} can only be used inside a loop body`));
    }
  }

  return issues;
}

export function compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraph(normalizedGraph).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  const start = normalizedGraph.nodes.find((node) => node.node_type === "start");
  if (!start) {
    throw validationError("graph", "Graph must contain exactly one start node");
  }

  const steps: CompiledGraphStep[] = [];
  compilePath(normalizedGraph, nextTarget(normalizedGraph, start.id, "out"), new Set(), steps);
  return { steps };
}

export function compileWorkflowRunPlan(
  graph: WorkflowGraph,
  settings: WorkflowSettings,
): CompiledWorkflowGraph {
  const compiled = compileWorkflowGraph(migrateWorkflowGraph(graph)).steps.map((step) => ({
    ...step,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(step.config)),
  }));
  const withWaits = insertWaitBetweenGraphNodes(compiled);
  const domainPolicy = domainPolicyFromSteps(withWaits);
  return {
    steps: [...settingsPreludeSteps(settings), ...withWaits],
    domain_policy: domainPolicy,
  };
}

function compilePath(
  graph: WorkflowGraph,
  nodeId: string | null,
  visited: Set<string>,
  steps: CompiledGraphStep[],
) {
  if (!nodeId) return;
  if (visited.has(nodeId)) {
    throw validationError("graph", `Graph path contains an unsupported cycle at node ${nodeId}`);
  }
  visited.add(nodeId);

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw validationError("graph", "Graph node was not found");
  }

  switch (node.node_type) {
    case "end_success":
      if (closeBrowserConfig(node.config)) {
        steps.push(step(node, {
          type: "stop_workflow",
          config: { status: "success", reason: null, close_browser: true },
        }));
      }
      return;
    case "end_failure":
      steps.push(step(node, {
        type: "stop_workflow",
        config: {
          status: "failure",
          reason: stringField(node.config, "reason") ?? "Graph reached failure end",
          close_browser: closeBrowserConfig(node.config),
        },
      }));
      return;
    case "action":
      steps.push(step(node, node.config as ActionConfig));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "if": {
      const condition = nodeCondition(node);
      steps.push(step(node, {
        type: "if_condition",
        config: {
          condition,
          then_steps: compileNestedConfigs(graph, node.id, "true", visited),
          else_steps: compileNestedConfigs(graph, node.id, "false", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "switch": {
      const expression = requiredString(node.config, "expression", "Switch expression is required");
      const caseValues = stringArray(node.config, "cases", "Switch cases are required");
      steps.push(step(node, {
        type: "switch_condition",
        config: {
          expression,
          cases: caseValues.map((value, index) => ({
            value,
            steps: compileNestedConfigs(graph, node.id, `case_${index + 1}`, visited),
          })),
          default_steps: compileNestedConfigs(graph, node.id, "default", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "repeat_times": {
      steps.push(step(node, {
        type: "repeat_times",
        config: {
          times: positiveInteger(node.config, "times", "Repeat times must be greater than 0"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "repeat_for_each": {
      const arrayVariable = stringField(node.config, "array_variable");
      steps.push(step(node, {
        type: "repeat_for_each",
        config: {
          item_name: requiredString(node.config, "item_name", "Item name is required"),
          array_variable: arrayVariable,
          items: arrayVariable
            ? []
            : stringArray(node.config, "items", "Items are required"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "while": {
      steps.push(step(node, {
        type: "while_loop",
        config: {
          condition: nodeCondition(node),
          max_attempts: optionalPositiveInteger(node.config, "max_attempts"),
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "repeat_until": {
      steps.push(step(node, {
        type: "repeat_until",
        config: {
          condition: nodeCondition(node),
          max_attempts: optionalPositiveInteger(node.config, "max_attempts"),
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited),
          timeout_steps: compileNestedConfigs(graph, node.id, "timeout", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "retry": {
      steps.push(step(node, {
        type: "retry_block",
        config: {
          max_attempts: positiveInteger(node.config, "max_attempts", "Max attempts must be greater than 0"),
          delay_ms: optionalPositiveInteger(node.config, "delay_ms"),
          steps: compileNestedConfigs(graph, node.id, "try", visited),
          failed_steps: compileNestedConfigs(graph, node.id, "failed", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "success"), visited, steps);
      break;
    }
    case "try_catch": {
      steps.push(step(node, {
        type: "try_catch",
        config: {
          try_steps: compileNestedConfigs(graph, node.id, "try", visited),
          success_steps: compileNestedConfigs(graph, node.id, "success", visited),
          error_steps: compileNestedConfigs(graph, node.id, "error", visited),
          finally_steps: compileNestedConfigs(graph, node.id, "finally", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "fallback": {
      steps.push(step(node, {
        type: "fallback_block",
        config: {
          primary_steps: compileNestedConfigs(graph, node.id, "primary", visited),
          fallback_steps: compileNestedConfigs(graph, node.id, "fallback", visited),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "done"), visited, steps);
      break;
    }
    case "break_loop":
      steps.push(step(node, { type: "break_loop", config: {} }));
      return;
    case "continue_loop":
      steps.push(step(node, { type: "continue_loop", config: {} }));
      return;
    case "stop_workflow":
      steps.push(step(node, {
        type: "stop_workflow",
        config: {
          status: stringField(node.config, "status") === "failure" ? "failure" : "success",
          reason: stringField(node.config, "reason"),
          close_browser: closeBrowserConfig(node.config),
        },
      }));
      return;
    case "set_variable":
      steps.push(step(node, setVariableActionConfig(node)));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "set_json_variables":
      steps.push(step(node, {
        type: "set_json_variables",
        config: { json: requiredString(node.config, "json", "JSON variables are required") },
      }));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "transform_variable":
      steps.push(step(node, {
        type: "transform_variable",
        config: {
          source_name: requiredString(node.config, "source_name", "Source output is required"),
          target_name: requiredString(node.config, "target_name", "Target output is required"),
          expression: stringField(node.config, "expression") ?? "",
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "assert_output":
      steps.push(step(node, {
        type: "assert_output",
        config: {
          name: requiredString(node.config, "name", "Output name is required"),
          match_mode: stringField(node.config, "match") === "contains" ? "contains" : "equals",
          value: requiredString(node.config, "value", "Expected output value is required"),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "run_subworkflow":
      steps.push(step(node, {
        type: "run_subworkflow",
        config: {
          workflow_id: requiredString(node.config, "workflow_id", "Workflow id is required"),
          input_mapping: variableMappings(node.config, "input_mapping"),
          output_mapping: variableMappings(node.config, "output_mapping"),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "domain_allowlist":
      steps.push(step(node, {
        type: "domain_allowlist",
        config: { domains: stringArray(node.config, "domains", "Allowed domains are required") },
      }));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "manual_approval":
      steps.push(step(node, {
        type: "pause_for_human",
        config: {
          reason: stringField(node.config, "reason") ?? "Manual approval required",
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
        },
      }));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "rate_limit":
      steps.push(step(node, durationWaitAction(optionalPositiveInteger(node.config, "delay_ms") ?? 1000)));
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
    case "start":
      compilePath(graph, nextTarget(graph, node.id, "out"), visited, steps);
      break;
  }

  visited.delete(nodeId);
}

function compileNestedConfigs(
  graph: WorkflowGraph,
  sourceNodeId: string,
  sourcePort: string,
  visited: Set<string>,
): CompiledNestedAction[] {
  const nestedSteps: CompiledGraphStep[] = [];
  compilePath(graph, nextTarget(graph, sourceNodeId, sourcePort), new Set(visited), nestedSteps);
  return nestedSteps.map((compiledStep) => ({
    ...compiledStep.config,
    graph_node_id: compiledStep.node_id,
    graph_label: compiledStep.label,
  }));
}

function pushNodeSemanticIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
) {
  switch (node.node_type) {
    case "start":
      if (!hasOutgoing(graph, node.id, "out")) {
        issues.push(warning(node.id, null, "Start is not connected; this draft has no executable work"));
      }
      break;
    case "action":
      if (node.config == null) {
        issues.push(error(node.id, null, "Choose an action type before running this node"));
      } else {
        const validation = validateActionConfig(node.config as ActionConfig);
        if (validation) {
          issues.push(error(node.id, null, `Node ${node.label} has invalid action config: ${validation.message}`));
        }
      }
      break;
    case "if":
      pushConditionIssue(node, issues);
      warnMissingBranch(graph, node, "true", "If true branch is unconnected and will no-op", issues);
      warnMissingBranch(graph, node, "false", "If false branch is unconnected and will no-op", issues);
      warnMissingContinuation(graph, node, "done", "If done continuation is unconnected; workflow ends successfully here", issues);
      break;
    case "switch":
      if (!stringField(node.config, "expression")) {
        issues.push(error(node.id, null, "Switch expression is required"));
      }
      if (!arrayField(node.config, "cases").some((item) => typeof item === "string" && item.trim())) {
        issues.push(error(node.id, null, "Switch cases are required"));
      }
      pushStaleSwitchCaseIssues(graph, node, issues);
      warnMissingBranch(graph, node, "default", "Switch default branch is unconnected and will no-op", issues);
      warnMissingContinuation(graph, node, "done", "Switch done continuation is unconnected; workflow ends successfully here", issues);
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
    case "transform_variable":
      if (!stringField(node.config, "source_name")) issues.push(error(node.id, null, "Source output is required"));
      if (!stringField(node.config, "target_name")) issues.push(error(node.id, null, "Target output is required"));
      break;
    case "assert_output":
      if (!stringField(node.config, "name")) issues.push(error(node.id, null, "Output name is required"));
      if (!stringField(node.config, "value")) issues.push(error(node.id, null, "Expected output value is required"));
      break;
    case "run_subworkflow":
      if (!stringField(node.config, "workflow_id")) issues.push(error(node.id, null, "Workflow id is required"));
      for (const field of ["input_mapping", "output_mapping"]) {
        try {
          variableMappings(node.config, field);
        } catch (caught) {
          issues.push(error(node.id, null, serializeValidationError(caught).message));
        }
      }
      break;
    case "domain_allowlist":
      if (stringArrayOrNull(node.config, "domains") == null) {
        issues.push(error(node.id, null, "Allowed domains are required"));
      }
      break;
    case "rate_limit":
      if (numberField(node.config, "delay_ms") === 0) {
        issues.push(error(node.id, null, "Rate limit delay must be greater than 0"));
      }
      break;
  }
}

function step(node: GraphNode, config: ActionConfig): CompiledGraphStep {
  return {
    node_id: node.id,
    label: node.label,
    config,
  };
}

export function validateActionConfig(config: ActionConfig): ValidationError | null {
  switch (config.type) {
    case "navigate":
      return firstValidation(
        requiredActionString(config.config.url, "url", "URL is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "wait": {
      const condition = config.config.condition;
      const validConditions = [
        "duration",
        "element_visible",
        "element_hidden",
        "element_attached",
        "element_detached",
        "text_visible",
        "url_contains",
        "page_load",
        "element_enabled",
        "element_disabled",
      ];
      if (!validConditions.includes(condition)) {
        return validationError("condition", "Wait condition is invalid");
      }
      if (config.config.condition === "duration" && !positive(config.config.duration_ms)) {
        return validationError("duration_ms", "Wait duration must be greater than 0");
      }
      if (
        config.config.condition.startsWith("element_") &&
        !hasElementTargetField(config.config)
      ) {
        return validationError("xpath", "Element target is required");
      }
      if (config.config.condition === "text_visible") {
        const validation = requiredActionString(config.config.text, "text", "Text is required");
        if (validation) return validation;
      }
      if (config.config.condition === "url_contains") {
        const validation = requiredActionString(config.config.url, "url", "URL contains is required");
        if (validation) return validation;
      }
      return optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0");
    }
    case "random_wait":
      if (!positive(config.config.min_ms) || !positive(config.config.max_ms) || config.config.max_ms < config.config.min_ms) {
        return validationError("max_ms", "Random wait range is invalid");
      }
      return null;
    case "click":
    case "input_text":
    case "clear_input":
      return firstValidation(
        validateElementTarget(config.config),
        validateElementActionTiming(config.config),
      );
    case "hover":
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
    case "set_contenteditable":
      return firstValidation(
        validateElementTarget(config.config),
        validateElementActionTiming(config.config),
      );
    case "scroll": {
      const mode = config.config.mode ?? "page";
      if (mode !== "page") {
        return validationError("mode", "Only page scroll is currently supported");
      }
      return firstValidation(
        positiveValue(config.config.pixels, "pixels", "Scroll pixels must be greater than 0"),
        optionalPositive(config.config.max_attempts, "max_attempts", "Max attempts must be greater than 0"),
        optionalNonNegative(config.config.wait_ms, "wait_ms", "Wait must be zero or greater"),
      );
    }
    case "select_option":
      return firstValidation(
        validateElementTarget(config.config),
        requiredActionString(config.config.value, "value", "Option value is required"),
        validateElementActionTiming(config.config),
      );
    case "press_key":
      return requiredActionString(config.config.key, "key", "Key is required");
    case "hotkey":
      return validateStringList(config.config.keys, "keys", "Hotkey keys are required");
    case "drag_and_drop":
      return firstValidation(
        validateElementTarget(config.config, {
          xpathField: "source_xpath",
          targetField: "source_target",
          message: "Source element target is required",
        }),
        validateElementTarget(config.config, {
          xpathField: "target_xpath",
          targetField: "target_target",
          message: "Target element target is required",
        }),
        validateElementActionTiming(config.config),
      );
    case "type_sequence":
      return firstValidation(
        validateElementTarget(config.config),
        requiredActionString(config.config.text, "text", "Text is required"),
        optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
        validateElementActionTiming(config.config),
      );
    case "set_clipboard":
      return null;
    case "upload_file":
      return firstValidation(
        validateElementTarget(config.config),
        validateStringList(config.config.files, "files", "Upload files are required"),
        validateElementActionTiming(config.config),
      );
    case "submit_form":
      return firstValidation(
        config.config.xpath || config.config.target
          ? validateElementTarget(config.config)
          : null,
        validateElementActionTiming(config.config),
      );
    case "select_custom_option":
      return firstValidation(
        validateElementTarget(config.config, {
          xpathField: "trigger_xpath",
          targetField: "trigger_target",
          message: "Trigger element target is required",
        }),
        requiredActionString(config.config.option_text, "option_text", "Option text is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return validateDataCaptureConfig(config.config);
    case "extract_attribute":
      return firstValidation(
        validateDataCaptureConfig(config.config),
        requiredActionString(config.config.attribute, "attribute", "Attribute is required"),
      );
    case "take_screenshot":
      return safeArtifactNameValidation(
        config.config.path,
        "path",
        "Screenshot path must be a safe artifact name",
      );
    case "go_back":
    case "go_forward":
    case "reload":
    case "accept_dialog":
    case "dismiss_dialog":
      return null;
    case "open_new_tab":
      return null;
    case "switch_tab":
      return zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater");
    case "close_tab":
      return config.config.index == null
        ? null
        : zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater");
    case "switch_frame":
      return config.config.xpath || config.config.target ? validateElementTarget(config.config) : null;
    case "set_download_directory":
      return requiredActionString(config.config.path, "path", "Download directory is required");
    case "wait_for_download":
      return firstValidation(
        requiredActionString(config.config.output_name, "output_name", "Download output name is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "set_variable": {
      const variables = config.config.variables ?? [];
      if (variables.length > 0) {
        return variables.some((row) => !row.name.trim())
          ? validationError("variables", "Variable name is required")
          : null;
      }
      return config.config.name?.trim()
        ? null
        : validationError("name", "Variable name is required");
    }
    case "set_json_variables": {
      try {
        const parsed = JSON.parse(config.config.json);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? null
          : validationError("json", "JSON variables must be an object");
      } catch {
        return validationError("json", "JSON variables must be valid JSON");
      }
    }
    case "assert_element":
      return firstValidation(
        validateElementTarget(config.config),
        validateElementActionTiming(config.config),
      );
    case "assert_text":
      return firstValidation(
        validateElementTarget(config.config),
        requiredActionString(config.config.text, "text", "Assertion text is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "if_condition":
      return firstValidation(
        validateConditionConfig(config.config.condition),
        validateNestedActionArray(config.config.then_steps, "then_steps"),
        validateNestedActionArray(config.config.else_steps, "else_steps"),
      );
    case "repeat_times":
      return firstValidation(
        positiveValue(config.config.times, "times", "Repeat times must be greater than 0"),
        validateNestedActionArray(config.config.steps, "steps"),
      );
    case "repeat_for_each":
      return firstValidation(
        requiredActionString(config.config.item_name, "item_name", "Item name is required"),
        config.config.array_variable
          ? null
          : validateStringList(config.config.items, "items", "Items are required"),
        validateNestedActionArray(config.config.steps, "steps"),
      );
    case "retry_block":
      return firstValidation(
        positiveValue(config.config.max_attempts, "max_attempts", "Max attempts must be greater than 0"),
        optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
        validateNestedActionArray(config.config.steps, "steps"),
        validateNestedActionArray(config.config.failed_steps ?? [], "failed_steps"),
      );
    case "switch_condition":
      return firstValidation(
        requiredActionString(config.config.expression, "expression", "Switch expression is required"),
        validateSwitchCases(config.config.cases),
        validateNestedActionArray(config.config.default_steps, "default_steps"),
      );
    case "while_loop":
      return firstValidation(
        validateConditionConfig(config.config.condition),
        validateLoopLimit(config.config),
        validateNestedActionArray(config.config.steps, "steps"),
      );
    case "repeat_until":
      return firstValidation(
        validateConditionConfig(config.config.condition),
        validateLoopLimit(config.config),
        validateNestedActionArray(config.config.steps, "steps"),
        validateNestedActionArray(config.config.timeout_steps, "timeout_steps"),
      );
    case "try_catch":
      return firstValidation(
        validateNestedActionArray(config.config.try_steps, "try_steps"),
        validateNestedActionArray(config.config.success_steps, "success_steps"),
        validateNestedActionArray(config.config.error_steps, "error_steps"),
        validateNestedActionArray(config.config.finally_steps, "finally_steps"),
      );
    case "fallback_block":
      return firstValidation(
        validateNestedActionArray(config.config.primary_steps, "primary_steps"),
        validateNestedActionArray(config.config.fallback_steps, "fallback_steps"),
      );
    case "break_loop":
    case "continue_loop":
      return null;
    case "stop_workflow":
      return ["success", "failure"].includes(config.config.status)
        ? null
        : validationError("status", "Stop workflow status must be success or failure");
    case "transform_variable":
      return firstValidation(
        requiredActionString(config.config.source_name, "source_name", "Source output is required"),
        requiredActionString(config.config.target_name, "target_name", "Target output is required"),
      );
    case "assert_output":
      return firstValidation(
        requiredActionString(config.config.name, "name", "Output name is required"),
        requiredActionString(config.config.value, "value", "Expected output value is required"),
      );
    case "run_subworkflow":
      return firstValidation(
        requiredActionString(config.config.workflow_id, "workflow_id", "Workflow id is required"),
        validateMappings(config.config.input_mapping, "input_mapping"),
        validateMappings(config.config.output_mapping, "output_mapping"),
      );
    case "domain_allowlist":
      return validateStringList(config.config.domains, "domains", "Allowed domains are required");
    case "use_profile":
      return requiredActionString(config.config.name, "name", "Profile name is required");
    case "save_session":
    case "load_session":
      return requiredActionString(config.config.path, "path", "Session path is required");
    case "set_cookie":
      return firstValidation(
        requiredActionString(config.config.name, "name", "Cookie name is required"),
        requiredActionString(config.config.value, "value", "Cookie value is required"),
      );
    case "clear_cookies":
      return null;
    case "set_secret":
      return firstValidation(
        requiredActionString(config.config.name, "name", "Secret name is required"),
        requiredActionString(config.config.value, "value", "Secret value is required"),
      );
    case "use_proxy":
      return requiredActionString(config.config.server, "server", "Proxy server is required");
    case "set_user_agent":
      return requiredActionString(config.config.user_agent, "user_agent", "User agent is required");
    case "set_viewport":
      return firstValidation(
        positiveValue(config.config.width, "width", "Viewport width must be greater than 0"),
        positiveValue(config.config.height, "height", "Viewport height must be greater than 0"),
        optionalPositive(config.config.device_scale_factor, "device_scale_factor", "Device scale factor must be greater than 0"),
      );
    case "set_geolocation":
      return firstValidation(
        latitudeValidation(config.config.latitude),
        longitudeValidation(config.config.longitude),
        optionalNonNegative(config.config.accuracy, "accuracy", "Accuracy must be zero or greater"),
      );
    case "set_extra_headers":
      return validateHeaderPairs(config.config.headers);
    case "grant_permission":
      return validateStringList(config.config.permissions, "permissions", "Permissions are required");
    case "detect_challenge":
      return firstValidation(
        requiredActionString(config.config.output_name, "output_name", "Challenge output name is required"),
        validateStringList(config.config.patterns, "patterns", "Challenge pattern is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "pause_for_human":
      return firstValidation(
        requiredActionString(config.config.reason, "reason", "Pause reason is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "resume_when_condition":
      return firstValidation(
        validateConditionConfig(config.config.condition),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "fallback_selector":
      return firstValidation(
        requiredActionString(config.config.output_name, "output_name", "Fallback selector output name is required"),
        validateStringList(config.config.xpaths, "xpaths", "Fallback selector XPath is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "retry_step":
      return firstValidation(
        positiveValue(config.config.max_attempts, "max_attempts", "Max attempts must be greater than 0"),
        optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
        validateNestedActionValue(config.config.step, "step"),
      );
    case "checkpoint":
      return firstValidation(
        requiredActionString(config.config.name, "name", "Checkpoint name is required"),
        safeArtifactNameValidation(config.config.screenshot_path, "screenshot_path", "Checkpoint screenshot path must be a safe artifact name"),
      );
    case "execute_js":
      return firstValidation(
        requiredActionString(config.config.script, "script", "Script is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "wait_for_request":
      return firstValidation(
        requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "wait_for_response":
      return firstValidation(
        requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
        statusValidation(config.config.status, "status", "Response status must be between 100 and 599"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
    case "block_request":
      return validateStringList(config.config.url_patterns, "url_patterns", "URL pattern is required");
    case "mock_response":
      return firstValidation(
        requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
        statusValidation(config.config.status, "status", "Mock response status must be between 100 and 599"),
      );
    case "set_local_storage":
    case "set_session_storage":
      return requiredActionString(config.config.key, "key", "Storage key is required");
    default:
      return null;
  }
}

function firstValidation(...validations: Array<ValidationError | null | undefined>) {
  return validations.find((validation): validation is ValidationError => Boolean(validation)) ?? null;
}

function requiredActionString(
  value: string | null | undefined,
  field: string,
  message: string,
) {
  return typeof value === "string" && value.trim()
    ? null
    : validationError(field, message);
}

function positiveValue(value: number | null | undefined, field: string, message: string) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? null
    : validationError(field, message);
}

function optionalPositive(value: number | null | undefined, field: string, message: string) {
  return value == null ? null : positiveValue(value, field, message);
}

function optionalNonNegative(value: number | null | undefined, field: string, message: string) {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= 0)
    ? null
    : validationError(field, message);
}

function zeroOrPositiveInteger(value: number | null | undefined, field: string, message: string) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
    ? null
    : validationError(field, message);
}

function validateElementTarget(
  config: unknown,
  options: {
    xpathField?: string;
    targetField?: string;
    message?: string;
  } = {},
) {
  const xpathField = options.xpathField ?? "xpath";
  return hasElementTargetField(config, xpathField, options.targetField ?? "target")
    ? null
    : validationError(xpathField, options.message ?? "Element target is required");
}

function validateElementActionTiming(config: unknown) {
  const record = asRecord(config);
  return firstValidation(
    optionalPositive(record.timeout_ms as number | null | undefined, "timeout_ms", "Timeout must be greater than 0"),
    optionalNonNegative(record.retry_interval_ms as number | null | undefined, "retry_interval_ms", "Retry interval must be zero or greater"),
    optionalNonNegative(record.post_click_wait_ms as number | null | undefined, "post_click_wait_ms", "Post-click wait must be zero or greater"),
  );
}

function validateDataCaptureConfig(config: {
  xpath?: string | null;
  target?: unknown;
  output_name: string;
  timeout_ms?: number | null;
}) {
  return firstValidation(
    validateElementTarget(config),
    requiredActionString(config.output_name, "output_name", "Output name is required"),
    optionalPositive(config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
  );
}

function validateStringList(value: unknown, field: string, message: string) {
  return Array.isArray(value) &&
    value.some((item) => typeof item === "string" && item.trim())
    ? null
    : validationError(field, message);
}

function validateHeaderPairs(headers: unknown) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return validationError("headers", "Header name is required");
  }
  for (const header of headers) {
    if (!stringField(header, "name")) {
      return validationError("headers", "Header name is required");
    }
  }
  return null;
}

function validateConditionConfig(condition: unknown, field = "condition") {
  if (!condition || typeof condition !== "object") {
    return validationError(field, "Condition is required");
  }
  try {
    validateWorkflowCondition(condition as WorkflowCondition);
    return null;
  } catch (caught) {
    const serialized = serializeValidationError(caught);
    return validationError(`${field}.${serialized.field}`, serialized.message);
  }
}

function validateNestedActionArray(steps: unknown, field: string): ValidationError | null {
  if (!Array.isArray(steps)) {
    return validationError(field, "Nested steps must be an array");
  }
  for (let index = 0; index < steps.length; index += 1) {
    const validation = validateNestedActionValue(steps[index], `${field}[${index}]`);
    if (validation) return validation;
  }
  return null;
}

function validateNestedActionValue(stepValue: unknown, field: string): ValidationError | null {
  if (!isActionConfig(stepValue)) {
    return validationError(field, "Nested step must be an action config");
  }
  const validation = validateActionConfig(stepValue);
  return validation
    ? validationError(`${field}.${validation.field}`, validation.message)
    : null;
}

function validateSwitchCases(cases: unknown) {
  if (!Array.isArray(cases)) {
    return validationError("cases", "Switch cases must be an array");
  }
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    if (!stringField(caseValue, "value")) {
      return validationError(`cases[${index}].value`, "Switch case value is required");
    }
    const validation = validateNestedActionArray(caseValue.steps, `cases[${index}].steps`);
    if (validation) return validation;
  }
  return null;
}

function validateLoopLimit(config: { max_attempts?: number | null; timeout_ms?: number | null }) {
  const maxAttemptsValidation = optionalPositive(
    config.max_attempts,
    "max_attempts",
    "Max attempts must be greater than 0",
  );
  if (maxAttemptsValidation) return maxAttemptsValidation;
  const timeoutValidation = optionalPositive(
    config.timeout_ms,
    "timeout_ms",
    "Timeout must be greater than 0",
  );
  if (timeoutValidation) return timeoutValidation;
  return config.max_attempts == null && config.timeout_ms == null
    ? validationError("max_attempts", "Loop actions require max attempts or timeout")
    : null;
}

function validateMappings(mappings: unknown, field: string) {
  if (!Array.isArray(mappings)) return validationError(field, "Mappings must be an array");
  for (let index = 0; index < mappings.length; index += 1) {
    if (!stringField(mappings[index], "source")) {
      return validationError(`${field}[${index}].source`, "Mapping source is required");
    }
    if (!stringField(mappings[index], "target")) {
      return validationError(`${field}[${index}].target`, "Mapping target is required");
    }
  }
  return null;
}

function latitudeValidation(value: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90
    ? null
    : validationError("latitude", "Latitude must be between -90 and 90");
}

function longitudeValidation(value: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180
    ? null
    : validationError("longitude", "Longitude must be between -180 and 180");
}

function statusValidation(value: number | null | undefined, field: string, message: string) {
  return value == null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599)
    ? null
    : validationError(field, message);
}

function safeArtifactNameValidation(
  value: string | null | undefined,
  field: string,
  message: string,
) {
  const raw = value?.trim();
  if (!raw) return null;
  if (
    /^file:/i.test(raw) ||
    path.isAbsolute(raw) ||
    raw.includes("/") ||
    raw.includes("\\") ||
    raw.split(/[\\/]+/).includes("..")
  ) {
    return validationError(field, message);
  }
  const parsed = path.parse(raw);
  return parsed.dir || parsed.base === ".." || parsed.name === ".."
    ? validationError(field, message)
    : null;
}

function settingsPreludeSteps(settings: WorkflowSettings): CompiledGraphStep[] {
  const steps: CompiledGraphStep[] = [];
  if (
    settings.owned_test_gates.fingerprint_preflight_enabled &&
    settings.owned_test_gates.fingerprint_probe_url
  ) {
    steps.push(settingsStep("browser:fingerprint-preflight:navigate", "Open fingerprint preflight probe", {
      type: "navigate",
      config: {
        url: settings.owned_test_gates.fingerprint_probe_url,
      },
    }));
    steps.push(settingsStep("browser:fingerprint-preflight:verdict", "Validate fingerprint preflight verdict", {
      type: "execute_js",
      config: {
        script: fingerprintPreflightScript(settings),
        output_name: null,
      },
    }));
  }

  const variables: VariableAssignment[] = settings.environment.initial_variables;
  if (variables.length > 0) {
    steps.push(settingsStep("inputs:variables", "Seed settings inputs and variables", {
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables,
      },
    }));
  }
  return steps;
}

function settingsStep(id: string, label: string, config: ActionConfig): CompiledGraphStep {
  return { node_id: `__settings:${id}`, label, config };
}

function domainPolicyFromSteps(steps: CompiledGraphStep[]) {
  const domains = new Set<string>();
  for (const stepValue of steps) {
    collectDomainAllowlist(stepValue.config, domains);
  }
  return domains.size > 0 ? { allowed_domains: [...domains] } : null;
}

function collectDomainAllowlist(config: ActionConfig, domains: Set<string>) {
  if (config.type === "domain_allowlist") {
    for (const domain of config.config.domains) {
      const normalized = domain.trim();
      if (normalized) domains.add(normalized);
    }
  }
  forEachNestedActionArray(config, (steps) => {
    for (const stepValue of steps) collectDomainAllowlist(stepValue, domains);
  });
}

function applyExecutionDefaults(config: ActionConfig): ActionConfig {
  return structuredClone(config) as ActionConfig;
}

function applyNestedWaitBetweenNodes(
  config: ActionConfig,
): ActionConfig {
  return config;
}

function insertWaitBetweenGraphNodes(
  steps: CompiledGraphStep[],
): CompiledGraphStep[] {
  return steps;
}

function forEachNestedActionArray(
  config: ActionConfig,
  visit: (steps: ActionConfig[]) => void,
) {
  const record = asMutableRecord(config.config);
  for (const key of nestedStepKeys) {
    const value = record[key];
    if (Array.isArray(value)) visit(value as ActionConfig[]);
  }
  const cases = record.cases;
  if (Array.isArray(cases)) {
    for (const switchCase of cases) {
      const steps = asMutableRecord(switchCase).steps;
      if (Array.isArray(steps)) visit(steps as ActionConfig[]);
    }
  }
  const stepValue = record.step;
  if (isActionConfig(stepValue)) visit([stepValue]);
}

function fingerprintPreflightScript(settings: WorkflowSettings) {
  const profileId = JSON.stringify(settings.owned_test_gates.fingerprint_profile_id ?? "unassigned");
  const workflowId = JSON.stringify(settings.workflow_id);
  const proxyLabel = JSON.stringify(settings.owned_test_gates.fingerprint_proxy_label ?? null);
  const proxyRegion = JSON.stringify(settings.owned_test_gates.fingerprint_proxy_region ?? null);
  return `const expectedProfileId = ${profileId};
const workflowId = ${workflowId};
const proxyLabel = ${proxyLabel};
const proxyRegion = ${proxyRegion};
const raw = document.body ? document.body.innerText.trim() : "";
if (!raw) throw new Error("Fingerprint probe returned an empty verdict");
const verdict = JSON.parse(raw);
const required = ["passed", "verdict", "risk_score", "run_id", "profile_id", "mismatches", "evidence"];
for (const field of required) if (!(field in verdict)) throw new Error("Fingerprint verdict missing required field: " + field);
const evidence = {
  workflow_id: workflowId,
  timestamp_ms: Date.now(),
  probe_origin: window.location.origin,
  run_id: String(verdict.run_id || ""),
  profile_id: String(verdict.profile_id || expectedProfileId),
  expected_profile_id: expectedProfileId,
  proxy_label: proxyLabel,
  proxy_region: proxyRegion,
  verdict: String(verdict.verdict || ""),
  risk_score: verdict.risk_score ?? null,
  passed: Boolean(verdict.passed),
  mismatches: Array.isArray(verdict.mismatches) ? verdict.mismatches : [],
  coverage: verdict.evidence || {}
};
window.__wamOutputs = window.__wamOutputs || {};
window.__wamOutputs.fingerprint_preflight = evidence;
if (!verdict.passed) throw new Error("Fingerprint preflight blocked run " + evidence.run_id);
return evidence;`;
}

function expectedPorts(node: GraphNode): GraphPort[] {
  switch (node.node_type) {
    case "start":
      return [outputPort("out", "Out")];
    case "end_success":
    case "end_failure":
    case "break_loop":
    case "continue_loop":
    case "stop_workflow":
      return [inputPort("in", "In")];
    case "if":
      return [inputPort("in", "In"), outputPort("true", "True"), outputPort("false", "False"), outputPort("done", "Done")];
    case "switch": {
      const caseCount = Math.max(stringArrayOrNull(node.config, "cases")?.length ?? 0, node.ports.filter((port) => port.direction === "output" && port.id.startsWith("case_")).length, 1);
      return [
        inputPort("in", "In"),
        ...Array.from({ length: caseCount }, (_, index) => outputPort(`case_${index + 1}`, `Case ${index + 1}`)),
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

function hasPort(node: GraphNode, portId: string, direction: GraphPortDirection): boolean {
  return expectedPorts(node).some((port) => port.id === portId && port.direction === direction);
}

function inputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "input" };
}

function outputPort(id: string, label: string): GraphPort {
  return { id, label, direction: "output" };
}

function pushBranchContinuationIssues(
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
      const caseCount = stringArrayOrNull(node.config, "cases")?.length ?? 0;
      return {
        branchPorts: [
          ...Array.from({ length: caseCount }, (_, index) => `case_${index + 1}`),
          "default",
        ],
        continuationPorts: ["done"],
      };
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
  sourceNodeId: string,
  sourcePorts: string[],
): Set<string> {
  const reachable = new Set<string>();
  const queue = graph.edges
    .filter((edgeValue) =>
      edgeValue.source_node_id === sourceNodeId && sourcePorts.includes(edgeValue.source_port)
    )
    .map((edgeValue) => edgeValue.target_node_id);

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node || isTerminalBranchBoundary(node.node_type)) continue;
    for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === nodeId)) {
      queue.push(edgeValue.target_node_id);
    }
  }

  return reachable;
}

function isTerminalBranchBoundary(nodeType: GraphNodeType): boolean {
  return ["end_success", "end_failure", "break_loop", "continue_loop", "stop_workflow"].includes(nodeType);
}

function nextTarget(graph: WorkflowGraph, sourceNodeId: string, sourcePort: string): string | null {
  return [...graph.edges]
    .filter((edgeValue) => edgeValue.source_node_id === sourceNodeId && edgeValue.source_port === sourcePort)
    .sort((left, right) => left.id.localeCompare(right.id))[0]?.target_node_id ?? null;
}

function hasOutgoing(graph: WorkflowGraph, sourceNodeId: string, sourcePort: string): boolean {
  return graph.edges.some((edgeValue) => edgeValue.source_node_id === sourceNodeId && edgeValue.source_port === sourcePort);
}

function reachableNodeIds(graph: WorkflowGraph): Set<string> {
  const start = graph.nodes.find((node) => node.node_type === "start");
  const reachable = new Set<string>();
  if (!start) return reachable;
  const queue = [start.id];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === nodeId)) {
      queue.push(edgeValue.target_node_id);
    }
  }
  return reachable;
}

function unsupportedCycleNodeIds(graph: WorkflowGraph): Set<string> {
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
  for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === nodeId)) {
    collectCycleNodes(graph, edgeValue.target_node_id, visiting, visited, cycles);
  }
  visiting.delete(nodeId);
  visited.add(nodeId);
}

function loopControlOutsideLoopNodeIds(graph: WorkflowGraph): Set<string> {
  const invalid = new Set<string>();
  const start = graph.nodes.find((node) => node.node_type === "start");
  if (!start) return invalid;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const queue = [{ nodeId: start.id, insideLoop: false }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const key = `${current.nodeId}:${current.insideLoop}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const node = nodeById.get(current.nodeId);
    if (!node) continue;
    if ((node.node_type === "break_loop" || node.node_type === "continue_loop") && !current.insideLoop) {
      invalid.add(node.id);
    }
    for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === node.id)) {
      queue.push({
        nodeId: edgeValue.target_node_id,
        insideLoop: current.insideLoop || (isLoopNode(node.node_type) && edgeValue.source_port === "loop"),
      });
    }
  }
  return invalid;
}

function isLoopNode(nodeType: GraphNodeType) {
  return ["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(nodeType);
}

function pushStaleSwitchCaseIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
) {
  const caseValues = arrayField(node.config, "cases");
  for (const edgeValue of graph.edges.filter((edgeItem) => edgeItem.source_node_id === node.id)) {
    const match = /^case_(\d+)$/.exec(edgeValue.source_port);
    if (!match) continue;
    const caseIndex = Number(match[1]) - 1;
    const caseValue = caseValues[caseIndex];
    if (typeof caseValue === "string" && caseValue.trim()) continue;
    issues.push(error(
      node.id,
      edgeValue.id,
      `Switch ${edgeValue.source_port} no longer matches a configured case`,
    ));
  }
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
  switch (condition.kind) {
    case "output_equals":
    case "output_contains":
      if (!condition.name.trim()) throw validationError("name", "Condition output name is required");
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "text_visible":
      if (!condition.text.trim()) throw validationError("text", "Condition text is required");
      break;
    case "url_contains":
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "element_visible":
      if (!condition.target && !condition.xpath?.trim()) throw validationError("xpath", "Condition XPath is required");
      break;
  }
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
      name: requiredString(node.config, "name", "Variable name is required"),
      value: stringField(node.config, "value") ?? "",
      value_type: null,
      variables: [],
    },
  };
}

function variableMappings(config: unknown, field: string) {
  const mappings = arrayField(config, field);
  return mappings.map((mapping) => ({
    source: requiredString(mapping, "source", "Mapping source is required"),
    target: requiredString(mapping, "target", "Mapping target is required"),
  }));
}

function requiredString(config: unknown, field: string, message: string) {
  const value = stringField(config, field);
  if (!value) throw validationError(field, message);
  return value;
}

function stringField(config: unknown, field: string): string | null {
  const value = asRecord(config)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberField(config: unknown, field: string): number | null {
  const value = asRecord(config)[field];
  return typeof value === "number" ? value : null;
}

function positiveNumberField(config: unknown, field: string): boolean {
  const value = numberField(config, field);
  return value != null && value > 0;
}

function positiveInteger(config: unknown, field: string, message: string): number {
  const value = numberField(config, field);
  if (value == null || value <= 0 || !Number.isFinite(value)) {
    throw validationError(field, message);
  }
  return Math.trunc(value);
}

function optionalPositiveInteger(config: unknown, field: string): number | null {
  const value = numberField(config, field);
  if (value == null) return null;
  if (value <= 0 || !Number.isFinite(value)) {
    throw validationError(field, "Value must be greater than 0");
  }
  return Math.trunc(value);
}

function stringArray(config: unknown, field: string, message: string): string[] {
  const values = stringArrayOrNull(config, field);
  if (!values) throw validationError(field, message);
  return values;
}

function stringArrayOrNull(config: unknown, field: string): string[] | null {
  const values = arrayField(config, field)
    .filter((value) => typeof value === "string")
    .map((value) => (value as string).trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

function arrayField(config: unknown, field: string): unknown[] {
  const value = asRecord(config)[field];
  return Array.isArray(value) ? value : [];
}

function closeBrowserConfig(config: unknown): boolean {
  return asRecord(config).close_browser === true;
}

function hasElementTargetField(
  config: unknown,
  xpathField = "xpath",
  targetField = "target",
): boolean {
  const record = asRecord(config);
  const xpath = record[xpathField];
  return Boolean(
    (typeof xpath === "string" && xpath.trim()) ||
      hasStructuredElementTarget(record[targetField]),
  );
}

function hasStructuredElementTarget(target: unknown): boolean {
  const locators = asRecord(target).locators;
  return Array.isArray(locators) &&
    locators.some((locator) => {
      const value = asRecord(locator).value;
      return typeof value === "string" && value.trim();
    });
}

function durationWaitAction(duration_ms: number): ActionConfig {
  return {
    type: "wait",
    config: { condition: "duration", duration_ms },
  };
}

function positive(value: number | null | undefined) {
  return value != null && value > 0;
}

function isActionConfig(value: unknown): value is ActionConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "config" in value,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asMutableRecord(value: unknown): Record<string, unknown> {
  return asRecord(value);
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

function validationError(field: string, message: string): ValidationError {
  return { field, message };
}

function serializeValidationError(error: unknown): ValidationError {
  return error && typeof error === "object" && "message" in error
    ? (error as ValidationError)
    : validationError("graph", "Invalid graph");
}
