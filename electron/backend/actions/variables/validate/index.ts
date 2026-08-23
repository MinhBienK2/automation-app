import { createCoreVariablesValidators } from "./core.js";
import { createNumberVariablesValidators } from "./number.js";
import { createTextVariablesValidators } from "./text.js";
import { createBooleanVariablesValidators } from "./boolean.js";
import { createListVariablesValidators } from "./list.js";
import { createObjectVariablesValidators } from "./object.js";

import type { ActionValidatorMap } from "../../validation.js";

export type VariablesValidators = Pick<
  ActionValidatorMap,
  "set_variable" | "set_json_variables" | "transform_variable" | "check_conditions" |
  "calculate_value" | "update_number_variable" | "set_number_variable" | "generate_random_number" |
  "parse_text_to_number" | "math_operation" | "round_number" | "format_number" |
  "compare_numbers" | "check_number_range" | "check_number_property" | "update_text_variable" |
  "set_text_variable" | "append_text" | "prepend_text" | "replace_text" |
  "trim_text" | "change_text_case" | "slice_text" | "regex_extract" |
  "get_text_length" | "check_text_empty" | "check_text_contains" | "check_text_regex_matches" |
  "update_flag_variable" | "set_boolean_variable" | "generate_random_boolean" | "parse_to_boolean" |
  "boolean_logical_op" | "compare_booleans" | "check_boolean_property" | "update_list_variable" |
  "create_empty_list" | "create_list_manual" | "split_text_to_list" | "generate_number_range" |
  "add_to_list" | "remove_from_list_by_index" | "remove_from_list_by_value" | "merge_lists" |
  "get_list_item" | "get_list_length" | "slice_list" | "join_list" |
  "filter_list" | "map_list_property" | "sort_reverse_list" | "execute_list_script" |
  "check_list_empty" | "check_list_contains" | "check_list_any_match" | "check_list_all_match" |
  "create_empty_object" | "create_object_manual" | "parse_json_to_object" | "set_object_property" |
  "remove_object_property" | "merge_objects" | "rename_object_property" | "get_object_property" |
  "get_object_keys" | "get_object_values" | "stringify_object" | "execute_object_script" |
  "check_object_key_exists" | "check_object_empty"
>;

export function createVariablesValidators(): VariablesValidators {
  return {
    ...createCoreVariablesValidators(),
    ...createNumberVariablesValidators(),
    ...createTextVariablesValidators(),
    ...createBooleanVariablesValidators(),
    ...createListVariablesValidators(),
    ...createObjectVariablesValidators(),
  };
}
