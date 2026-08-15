/**
 * Desktop Target — the project-owned description of an application a workflow
 * drives, and the pieces it is made of.
 *
 * These live here, beside `BrowserProfile`, because they cross the IPC boundary:
 * the Projects UI creates them, the run lifecycle resolves them. The *driver*
 * shapes they get compared against — Element Snapshots, window lists — stay in
 * `electron/backend/surfaces/desktop/types.ts`, which is the half that changes
 * when `cua-driver` changes rather than when a product decision does.
 *
 * Spec: `docs/domain/desktop/desktop-target.md`.
 */

/** How a locator or a window selector matches a name. */
export type NameMatch =
  | { kind: "exact"; value: string }
  | { kind: "prefix"; value: string }
  | { kind: "pattern"; value: string };

/** One step of a stored ancestor chain. Named ancestors only. */
export type AncestorStep = {
  role: string;
  name?: NameMatch;
};

/**
 * The durable description of an element, resolved against a fresh snapshot.
 *
 * Deliberately not the driver's `element_token`, which embeds a snapshot id and
 * is rejected the moment that snapshot expires.
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

/** How much of a window is machine-addressable. */
export type CapabilityTier = "element" | "chrome" | "pixel";

/**
 * How the runner knows an application finished starting.
 *
 * One kind, deliberately: "a window matching the selector appeared" is the only
 * readiness signal the driver actually gives us.
 */
export type ReadyCondition = { kind: "window"; timeout_ms?: number };

export type DesktopLaunchSpec = {
  kind: "app_id" | "executable";
  /** "calc" | "C:\\Tools\\ledger.exe" */
  value: string;
  args?: string[];
  ready?: ReadyCondition;
};

/** How a Desktop Target picks its window out of everything the process owns. */
export type WindowSelector = {
  title?: NameMatch;
  /** When several match, 0-based by z-order. */
  ordinal?: number;
};

/** Per-app switches that make an accessibility tree appear at all. */
export type AccessibilityHints = {
  env?: Record<string, string>;
};

/**
 * Project-owned description of an application a workflow drives.
 *
 * Owns no persistent storage — desktop applications do not accept a private
 * profile directory, which is why this is not called a "Desktop Profile".
 * `pid` and `window_id` are never stored; they are a Window Binding, resolved
 * per run.
 */
export type DesktopTarget = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: boolean;
  launch: DesktopLaunchSpec;
  window: WindowSelector;
  accessibility?: AccessibilityHints;
  /** Last probe result. Advisory only — the tier is re-read every run. */
  observed_tier?: CapabilityTier;
  created_at: string;
  updated_at: string;
};

/**
 * One node of the tree the element picker draws.
 *
 * Deliberately not the driver's snapshot element, and the two omissions are the
 * point. `value` is missing because that is where a `Document` element keeps
 * the operator's whole open file, the largest incidental-secret source in the
 * system. `element_token` is missing because it is scoped to a snapshot that
 * has expired by the time anyone clicks, so keeping it would only invite
 * someone to store it.
 */
export type PickerElement = {
  index: number;
  role: string;
  label?: string;
  automationId?: string;
  depth: number;
  parentIndex?: number;
  /** Lets the picker show where an element is, and offer a pixel fallback. */
  frame?: { x: number; y: number; w: number; h: number };
  /**
   * The locator that would be written for this element, computed where the
   * resolver lives rather than in the renderer. Writing the suggestion twice —
   * once to resolve, once to author — is how the two halves drift apart.
   */
  suggestion: LocatorSuggestion;
};

export type PickerTree = {
  elements: PickerElement[];
  /** Why the tree is empty, when it is. */
  degradedReason?: string;
};

/** What one authoring look at a Desktop Target's window produced. */
export type DesktopInspection = {
  tier: CapabilityTier;
  tree: PickerTree;
  warnings: string[];
};

/**
 * A locator the picker wrote, with the reasoning it used.
 *
 * The explanation is not decoration: `locator-model.md` asks the picker to show
 * which identifier it settled on *and why*, because the difference between "the
 * only button with that name" and "the second of four identical buttons" is the
 * difference between a step that lasts and one that breaks on the next release.
 */
export type LocatorSuggestion = {
  locator: DesktopLocator;
  matchedBy: "automation_id" | "name" | "ancestry" | "ordinal";
  explanation: string;
  fragile: boolean;
};

export type DesktopTargetInput = {
  name: string;
  description?: string | null;
  is_default?: boolean | null;
  launch: DesktopLaunchSpec;
  window?: WindowSelector | null;
  accessibility?: AccessibilityHints | null;
};
