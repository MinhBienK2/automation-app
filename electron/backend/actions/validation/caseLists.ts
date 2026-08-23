import { asRecord, stringField, validationError } from "../../shared/records.js";
import { validateConditionConfig, validateNestedActionArray } from "./primitives.js";

/**
 * Case-list shapes for switch / router / random-choice nodes: three structural
 * twins kept side by side so a change to one family is made consciously
 * against the others.
 */
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
