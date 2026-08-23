/**
 * Turning driver payloads into things that are safe to say out loud.
 *
 * Error messages from this surface end up in run steps and traces, and the
 * driver's payloads are the richest source of incidental secrets in the
 * system: a `Document` element's `value` is the entire contents of the open
 * file. `docs/domain/desktop/secrets-and-evidence.md` forbids a snapshot from
 * reaching run outputs, run steps or evidence — an exception for error paths
 * would leak exactly when things are already going wrong.
 *
 * So a failure describes the *shape* of what came back, never its contents.
 */

import type { z } from "zod";
import { isPlainRecord } from "../../shared/records.js";

/** Driver status text is short; anything longer is content that got loose. */
const MAX_MESSAGE = 500;

export function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/**
 * A leak-safe description: keys and counts, never values.
 *
 * Enough to tell "the driver returned an error object" from "the driver
 * returned a tree with a field missing", which is what a failure needs.
 */
export function summarisePayload(value: unknown): string {
  if (value === undefined) return "no readable payload";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array of ${value.length}`;
  if (isPlainRecord(value)) {
    const keys = Object.keys(value);
    return keys.length ? `object with keys: ${keys.join(", ")}` : "empty object";
  }
  return typeof value;
}

/**
 * Clamps driver status text.
 *
 * Status messages are diagnostic and worth keeping; a payload that turns out
 * to be a document is not, and its first 500 characters are already more than
 * anyone needs to identify it.
 */
export function clampMessage(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE)}… (truncated)`;
}
