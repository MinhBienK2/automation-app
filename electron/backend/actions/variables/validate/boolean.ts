import {
  firstValidation,
  requiredActionString,
  validateRequiredEnumValue,
} from "../../validation.js";
import {
  outputVariableNameRequired,
  variableNameRequired,
} from "../../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../../validation.js";

export type BooleanVariablesValidators = Pick<
  ActionValidatorMap,
  "update_flag_variable" | "set_boolean_variable" | "generate_random_boolean" | "parse_to_boolean" |
  "boolean_logical_op" | "compare_booleans" | "check_boolean_property"
>;

export function createBooleanVariablesValidators(): BooleanVariablesValidators {
  return {
    update_flag_variable: (config) => {
      return firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          config.config.operation,
          ["toggle", "set_true", "set_false"],
          "operation",
          "Operation must be toggle, set_true, or set_false",
        ),
      );
    },
    set_boolean_variable: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        requiredActionString(config.config.value, "value", "Value is required"),
      ),
    generate_random_boolean: (config) =>
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    parse_to_boolean: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", "Source is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    boolean_logical_op: (config) => {
      const operation = config.config.operation;
      const needsOperand2 = ["and", "or", "xor"].includes(operation);
      return firstValidation(
        requiredActionString(config.config.operand1, "operand1", "Operand 1 is required"),
        validateRequiredEnumValue(
          operation,
          ["and", "or", "not", "xor"],
          "operation",
          "Invalid logic operation option",
        ),
        needsOperand2
          ? requiredActionString(config.config.operand2, "operand2", "Operand 2 is required")
          : null,
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      );
    },
    compare_booleans: (config) =>
      firstValidation(
        requiredActionString(config.config.operand1, "operand1", "Operand 1 is required"),
        validateRequiredEnumValue(
          config.config.operator,
          ["eq", "neq"],
          "operator",
          "Operator is invalid",
        ),
        requiredActionString(config.config.operand2, "operand2", "Operand 2 is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_boolean_property: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", "Source is required"),
        validateRequiredEnumValue(
          config.config.property,
          ["is_true", "is_false"],
          "property",
          "Property is invalid",
        ),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
  };
}
