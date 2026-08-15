/**
 * Window Binding: Desktop Target -> one concrete (pid, window_id).
 *
 * Pure. The driver call that produces the window list lives in the client;
 * everything about *choosing* among the results is here, because choosing
 * wrongly means the workflow types into someone else's window.
 *
 * Spec: `docs/domain/desktop/desktop-target.md`.
 */

import { z } from "zod";
import { isPlainRecord } from "../../shared/records.js";
import { matchesName } from "./locator.js";
import { describeIssues } from "./payloads.js";
import type { DriverWindow, WindowBinding, WindowSelector } from "./types.js";

/** Accepts either shape: `list_windows` returns a bare array, `launch_app` an envelope. */
const idSchema = z.union([z.string(), z.number()]).transform((v) => String(v));

const windowSchema = z.object({
  window_id: idSchema,
  pid: idSchema,
  title: z.string().optional(),
  is_minimized: z.boolean().optional(),
  is_on_screen: z.boolean().optional(),
  z_order: z.number().optional(),
  bounds: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
});

export type WindowListParse =
  | { ok: true; windows: DriverWindow[] }
  | { ok: false; detail: string };

export type BindingContext = {
  /** The process the Desktop Target launched, or attached to. */
  pid: string;
  /** True when the launch handed off to an already-running instance. */
  attached?: boolean;
};

export type WindowSelection =
  | { ok: true; binding: WindowBinding }
  | { ok: false; reason: "no_windows" | "ambiguous"; detail: string; candidates: DriverWindow[] };

export function parseWindowList(payload: unknown): WindowListParse {
  // Unwrapped before validation rather than as a union, so a bad window
  // reports which field it is missing instead of "no branch matched".
  const list = Array.isArray(payload)
    ? payload
    : isPlainRecord(payload) && Array.isArray(payload.windows)
      ? payload.windows
      : undefined;

  if (!list) {
    return {
      ok: false,
      detail: "Expected an array of windows, or an envelope carrying a `windows` array.",
    };
  }

  const parsed = z.array(windowSchema).safeParse(list);

  if (!parsed.success) {
    return { ok: false, detail: describeIssues(parsed.error) };
  }

  return { ok: true, windows: parsed.data };
}

/**
 * Selection is deterministic or it fails. Never "whichever one".
 *
 * Order: process, then visibility, then title, then — only if the operator
 * asked for it — z-order position.
 */
export function selectWindow(
  windows: DriverWindow[],
  context: BindingContext,
  selector: WindowSelector,
): WindowSelection {
  const owned = windows.filter((w) => w.pid === context.pid);
  const visible = owned.filter((w) => w.is_minimized !== true && w.is_on_screen !== false);

  if (visible.length === 0) {
    return {
      ok: false,
      reason: "no_windows",
      detail: owned.length
        ? `Process ${context.pid} has ${owned.length} window(s), but all are minimised or off-screen.`
        : `Process ${context.pid} has no windows. The application may still be starting.`,
      candidates: owned,
    };
  }

  const titled = selector.title
    ? visible.filter((w) => matchesName(selector.title, w.title))
    : visible;

  if (titled.length === 0) {
    return {
      ok: false,
      reason: "no_windows",
      detail:
        `No window titled ${describeSelector(selector)} in process ${context.pid}. ` +
        `Found: ${describeWindows(visible)}.`,
      candidates: visible,
    };
  }

  if (titled.length === 1) {
    return { ok: true, binding: bind(titled[0], context) };
  }

  // Z-order, not list order: the driver's ordering is not part of any contract,
  // and an ordinal that moves between runs is worse than no ordinal.
  const byZOrder = [...titled].sort((a, b) => (a.z_order ?? 0) - (b.z_order ?? 0));

  if (selector.ordinal !== undefined) {
    const picked = byZOrder[selector.ordinal];
    if (picked) {
      return { ok: true, binding: bind(picked, context) };
    }
    return {
      ok: false,
      reason: "ambiguous",
      detail:
        `Ordinal ${selector.ordinal} is out of range; ${titled.length} windows matched ` +
        `${describeSelector(selector)}: ${describeWindows(byZOrder)}.`,
      candidates: byZOrder,
    };
  }

  return {
    ok: false,
    reason: "ambiguous",
    detail:
      `${titled.length} windows match ${describeSelector(selector)}: ${describeWindows(byZOrder)}. ` +
      `Add a title match or an ordinal to the Desktop Target.`,
    candidates: byZOrder,
  };
}

/**
 * Single-instance applications hand a launch off to the running process.
 *
 * Detected rather than assumed: a pid that existed before the attempt means
 * this run attached, and the run records that so inherited state explains
 * itself later instead of looking like a mystery.
 */
export function classifyLaunch(
  pidsBefore: string[] | undefined,
  launchedPid: string,
): "launched" | "attached" {
  if (!pidsBefore) return "attached";
  return pidsBefore.includes(launchedPid) ? "attached" : "launched";
}

function bind(window: DriverWindow, context: BindingContext): WindowBinding {
  return {
    pid: context.pid,
    windowId: window.window_id,
    title: window.title,
    attached: context.attached === true,
  };
}

function describeSelector(selector: WindowSelector): string {
  if (!selector.title) return "any title";
  return `${selector.title.kind} "${selector.title.value}"`;
}

function describeWindows(windows: DriverWindow[]): string {
  return windows.map((w) => `${w.window_id} "${w.title ?? "(untitled)"}"`).join(", ");
}
