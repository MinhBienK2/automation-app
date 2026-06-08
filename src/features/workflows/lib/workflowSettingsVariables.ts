import type {
  VariableAssignment,
  VariableValueType,
} from "../../../types/workflow";

export function variableRowsFromJsonText(
  text: string,
): { rows: VariableAssignment[]; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }

  if (!isPlainObject(parsed)) {
    return { rows: [], error: "Variables JSON must be an object." };
  }

  return { rows: flattenVariablesObject(parsed), error: null };
}

export function variablesJsonFromRows(rows: VariableAssignment[]) {
  const root: Record<string, unknown> = {};
  for (const row of rows) {
    const path = row.name
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!path.length) continue;
    setNestedValue(root, path, variableRowValue(row));
  }
  return JSON.stringify(root, null, 2);
}

function flattenVariablesObject(
  object: Record<string, unknown>,
  prefix = "",
): VariableAssignment[] {
  const rows: VariableAssignment[] = [];
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      rows.push(...flattenVariablesObject(value, path));
      continue;
    }
    rows.push({
      name: path,
      value_type: variableValueType(value),
      value: variableValueText(value),
    });
  }
  return rows;
}

function variableValueType(value: unknown): VariableValueType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "text";
  return "json";
}

function variableValueText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function variableRowValue(row: VariableAssignment): unknown {
  switch (row.value_type) {
    case "number": {
      const parsed = Number(row.value);
      return Number.isFinite(parsed) ? parsed : row.value;
    }
    case "boolean":
      return row.value.trim().toLowerCase() === "true";
    case "json":
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    case "text":
    default:
      return row.value;
  }
}

function setNestedValue(root: Record<string, unknown>, path: string[], value: unknown) {
  let target = root;
  for (const key of path.slice(0, -1)) {
    const current = target[key];
    if (!isPlainObject(current)) {
      target[key] = {};
    }
    target = target[key] as Record<string, unknown>;
  }
  target[path[path.length - 1]] = value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
