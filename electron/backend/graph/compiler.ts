import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  GraphEdge,
  GraphNode,
  RouterGraphCase,
  RouterGraphConfig,
  VariableAssignment,
  ProfileEnvironment,
  WorkflowCondition,
  WorkflowGraph,
  WorkflowRunFromSelectedMode,
  WorkflowSettings,
  LogicRuleGroup,
  SwitchGraphCase,
  SwitchGraphConfig,
} from "../../../src/types/workflow.js";
import {
  validateWorkflowGraph as validateWorkflowGraphModule,
  type WorkflowGraphValidationOptions,
} from "./validateGraph.js";
import { migrateWorkflowGraph } from "./migration.js";
import {
  arrayField,
  asRecord,
  numberField,
  stringField,
  validationError,
} from "../shared/records.js";

export { validateActionConfig } from "../actions/validation.js";
export { validateWorkflowGraph } from "./validateGraph.js";

type CompileSubflowReference = {
  id: string;
  project_id: string;
  name: string;
  graph: WorkflowGraph;
};

export type CompileWorkflowGraphOptions = Omit<WorkflowGraphValidationOptions, "resolveSubflow"> & {
  workflowLabel?: string | null;
  labelPrefix?: string[];
  nodeIdPrefix?: string;
  resolveSubflow?: (subflowId: string) => CompileSubflowReference | null;
  profileEnvironment?: ProfileEnvironment;
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

export function compileWorkflowGraph(
  graph: WorkflowGraph,
  options: CompileWorkflowGraphOptions = {},
): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraphModule(normalizedGraph, options).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  const start = normalizedGraph.nodes.find((node) => node.node_type === "start");
  if (!start) {
    throw validationError("graph", "Graph must contain exactly one start node");
  }

  const steps: CompiledGraphStep[] = [];
  compileTransition(normalizedGraph, nextTransition(normalizedGraph, start.id, "out"), new Set(), steps, options);
  return { steps };
}

export function compileWorkflowRunPlan(
  graph: WorkflowGraph,
  settings: WorkflowSettings,
  options: CompileWorkflowGraphOptions = {},
): CompiledWorkflowGraph {
  const compiled = compileWorkflowGraph(migrateWorkflowGraph(graph), options).steps.map((step) => ({
    ...step,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(step.config)),
  }));
  const withWaits = insertWaitBetweenGraphNodes(compiled);
  const domainPolicy = domainPolicyFromSteps(withWaits);
  return {
    steps: [...settingsPreludeSteps(settings, options.profileEnvironment), ...withWaits],
    domain_policy: domainPolicy,
  };
}

type CompileWorkflowGraphFromNodeOptions = CompileWorkflowGraphOptions & {
  mode?: WorkflowRunFromSelectedMode;
  settings?: WorkflowSettings;
};

export function compileWorkflowGraphFromNode(
  graph: WorkflowGraph,
  startNodeId: string,
  options: CompileWorkflowGraphFromNodeOptions = {},
): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraphModule(normalizedGraph, options).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  const node = normalizedGraph.nodes.find((candidate) => candidate.id === startNodeId);
  if (!node || node.node_type === "start" || node.node_type === "merge") {
    throw validationError("startNodeId", "Run from selected requires an executable graph node");
  }

  const steps: CompiledGraphStep[] = [];
  compilePath(normalizedGraph, startNodeId, new Set(), steps, {
    ...options,
    stopAfterCurrentNode: options.mode === "selected_only",
  });
  const compiled = steps.map((stepValue) => ({
    ...stepValue,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepValue.config)),
  }));
  const withWaits = insertWaitBetweenGraphNodes(compiled);
  const fullCompiled = compileWorkflowGraph(normalizedGraph, options).steps.map((stepValue) => ({
    ...stepValue,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepValue.config)),
  }));
  const fullWithWaits = insertWaitBetweenGraphNodes(fullCompiled);

  const prelude = options.settings
    ? settingsPreludeSteps(options.settings, options.profileEnvironment)
    : [];

  return {
    steps: [...prelude, ...withWaits],
    domain_policy: domainPolicyFromSteps(fullWithWaits),
  };
}

function compilePath(
  graph: WorkflowGraph,
  nodeId: string | null,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions & { stopAfterCurrentNode?: boolean } = {},
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
        }, options));
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
      }, options));
      return;
    case "action":
      steps.push(step(node, node.config as ActionConfig, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "call_subflow":
      compileCallSubflow(node, options, steps);
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "merge":
      steps.push(step(node, { type: "graph_noop", config: { kind: "merge" } }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
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
            steps: compileNestedConfigs(graph, node.id, `case_${caseValue.id}`, visited, options),
          })),
          default_steps: compileNestedConfigs(graph, node.id, "default", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "random_choice": {
      const randomChoice = randomChoiceGraphConfig(node);
      steps.push(step(node, {
        type: "random_choice",
        config: {
          output_name: randomChoice.output_name,
          choices: randomChoice.choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            weight: choice.weight,
            steps: compileNestedConfigs(graph, node.id, `choice_${choice.id}`, visited, options),
          })),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "if": {
      const condition = nodeCondition(node);
      steps.push(step(node, {
        type: "if_condition",
        config: {
          condition,
          then_steps: compileNestedConfigs(graph, node.id, "true", visited, options),
          else_steps: compileNestedConfigs(graph, node.id, "false", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "switch": {
      const switchNodeConfig = switchGraphConfig(node);
      steps.push(step(node, {
        type: "switch_condition",
        config: {
          expression: switchNodeConfig.expression,
          cases: switchNodeConfig.cases.map((caseValue) => ({
            value: caseValue.value,
            steps: compileNestedConfigs(graph, node.id, `case_${caseValue.id}`, visited, options),
          })),
          default_steps: compileNestedConfigs(graph, node.id, "default", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "repeat_times": {
      steps.push(step(node, {
        type: "repeat_times",
        config: {
          times: positiveInteger(node.config, "times", "Repeat times must be greater than 0"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
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
          steps: compileNestedConfigs(graph, node.id, "loop", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "while": {
      steps.push(step(node, {
        type: "while_loop",
        config: {
          condition: nodeCondition(node),
          max_attempts: optionalPositiveInteger(node.config, "max_attempts"),
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "repeat_until": {
      steps.push(step(node, {
        type: "repeat_until",
        config: {
          condition: nodeCondition(node),
          max_attempts: optionalPositiveInteger(node.config, "max_attempts"),
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
          steps: compileNestedConfigs(graph, node.id, "loop", visited, options),
          timeout_steps: compileNestedConfigs(graph, node.id, "timeout", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "retry": {
      steps.push(step(node, {
        type: "retry_block",
        config: {
          max_attempts: positiveInteger(node.config, "max_attempts", "Max attempts must be greater than 0"),
          delay_ms: optionalPositiveInteger(node.config, "delay_ms"),
          steps: compileNestedConfigs(graph, node.id, "try", visited, options),
          failed_steps: compileNestedConfigs(graph, node.id, "failed", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "success", visited, steps, options);
      break;
    }
    case "try_catch": {
      steps.push(step(node, {
        type: "try_catch",
        config: {
          try_steps: compileNestedConfigs(graph, node.id, "try", visited, options),
          success_steps: compileNestedConfigs(graph, node.id, "success", visited, options),
          error_steps: compileNestedConfigs(graph, node.id, "error", visited, options),
          finally_steps: compileNestedConfigs(graph, node.id, "finally", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "fallback": {
      steps.push(step(node, {
        type: "fallback_block",
        config: {
          primary_steps: compileNestedConfigs(graph, node.id, "primary", visited, options),
          fallback_steps: compileNestedConfigs(graph, node.id, "fallback", visited, options),
        },
      }, options));
      compileContinuation(graph, node.id, "done", visited, steps, options);
      break;
    }
    case "break_loop":
      steps.push(step(node, { type: "break_loop", config: {} }, options));
      return;
    case "continue_loop":
      steps.push(step(node, { type: "continue_loop", config: {} }, options));
      return;
    case "stop_workflow":
      steps.push(step(node, {
        type: "stop_workflow",
        config: {
          status: stringField(node.config, "status") === "failure" ? "failure" : "success",
          reason: stringField(node.config, "reason"),
          close_browser: closeBrowserConfig(node.config),
        },
      }, options));
      return;
    case "set_variable":
      steps.push(step(node, setVariableActionConfig(node), options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "set_json_variables":
      steps.push(step(node, {
        type: "set_json_variables",
        config: { json: requiredString(node.config, "json", "JSON variables are required") },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "check_conditions":
      steps.push(step(node, {
        type: "check_conditions",
        config: {
          output_name: requiredString(node.config, "output_name", "Output variable name is required"),
          mode: stringField(node.config, "mode") === "script" ? "script" : "visual",
          script: stringField(node.config, "script") ?? undefined,
          rules_group: asRecord(node.config).rules_group as LogicRuleGroup | undefined,
          evaluation_type: stringField(node.config, "evaluation_type") === "dynamic" ? "dynamic" : "static",
        },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "calculate_value":
      steps.push(step(node, {
        type: "calculate_value",
        config: {
          output_name: requiredString(node.config, "output_name", "Output variable name is required"),
          expression: requiredString(node.config, "expression", "Expression is required"),
          evaluation_type: stringField(node.config, "evaluation_type") === "dynamic" ? "dynamic" : "static",
        },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "update_number_variable": {
      const name = requiredString(node.config, "name", "Variable name is required");
      const operation = requiredString(node.config, "operation", "Operation must be increment, decrement, add, subtract, multiply, or divide") as any;
      const value = stringField(node.config, "value");
      steps.push(step(node, {
        type: "update_number_variable",
        config: { name, operation, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_text_variable": {
      const name = requiredString(node.config, "name", "Variable name is required");
      const operation = requiredString(node.config, "operation", "Operation must be append, prepend, replace, uppercase, lowercase, or trim") as any;
      const value = stringField(node.config, "value");
      const search_pattern = stringField(node.config, "search_pattern");
      steps.push(step(node, {
        type: "update_text_variable",
        config: { name, operation, value, search_pattern },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_flag_variable": {
      const name = requiredString(node.config, "name", "Variable name is required");
      const operation = requiredString(node.config, "operation", "Operation must be toggle, set_true, or set_false") as any;
      steps.push(step(node, {
        type: "update_flag_variable",
        config: { name, operation },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_list_variable": {
      const name = requiredString(node.config, "name", "Variable name is required");
      const operation = requiredString(node.config, "operation", "Operation must be push, unshift, push_unique, pop, shift, remove_by_index, or remove_by_value") as any;
      const value = stringField(node.config, "value");
      const value_type = stringField(node.config, "value_type") as any;
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : null) as any;
      steps.push(step(node, {
        type: "update_list_variable",
        config: { name, operation, value, value_type, index },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_object_variable": {
      const name = requiredString(node.config, "name", "Variable name is required");
      const operation = requiredString(node.config, "operation", "Operation must be merge, deep_merge, set_key, or delete_key") as any;
      const value = stringField(node.config, "value");
      const property_key = stringField(node.config, "property_key");
      const property_value = stringField(node.config, "property_value");
      const property_value_type = stringField(node.config, "property_value_type") as any;
      steps.push(step(node, {
        type: "update_object_variable",
        config: { name, operation, value, property_key, property_value, property_value_type },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "transform_variable":
      steps.push(step(node, {
        type: "transform_variable",
        config: {
          source_name: requiredString(node.config, "source_name", "Source output is required"),
          target_name: requiredString(node.config, "target_name", "Target output is required"),
          expression: stringField(node.config, "expression") ?? "",
        },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "assert_output":
      steps.push(step(node, {
        type: "assert_output",
        config: {
          name: requiredString(node.config, "name", "Output name is required"),
          match_mode: stringField(node.config, "match") === "contains" ? "contains" : "equals",
          value: requiredString(node.config, "value", "Expected output value is required"),
        },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "domain_allowlist":
      steps.push(step(node, {
        type: "domain_allowlist",
        config: { domains: stringArray(node.config, "domains", "Allowed domains are required") },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "start":
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "quarantined":
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    default:
      throw validationError("node_type", unsupportedGraphNodeTypeMessage(node.node_type));
  }

  visited.delete(nodeId);
}

function compileContinuation(
  graph: WorkflowGraph,
  nodeId: string,
  sourcePort: string,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions & { stopAfterCurrentNode?: boolean },
) {
  if (options.stopAfterCurrentNode) return;
  compileTransition(graph, nextTransition(graph, nodeId, sourcePort), visited, steps, options);
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
  options: CompileWorkflowGraphOptions = {},
) {
  if (!transition) return;
  pushEdgeDelayStep(graph, transition.edge, transition.targetNodeId, steps);
  compilePath(graph, transition.targetNodeId, visited, steps, options);
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
  options: CompileWorkflowGraphOptions = {},
): CompiledNestedAction[] {
  const parentNode = graph.nodes.find((n) => n.id === sourceNodeId);
  const parentLabel = parentNode?.label;

  const nestedSteps: CompiledGraphStep[] = [];
  compileTransition(
    graph,
    nextTransition(graph, sourceNodeId, sourcePort),
    new Set(visited),
    nestedSteps,
    {
      ...options,
      labelPrefix: [...(options.labelPrefix ?? []), ...(parentLabel ? [parentLabel] : [])],
    },
  );
  return nestedSteps.map((compiledStep) => ({
    ...compiledStep.config,
    graph_node_id: compiledStep.node_id,
    graph_label: compiledStep.label,
    ...(compiledStep.metadata ? { graph_metadata: compiledStep.metadata } : {}),
  }));
}

function step(
  node: GraphNode,
  config: ActionConfig,
  options: CompileWorkflowGraphOptions = {},
): CompiledGraphStep {
  return {
    node_id: prefixedNodeId(node, options),
    label: prefixedLabel(node.label, options),
    config,
  };
}

function prefixedNodeId(node: GraphNode, options: CompileWorkflowGraphOptions) {
  return `${options.nodeIdPrefix ?? ""}${node.id}`;
}

function prefixedLabel(label: string, options: CompileWorkflowGraphOptions) {
  return [...(options.labelPrefix ?? []), label].filter(Boolean).join(" > ");
}

function compileCallSubflow(
  node: GraphNode,
  options: CompileWorkflowGraphOptions,
  steps: CompiledGraphStep[],
) {
  const subflowId = requiredString(node.config, "subflow_id", "Call Subflow requires a subflow");
  if (!options.resolveSubflow) {
    throw validationError("subflow_id", "Call Subflow cannot be compiled without a subflow resolver");
  }
  const subflow = options.resolveSubflow(subflowId);
  if (!subflow) {
    throw validationError("subflow_id", "Call Subflow references a missing subflow");
  }
  if (options.projectId && subflow.project_id !== options.projectId) {
    throw validationError("subflow_id", "Call Subflow must reference a subflow in the same project");
  }

  const inputMapping = callSubflowInputMapping(node.config);
  if (inputMapping.length > 0) {
    steps.push({
      node_id: `${prefixedNodeId(node, options)}::__inputs`,
      label: prefixedLabel("Inputs", {
        ...options,
        labelPrefix: callSubflowLabelPrefix(options, subflow),
      }),
      config: {
        type: "set_variable",
        config: {
          name: null,
          value: null,
          value_type: null,
          variables: inputMapping.map((mapping) => ({
            name: mapping.input_name,
            value_type: "text" as const,
            value: mapping.value,
          })),
        },
      },
    });
  }

  const compiled = compileWorkflowGraph(subflow.graph, {
    ...options,
    graphKind: "subflow",
    projectId: subflow.project_id,
    nodeIdPrefix: `${prefixedNodeId(node, options)}::`,
    labelPrefix: callSubflowLabelPrefix(options, subflow),
  });
  if (compiled.steps.length === 0) {
    throw validationError("subflow_id", "Referenced subflow has no executable steps");
  }
  steps.push(...compiled.steps.map((compiledStep, index) => ({
    ...compiledStep,
    metadata: {
      ...(compiledStep.metadata ?? {}),
      subflow: {
        id: subflow.id,
        name: subflow.name,
        step_number: index + 1,
        step_count: compiled.steps.length,
      },
    },
  })));
}

function callSubflowLabelPrefix(
  options: CompileWorkflowGraphOptions,
  subflow: CompileSubflowReference,
) {
  return [
    ...(options.workflowLabel ? [options.workflowLabel] : []),
    subflow.name,
  ];
}

function callSubflowInputMapping(config: unknown): Array<{ input_name: string; value: string }> {
  const value = asRecord(config).input_mapping;
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      return {
        input_name: stringField(record, "input_name") ?? "",
        value: typeof record.value === "string" ? record.value : "",
      };
    })
    .filter((item) => item.input_name.trim());
}

function settingsPreludeSteps(
  settings: WorkflowSettings,
  profileEnvironment?: ProfileEnvironment,
): CompiledGraphStep[] {
  const steps: CompiledGraphStep[] = [];
  if (profileEnvironment && profileEnvironment.variables.length > 0) {
    steps.push(settingsStep("profile:variables", "Seed profile inputs and variables", {
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: profileEnvironment.variables.map((v) => ({
          name: v.name,
          value_type: v.value_type,
          value: v.value,
        })),
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
  try {
    return structuredClone(config) as ActionConfig;
  } catch {
    return JSON.parse(JSON.stringify(config)) as ActionConfig;
  }
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
  for (const branchKey of ["cases", "choices"]) {
    const branches = record[branchKey];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      const steps = asMutableRecord(branch).steps;
      if (Array.isArray(steps)) visit(steps as ActionConfig[]);
    }
  }
  const stepValue = record.step;
  if (isActionConfig(stepValue)) visit([stepValue]);
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

type RandomChoiceGraphConfig = {
  choices: Array<{ id: string; label: string; weight: number }>;
  output_name: string | null;
};

function randomChoiceGraphConfig(node: GraphNode): RandomChoiceGraphConfig {
  const record = asRecord(node.config);
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  const choices = rawChoices.map((item) => {
    const choice = asRecord(item);
    return {
      id: stringField(choice, "id") ?? "",
      label: stringField(choice, "label") ?? "",
      weight: numberField(choice, "weight") ?? 0,
    };
  });
  if (choices.length === 0) throw validationError("choices", "Random choices are required");
  return {
    choices,
    output_name: stringField(record, "output_name"),
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

function closeBrowserConfig(config: unknown): boolean {
  return asRecord(config).close_browser === true;
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

function isActionConfig(value: unknown): value is ActionConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "config" in value,
  );
}

function asMutableRecord(value: unknown): Record<string, unknown> {
  return asRecord(value);
}
