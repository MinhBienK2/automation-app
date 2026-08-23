import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  GraphEdge,
  GraphNode,
  RouterGraphConfig,
  VariableAssignment,
  ObjectFieldAssignment,
  ProfileEnvironment,
  WorkflowGraph,
  WorkflowRunFromSelectedMode,
  WorkflowSettings,
  LogicRuleGroup,
} from "../../../src/types/workflow.js";
import {
  validateWorkflowGraph as validateWorkflowGraphModule,
  type WorkflowGraphValidationOptions,
} from "./validateGraph.js";
import { migrateWorkflowGraph } from "./migration.js";
import {
  nodeCondition,
  routerGraphConfigOrNull,
  setVariableActionConfig,
  stringArrayOrNull,
  switchGraphConfig,
  unsupportedGraphNodeTypeMessage,
} from "./nodeConfigReaders.js";
import {
  outputNameRequired,
  outputVariableNameRequired,
  propertyKeyRequired,
  regexPatternRequired,
  resultOutputVariableNameRequired,
  sourceListVariableNameRequired,
  sourceOutputRequired,
  sourceVariableNameRequired,
  targetListVariableNameRequired,
  variableNameRequired,
} from "../shared/validationMessages.js";
import {
  asRecord,
  numberField,
  stringField,
  validationError,
} from "../shared/records.js";
import { generateLoopPreludeSteps } from "./loopAnalysis.js";
import { forEachNestedActionArray } from "./nestedSteps.js";

export { validateActionConfig } from "../actions/validation/index.js";
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

  const loopPrelude = generateLoopPreludeSteps(normalizedGraph, startNodeId);
  const prelude = options.settings
    ? settingsPreludeSteps(options.settings, options.profileEnvironment)
    : [];

  return {
    steps: [...prelude, ...loopPrelude, ...withWaits],
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
      const repeatConfig: Record<string, any> = {
        item_name: requiredString(node.config, "item_name", "Item name is required"),
        array_variable: arrayVariable,
        items: arrayVariable
          ? []
          : stringArray(node.config, "items", "Items are required"),
        steps: compileNestedConfigs(graph, node.id, "loop", visited, options),
      };

      const startIndex = stringField(node.config, "start_index");
      if (startIndex) repeatConfig.start_index = startIndex;

      const endIndex = stringField(node.config, "end_index");
      if (endIndex) repeatConfig.end_index = endIndex;

      const maxLoops = stringField(node.config, "max_loops");
      if (maxLoops) repeatConfig.max_loops = maxLoops;

      const minLoops = stringField(node.config, "min_loops");
      if (minLoops) repeatConfig.min_loops = minLoops;

      steps.push(step(node, {
        type: "repeat_for_each",
        config: repeatConfig as any,
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
    case "extract_text":
    case "extract_attribute":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
    case "count_elements":
    case "extract_regex_matches":
    case "extract_text_content":
    case "extract_inner_html":
    case "extract_outer_html":
    case "extract_computed_style":
    case "extract_all_attributes":
    case "extract_data_attributes":
    case "extract_class_list":
    case "extract_descendant_attributes":
    case "extract_select_value":
    case "extract_select_options":
    case "extract_checkbox_state":
    case "extract_form_data":
    case "extract_table_headers":
    case "extract_table_row":
    case "extract_table_column":
    case "extract_table_cell":
    case "extract_list_attributes":
    case "extract_structured_list":
    case "extract_dimensions":
    case "extract_visibility":
    case "extract_element_state":
    case "check_element_exists":
    case "get_page_title":
    case "get_meta_content":
    case "extract_page_links":
    case "extract_numbers":
    case "extract_urls":
    case "extract_emails":
    case "get_current_url": {
      steps.push(step(node, {
        type: node.node_type as any,
        config: asRecord(node.config) as any,
      } as ActionConfig, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "set_variable":
      steps.push(step(node, setVariableActionConfig(node, () => requiredString(node.config, "name", variableNameRequired)), options));
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
          output_name: requiredString(node.config, "output_name", outputVariableNameRequired),
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
          output_name: requiredString(node.config, "output_name", outputVariableNameRequired),
          expression: requiredString(node.config, "expression", "Expression is required"),
          evaluation_type: stringField(node.config, "evaluation_type") === "dynamic" ? "dynamic" : "static",
        },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    case "update_number_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const operation = requiredString(node.config, "operation", "Operation must be increment, decrement, add, subtract, multiply, or divide") as any;
      const value = stringField(node.config, "value");
      steps.push(step(node, {
        type: "update_number_variable",
        config: { name, operation, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "set_number_variable": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value = stringField(node.config, "value") ?? "";
      steps.push(step(node, {
        type: "set_number_variable",
        config: { output_name, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "generate_random_number": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const min = stringField(node.config, "min") ?? "0";
      const max = stringField(node.config, "max") ?? "100";
      const integer = asRecord(node.config).integer !== false;
      steps.push(step(node, {
        type: "generate_random_number",
        config: { output_name, min, max, integer },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "parse_text_to_number": {
      const source = stringField(node.config, "source") ?? "";
      const fallback = stringField(node.config, "fallback");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "parse_text_to_number",
        config: { source, fallback, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "math_operation": {
      const operand1 = stringField(node.config, "operand1") ?? "";
      const operation = requiredString(node.config, "operation", "Operation is required") as any;
      const operand2 = stringField(node.config, "operand2");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "math_operation",
        config: { operand1, operation, operand2, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "round_number": {
      const source = stringField(node.config, "source") ?? "";
      const mode = requiredString(node.config, "mode", "Rounding mode is required") as any;
      const decimals = stringField(node.config, "decimals") ?? "0";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "round_number",
        config: { source, mode, decimals, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "format_number": {
      const source = stringField(node.config, "source") ?? "";
      const format = requiredString(node.config, "format", "Format is required") as any;
      const decimals = stringField(node.config, "decimals");
      const currency_code = stringField(node.config, "currency_code");
      const locale = stringField(node.config, "locale");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "format_number",
        config: { source, format, decimals, currency_code, locale, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "compare_numbers": {
      const operand1 = stringField(node.config, "operand1") ?? "";
      const operator = requiredString(node.config, "operator", "Operator is required") as any;
      const operand2 = stringField(node.config, "operand2") ?? "";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "compare_numbers",
        config: { operand1, operator, operand2, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_number_range": {
      const value = stringField(node.config, "value") ?? "";
      const min = stringField(node.config, "min") ?? "";
      const max = stringField(node.config, "max") ?? "";
      const inclusive = asRecord(node.config).inclusive !== false;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_number_range",
        config: { value, min, max, inclusive, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_number_property": {
      const value = stringField(node.config, "value") ?? "";
      const property = requiredString(node.config, "property", "Property is required") as any;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_number_property",
        config: { value, property, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_text_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
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
    case "set_text_variable": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value = stringField(node.config, "value");
      steps.push(step(node, {
        type: "set_text_variable",
        config: { output_name, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "append_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const value = stringField(node.config, "value");
      steps.push(step(node, {
        type: "append_text",
        config: { name, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "prepend_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const value = stringField(node.config, "value");
      steps.push(step(node, {
        type: "prepend_text",
        config: { name, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "replace_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const search_pattern = requiredString(node.config, "search_pattern", "Search pattern is required");
      const replacement = stringField(node.config, "replacement");
      steps.push(step(node, {
        type: "replace_text",
        config: { name, search_pattern, replacement },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "trim_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      steps.push(step(node, {
        type: "trim_text",
        config: { name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "change_text_case": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const to_case = requiredString(node.config, "to_case", "Invalid text case option") as any;
      steps.push(step(node, {
        type: "change_text_case",
        config: { name, to_case },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "slice_text": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const start = requiredString(String(asRecord(node.config).start ?? ""), "start", "Start value is required");
      const end = stringField(node.config, "end") ?? (typeof asRecord(node.config).end === "number" ? asRecord(node.config).end : null) as any;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "slice_text",
        config: { source, start, end, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "regex_extract": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const pattern = requiredString(node.config, "pattern", regexPatternRequired);
      const group_index = stringField(node.config, "group_index") ?? (typeof asRecord(node.config).group_index === "number" ? asRecord(node.config).group_index : null) as any;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "regex_extract",
        config: { source, pattern, group_index, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "get_text_length": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "get_text_length",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_text_empty": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_text_empty",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_text_contains": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const substring = requiredString(node.config, "substring", "Substring is required");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_text_contains",
        config: { source, substring, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_text_regex_matches": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const pattern = requiredString(node.config, "pattern", regexPatternRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_text_regex_matches",
        config: { source, pattern, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_flag_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const operation = requiredString(node.config, "operation", "Operation must be toggle, set_true, or set_false") as any;
      steps.push(step(node, {
        type: "update_flag_variable",
        config: { name, operation },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "set_boolean_variable": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value = requiredString(node.config, "value", "Value is required");
      steps.push(step(node, {
        type: "set_boolean_variable",
        config: { output_name, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "generate_random_boolean": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const probability = stringField(node.config, "probability") ?? (typeof asRecord(node.config).probability === "number" ? asRecord(node.config).probability : null) as any;
      steps.push(step(node, {
        type: "generate_random_boolean",
        config: { output_name, probability },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "parse_to_boolean": {
      const source = requiredString(node.config, "source", "Source is required");
      const fallback = stringField(node.config, "fallback");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "parse_to_boolean",
        config: { source, fallback, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "boolean_logical_op": {
      const operand1 = requiredString(node.config, "operand1", "Operand 1 is required");
      const operation = requiredString(node.config, "operation", "Operation is required") as any;
      const operand2 = stringField(node.config, "operand2");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "boolean_logical_op",
        config: { operand1, operation, operand2, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "compare_booleans": {
      const operand1 = requiredString(node.config, "operand1", "Operand 1 is required");
      const operator = requiredString(node.config, "operator", "Operator is required") as any;
      const operand2 = requiredString(node.config, "operand2", "Operand 2 is required");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "compare_booleans",
        config: { operand1, operator, operand2, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_boolean_property": {
      const source = requiredString(node.config, "source", "Source is required");
      const property = requiredString(node.config, "property", "Property is required") as any;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_boolean_property",
        config: { source, property, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "update_list_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
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
    case "create_empty_list": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "create_empty_list",
        config: { output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "create_list_manual": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value_type = requiredString(node.config, "value_type", "Item value type is required") as any;
      const items = (asRecord(node.config).items as string[]) ?? [];
      steps.push(step(node, {
        type: "create_list_manual",
        config: { output_name, value_type, items },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "split_text_to_list": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const source_text = stringField(node.config, "source_text") ?? "";
      const delimiter = stringField(node.config, "delimiter") ?? "";
      steps.push(step(node, {
        type: "split_text_to_list",
        config: { output_name, source_text, delimiter },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "generate_number_range": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const start = stringField(node.config, "start") ?? 0;
      const end = stringField(node.config, "end") ?? 0;
      const stepVal = stringField(node.config, "step") ?? null;
      steps.push(step(node, {
        type: "generate_number_range",
        config: { output_name, start, end, step: stepVal },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "add_to_list": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const position = requiredString(node.config, "position", "Position is required") as any;
      const value_type = requiredString(node.config, "value_type", "Value type is required") as any;
      const value = stringField(node.config, "value") ?? "";
      steps.push(step(node, {
        type: "add_to_list",
        config: { name, position, value_type, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "remove_from_list_by_index": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : "") as any;
      steps.push(step(node, {
        type: "remove_from_list_by_index",
        config: { name, index },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "remove_from_list_by_value": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const value_type = requiredString(node.config, "value_type", "Value type is required") as any;
      const value = stringField(node.config, "value") ?? "";
      steps.push(step(node, {
        type: "remove_from_list_by_value",
        config: { name, value_type, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "merge_lists": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const value = stringField(node.config, "value") ?? "";
      const unique = !!asRecord(node.config).unique;
      steps.push(step(node, {
        type: "merge_lists",
        config: { name, value, unique },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "get_list_item": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const position = requiredString(node.config, "position", "Position is required") as any;
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : null) as any;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "get_list_item",
        config: { source, position, index, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "get_list_length": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "get_list_length",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "slice_list": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const start = stringField(node.config, "start") ?? 0;
      const end = stringField(node.config, "end") ?? null;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "slice_list",
        config: { source, start, end, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "join_list": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const separator = stringField(node.config, "separator") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "join_list",
        config: { source, separator, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "filter_list":
    case "check_list_any_match":
    case "check_list_all_match": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const rules_group = (asRecord(node.config).rules_group ?? null) as any;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: node.node_type as any,
        config: { source, rules_group, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "map_list_property": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const property_key = stringField(node.config, "property_key") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "map_list_property",
        config: { source, property_key, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "sort_reverse_list": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const action = requiredString(node.config, "action", "Action is required") as any;
      const sort_key = stringField(node.config, "sort_key") ?? null;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "sort_reverse_list",
        config: { source, action, sort_key, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "execute_list_script": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const script = stringField(node.config, "script") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "execute_list_script",
        config: { source, script, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_list_empty": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "check_list_empty",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_list_contains": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const value_type = requiredString(node.config, "value_type", "Value type is required") as any;
      const value = stringField(node.config, "value") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(step(node, {
        type: "check_list_contains",
        config: { source, value_type, value, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "create_empty_object": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "create_empty_object",
        config: { output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "create_object_manual": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const fields = (asRecord(node.config).fields as ObjectFieldAssignment[]) ?? [];
      steps.push(step(node, {
        type: "create_object_manual",
        config: { output_name, fields },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "parse_json_to_object": {
      const source_text = stringField(node.config, "source_text") ?? "";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "parse_json_to_object",
        config: { source_text, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "set_object_property": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      const value_type = requiredString(node.config, "value_type", "Value type is required") as any;
      const value = stringField(node.config, "value") ?? "";
      steps.push(step(node, {
        type: "set_object_property",
        config: { name, property_key, value_type, value },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "remove_object_property": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      steps.push(step(node, {
        type: "remove_object_property",
        config: { name, property_key },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "merge_objects": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const value = stringField(node.config, "value") ?? "";
      const deep = !!asRecord(node.config).deep;
      steps.push(step(node, {
        type: "merge_objects",
        config: { name, value, deep },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "rename_object_property": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const old_key = requiredString(node.config, "old_key", "Old key is required");
      const new_key = requiredString(node.config, "new_key", "New key is required");
      steps.push(step(node, {
        type: "rename_object_property",
        config: { name, old_key, new_key },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "get_object_property": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "get_object_property",
        config: { source, property_key, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "get_object_keys": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "get_object_keys",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "get_object_values": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "get_object_values",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "stringify_object": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "stringify_object",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "execute_object_script": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const script = stringField(node.config, "script") ?? "";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "execute_object_script",
        config: { source, script, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_object_key_exists": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_object_key_exists",
        config: { source, property_key, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "check_object_empty": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(step(node, {
        type: "check_object_empty",
        config: { source, output_name },
      }, options));
      compileContinuation(graph, node.id, "out", visited, steps, options);
      break;
    }
    case "transform_variable":
      steps.push(step(node, {
        type: "transform_variable",
        config: {
          source_name: requiredString(node.config, "source_name", sourceOutputRequired),
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
          name: requiredString(node.config, "name", outputNameRequired),
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


function closeBrowserConfig(config: unknown): boolean {
  return asRecord(config).close_browser === true;
}


