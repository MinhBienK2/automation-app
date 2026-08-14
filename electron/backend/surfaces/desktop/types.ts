/**
 * Desktop Surface types.
 *
 * Shapes here mirror what `cua-driver` actually returns on Windows — see
 * `docs/research/cua-driver-windows.md`. Fields the driver omits for some
 * elements are optional here for that reason, not for convenience.
 */

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
  frame?: { x: number; y: number; w: number; h: number };
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
  escalation?: { reason: string; recommended: "px" | "ax" };
  /** True when the walk was bounded; the tree may be partial. */
  elements_complete?: boolean;
};

/** How a locator matches an accessible name. */
export type NameMatch =
  | { kind: "exact"; value: string }
  | { kind: "prefix"; value: string }
  | { kind: "pattern"; value: string };

/** One step of the stored ancestor chain. Named ancestors only. */
export type AncestorStep = {
  role: string;
  name?: NameMatch;
};

/**
 * The durable description of an element, resolved against a fresh snapshot.
 *
 * Deliberately not the driver's `element_token`, which embeds a snapshot id
 * and is rejected once stale.
 */
export type DesktopLocator = {
  role: string;
  name?: NameMatch;
  /** Nearest-first. Intermediate unnamed containers are not represented. */
  ancestors?: AncestorStep[];
  /** Disambiguates identical siblings. Positional, so a last resort. */
  ordinal?: number;
  /** Short-circuits the whole match when present on both sides. */
  automationId?: string;
};

/** What a desktop step points at. */
export type DesktopTarget =
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
export type LocatorResolution =
  | { ok: true; element: SnapshotElement; elementToken: string; snapshotId: string }
  | { ok: false; reason: "degraded"; detail: string }
  | { ok: false; reason: "not_found"; detail: string }
  | { ok: false; reason: "ambiguous"; detail: string; candidates: SnapshotElement[] };

/** How much of a window is machine-addressable. */
export type CapabilityTier = "element" | "chrome" | "pixel";
