import type {
  ActionConfig,
  ActionType,
  DesktopStepTargetConfig,
} from "../../../types/workflow";

export function defaultVariableActionConfig(actionType: ActionType): ActionConfig | null {
  switch (actionType) {
    case "set_variable":
      return {
        type: actionType,
        config: { variables: [{ name: "name", value_type: "text", value: "" }] },
      };
    case "set_json_variables":
      return { type: actionType, config: { json: "{\n  \"name\": \"value\"\n}" } };
    case "check_conditions":
      return {
        type: actionType,
        config: {
          output_name: "is_valid",
          mode: "visual",
          script: "",
          rules_group: {
            operator: "and",
            rules: [],
          },
          evaluation_type: "static",
        },
      };
    case "calculate_value":
      return {
        type: actionType,
        config: {
          output_name: "result",
          expression: "",
          evaluation_type: "static",
        },
      };
    case "update_number_variable":
      return {
        type: actionType,
        config: { name: "", operation: "increment", value: "" },
      };
    case "set_number_variable":
      return {
        type: actionType,
        config: { output_name: "my_number", value: "0" },
      };
    case "generate_random_number":
      return {
        type: actionType,
        config: { output_name: "random_number", min: "1", max: "100", integer: true },
      };
    case "parse_text_to_number":
      return {
        type: actionType,
        config: { source: "", fallback: "0", output_name: "parsed_number" },
      };
    case "math_operation":
      return {
        type: actionType,
        config: { operand1: "", operation: "add", operand2: "1", output_name: "math_result" },
      };
    case "round_number":
      return {
        type: actionType,
        config: { source: "", mode: "round", decimals: "0", output_name: "rounded_number" },
      };
    case "format_number":
      return {
        type: actionType,
        config: { source: "", format: "decimal", decimals: "2", currency_code: "USD", locale: "en-US", output_name: "formatted_number" },
      };
    case "compare_numbers":
      return {
        type: actionType,
        config: { operand1: "", operator: "gt", operand2: "", output_name: "is_greater" },
      };
    case "check_number_range":
      return {
        type: actionType,
        config: { value: "", min: "0", max: "100", inclusive: true, output_name: "is_in_range" },
      };
    case "check_number_property":
      return {
        type: actionType,
        config: { value: "", property: "even", output_name: "is_even" },
      };
    case "update_text_variable":
      return {
        type: actionType,
        config: { name: "", operation: "append", value: "", search_pattern: "" },
      };
    case "set_text_variable":
      return {
        type: actionType,
        config: { output_name: "my_text", value: "" },
      };
    case "append_text":
      return {
        type: actionType,
        config: { name: "", value: "" },
      };
    case "prepend_text":
      return {
        type: actionType,
        config: { name: "", value: "" },
      };
    case "replace_text":
      return {
        type: actionType,
        config: { name: "", search_pattern: "", replacement: "" },
      };
    case "trim_text":
      return {
        type: actionType,
        config: { name: "" },
      };
    case "change_text_case":
      return {
        type: actionType,
        config: { name: "", to_case: "upper" },
      };
    case "slice_text":
      return {
        type: actionType,
        config: { source: "", start: 0, end: null, output_name: "sliced_text" },
      };
    case "regex_extract":
      return {
        type: actionType,
        config: { source: "", pattern: "", group_index: 1, output_name: "extracted_text" },
      };
    case "get_text_length":
      return {
        type: actionType,
        config: { source: "", output_name: "text_length" },
      };
    case "check_text_empty":
      return {
        type: actionType,
        config: { source: "", output_name: "is_empty" },
      };
    case "check_text_contains":
      return {
        type: actionType,
        config: { source: "", substring: "", output_name: "contains_text" },
      };
    case "check_text_regex_matches":
      return {
        type: actionType,
        config: { source: "", pattern: "", output_name: "matches_regex" },
      };
    case "update_flag_variable":
      return {
        type: actionType,
        config: { name: "", operation: "toggle" },
      };
    case "set_boolean_variable":
      return {
        type: actionType,
        config: { output_name: "bool_var", value: "true" },
      };
    case "generate_random_boolean":
      return {
        type: actionType,
        config: { output_name: "random_bool", probability: 0.5 },
      };
    case "parse_to_boolean":
      return {
        type: actionType,
        config: { source: "", fallback: "false", output_name: "parsed_bool" },
      };
    case "boolean_logical_op":
      return {
        type: actionType,
        config: { operand1: "", operation: "and", operand2: "", output_name: "logic_result" },
      };
    case "compare_booleans":
      return {
        type: actionType,
        config: { operand1: "", operator: "eq", operand2: "", output_name: "compare_result" },
      };
    case "check_boolean_property":
      return {
        type: actionType,
        config: { source: "", property: "is_true", output_name: "property_result" },
      };
    default:
      return null;
  }
}
