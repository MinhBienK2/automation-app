import type { z } from "zod";
import type { ActionConfig, WorkflowNode } from "../../../../src/types/workflow.js";
import { navigateSchema } from "./navigate.js";
import { clickSchema } from "./click.js";
import { inputTextSchema } from "./input_text.js";
import { waitSchema } from "./wait.js";
import { extractTextSchema } from "./extract_text.js";
import { ifConditionSchema } from "./if_condition.js";
import { setVariableSchema } from "./set_variable.js";
import { takeScreenshotSchema } from "./take_screenshot.js";
import { executeJsSchema } from "./execute_js.js";

type ActionType = ActionConfig["type"];

/**
 * Registry of Zod schemas keyed by action type.
 * Only the top-10 action types are registered in PR 1.3.
 * PR 1.4 fills in the remaining ~80 types.
 */
export const actionSchemas: Partial<Record<ActionType, z.ZodSchema>> = {
  navigate: navigateSchema,
  click: clickSchema,
  input_text: inputTextSchema,
  wait: waitSchema,
  extract_text: extractTextSchema,
  if_condition: ifConditionSchema,
  set_variable: setVariableSchema,
  take_screenshot: takeScreenshotSchema,
  execute_js: executeJsSchema,
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no_schema" | "invalid"; issues: z.ZodIssue[] };

/**
 * Validate a workflow node's action config against its Zod schema.
 * Returns `no_schema` if no schema is registered for this action type
 * (pass-through until PR 1.4 flips the switch to quarantine).
 */
export function validateActionConfig(node: WorkflowNode): ValidationResult<ActionConfig> {
  const config = node.config as { type?: unknown } | null;
  if (!config || typeof config.type !== "string") {
    return { ok: false, reason: "no_schema", issues: [] };
  }
  const schema = actionSchemas[config.type as ActionType];
  if (!schema) return { ok: false, reason: "no_schema", issues: [] };
  const parsed = schema.safeParse(node.config);
  return parsed.success
    ? { ok: true, data: parsed.data as ActionConfig }
    : { ok: false, reason: "invalid", issues: parsed.error.issues };
}
