import type { ActionConfig } from "../../../src/types/workflow.js";
import { isPlainRecord } from "../shared/records.js";

/**
 * Which workflow-node config fields hold an ARRAY of nested step configs.
 *
 * This is persisted-shape knowledge: the compiler walks these to interleave
 * waits, the runner walks them to collect nested node ids, and template
 * resolution must never render inside them (outputs are resolved per step at
 * execution time, not authored time). Adding a flow-control node with child
 * steps means adding its key here — once.
 */
export const NESTED_STEP_KEYS = [
  "then_steps",
  "else_steps",
  "steps",
  "failed_steps",
  "default_steps",
  "try_steps",
  "success_steps",
  "error_steps",
  "finally_steps",
  "primary_steps",
  "fallback_steps",
  "timeout_steps",
] as const;

/**
 * Config fields whose value is an array of BRANCHES, each branch carrying its
 * own `steps` array (router cases, random choices).
 */
export const NESTED_BRANCH_KEYS = ["cases", "choices"] as const;

/**
 * Config fields template resolution must skip wholesale: every nested-step
 * container, the branch lists, and the single `condition` object whose
 * operands are evaluated at run time.
 */
export const TEMPLATE_SKIPPED_KEYS: Readonly<Record<string, true>> = Object.fromEntries(
  [...NESTED_STEP_KEYS, ...NESTED_BRANCH_KEYS, "condition"].map((key) => [key, true as const]),
);

/**
 * Visit every direct nested step array inside a node config record: the
 * per-key step arrays plus each branch's `steps` inside `cases`/`choices`.
 * Does not descend recursively — callers recurse via their own visitor.
 */
export function forEachNestedStepArray(
  record: Record<string, unknown>,
  visit: (steps: unknown[]) => void,
): void {
  for (const key of NESTED_STEP_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) visit(value);
  }
  for (const branchKey of NESTED_BRANCH_KEYS) {
    const branches = record[branchKey];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      const steps = isPlainRecord(branch) ? branch.steps : undefined;
      if (Array.isArray(steps)) visit(steps);
    }
  }
}

/**
 * Visit every nested action-config array under an action config, including
 * the singular `step` wrapper some nodes carry.
 */
export function forEachNestedActionArray(
  config: ActionConfig,
  visit: (steps: ActionConfig[]) => void,
): void {
  const inner: Record<string, unknown> = isPlainRecord(config.config) ? { ...config.config } : {};
  forEachNestedStepArray(inner, (steps) => visit(steps as ActionConfig[]));
  const stepValue = inner.step;
  if (isActionConfig(stepValue)) visit([stepValue]);
}

function isActionConfig(value: unknown): value is ActionConfig {
  return isPlainRecord(value) && typeof value.type === "string";
}
