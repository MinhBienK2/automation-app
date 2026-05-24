import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  GraphEdge,
  GraphNode,
  GraphNodeType,
  RouterGraphCase,
  RouterGraphConfig,
  VariableAssignment,
  WorkflowCondition,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import { validateWorkflowGraph as validateWorkflowGraphModule } from "./validateGraph.js";
import { migrateWorkflowGraph } from "./migration.js";

export { validateActionConfig } from "../actions/validation.js";
export { validateWorkflowGraph } from "./validateGraph.js";

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

export function compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraphModule(normalizedGraph).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  const start = normalizedGraph.nodes.find((node) => node.node_type === "start");
  if (!start) {
    throw validationError("graph", "Graph must contain exactly one start node");
  }

  const steps: CompiledGraphStep[] = [];
  compileTransition(normalizedGraph, nextTransition(normalizedGraph, start.id, "out"), new Set(), steps);
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

export function compileWorkflowGraphFromNode(
  graph: WorkflowGraph,
  startNodeId: string,
): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraphModule(normalizedGraph).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  if (!mainPathNodeIds(normalizedGraph).has(startNodeId)) {
    throw validationError("startNodeId", "Run from selected is only supported for main path nodes");
  }

  const node = normalizedGraph.nodes.find((candidate) => candidate.id === startNodeId);
  if (!node || node.node_type === "start" || node.node_type === "merge") {
    throw validationError("startNodeId", "Run from selected requires an executable graph node");
  }

  const steps: CompiledGraphStep[] = [];
  compilePath(normalizedGraph, startNodeId, new Set(), steps);
  const compiled = steps.map((stepValue) => ({
    ...stepValue,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepValue.config)),
  }));
  const withWaits = insertWaitBetweenGraphNodes(compiled);
  const fullCompiled = compileWorkflowGraph(normalizedGraph).steps.map((stepValue) => ({
    ...stepValue,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepValue.config)),
  }));
  const fullWithWaits = insertWaitBetweenGraphNodes(fullCompiled);
  return {
    steps: withWaits,
    domain_policy: domainPolicyFromSteps(fullWithWaits),
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
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
      break;
    case "merge":
      steps.push(step(node, { type: "graph_noop", config: { kind: "merge" } }));
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
      break;
    case "router": {
      const router = routerGraphConfig(node);
      steps.push(step(node, {
        type: "router_condition",
        config: {
          mode: "first_match",
          cases: router.cases.map((caseValue) => ({
            id: caseValue.id,
            label: caseValue.label,
            condition: caseValue.condition,
            steps: compileNestedConfigs(graph, node.id, `case_${caseValue.id}`, visited),
          })),
          default_steps: compileNestedConfigs(graph, node.id, "default", visited),
        },
      }));
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
      break;
    }
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "success"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "done"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
      break;
    case "set_json_variables":
      steps.push(step(node, {
        type: "set_json_variables",
        config: { json: requiredString(node.config, "json", "JSON variables are required") },
      }));
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
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
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
      break;
    case "domain_allowlist":
      steps.push(step(node, {
        type: "domain_allowlist",
        config: { domains: stringArray(node.config, "domains", "Allowed domains are required") },
      }));
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
      break;
    case "start":
      compileTransition(graph, nextTransition(graph, node.id, "out"), visited, steps);
      break;
    default:
      throw validationError("node_type", unsupportedGraphNodeTypeMessage(node.node_type));
  }

  visited.delete(nodeId);
}

type GraphTransition = {
  edge: GraphEdge;
  targetNodeId: string;
} | null;

function compileTransition(
  graph: WorkflowGraph,
  transition: GraphTransition,
  visited: Set<string>,
  steps: CompiledGraphStep[],
) {
  if (!transition) return;
  pushEdgeDelayStep(graph, transition.edge, transition.targetNodeId, steps);
  compilePath(graph, transition.targetNodeId, visited, steps);
}

function pushEdgeDelayStep(
  graph: WorkflowGraph,
  edge: GraphEdge,
  targetNodeId: string,
  steps: CompiledGraphStep[],
) {
  const delay = edge.delay;
  if (!delay) return;
  const target = graph.nodes.find((node) => node.id === targetNodeId);
  if (delay.type === "fixed") {
    steps.push({
      node_id: `__edge_wait:${edge.id}`,
      label: `Wait before ${target?.label ?? targetNodeId}`,
      config: {
        type: "wait",
        config: {
          condition: "duration",
          duration_ms: delay.duration_ms,
        },
      },
    });
    return;
  }
  steps.push({
    node_id: `__edge_wait:${edge.id}`,
    label: `Wait before ${target?.label ?? targetNodeId}`,
    config: { type: "random_wait", config: { min_ms: delay.min_ms, max_ms: delay.max_ms } },
  });
}

function compileNestedConfigs(
  graph: WorkflowGraph,
  sourceNodeId: string,
  sourcePort: string,
  visited: Set<string>,
): CompiledNestedAction[] {
  const nestedSteps: CompiledGraphStep[] = [];
  compileTransition(graph, nextTransition(graph, sourceNodeId, sourcePort), new Set(visited), nestedSteps);
  return nestedSteps.map((compiledStep) => ({
    ...compiledStep.config,
    graph_node_id: compiledStep.node_id,
    graph_label: compiledStep.label,
  }));
}

function step(node: GraphNode, config: ActionConfig): CompiledGraphStep {
  return {
    node_id: node.id,
    label: node.label,
    config,
  };
}

function settingsPreludeSteps(settings: WorkflowSettings): CompiledGraphStep[] {
  const steps: CompiledGraphStep[] = [];
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

function nextTarget(graph: WorkflowGraph, sourceNodeId: string, sourcePort: string): string | null {
  return nextTransition(graph, sourceNodeId, sourcePort)?.targetNodeId ?? null;
}

function nextTransition(
  graph: WorkflowGraph,
  sourceNodeId: string,
  sourcePort: string,
): GraphTransition {
  const edge = [...graph.edges]
    .filter((edgeValue) => edgeValue.source_node_id === sourceNodeId && edgeValue.source_port === sourcePort)
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
  return edge ? { edge, targetNodeId: edge.target_node_id } : null;
}

function mainPathNodeIds(graph: WorkflowGraph) {
  const nodeIds = new Set<string>();
  let node = graph.nodes.find((candidate) => candidate.node_type === "start") ?? null;
  const visited = new Set<string>();

  while (node && !visited.has(node.id)) {
    nodeIds.add(node.id);
    visited.add(node.id);
    const nextPort = mainContinuationPort(node.node_type);
    if (!nextPort) break;
    const nextNodeId = nextTarget(graph, node.id, nextPort);
    node = nextNodeId
      ? graph.nodes.find((candidate) => candidate.id === nextNodeId) ?? null
      : null;
  }

  return nodeIds;
}

function mainContinuationPort(nodeType: GraphNodeType) {
  switch (nodeType) {
    case "start":
    case "action":
    case "set_variable":
    case "set_json_variables":
    case "transform_variable":
    case "assert_output":
    case "domain_allowlist":
    case "merge":
      return "out";
    case "if":
    case "switch":
    case "router":
    case "repeat_times":
    case "repeat_for_each":
    case "while":
    case "repeat_until":
    case "try_catch":
    case "fallback":
      return "done";
    case "retry":
      return "success";
    default:
      return null;
  }
}

function routerGraphConfig(node: GraphNode): RouterGraphConfig {
  const router = routerGraphConfigOrNull(node);
  if (!router || router.cases.length === 0) {
    throw validationError("cases", "Router cases are required");
  }
  return router;
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

function nodeCondition(node: GraphNode): WorkflowCondition {
  const condition = asRecord(node.config).condition;
  if (!condition) throw validationError("condition", "Condition is required");
  return condition as WorkflowCondition;
}

function unsupportedGraphNodeTypeMessage(nodeType: unknown) {
  return `Unsupported graph node type: ${typeof nodeType === "string" && nodeType ? nodeType : "unknown"}`;
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

function validationError(field: string, message: string): ValidationError {
  return { field, message };
}
