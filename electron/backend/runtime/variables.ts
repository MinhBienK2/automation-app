import type { ActionConfig } from "../../../src/types/workflow.js";
import { isPlainRecord } from "../shared/records.js";

export function setVariables(
  outputs: Record<string, unknown>,
  config: Extract<ActionConfig, { type: "set_variable" }>["config"],
) {
  const variables = config.variables ?? [
    {
      name: config.name ?? "",
      value_type: config.value_type ?? "text",
      value: config.value ?? "",
    },
  ];
  for (const variable of variables) {
    if (!variable.name.trim()) continue;
    writeVariableValue(
      outputs,
      variable.name,
      parseVariableValue(variable.value_type, variable.value, outputs),
    );
  }
}

export function parseVariableValue(
  valueType: string,
  value: string,
  outputs: Record<string, unknown>,
) {
  const rendered = renderTemplate(value, outputs);
  if (valueType === "json") return JSON.parse(rendered);
  if (valueType === "number") return Number(rendered);
  if (valueType === "boolean") return rendered === "true";
  return rendered;
}

export function flattenObject(outputs: Record<string, unknown>, prefix: string, value: unknown) {
  if (!isPlainRecord(value)) {
    if (prefix) outputs[prefix] = value;
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenObject(outputs, prefix ? `${prefix}.${key}` : key, child);
  }
}

export function writeVariableValue(
  outputs: Record<string, unknown>,
  name: string,
  value: unknown,
) {
  outputs[name] = value;
  if (isPlainRecord(value)) {
    flattenObject(outputs, name, value);
  }
}

export function renderTemplate(value: string, outputs: Record<string, unknown>) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, name: string) =>
    String(outputs[name] ?? ""),
  );
}

const NUMERIC_KEYS = new Set([
  "timeout_ms",
  "duration_ms",
  "min_ms",
  "max_ms",
  "delay_ms",
  "index",
  "times",
  "max_attempts",
  "width",
  "height",
  "latitude",
  "longitude",
]);

const NESTED_STEP_KEYS = new Set([
  "steps",
  "then_steps",
  "else_steps",
  "try_steps",
  "success_steps",
  "error_steps",
  "finally_steps",
  "primary_steps",
  "fallback_steps",
  "failed_steps",
  "timeout_steps",
  "cases",
  "choices",
  "condition",
]);

export function resolveObjectTemplates(
  val: any,
  outputs: Record<string, unknown>,
  parentKey?: string,
): any {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    const rendered = renderTemplate(val, outputs);
    if (parentKey && NUMERIC_KEYS.has(parentKey)) {
      const parsed = Number(rendered);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return rendered;
  }

  if (Array.isArray(val)) {
    return val.map((item) => resolveObjectTemplates(item, outputs, parentKey));
  }

  if (typeof val === "object") {
    const result: any = {};
    for (const [key, child] of Object.entries(val)) {
      if (NESTED_STEP_KEYS.has(key)) {
        result[key] = child;
      } else {
        result[key] = resolveObjectTemplates(child, outputs, key);
      }
    }
    return result;
  }

  return val;
}


