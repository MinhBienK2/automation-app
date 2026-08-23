import {
  outputNameRequired,
} from "../shared/validationMessages.js";
import type {
  ActionConfig,
  WorkflowCondition,
} from "../../../src/types/workflow.js";
import {
  actionDefinitions,
  getActionDefinition,
  unsupportedActionTypeMessage,
  type ActionType,
} from "./registry.js";
import {
  asRecord,
  stringField,
  validationError,
} from "../shared/records.js";
import { createNavigationValidators } from "./navigation/validate.js";
import { createInteractionValidators } from "./interaction/validate.js";
import { createExtractionValidators } from "./extraction/validate.js";
import { createVariablesValidators } from "./variables/validate/index.js";
import { createFlowControlValidators } from "./flow-control/validate.js";
import { createEnvironmentValidators } from "./environment/validate.js";
import { createFilesValidators } from "./files/validate.js";
import { validateWorkflowCondition } from "./validateKit.js";

export type ActionValidationError = {
  field: string;
  message: string;
};

export type ActionValidator<T extends ActionConfig = ActionConfig> = (
  config: T,
) => ActionValidationError | null;

export type ActionValidatorMap = {
  [Type in ActionType]: ActionValidator<Extract<ActionConfig, { type: Type }>>;
};

const actionValidators = createActionValidatorMap({
  ...createNavigationValidators(),
  ...createInteractionValidators(),
  ...createExtractionValidators(),
  ...createVariablesValidators(),
  ...createFlowControlValidators(),
  ...createEnvironmentValidators(),
  ...createFilesValidators(),
});

/**
 * The authority on whether an Action Config is complete enough to run.
 *
 * This is one of two tiers of the same interface. `parseActionConfigShape` in
 * `./schemas/index.js` answers the narrower question "can this persisted JSON be
 * read as an Action Config of its declared type?", which the graph load path
 * uses to decide what to quarantine. This function answers "is it runnable?",
 * which is what the authoring path and the compile path enforce.
 *
 * The two are asymmetric by design: this tier is strictly stricter. A freshly
 * dropped `click` node has an empty element target, so the load path must accept
 * it while this tier reports it. `actionConfigTiers.test.ts` pins that
 * relationship so it stays deliberate.
 */
export function validateActionConfig(config: ActionConfig): ActionValidationError | null {
  const definition = getActionDefinition((config as { type?: unknown }).type);
  if (!definition) {
    return validationError(
      "type",
      unsupportedActionTypeMessage((config as { type?: unknown }).type),
    );
  }
  const validator = actionValidators[definition.type] as ActionValidator | undefined;
  if (!validator) {
    return validationError(
      "type",
      `Action ${definition.type} is registered without a validation handler`,
    );
  }
  return validator(config);
}

/**
 * The single module-load coverage assertion over the action registry.
 *
 * Every registered action type needs both tiers: a shape schema (absent only for
 * `quarantined`, which has no authorable config) and a completeness validator.
 * Previously these were two separate assertions in two modules, one of which
 * only ran under test. Adding an action type and forgetting either half now
 * fails at import time with the missing type named.
 */
export function assertActionRegistryCoverage(
  validators: Partial<Record<ActionType, unknown>> = actionValidators,
): asserts validators is ActionValidatorMap {
  for (const definition of actionDefinitions) {
    if (typeof validators[definition.type] !== "function") {
      throw new Error(`Action ${definition.type} is registered without a validation handler`);
    }
    if (definition.type !== "quarantined" && !definition.configSchema) {
      throw new Error(
        `Action type "${definition.type}" is registered without a Zod schema. ` +
          `Add a schema in electron/backend/actions/schemas/ and register it in index.ts.`,
      );
    }
  }
}

assertActionRegistryCoverage();

function createActionValidatorMap(validators: ActionValidatorMap): ActionValidatorMap {
  return validators;
}

export function firstValidation(...validations: Array<ActionValidationError | null | undefined>) {
  return validations.find((validation): validation is ActionValidationError => Boolean(validation)) ?? null;
}

export function requiredActionString(
  value: string | null | undefined,
  field: string,
  message: string,
) {
  return typeof value === "string" && value.trim()
    ? null
    : validationError(field, message);
}

export function isTemplateVariable(value: unknown): boolean {
  return typeof value === "string" && /^\{\{\s*[^}]+?\s*\}\}$/.test(value.trim());
}

export function positiveValue(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value > 0)
    ? null
    : validationError(field, message);
}

export function optionalPositive(value: any, field: string, message: string) {
  return value == null || isTemplateVariable(value) ? null : positiveValue(value, field, message);
}

export function optionalNonNegative(value: any, field: string, message: string) {
  return value == null || isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0)
    ? null
    : validationError(field, message);
}

export function finiteValue(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value))
    ? null
    : validationError(field, message);
}

export function percentValue(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)
    ? null
    : validationError(field, message);
}

export function zeroOrPositiveInteger(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? null
    : validationError(field, message);
}

export function validateElementTarget(
  config: unknown,
  options: {
    xpathField?: string;
    targetField?: string;
    message?: string;
  } = {},
) {
  const xpathField = options.xpathField ?? "xpath";
  return hasElementTargetField(config, xpathField, options.targetField ?? "target")
    ? null
    : validationError(xpathField, options.message ?? "Element target is required");
}

export function validateElementTargetSource(
  config: unknown,
  options: {
    xpathField?: string;
    targetField?: string;
    refField?: string;
    message?: string;
    refMessage?: string;
  } = {},
) {
  const refField = options.refField ?? "target_ref";
  if (hasConfiguredField(config, refField)) {
    return requiredActionString(
      asRecord(config)[refField] as string | null | undefined,
      refField,
      options.refMessage ?? "Target ref is required",
    );
  }
  return validateElementTarget(config, options);
}

export function validateElementActionTiming(config: unknown) {
  const record = asRecord(config);
  return firstValidation(
    validateOptionalEnumValue(
      record.wait_until,
      ["attached", "visible", "enabled", "clickable"],
      "wait_until",
      "Wait until must be attached, visible, enabled, or clickable",
    ),
    optionalPositive(record.timeout_ms as number | null | undefined, "timeout_ms", "Timeout must be greater than 0"),
  );
}

export function validateDragTargetPosition(value: unknown) {
  if (value == null) return null;
  const position = asRecord(value);
  const modeValidation = validateRequiredEnumValue(
    position.mode,
    ["center", "percent", "offset"],
    "target_position.mode",
    "Target position mode must be center, percent, or offset",
  );
  if (modeValidation) return modeValidation;

  if (position.mode === "center") return null;

  if (position.mode === "percent") {
    return firstValidation(
      percentValue(
        position.x_percent,
        "target_position.x_percent",
        "Target X percent must be between 0 and 100",
      ),
      percentValue(
        position.y_percent,
        "target_position.y_percent",
        "Target Y percent must be between 0 and 100",
      ),
    );
  }

  return firstValidation(
    finiteValue(
      position.x_px,
      "target_position.x_px",
      "Target X offset must be a finite number",
    ),
    finiteValue(
      position.y_px,
      "target_position.y_px",
      "Target Y offset must be a finite number",
    ),
  );
}

export function validateOptionalEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  field: string,
  message: string,
) {
  return value == null || (typeof value === "string" && allowedValues.includes(value))
    ? null
    : validationError(field, message);
}

export function validateRequiredEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  field: string,
  message: string,
) {
  return typeof value === "string" && allowedValues.includes(value)
    ? null
    : validationError(field, message);
}

export function validateDataCaptureConfig(config: {
  xpath?: string | null;
  target?: unknown;
  target_ref?: string | null;
  output_name: string;
  timeout_ms?: number | null;
  separator?: string | null;
  join_list?: boolean | null;
  join_separator?: string | null;
}) {
  return firstValidation(
    validateElementTargetSource(config),
    requiredActionString(config.output_name, "output_name", outputNameRequired),
    optionalPositive(config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
  );
}

export function validateStringList(value: unknown, field: string, message: string) {
  return Array.isArray(value) &&
    value.some((item) => typeof item === "string" && item.trim())
    ? null
    : validationError(field, message);
}

export function validateHeaderPairs(headers: unknown) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return validationError("headers", "Header name is required");
  }
  for (const header of headers) {
    if (!stringField(header, "name")) {
      return validationError("headers", "Header name is required");
    }
  }
  return null;
}

export function validateConditionConfig(condition: unknown, field = "condition") {
  if (!condition || typeof condition !== "object") {
    return validationError(field, "Condition is required");
  }
  try {
    validateWorkflowCondition(condition as WorkflowCondition);
    return null;
  } catch (caught) {
    const serialized = serializeValidationError(caught);
    return validationError(`${field}.${serialized.field}`, serialized.message);
  }
}

export function validateNestedActionArray(steps: unknown, field: string): ActionValidationError | null {
  if (!Array.isArray(steps)) {
    return validationError(field, "Nested steps must be an array");
  }
  for (let index = 0; index < steps.length; index += 1) {
    const validation = validateNestedActionValue(steps[index], `${field}[${index}]`);
    if (validation) return validation;
  }
  return null;
}

function validateNestedActionValue(stepValue: unknown, field: string): ActionValidationError | null {
  if (!isActionConfig(stepValue)) {
    return validationError(field, "Nested step must be an action config");
  }
  const validation = validateActionConfig(stepValue);
  return validation
    ? validationError(`${field}.${validation.field}`, validation.message)
    : null;
}

export function validateSwitchCases(cases: unknown) {
  if (!Array.isArray(cases)) {
    return validationError("cases", "Switch cases must be an array");
  }
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    if (!stringField(caseValue, "value")) {
      return validationError(`cases[${index}].value`, "Switch case value is required");
    }
    const validation = validateNestedActionArray(caseValue.steps, `cases[${index}].steps`);
    if (validation) return validation;
  }
  return null;
}

export function validateRouterConditionCases(cases: unknown) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return validationError("cases", "Router cases are required");
  }
  const seenIds = new Set<string>();
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    const id = stringField(caseValue, "id");
    if (!id) return validationError(`cases[${index}].id`, "Router case id is required");
    if (seenIds.has(id)) return validationError("cases", "Router case ids must be unique");
    seenIds.add(id);
    if (!stringField(caseValue, "label")) {
      return validationError(`cases[${index}].label`, "Router case labels are required");
    }
    const conditionValidation = validateConditionConfig(
      caseValue.condition,
      `cases[${index}].condition`,
    );
    if (conditionValidation) return conditionValidation;
    const stepsValidation = validateNestedActionArray(caseValue.steps, `cases[${index}].steps`);
    if (stepsValidation) return stepsValidation;
  }
  return null;
}

export function validateRandomChoiceCases(cases: unknown) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return validationError("choices", "Random choices are required");
  }
  const seenIds = new Set<string>();
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    const id = stringField(caseValue, "id");
    if (!id) return validationError(`choices[${index}].id`, "Random choice id is required");
    if (seenIds.has(id)) return validationError("choices", "Random choice ids must be unique");
    seenIds.add(id);
    if (!stringField(caseValue, "label")) {
      return validationError(`choices[${index}].label`, "Random choice labels are required");
    }
    const weight = caseValue.weight;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      return validationError(`choices[${index}].weight`, "Random choice weight must be greater than 0");
    }
    const stepsValidation = validateNestedActionArray(caseValue.steps, `choices[${index}].steps`);
    if (stepsValidation) return stepsValidation;
  }
  return null;
}

export function validateLoopLimit(config: { max_attempts?: number | null; timeout_ms?: number | null }) {
  const maxAttemptsValidation = optionalPositive(
    config.max_attempts,
    "max_attempts",
    "Max attempts must be greater than 0",
  );
  if (maxAttemptsValidation) return maxAttemptsValidation;
  const timeoutValidation = optionalPositive(
    config.timeout_ms,
    "timeout_ms",
    "Timeout must be greater than 0",
  );
  if (timeoutValidation) return timeoutValidation;
  return config.max_attempts == null && config.timeout_ms == null
    ? validationError("max_attempts", "Loop actions require max attempts or timeout")
    : null;
}



export function hasElementTargetField(
  config: unknown,
  xpathField = "xpath",
  targetField = "target",
): boolean {
  const record = asRecord(config);
  const xpath = record[xpathField];
  return Boolean(
    (typeof xpath === "string" && xpath.trim()) ||
      hasStructuredElementTarget(record[targetField]),
  );
}

export function hasElementTargetSourceField(
  config: unknown,
  xpathField = "xpath",
  targetField = "target",
  refField = "target_ref",
): boolean {
  return hasConfiguredField(config, refField) || hasElementTargetField(config, xpathField, targetField);
}

export function hasConfiguredField(config: unknown, field: string): boolean {
  const record = asRecord(config);
  return Object.prototype.hasOwnProperty.call(record, field) && record[field] != null;
}

export function hasStructuredElementTarget(target: unknown): boolean {
  const locators = asRecord(target).locators;
  return Array.isArray(locators) &&
    locators.some((locator) => {
      const value = asRecord(locator).value;
      return typeof value === "string" && value.trim();
    });
}

export function positive(value: any) {
  return (value != null && value > 0) || isTemplateVariable(value);
}

function isActionConfig(value: unknown): value is ActionConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "config" in value,
  );
}

function serializeValidationError(error: unknown): ActionValidationError {
  return error && typeof error === "object" && "message" in error
    ? (error as ActionValidationError)
    : validationError("graph", "Invalid graph");
}
