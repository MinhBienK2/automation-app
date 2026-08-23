import {
  firstValidation,
  requiredActionString,
  validateRequiredEnumValue,
} from "../../validation.js";
import {
  outputVariableNameRequired,
  regexPatternRequired,
  sourceVariableNameRequired,
  variableNameRequired,
} from "../../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../../validation.js";

export type TextVariablesValidators = Pick<
  ActionValidatorMap,
  "update_text_variable" | "set_text_variable" | "append_text" | "prepend_text" |
  "replace_text" | "trim_text" | "change_text_case" | "slice_text" |
  "regex_extract" | "get_text_length" | "check_text_empty" | "check_text_contains" |
  "check_text_regex_matches"
>;

export function createTextVariablesValidators(): TextVariablesValidators {
  return {
    update_text_variable: (config) => {
      const operation = config.config.operation;
      const needsValue = ["append", "prepend", "replace"].includes(operation);
      const needsSearch = operation === "replace";
      return firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          operation,
          ["append", "prepend", "replace", "uppercase", "lowercase", "trim"],
          "operation",
          "Operation must be append, prepend, replace, uppercase, lowercase, or trim",
        ),
        needsValue
          ? requiredActionString(config.config.value, "value", "Value is required")
          : null,
        needsSearch
          ? requiredActionString(config.config.search_pattern, "search_pattern", "Search pattern is required")
          : null,
      );
    },
    set_text_variable: (config) =>
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    append_text: (config) =>
      requiredActionString(config.config.name, "name", variableNameRequired),
    prepend_text: (config) =>
      requiredActionString(config.config.name, "name", variableNameRequired),
    replace_text: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(config.config.search_pattern, "search_pattern", "Search pattern is required"),
      ),
    trim_text: (config) =>
      requiredActionString(config.config.name, "name", variableNameRequired),
    change_text_case: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          config.config.to_case,
          ["upper", "lower"],
          "to_case",
          "Invalid text case option",
        ),
      ),
    slice_text: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    regex_extract: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.pattern, "pattern", regexPatternRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    get_text_length: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_text_empty: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_text_contains: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.substring, "substring", "Substring is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_text_regex_matches: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.pattern, "pattern", regexPatternRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
  };
}
