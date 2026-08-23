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

export type NumberVariablesValidators = Pick<
  ActionValidatorMap,
  "update_number_variable" | "set_number_variable" | "generate_random_number" | "parse_text_to_number" |
  "math_operation" | "round_number" | "format_number" | "compare_numbers" |
  "check_number_range" | "check_number_property"
>;

export function createNumberVariablesValidators(): NumberVariablesValidators {
  return {
    update_number_variable: (config) => {
      const operation = config.config.operation;
      const needsValue = ["add", "subtract", "multiply", "divide"].includes(operation);
      return firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        validateRequiredEnumValue(
          operation,
          ["increment", "decrement", "add", "subtract", "multiply", "divide"],
          "operation",
          "Operation must be increment, decrement, add, subtract, multiply, or divide",
        ),
        needsValue
          ? requiredActionString(config.config.value, "value", "Value is required")
          : null,
      );
    },
    set_number_variable: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        requiredActionString(config.config.value, "value", "Value is required"),
      ),
    generate_random_number: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        requiredActionString(config.config.min, "min", "Minimum value is required"),
        requiredActionString(config.config.max, "max", "Maximum value is required"),
      ),
    parse_text_to_number: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", "Source text is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    math_operation: (config) => {
      const operation = config.config.operation;
      const needsOperand2 = !["abs", "sqrt"].includes(operation);
      return firstValidation(
        requiredActionString(config.config.operand1, "operand1", "First operand is required"),
        validateRequiredEnumValue(
          operation,
          ["add", "subtract", "multiply", "divide", "modulo", "power", "abs", "sqrt", "min", "max"],
          "operation",
          "Operation is invalid",
        ),
        needsOperand2
          ? requiredActionString(config.config.operand2, "operand2", "Second operand is required")
          : null,
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      );
    },
    round_number: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", "Source number is required"),
        validateRequiredEnumValue(
          config.config.mode,
          ["round", "floor", "ceil"],
          "mode",
          "Rounding mode must be round, floor, or ceil",
        ),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    format_number: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", "Source number is required"),
        validateRequiredEnumValue(
          config.config.format,
          ["decimal", "currency", "percent"],
          "format",
          "Format must be decimal, currency, or percent",
        ),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    compare_numbers: (config) =>
      firstValidation(
        requiredActionString(config.config.operand1, "operand1", "First operand is required"),
        validateRequiredEnumValue(
          config.config.operator,
          ["gt", "gte", "lt", "lte", "eq", "neq"],
          "operator",
          "Operator is invalid",
        ),
        requiredActionString(config.config.operand2, "operand2", "Second operand is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_number_range: (config) =>
      firstValidation(
        requiredActionString(config.config.value, "value", "Value to check is required"),
        requiredActionString(config.config.min, "min", "Minimum bound is required"),
        requiredActionString(config.config.max, "max", "Maximum bound is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_number_property: (config) =>
      firstValidation(
        requiredActionString(config.config.value, "value", "Value to check is required"),
        validateRequiredEnumValue(
          config.config.property,
          ["even", "odd", "integer", "positive", "negative"],
          "property",
          "Property is invalid",
        ),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
  };
}
