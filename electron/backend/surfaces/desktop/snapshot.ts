/**
 * Element Snapshot handling and tiering.
 *
 * The driver hands back untyped JSON through `callTool`, and its shape changes
 * between releases (16 in three weeks — see the research findings). Everything
 * that turns that payload into something the runner may rely on lives here, and
 * it is pure: payload in, verdict out, no driver required to test it.
 *
 * Spec: `docs/domain/desktop/capability-tiers.md`.
 */

import { z } from "zod";
import { describeIssues } from "./payloads.js";
import type { CapabilityTier, ElementSnapshot } from "./types.js";

/** Frame controls every window exposes, which alone mean nothing is reachable. */
const WINDOW_CHROME_LABELS = new Set(["minimize", "maximize", "restore", "close"]);

const snapshotElementSchema = z.object({
  element_index: z.number(),
  element_token: z.string(),
  role: z.string(),
  depth: z.number(),
  label: z.string().optional(),
  parent_index: z.number().optional(),
  enabled: z.boolean().optional(),
  frame: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .optional(),
  value: z.string().optional(),
  automation_id: z.string().optional(),
});

/**
 * `element_count` is optional because the tree is the truth; a disagreement
 * between the two is reported as a warning rather than a parse failure.
 */
const snapshotSchema = z.object({
  snapshot_id: z.string(),
  elements: z.array(snapshotElementSchema),
  element_count: z.number().optional(),
  degraded: z.boolean().optional(),
  degraded_reason: z.string().optional(),
  /**
   * `recommended` is a loose string on purpose. Only `"px"` has been measured,
   * and rejecting an unfamiliar value would fail the parse of a snapshot whose
   * tree is perfectly usable — the opposite of what a degradation signal is
   * for. An unrecognised recommendation becomes a warning instead.
   */
  escalation: z.object({ reason: z.string(), recommended: z.string() }).optional(),
  elements_complete: z.boolean().optional(),
});

export type SnapshotParse =
  | { ok: true; snapshot: ElementSnapshot }
  | { ok: false; detail: string };

/**
 * Validates one `get_window_state` payload.
 *
 * A degraded window with zero elements parses successfully. That is a real
 * state of a real window, and it must reach the caller as `degraded` so the
 * failure reads "this window lost its accessibility tree" rather than
 * "the driver returned nonsense".
 */
export function parseSnapshot(payload: unknown): SnapshotParse {
  const parsed = snapshotSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, detail: describeIssues(parsed.error) };
  }

  return {
    ok: true,
    snapshot: {
      ...parsed.data,
      element_count: parsed.data.element_count ?? parsed.data.elements.length,
    },
  };
}

/**
 * Classifies a snapshot so the caller can tell "the element moved" from
 * "the window stopped exposing anything", which need different repairs.
 *
 * `elements_complete: false` is deliberately not consulted: it appears on
 * healthy snapshots too and its meaning is unresolved upstream.
 */
export function tierOf(snapshot: ElementSnapshot): CapabilityTier {
  if (snapshot.degraded || snapshot.escalation?.recommended === "px") return "pixel";
  if (snapshot.elements.length === 0) return "pixel";

  const meaningful = snapshot.elements.filter(
    (e) => !WINDOW_CHROME_LABELS.has((e.label ?? "").toLowerCase()),
  );

  return meaningful.length === 0 ? "chrome" : "element";
}

/**
 * Things worth telling the operator about a snapshot that are not failures.
 *
 * These attach to the authored step, where they are actionable, rather than
 * failing a run that may well work.
 */
export function snapshotWarnings(snapshot: ElementSnapshot): string[] {
  const warnings: string[] = [];
  const tier = tierOf(snapshot);

  if (snapshot.elements_complete === false) {
    warnings.push(
      "The accessibility walk was bounded, so the tree may be partial and an element may be missing from it.",
    );
  }

  if (snapshot.element_count !== snapshot.elements.length) {
    warnings.push(
      `The driver reported ${snapshot.element_count} elements but returned ${snapshot.elements.length}.`,
    );
  }

  if (tier === "chrome") {
    warnings.push(
      "Only the window frame is reachable — minimise, restore and close. No content of this window is addressable.",
    );
  }

  if (tier === "pixel") {
    warnings.push(
      snapshot.degraded_reason ??
        "This window exposes no accessibility tree; only pixel addressing is available.",
    );
  }

  const recommended = snapshot.escalation?.recommended;
  if (recommended !== undefined && recommended !== "px" && recommended !== "ax") {
    warnings.push(
      `The driver recommended an escalation this build does not recognise ("${recommended}"): ${snapshot.escalation?.reason}`,
    );
  }

  return warnings;
}
