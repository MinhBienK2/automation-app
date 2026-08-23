import { validationError } from "../../shared/records.js";
import {
  firstValidation,
  requiredActionString,
  positiveValue,
  optionalNonNegative,
  validateRequiredEnumValue,
  validateStringList,
  validateConditionConfig,
  validateNestedActionArray,
  validateSwitchCases,
  validateRouterConditionCases,
  validateRandomChoiceCases,
  validateLoopLimit,
} from "../validation.js";
import {
  outputNameRequired,
} from "../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../validation.js";

export type FlowControlValidators = Pick<
  ActionValidatorMap,
  "graph_noop" | "if_condition" | "router_condition" | "random_choice" |
  "repeat_times" | "repeat_for_each" | "retry_block" | "switch_condition" |
  "while_loop" | "repeat_until" | "try_catch" | "fallback_block" |
  "break_loop" | "continue_loop" | "stop_workflow" | "quarantined" |
  "assert_output"
>;

export function createFlowControlValidators(): FlowControlValidators {
  return {
    graph_noop: (config) =>
      config.config.kind === "merge"
        ? null
        : validationError("kind", "Graph no-op kind is invalid"),
    if_condition: (config) =>
      firstValidation(
        validateConditionConfig(config.config.condition),
        validateNestedActionArray(config.config.then_steps, "then_steps"),
        validateNestedActionArray(config.config.else_steps, "else_steps"),
      ),
    router_condition: (config) =>
      firstValidation(
        validateRequiredEnumValue(
          config.config.mode,
          ["first_match"],
          "mode",
          "Router mode must be first_match",
        ),
        validateRouterConditionCases(config.config.cases),
        validateNestedActionArray(config.config.default_steps, "default_steps"),
      ),
    random_choice: (config) => validateRandomChoiceCases(config.config.choices),
    repeat_times: (config) =>
      firstValidation(
        positiveValue(config.config.times, "times", "Repeat times must be greater than 0"),
        validateNestedActionArray(config.config.steps, "steps"),
      ),
    repeat_for_each: (config) =>
      firstValidation(
        requiredActionString(config.config.item_name, "item_name", "Item name is required"),
        config.config.array_variable
          ? null
          : validateStringList(config.config.items, "items", "Items are required"),
        validateNestedActionArray(config.config.steps, "steps"),
      ),
    retry_block: (config) =>
      firstValidation(
        positiveValue(config.config.max_attempts, "max_attempts", "Max attempts must be greater than 0"),
        optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
        validateNestedActionArray(config.config.steps, "steps"),
        validateNestedActionArray(config.config.failed_steps ?? [], "failed_steps"),
      ),
    switch_condition: (config) =>
      firstValidation(
        requiredActionString(config.config.expression, "expression", "Switch expression is required"),
        validateSwitchCases(config.config.cases),
        validateNestedActionArray(config.config.default_steps, "default_steps"),
      ),
    while_loop: (config) =>
      firstValidation(
        validateConditionConfig(config.config.condition),
        validateLoopLimit(config.config),
        validateNestedActionArray(config.config.steps, "steps"),
      ),
    repeat_until: (config) =>
      firstValidation(
        validateConditionConfig(config.config.condition),
        validateLoopLimit(config.config),
        validateNestedActionArray(config.config.steps, "steps"),
        validateNestedActionArray(config.config.timeout_steps, "timeout_steps"),
      ),
    try_catch: (config) =>
      firstValidation(
        validateNestedActionArray(config.config.try_steps, "try_steps"),
        validateNestedActionArray(config.config.success_steps, "success_steps"),
        validateNestedActionArray(config.config.error_steps, "error_steps"),
        validateNestedActionArray(config.config.finally_steps, "finally_steps"),
      ),
    fallback_block: (config) =>
      firstValidation(
        validateNestedActionArray(config.config.primary_steps, "primary_steps"),
        validateNestedActionArray(config.config.fallback_steps, "fallback_steps"),
      ),
    break_loop: () => null,
    continue_loop: () => null,
    stop_workflow: (config) =>
      ["success", "failure"].includes(config.config.status)
        ? null
        : validationError("status", "Stop workflow status must be success or failure"),
    quarantined: () => null,
    assert_output: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", outputNameRequired),
        validateRequiredEnumValue(
          config.config.match_mode,
          ["contains", "equals"],
          "match_mode",
          "Match mode must be contains or equals",
        ),
        requiredActionString(config.config.value, "value", "Expected output value is required"),
      ),
  };
}
