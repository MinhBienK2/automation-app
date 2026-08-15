/**
 * Desktop Surface types.
 *
 * Two kinds live here, and the difference matters when one of them changes:
 *
 * - **Driver shapes** (`SnapshotElement`, `ElementSnapshot`, `DriverWindow`)
 *   mirror what `cua-driver` actually returns on Windows — see
 *   `docs/research/cua-driver-windows.md`. Fields the driver omits for some
 *   elements are optional here for that reason, not for convenience. These
 *   change when the driver changes.
 * - **Domain shapes** (`DesktopTarget`, `DesktopLocator`, `WindowBinding`, …)
 *   are ours, specified in `docs/domain/desktop/`. These change when a product
 *   decision changes, and a driver release must never force one open. The ones
 *   that cross the IPC boundary are declared in `src/types/desktopTargets.ts`
 *   and re-exported below; `WindowBinding` stays here because it is runtime
 *   state that is never stored and never leaves the backend.
 */

/**
 * The domain half now lives in `src/types/desktopTargets.ts`, because a Desktop
 * Target crosses the IPC boundary: the Projects UI creates one, the run
 * lifecycle resolves it. Re-exported here so this module stays the single
 * import for the surface, and so the split stays a fact about *where a shape
 * changes from* rather than a second place to declare it.
 */
export type {
  AccessibilityHints,
  AncestorStep,
  CapabilityTier,
  DesktopLaunchSpec,
  DesktopLocator,
  DesktopTarget,
  NameMatch,
  ReadyCondition,
  WindowSelector,
} from "../../../../src/types/desktopTargets.js";

import type { DesktopLocator } from "../../../../src/types/desktopTargets.js";

/** A rectangle, in the units of whatever reported it. */
export type Rect = { x: number; y: number; w: number; h: number };

/** One element from an Element Snapshot, as the driver reports it. */
export type SnapshotElement = {
  /** Position in the driver's walk. Valid only inside its own snapshot. */
  element_index: number;
  /** `<snapshot_id>:<index>`. The handle an action must pass back. */
  element_token: string;
  /** UIA control type: "Button", "Edit", "TabItem", "Document", ... */
  role: string;
  /** The element's accessible name. Absent for unnamed containers. */
  label?: string;
  /** Index of the parent element within the same snapshot. */
  parent_index?: number;
  depth: number;
  enabled?: boolean;
  frame?: Rect;
  /**
   * Element content. For a Document this is the whole document text, so it
   * is a leaking hazard — see `docs/domain/desktop/secrets-and-evidence.md`.
   */
  value?: string;
  /** UIA AutomationId. Rarely present, but the most stable id when it is. */
  automation_id?: string;
};

/** One read of a window's accessibility tree. */
export type ElementSnapshot = {
  snapshot_id: string;
  elements: SnapshotElement[];
  element_count: number;
  /** The driver's own signal that the tree is unusable. */
  degraded?: boolean;
  degraded_reason?: string;
  /**
   * The driver's own recommendation. `"px"` is the only value measured; the
   * field stays a string so an unfamiliar one warns rather than failing the
   * parse of an otherwise usable tree.
   */
  escalation?: { reason: string; recommended: string };
  /** True when the walk was bounded; the tree may be partial. */
  elements_complete?: boolean;
};

/**
 * What a desktop step points at.
 *
 * Named `DesktopStepTarget`, not `DesktopTarget`: the glossary reserves
 * "Desktop Target" for the project-owned application description below, and
 * two things called the same name in one directory is how a run ends up
 * binding the wrong concept.
 */
export type DesktopStepTarget =
  | { kind: "element"; locator: DesktopLocator }
  | { kind: "pixel"; x: number; y: number; origin: "window" };

/**
 * Resolution outcome.
 *
 * The failures are distinct because they need different repairs: a missing
 * element means re-author the step, a degraded window means the tree is gone
 * and the locator was never at fault, and ambiguity means the locator is
 * under-specified.
 */
/**
 * Which of the locator's identifiers actually did the work.
 *
 * Reported rather than inferred from the locator, because a locator that
 * carries an `automationId` and an ordinal does not say which one narrowed the
 * field. It lands in the step's trace: a step that used to match by name and
 * now matches by ordinal is one resize away from acting on the wrong element,
 * and that drift is invisible unless the run records it.
 */
export type LocatorMatchKind = "automation_id" | "name" | "ancestry" | "ordinal";

export type LocatorResolution =
  | {
      ok: true;
      element: SnapshotElement;
      elementToken: string;
      snapshotId: string;
      matchedBy: LocatorMatchKind;
    }
  | { ok: false; reason: "degraded"; detail: string }
  | { ok: false; reason: "not_found"; detail: string }
  | { ok: false; reason: "ambiguous"; detail: string; candidates: SnapshotElement[] };

/**
 * One window as the driver lists it.
 *
 * `pid` and `window_id` are `bigint` in the SDK and arrive as number or string
 * over JSON, so both are normalised to string at the parse boundary.
 *
 * `pid` is optional because `launch_app`'s window entries omit it — the pid
 * belongs to the launch, one level up. The pairs of near-duplicate fields are
 * the driver's own two spellings, measured on different tools.
 */
export type DriverWindow = {
  window_id: string;
  pid?: string;
  title?: string;
  is_minimized?: boolean;
  minimized?: boolean;
  is_on_screen?: boolean;
  z_order?: number;
  z_index?: number;
  /** Long names here; an element's `frame` uses short ones. Both measured. */
  bounds?: { x: number; y: number; width: number; height: number };
};

/**
 * The runtime resolution of a Desktop Target to one concrete window.
 *
 * Ephemeral by construction: both ids change between runs, which is why a
 * Desktop Target stores neither.
 */
export type WindowBinding = {
  pid: string;
  windowId: string;
  title?: string;
  /**
   * True when the "launch" handed off to an already-running process. The run
   * continues, but it inherited whatever state the operator left behind.
   */
  attached: boolean;
};
