// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  validateActionConfig,
} from "../validation.js";

describe("backend action validation registry", () => {
  test("validates new update variable action configs", () => {
    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: {
          name: "my_number",
          operation: "increment",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_text_variable",
        config: {
          name: "my_text",
          operation: "append",
          value: "some text",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_flag_variable",
        config: {
          name: "my_flag",
          operation: "toggle",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "update_flag_variable",
        config: {
          name: "my_flag",
          operation: "toggle",
        },
      } as never),
    ).toBeNull();


    // update_number_variable
    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: { name: "", operation: "increment" },
      } as never),
    ).toEqual({ field: "name", message: "Variable name is required" });

    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: { name: "counter", operation: "invalid_op" },
      } as never),
    ).toEqual({ field: "operation", message: "Operation must be increment, decrement, add, subtract, multiply, or divide" });

    expect(
      validateActionConfig({
        type: "update_number_variable",
        config: { name: "counter", operation: "add", value: "" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    // update_text_variable
    expect(
      validateActionConfig({
        type: "update_text_variable",
        config: { name: "my_text", operation: "append", value: "" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    expect(
      validateActionConfig({
        type: "update_text_variable",
        config: { name: "my_text", operation: "replace", value: "new", search_pattern: "" },
      } as never),
    ).toEqual({ field: "search_pattern", message: "Search pattern is required" });

    // update_flag_variable
    expect(
      validateActionConfig({
        type: "update_flag_variable",
        config: { name: "my_flag", operation: "invalid" },
      } as never),
    ).toEqual({ field: "operation", message: "Operation must be toggle, set_true, or set_false" });

    // update_list_variable
    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "push", value: "", value_type: "text" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "push", value: "item", value_type: "invalid" },
      } as never),
    ).toEqual({ field: "value_type", message: "Value type must be text, json, number, or boolean" });

    expect(
      validateActionConfig({
        type: "update_list_variable",
        config: { name: "my_list", operation: "merge", value: "", value_type: "json" },
      } as never),
    ).toEqual({ field: "value", message: "Value is required" });


    // check_conditions
    expect(
      validateActionConfig({
        type: "check_conditions",
        config: { output_name: "", mode: "visual" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });

    expect(
      validateActionConfig({
        type: "check_conditions",
        config: { output_name: "is_valid", mode: "script", script: "" },
      } as any),
    ).toEqual({ field: "script", message: "JavaScript script is required in script mode" });

    expect(
      validateActionConfig({
        type: "check_conditions",
        config: { output_name: "is_valid", mode: "visual", rules_group: {} },
      } as any),
    ).toEqual({ field: "rules_group", message: "Invalid visual rules configuration" });

    // calculate_value
    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "", expression: "1 + 1" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });

    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "result", expression: "" },
      } as any),
    ).toEqual({ field: "expression", message: "Expression is required" });

    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "result", expression: "1 + 1", evaluation_type: "invalid" as any },
      } as any),
    ).toEqual({ field: "evaluation_type", message: "Evaluation type must be static or dynamic" });

    expect(
      validateActionConfig({
        type: "calculate_value",
        config: { output_name: "result", expression: "1 + 1", evaluation_type: "dynamic" },
      } as any),
    ).toBeNull();
  });
  test("validates new granular text processing action configs", () => {
    // set_text_variable
    expect(
      validateActionConfig({
        type: "set_text_variable",
        config: { output_name: "", value: "hello" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });
    expect(
      validateActionConfig({
        type: "set_text_variable",
        config: { output_name: "var", value: "hello" },
      } as any),
    ).toBeNull();

    // append_text
    expect(
      validateActionConfig({
        type: "append_text",
        config: { name: "", value: "suffix" },
      } as any),
    ).toEqual({ field: "name", message: "Variable name is required" });

    // prepend_text
    expect(
      validateActionConfig({
        type: "prepend_text",
        config: { name: "", value: "prefix" },
      } as any),
    ).toEqual({ field: "name", message: "Variable name is required" });

    // replace_text
    expect(
      validateActionConfig({
        type: "replace_text",
        config: { name: "", search_pattern: "abc", replacement: "xyz" },
      } as any),
    ).toEqual({ field: "name", message: "Variable name is required" });
    expect(
      validateActionConfig({
        type: "replace_text",
        config: { name: "var", search_pattern: "", replacement: "xyz" },
      } as any),
    ).toEqual({ field: "search_pattern", message: "Search pattern is required" });

    // trim_text
    expect(
      validateActionConfig({
        type: "trim_text",
        config: { name: "" },
      } as any),
    ).toEqual({ field: "name", message: "Variable name is required" });

    // change_text_case
    expect(
      validateActionConfig({
        type: "change_text_case",
        config: { name: "", to_case: "upper" },
      } as any),
    ).toEqual({ field: "name", message: "Variable name is required" });
    expect(
      validateActionConfig({
        type: "change_text_case",
        config: { name: "var", to_case: "invalid" as any },
      } as any),
    ).toEqual({ field: "to_case", message: "Invalid text case option" });

    // slice_text
    expect(
      validateActionConfig({
        type: "slice_text",
        config: { source: "", start: 0, output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source variable name is required" });
    expect(
      validateActionConfig({
        type: "slice_text",
        config: { source: "var", start: 0, output_name: "" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });

    // regex_extract
    expect(
      validateActionConfig({
        type: "regex_extract",
        config: { source: "", pattern: "\\d+", group_index: 1, output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source variable name is required" });
    expect(
      validateActionConfig({
        type: "regex_extract",
        config: { source: "var", pattern: "", group_index: 1, output_name: "out" },
      } as any),
    ).toEqual({ field: "pattern", message: "Regex pattern is required" });

    // get_text_length
    expect(
      validateActionConfig({
        type: "get_text_length",
        config: { source: "", output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source variable name is required" });

    // check_text_empty
    expect(
      validateActionConfig({
        type: "check_text_empty",
        config: { source: "", output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source variable name is required" });

    // check_text_contains
    expect(
      validateActionConfig({
        type: "check_text_contains",
        config: { source: "", substring: "sub", output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source variable name is required" });
    expect(
      validateActionConfig({
        type: "check_text_contains",
        config: { source: "var", substring: "", output_name: "out" },
      } as any),
    ).toEqual({ field: "substring", message: "Substring is required" });

    // check_text_regex_matches
    expect(
      validateActionConfig({
        type: "check_text_regex_matches",
        config: { source: "", pattern: "\\d+", output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source variable name is required" });
    expect(
      validateActionConfig({
        type: "check_text_regex_matches",
        config: { source: "var", pattern: "", output_name: "out" },
      } as any),
    ).toEqual({ field: "pattern", message: "Regex pattern is required" });
  });
  test("validates new granular boolean processing action configs", () => {
    // set_boolean_variable
    expect(
      validateActionConfig({
        type: "set_boolean_variable",
        config: { output_name: "", value: "true" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });
    expect(
      validateActionConfig({
        type: "set_boolean_variable",
        config: { output_name: "var", value: "true" },
      } as any),
    ).toBeNull();

    // generate_random_boolean
    expect(
      validateActionConfig({
        type: "generate_random_boolean",
        config: { output_name: "" },
      } as any),
    ).toEqual({ field: "output_name", message: "Output variable name is required" });

    // parse_to_boolean
    expect(
      validateActionConfig({
        type: "parse_to_boolean",
        config: { source: "", output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source is required" });

    // boolean_logical_op
    expect(
      validateActionConfig({
        type: "boolean_logical_op",
        config: { operand1: "", operation: "and", output_name: "out" },
      } as any),
    ).toEqual({ field: "operand1", message: "Operand 1 is required" });
    expect(
      validateActionConfig({
        type: "boolean_logical_op",
        config: { operand1: "a", operation: "invalid" as any, output_name: "out" },
      } as any),
    ).toEqual({ field: "operation", message: "Invalid logic operation option" });

    // compare_booleans
    expect(
      validateActionConfig({
        type: "compare_booleans",
        config: { operand1: "", operator: "eq", operand2: "b", output_name: "out" },
      } as any),
    ).toEqual({ field: "operand1", message: "Operand 1 is required" });

    // check_boolean_property
    expect(
      validateActionConfig({
        type: "check_boolean_property",
        config: { source: "", property: "is_true", output_name: "out" },
      } as any),
    ).toEqual({ field: "source", message: "Source is required" });
  });
});
