export type ValidationErrorLike = {
  field: string;
  message: string;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
