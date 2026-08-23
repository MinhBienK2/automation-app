import path from "node:path";
import {
  outputNameRequired,
  propertyKeyRequired,
  regexPatternRequired,
  sourceListVariableNameRequired,
  sourceOutputRequired,
  sourceVariableNameRequired,
} from "../../shared/validationMessages.js";
import type {
  ActionConfig,
  WorkflowCondition,
} from "../../../../src/types/workflow.js";
import {
  asRecord,
  stringField,
  validationError,
} from "../../shared/records.js";
import type { ActionType } from "../registry.js";


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

export function firstValidation(
  ...validations: Array<ActionValidationError | null | undefined>
) {
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

function isTemplateVariable(value: unknown): boolean {
  return typeof value === "string" && /^\{\{\s*[^}]+?\s*\}\}$/.test(value.trim());
}

export function positiveValue(value: unknown, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value > 0)
    ? null
    : validationError(field, message);
}

export function optionalPositive(value: unknown, field: string, message: string) {
  return value == null || isTemplateVariable(value) ? null : positiveValue(value, field, message);
}

export function optionalNonNegative(value: unknown, field: string, message: string) {
  return value == null || isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0)
    ? null
    : validationError(field, message);
}

function finiteValue(value: unknown, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value))
    ? null
    : validationError(field, message);
}

function percentValue(value: unknown, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)
    ? null
    : validationError(field, message);
}

export function zeroOrPositiveInteger(value: unknown, field: string, message: string) {
  return isTemplateVariable(value) || (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  )
    ? null
    : validationError(field, message);
}

export function positive(value: unknown) {
  return (value != null && Number(value) > 0) || isTemplateVariable(value);
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

export function hasElementTargetSourceField(
  config: unknown,
  xpathField = "xpath",
  targetField = "target",
  refField = "target_ref",
): boolean {
  return hasConfiguredField(config, refField) || hasElementTargetField(config, xpathField, targetField);
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
  // Local import cycle avoided by design: nested configs re-enter through the
  // composed map at index.ts, injected once at module init.
  const validation = nestedValidatorLookup()(stepValue);
  return validation
    ? validationError(`${field}.${validation.field}`, validation.message)
    : null;
}

let nestedLookup: ((config: ActionConfig) => ActionValidationError | null) | null = null;

export function registerNestedValidatorLookup(
  lookup: (config: ActionConfig) => ActionValidationError | null,
) {
  nestedLookup = lookup;
}

function nestedValidatorLookup() {
  if (!nestedLookup) {
    throw new Error("Nested validator lookup was not registered");
  }
  return nestedLookup;
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

const LATITUDE_BOUNDS = { min: -90, max: 90 } as const;
const LONGITUDE_BOUNDS = { min: -180, max: 180 } as const;

export function latitudeValidation(value: number) {
  return typeof value === "number" && value >= LATITUDE_BOUNDS.min && value <= LATITUDE_BOUNDS.max
    ? null
    : validationError("latitude", "Latitude must be between -90 and 90");
}

export function longitudeValidation(value: number) {
  return typeof value === "number" && value >= LONGITUDE_BOUNDS.min && value <= LONGITUDE_BOUNDS.max
    ? null
    : validationError("longitude", "Longitude must be between -180 and 180");
}

export function statusValidation(value: number | null | undefined, field: string, message: string) {
  return value == null || (Number.isInteger(value) && value >= 100 && value <= 599)
    ? null
    : validationError(field, message);
}

export function regexPatternValidation(pattern: string, flags: string | null | undefined) {
  const normalizedFlags = flags?.trim() || "g";
  if (!/^[dgimsuvy]*$/.test(normalizedFlags)) {
    return validationError("flags", "Regex flags are invalid");
  }
  try {
    new RegExp(pattern, normalizedFlags);
    return null;
  } catch {
    return validationError("pattern", "Regex pattern is invalid");
  }
}

export function safeArtifactNameValidation(
  value: string | null | undefined,
  field: string,
  message: string,
) {
  if (value == null || value.trim() === "") return null;
  return isSafeArtifactName(value)
    ? null
    : validationError(field, message);
}

function isSafeArtifactName(value: string) {
  const raw = value.trim();
  if (!raw) return false;
  if (
    /^file:/i.test(raw) ||
    path.isAbsolute(raw) ||
    raw.includes("/") ||
    raw.includes("\\") ||
    raw.split(/[\\/]+/).includes("..")
  ) {
    return false;
  }
  const parsed = path.parse(raw);
  return !(parsed.dir || parsed.base === ".." || parsed.name === "..");
}

function validateWorkflowCondition(condition: WorkflowCondition) {
  const conditionRecord = condition as { kind?: unknown };
  switch (condition.kind) {
    case "variable_is_true":
      if (!condition.name.trim()) throw validationError("name", "Condition variable name is required");
      break;
    case "text_visible":
      if (!condition.text.trim()) throw validationError("text", "Condition text is required");
      break;
    case "url_contains":
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "element_visible": {
      const validation = validateElementTargetSource(condition, {
        message: "Condition XPath is required",
      });
      if (validation) throw validation;
      break;
    }
    default:
      throw validationError(
        "kind",
        `Unsupported condition kind: ${conditionKindLabel(conditionRecord.kind)}`,
      );
  }
}

function conditionKindLabel(kind: unknown) {
  return typeof kind === "string" && kind ? kind : "unknown";
}

function hasElementTargetField(
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

function hasConfiguredField(config: unknown, field: string): boolean {
  const record = asRecord(config);
  return Object.prototype.hasOwnProperty.call(record, field) && record[field] != null;
}

function hasStructuredElementTarget(target: unknown): boolean {
  const locators = asRecord(target).locators;
  return Array.isArray(locators) &&
    locators.some((locator) => {
      const value = asRecord(locator).value;
      return typeof value === "string" && value.trim();
    });
}

export function isActionConfig(value: unknown): value is ActionConfig {
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

export const messages = {
  outputNameRequired,
  propertyKeyRequired,
  regexPatternRequired,
  sourceListVariableNameRequired,
  sourceOutputRequired,
  sourceVariableNameRequired,
};
