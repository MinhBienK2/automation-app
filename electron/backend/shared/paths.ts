/**
 * Sanitize a user- or run-supplied value into a single safe path segment:
 * trimmed, reduced to URL-friendly characters, never empty.
 */
export function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "default";
}
