import type {
  ActionConfig,
  ActionType,
  CompiledGraphStep,
  CompileWorkflowGraphOptions,
  GraphNode,
  LogicRuleGroup,
  ObjectFieldAssignment,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { asRecord, stringField } from "../shared/records.js";
import {
  requiredString,
  setVariableActionConfig,
  stringArray,
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
import type { CompilerContext } from "./controlFlowCompiler.js";

export function compileDataActionNode(
  graph: WorkflowGraph,
  node: GraphNode,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions,
  ctx: CompilerContext,
): boolean {
  switch (node.node_type) {
    case "action":
      steps.push(ctx.step(node, node.config as ActionConfig, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;

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
      steps.push(ctx.step(node, {
        type: node.node_type as unknown as never,
        config: asRecord(node.config) as unknown as never,
      } as ActionConfig, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "set_variable":
      steps.push(ctx.step(node, setVariableActionConfig(node, () => requiredString(node.config, "name", variableNameRequired)), options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    case "set_json_variables":
      steps.push(ctx.step(node, {
        type: "set_json_variables",
        config: { json: requiredString(node.config, "json", "JSON variables are required") },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    case "check_conditions":
      steps.push(ctx.step(node, {
        type: "check_conditions",
        config: {
          output_name: requiredString(node.config, "output_name", outputVariableNameRequired),
          mode: stringField(node.config, "mode") === "script" ? "script" : "visual",
          script: stringField(node.config, "script") ?? undefined,
          rules_group: asRecord(node.config).rules_group as LogicRuleGroup | undefined,
          evaluation_type: stringField(node.config, "evaluation_type") === "dynamic" ? "dynamic" : "static",
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    case "calculate_value":
      steps.push(ctx.step(node, {
        type: "calculate_value",
        config: {
          output_name: requiredString(node.config, "output_name", outputVariableNameRequired),
          expression: requiredString(node.config, "expression", "Expression is required"),
          evaluation_type: stringField(node.config, "evaluation_type") === "dynamic" ? "dynamic" : "static",
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    case "update_number_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const operation = requiredString(node.config, "operation", "Operation must be increment, decrement, add, subtract, multiply, or divide") as unknown as never;
      const value = stringField(node.config, "value");
      steps.push(ctx.step(node, {
        type: "update_number_variable",
        config: { name, operation, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "set_number_variable": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value = stringField(node.config, "value") ?? "";
      steps.push(ctx.step(node, {
        type: "set_number_variable",
        config: { output_name, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "generate_random_number": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const min = stringField(node.config, "min") ?? "0";
      const max = stringField(node.config, "max") ?? "100";
      const integer = asRecord(node.config).integer !== false;
      steps.push(ctx.step(node, {
        type: "generate_random_number",
        config: { output_name, min, max, integer },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "parse_text_to_number": {
      const source = stringField(node.config, "source") ?? "";
      const fallback = stringField(node.config, "fallback");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "parse_text_to_number",
        config: { source, fallback, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "math_operation": {
      const operand1 = stringField(node.config, "operand1") ?? "";
      const operation = requiredString(node.config, "operation", "Operation is required") as unknown as never;
      const operand2 = stringField(node.config, "operand2");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "math_operation",
        config: { operand1, operation, operand2, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "round_number": {
      const source = stringField(node.config, "source") ?? "";
      const mode = requiredString(node.config, "mode", "Rounding mode is required") as unknown as never;
      const decimals = stringField(node.config, "decimals") ?? "0";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "round_number",
        config: { source, mode, decimals, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "format_number": {
      const source = stringField(node.config, "source") ?? "";
      const format = requiredString(node.config, "format", "Format is required") as unknown as never;
      const decimals = stringField(node.config, "decimals");
      const currency_code = stringField(node.config, "currency_code");
      const locale = stringField(node.config, "locale");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "format_number",
        config: { source, format, decimals, currency_code, locale, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "compare_numbers": {
      const operand1 = stringField(node.config, "operand1") ?? "";
      const operator = requiredString(node.config, "operator", "Operator is required") as unknown as never;
      const operand2 = stringField(node.config, "operand2") ?? "";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "compare_numbers",
        config: { operand1, operator, operand2, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_number_range": {
      const value = stringField(node.config, "value") ?? "";
      const min = stringField(node.config, "min") ?? "";
      const max = stringField(node.config, "max") ?? "";
      const inclusive = asRecord(node.config).inclusive !== false;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_number_range",
        config: { value, min, max, inclusive, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_number_property": {
      const value = stringField(node.config, "value") ?? "";
      const property = requiredString(node.config, "property", "Property is required") as unknown as never;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_number_property",
        config: { value, property, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "update_text_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const operation = requiredString(node.config, "operation", "Operation must be append, prepend, replace, uppercase, lowercase, or trim") as unknown as never;
      const value = stringField(node.config, "value");
      const search_pattern = stringField(node.config, "search_pattern");
      steps.push(ctx.step(node, {
        type: "update_text_variable",
        config: { name, operation, value, search_pattern },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "set_text_variable": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value = stringField(node.config, "value");
      steps.push(ctx.step(node, {
        type: "set_text_variable",
        config: { output_name, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "append_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const value = stringField(node.config, "value");
      steps.push(ctx.step(node, {
        type: "append_text",
        config: { name, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "prepend_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const value = stringField(node.config, "value");
      steps.push(ctx.step(node, {
        type: "prepend_text",
        config: { name, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "replace_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const search_pattern = requiredString(node.config, "search_pattern", "Search pattern is required");
      const replacement = stringField(node.config, "replacement");
      steps.push(ctx.step(node, {
        type: "replace_text",
        config: { name, search_pattern, replacement },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "trim_text": {
      const name = requiredString(node.config, "name", variableNameRequired);
      steps.push(ctx.step(node, {
        type: "trim_text",
        config: { name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "change_text_case": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const to_case = requiredString(node.config, "to_case", "Invalid text case option") as unknown as never;
      steps.push(ctx.step(node, {
        type: "change_text_case",
        config: { name, to_case },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "slice_text": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const start = requiredString(String(asRecord(node.config).start ?? ""), "start", "Start value is required");
      const end = stringField(node.config, "end") ?? (typeof asRecord(node.config).end === "number" ? asRecord(node.config).end : null) as unknown as never;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "slice_text",
        config: { source, start, end, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "regex_extract": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const pattern = requiredString(node.config, "pattern", regexPatternRequired);
      const group_index = stringField(node.config, "group_index") ?? (typeof asRecord(node.config).group_index === "number" ? asRecord(node.config).group_index : null) as unknown as never;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "regex_extract",
        config: { source, pattern, group_index, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "get_text_length": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "get_text_length",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_text_empty": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_text_empty",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_text_contains": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const substring = requiredString(node.config, "substring", "Substring is required");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_text_contains",
        config: { source, substring, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_text_regex_matches": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const pattern = requiredString(node.config, "pattern", regexPatternRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_text_regex_matches",
        config: { source, pattern, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "update_flag_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const operation = requiredString(node.config, "operation", "Operation must be toggle, set_true, or set_false") as unknown as never;
      steps.push(ctx.step(node, {
        type: "update_flag_variable",
        config: { name, operation },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "set_boolean_variable": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value = requiredString(node.config, "value", "Value is required");
      steps.push(ctx.step(node, {
        type: "set_boolean_variable",
        config: { output_name, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "generate_random_boolean": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const probability = stringField(node.config, "probability") ?? (typeof asRecord(node.config).probability === "number" ? asRecord(node.config).probability : null) as unknown as never;
      steps.push(ctx.step(node, {
        type: "generate_random_boolean",
        config: { output_name, probability },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "parse_to_boolean": {
      const source = requiredString(node.config, "source", "Source is required");
      const fallback = stringField(node.config, "fallback");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "parse_to_boolean",
        config: { source, fallback, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "boolean_logical_op": {
      const operand1 = requiredString(node.config, "operand1", "Operand 1 is required");
      const operation = requiredString(node.config, "operation", "Operation is required") as unknown as never;
      const operand2 = stringField(node.config, "operand2");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "boolean_logical_op",
        config: { operand1, operation, operand2, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "compare_booleans": {
      const operand1 = requiredString(node.config, "operand1", "Operand 1 is required");
      const operator = requiredString(node.config, "operator", "Operator is required") as unknown as never;
      const operand2 = requiredString(node.config, "operand2", "Operand 2 is required");
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "compare_booleans",
        config: { operand1, operator, operand2, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_boolean_property": {
      const source = requiredString(node.config, "source", "Source is required");
      const property = requiredString(node.config, "property", "Property is required") as unknown as never;
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_boolean_property",
        config: { source, property, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    default:
      return false;
  }
}
