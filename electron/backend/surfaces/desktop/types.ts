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
 *   are ours, defined in `docs/domain/desktop/`. These change when a product
 *   decision changes, and a driver release must never force one open.
 */

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
export type LocatorResolution =
  | { ok: true; element: SnapshotElement; elementToken: string; snapshotId: string }
  | { ok: false; reason: "degraded"; detail: string }
  | { ok: false; reason: "not_found"; detail: string }
  | { ok: false; reason: "ambiguous"; detail: string; candidates: SnapshotElement[] };

/** How much of a window is machine-addressable. */
export type CapabilityTier = "element" | "chrome" | "pixel";

/**
 * Project-owned description of an application a workflow drives.
 *
 * Owns no persistent storage — desktop applications do not accept a private
 * profile directory. See `docs/domain/desktop/desktop-target.md`.
 */
export type DesktopTarget = {
  id: string;
  project_id: string;
  name: string;
  launch: DesktopLaunchSpec;
  window: WindowSelector;
  /** Per-app switches that make a tree appear at all. */
  accessibility?: { env?: Record<string, string> };
  /** Last probe result. Advisory only — the tier is re-read every run. */
  observed_tier?: CapabilityTier;
};

export type DesktopLaunchSpec = {
  kind: "app_id" | "executable";
  /** "calc" | "C:\\Tools\\ledger.exe" */
  value: string;
  args?: string[];
};

/** How a Desktop Target picks its window out of everything the process owns. */
export type WindowSelector = {
  /** The same matcher a Desktop Locator uses for an element name. */
  title?: NameMatch;
  /** When several match, 0-based by z-order. */
  ordinal?: number;
};

/**
 * One window as the driver lists it.
 *
 * `pid` and `window_id` are `bigint` in the SDK and arrive as number or string
 * over JSON, so both are normalised to string at the parse boundary.
 */
export type DriverWindow = {
  window_id: string;
  pid: string;
  title?: string;
  is_minimized?: boolean;
  is_on_screen?: boolean;
  z_order?: number;
  bounds?: Rect;
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
