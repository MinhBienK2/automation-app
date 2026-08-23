import path from "node:path";
import {
  validationError,
} from "../shared/records.js";
import type { WorkflowCondition } from "../../../src/types/workflow.js";
import { validateElementTargetSource } from "./validation.js";

export function latitudeValidation(value: number) {
  return typeof value === "number" && value >= -90 && value <= 90
    ? null
    : validationError("latitude", "Latitude must be between -90 and 90");
}

export function longitudeValidation(value: number) {
  return typeof value === "number" && value >= -180 && value <= 180
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

export function isSafeArtifactName(value: string) {
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

export function validateWorkflowCondition(condition: WorkflowCondition) {
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

export function conditionKindLabel(kind: unknown) {
  return typeof kind === "string" && kind ? kind : "unknown";
}
