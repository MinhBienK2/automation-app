import { validationError } from "../../../shared/records.js";
import {
  firstValidation,
  requiredActionString,
  validateRequiredEnumValue,
} from "../../validation.js";
import {
  outputVariableNameRequired,
  propertyKeyRequired,
  sourceListVariableNameRequired,
  valueTypeMustBeVariableValueType,
  variableNameRequired,
} from "../../../shared/validationMessages.js";
import { listVariableOperations } from "../../../../../src/types/actionEnums.js";

import type { ActionValidatorMap } from "../../validation.js";

export type ListVariablesValidators = Pick<
  ActionValidatorMap,
  "update_list_variable" | "create_empty_list" | "create_list_manual" | "split_text_to_list" |
  "generate_number_range" | "add_to_list" | "remove_from_list_by_index" | "remove_from_list_by_value" |
  "merge_lists" | "get_list_item" | "get_list_length" | "slice_list" |
  "join_list" | "filter_list" | "map_list_property" | "sort_reverse_list" |
  "execute_list_script" | "check_list_empty" | "check_list_contains" | "check_list_any_match" |
  "check_list_all_match"
>;

export function createListVariablesValidators(): ListVariablesValidators {
  return {
    update_list_variable: (config) => {
      const operation = config.config.operation;
      const needsValue = ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(operation);
      const needsValueType = ["push", "unshift", "push_unique", "merge", "merge_unique"].includes(operation);
      const needsIndex = operation === "remove_by_index";
      return firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          operation,
          listVariableOperations,
          "operation",
          `Operation must be ${listVariableOperations.slice(0, -1).join(", ")}, or ${listVariableOperations.at(-1)}`,
        ),
        needsValue
          ? requiredActionString(config.config.value, "value", "Value is required")
          : null,
        needsValueType
          ? validateRequiredEnumValue(
              config.config.value_type,
              ["text", "json", "number", "boolean"],
              "value_type",
              valueTypeMustBeVariableValueType,
            )
          : null,
        needsIndex
          ? (config.config.index === null || config.config.index === undefined || String(config.config.index).trim() === ""
              ? validationError("index", "Index is required")
              : null)
          : null,
      );
    },
    create_empty_list: (config) =>
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    create_list_manual: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        validateRequiredEnumValue(
          config.config.value_type,
          ["text", "json", "number", "boolean"],
          "value_type",
          valueTypeMustBeVariableValueType,
        ),
      ),
    split_text_to_list: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        requiredActionString(config.config.source_text, "source_text", "Source text is required"),
        requiredActionString(config.config.delimiter, "delimiter", "Delimiter is required"),
      ),
    generate_number_range: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        requiredActionString(String(config.config.start ?? ""), "start", "Start value is required"),
        requiredActionString(String(config.config.end ?? ""), "end", "End value is required"),
      ),
    add_to_list: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          config.config.position,
          ["end", "start", "unique_end"],
          "position",
          "Position must be end, start, or unique_end",
        ),
        validateRequiredEnumValue(
          config.config.value_type,
          ["text", "json", "number", "boolean"],
          "value_type",
          valueTypeMustBeVariableValueType,
        ),
        requiredActionString(config.config.value, "value", "Value is required"),
      ),
    remove_from_list_by_index: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(String(config.config.index ?? ""), "index", "Index is required"),
      ),
    remove_from_list_by_value: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          config.config.value_type,
          ["text", "json", "number", "boolean"],
          "value_type",
          valueTypeMustBeVariableValueType,
        ),
        requiredActionString(config.config.value, "value", "Value is required"),
      ),
    merge_lists: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(config.config.value, "value", "Value is required"),
      ),
    get_list_item: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        validateRequiredEnumValue(
          config.config.position,
          ["first", "last", "index"],
          "position",
          "Position must be first, last, or index",
        ),
        config.config.position === "index"
          ? requiredActionString(String(config.config.index ?? ""), "index", "Index is required")
          : null,
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    get_list_length: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    slice_list: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(String(config.config.start ?? ""), "start", "Start index is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    join_list: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.separator, "separator", "Separator is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    filter_list: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    map_list_property: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.property_key, "property_key", propertyKeyRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    sort_reverse_list: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        validateRequiredEnumValue(
          config.config.action,
          ["sort_asc", "sort_desc", "reverse"],
          "action",
          "Action must be sort_asc, sort_desc, or reverse",
        ),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    execute_list_script: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.script, "script", "Script code is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_list_empty: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_list_contains: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        validateRequiredEnumValue(
          config.config.value_type,
          ["text", "json", "number", "boolean"],
          "value_type",
          valueTypeMustBeVariableValueType,
        ),
        requiredActionString(config.config.value, "value", "Value to check is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_list_any_match: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_list_all_match: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
  };
}
