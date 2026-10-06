import type {
  ActionConfig,
  ActionType,
  GraphNode,
  LogicRuleGroup,
  ObjectFieldAssignment,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import type {
  GraphValidationIssue,
  WorkflowGraphValidationOptions,
} from "./validateGraph.js";
import { validateActionConfig } from "../actions/validation/index.js";
import {
  error,
  warnMissingContinuation,
} from "./validateNodeSemantics.js";
import { asRecord, stringField } from "../shared/records.js";
import {
  setVariableActionConfig,
  stringArrayOrNull,
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

export function pushActionNodeSemanticIssues(
  graph: WorkflowGraph,
  node: GraphNode,
  issues: GraphValidationIssue[],
  options: WorkflowGraphValidationOptions,
): boolean {
  switch (node.node_type) {
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
      if (node.config == null) {
        issues.push(error(node.id, null, `Configure ${node.label} before running this node`));
      } else {
        const dummyActionConfig = {
          type: node.node_type as ActionType,
          config: node.config,
        } as ActionConfig;
        const validation = validateActionConfig(dummyActionConfig);
        if (validation) {
          issues.push(error(node.id, null, `Node ${node.label} has invalid config: ${validation.message}`));
        }
      }
      break;
    }
    case "set_variable": {
      const validation = validateActionConfig(setVariableActionConfig(node, () => stringField(node.config, "name") ?? ""));
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
        issues.push(error(node.id, null, outputVariableNameRequired));
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
        issues.push(error(node.id, null, outputVariableNameRequired));
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
    case "set_text_variable":
    case "set_boolean_variable":
    case "generate_random_boolean":
    case "parse_to_boolean":
    case "boolean_logical_op":
    case "compare_booleans":
    case "check_boolean_property":
    case "set_number_variable":
    case "generate_random_number":
    case "parse_text_to_number":
    case "math_operation":
    case "round_number":
    case "format_number":
    case "compare_numbers":
    case "check_number_range":
    case "check_number_property":
    case "append_text":
    case "prepend_text":
    case "replace_text":
    case "trim_text":
    case "change_text_case":
    case "slice_text":
    case "regex_extract":
    case "get_text_length":
    case "check_text_empty":
    case "check_text_contains":
    case "check_text_regex_matches":
    case "create_empty_list":
    case "create_list_manual":
    case "split_text_to_list":
    case "generate_number_range":
    case "add_to_list":
    case "remove_from_list_by_index":
    case "remove_from_list_by_value":
    case "merge_lists":
    case "get_list_item":
    case "get_list_length":
    case "slice_list":
    case "join_list":
    case "filter_list":
    case "map_list_property":
    case "sort_reverse_list":
    case "execute_list_script":
    case "check_list_empty":
    case "check_list_contains":
    case "check_list_any_match":
    case "check_list_all_match":
    case "create_empty_object":
    case "create_object_manual":
    case "parse_json_to_object":
    case "set_object_property":
    case "remove_object_property":
    case "merge_objects":
    case "rename_object_property":
    case "get_object_property":
    case "get_object_keys":
    case "get_object_values":
    case "stringify_object":
    case "execute_object_script":
    case "check_object_key_exists":
    case "check_object_empty": {
      const validation = validateActionConfig({
        type: node.node_type as any,
        config: asRecord(node.config) as any,
      });
      if (validation) issues.push(error(node.id, null, validation.message));
      break;
    }
    case "transform_variable":
      if (!stringField(node.config, "source_name")) issues.push(error(node.id, null, sourceOutputRequired));
      if (!stringField(node.config, "target_name")) issues.push(error(node.id, null, "Target output is required"));
      break;
    case "assert_output":
      if (!stringField(node.config, "name")) issues.push(error(node.id, null, outputNameRequired));
      if (!stringField(node.config, "value")) issues.push(error(node.id, null, "Expected output value is required"));
      break;
    case "domain_allowlist":
      if (stringArrayOrNull(node.config, "domains") == null) {
        issues.push(error(node.id, null, "Allowed domains are required"));
      }
      break;
    default:
      return false;
  }
  return true;
}
