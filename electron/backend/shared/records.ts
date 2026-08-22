export type ValidationErrorLike = {
  field: string;
  message: string;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringField(config: unknown, field: string): string | null {
  const value = asRecord(config)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function numberField(config: unknown, field: string): number | null {
  const value = asRecord(config)[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function arrayField(config: unknown, field: string): unknown[] {
  const value = asRecord(config)[field];
  return Array.isArray(value) ? value : [];
}

export function validationError(field: string, message: string): ValidationErrorLike {
  return { field, message };
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function stringValueTrimmed(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
