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

export function compileCollectionActionNode(
  graph: WorkflowGraph,
  node: GraphNode,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions,
  ctx: CompilerContext,
): boolean {
  switch (node.node_type) {
    case "update_list_variable": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const operation = requiredString(node.config, "operation", "Operation must be push, unshift, push_unique, pop, shift, remove_by_index, or remove_by_value") as unknown as never;
      const value = stringField(node.config, "value");
      const value_type = stringField(node.config, "value_type") as unknown as never;
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : null) as unknown as never;
      steps.push(ctx.step(node, {
        type: "update_list_variable",
        config: { name, operation, value, value_type, index },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "create_empty_list": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "create_empty_list",
        config: { output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "create_list_manual": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const value_type = requiredString(node.config, "value_type", "Item value type is required") as unknown as never;
      const items = (asRecord(node.config).items as string[]) ?? [];
      steps.push(ctx.step(node, {
        type: "create_list_manual",
        config: { output_name, value_type, items },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "split_text_to_list": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const source_text = stringField(node.config, "source_text") ?? "";
      const delimiter = stringField(node.config, "delimiter") ?? "";
      steps.push(ctx.step(node, {
        type: "split_text_to_list",
        config: { output_name, source_text, delimiter },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "generate_number_range": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const start = stringField(node.config, "start") ?? 0;
      const end = stringField(node.config, "end") ?? 0;
      const stepVal = stringField(node.config, "step") ?? null;
      steps.push(ctx.step(node, {
        type: "generate_number_range",
        config: { output_name, start, end, step: stepVal },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "add_to_list": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const position = requiredString(node.config, "position", "Position is required") as unknown as never;
      const value_type = requiredString(node.config, "value_type", "Value type is required") as unknown as never;
      const value = stringField(node.config, "value") ?? "";
      steps.push(ctx.step(node, {
        type: "add_to_list",
        config: { name, position, value_type, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "remove_from_list_by_index": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : "") as unknown as never;
      steps.push(ctx.step(node, {
        type: "remove_from_list_by_index",
        config: { name, index },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "remove_from_list_by_value": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const value_type = requiredString(node.config, "value_type", "Value type is required") as unknown as never;
      const value = stringField(node.config, "value") ?? "";
      steps.push(ctx.step(node, {
        type: "remove_from_list_by_value",
        config: { name, value_type, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "merge_lists": {
      const name = requiredString(node.config, "name", targetListVariableNameRequired);
      const value = stringField(node.config, "value") ?? "";
      const unique = !!asRecord(node.config).unique;
      steps.push(ctx.step(node, {
        type: "merge_lists",
        config: { name, value, unique },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "get_list_item": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const position = requiredString(node.config, "position", "Position is required") as unknown as never;
      const index = stringField(node.config, "index") ?? (typeof asRecord(node.config).index === "number" ? asRecord(node.config).index : null) as unknown as never;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "get_list_item",
        config: { source, position, index, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "get_list_length": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "get_list_length",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "slice_list": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const start = stringField(node.config, "start") ?? 0;
      const end = stringField(node.config, "end") ?? null;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "slice_list",
        config: { source, start, end, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "join_list": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const separator = stringField(node.config, "separator") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "join_list",
        config: { source, separator, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "filter_list":
    case "check_list_any_match":
    case "check_list_all_match": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const rules_group = (asRecord(node.config).rules_group ?? null) as unknown as never;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: node.node_type as unknown as never,
        config: { source, rules_group, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "map_list_property": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const property_key = stringField(node.config, "property_key") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "map_list_property",
        config: { source, property_key, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "sort_reverse_list": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const action = requiredString(node.config, "action", "Action is required") as unknown as never;
      const sort_key = stringField(node.config, "sort_key") ?? null;
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "sort_reverse_list",
        config: { source, action, sort_key, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "execute_list_script": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const script = stringField(node.config, "script") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "execute_list_script",
        config: { source, script, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_list_empty": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_list_empty",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_list_contains": {
      const source = requiredString(node.config, "source", sourceListVariableNameRequired);
      const value_type = requiredString(node.config, "value_type", "Value type is required") as unknown as never;
      const value = stringField(node.config, "value") ?? "";
      const output_name = requiredString(node.config, "output_name", resultOutputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_list_contains",
        config: { source, value_type, value, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "create_empty_object": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "create_empty_object",
        config: { output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "create_object_manual": {
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      const fields = (asRecord(node.config).fields as ObjectFieldAssignment[]) ?? [];
      steps.push(ctx.step(node, {
        type: "create_object_manual",
        config: { output_name, fields },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "parse_json_to_object": {
      const source_text = stringField(node.config, "source_text") ?? "";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "parse_json_to_object",
        config: { source_text, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "set_object_property": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      const value_type = requiredString(node.config, "value_type", "Value type is required") as unknown as never;
      const value = stringField(node.config, "value") ?? "";
      steps.push(ctx.step(node, {
        type: "set_object_property",
        config: { name, property_key, value_type, value },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "remove_object_property": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      steps.push(ctx.step(node, {
        type: "remove_object_property",
        config: { name, property_key },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "merge_objects": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const value = stringField(node.config, "value") ?? "";
      const deep = !!asRecord(node.config).deep;
      steps.push(ctx.step(node, {
        type: "merge_objects",
        config: { name, value, deep },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "rename_object_property": {
      const name = requiredString(node.config, "name", variableNameRequired);
      const old_key = requiredString(node.config, "old_key", "Old key is required");
      const new_key = requiredString(node.config, "new_key", "New key is required");
      steps.push(ctx.step(node, {
        type: "rename_object_property",
        config: { name, old_key, new_key },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "get_object_property": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "get_object_property",
        config: { source, property_key, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "get_object_keys": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "get_object_keys",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "get_object_values": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "get_object_values",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "stringify_object": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "stringify_object",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "execute_object_script": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const script = stringField(node.config, "script") ?? "";
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "execute_object_script",
        config: { source, script, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_object_key_exists": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const property_key = requiredString(node.config, "property_key", propertyKeyRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_object_key_exists",
        config: { source, property_key, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "check_object_empty": {
      const source = requiredString(node.config, "source", sourceVariableNameRequired);
      const output_name = requiredString(node.config, "output_name", outputVariableNameRequired);
      steps.push(ctx.step(node, {
        type: "check_object_empty",
        config: { source, output_name },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    }
    case "transform_variable":
      steps.push(ctx.step(node, {
        type: "transform_variable",
        config: {
          source_name: requiredString(node.config, "source_name", sourceOutputRequired),
          target_name: requiredString(node.config, "target_name", "Target output is required"),
          expression: stringField(node.config, "expression") ?? "",
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    case "assert_output":
      steps.push(ctx.step(node, {
        type: "assert_output",
        config: {
          name: requiredString(node.config, "name", outputNameRequired),
          match_mode: stringField(node.config, "match") === "contains" ? "contains" : "equals",
          value: requiredString(node.config, "value", "Expected output value is required"),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    case "domain_allowlist":
      steps.push(ctx.step(node, {
        type: "domain_allowlist",
        config: { domains: stringArray(node.config, "domains", "Allowed domains are required") },
      }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;
    default:
      return false;
  }
}
