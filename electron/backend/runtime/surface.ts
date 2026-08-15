/**
 * The Execution Surface union.
 *
 * A run drives exactly one kind of thing, and the two kinds have nothing in
 * common: a browser page has a URL, a DOM and frames; an application window
 * has a process, an accessibility tree and snapshots that expire. ADR-0001
 * forbids pretending otherwise by making the desktop driver implement
 * `BrowserDriver*`, so the seam is raised to here instead.
 *
 * `runtime/` knows the union, never its members' behaviour: the imports below
 * are type-only and erase at build time, which is what keeps this module from
 * dragging a driver into the surface-independent half of the runner.
 *
 * Spec: `docs/architecture/desktop-runner.md`.
 */

import type {
  BrowserDriverContext,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import type { DesktopDriverClient } from "../surfaces/desktop/driverClient.js";
import type { WindowBinding } from "../surfaces/desktop/types.js";

export type WebSurface = {
  kind: "web";
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  /** Which iframe subsequent locators resolve inside. Web-only by nature. */
  activeFrameXpath?: string | null;
};

export type DesktopSurface = {
  kind: "desktop";
  driver: DesktopDriverClient;
  binding: WindowBinding;
};

export type ExecutionSurface = WebSurface | DesktopSurface;

/**
 * Narrow to the web surface, once, at the entry of a web-acting family.
 *
 * No executor branches on the surface mid-body: an action that would need to
 * belongs to neither family. Reaching this error means a web action was
 * dispatched into a desktop run, which is a compiler or compiler-adjacent bug
 * rather than anything an operator did.
 */
export function requireWebSurface(surface: ExecutionSurface): WebSurface {
  if (surface.kind !== "web") {
    throw new Error(
      `A web action was dispatched on the ${surface.kind} surface. A workflow belongs to exactly one surface.`,
    );
  }
  return surface;
}

export function requireDesktopSurface(surface: ExecutionSurface): DesktopSurface {
  if (surface.kind !== "desktop") {
    throw new Error(
      `A desktop action was dispatched on the ${surface.kind} surface. A workflow belongs to exactly one surface.`,
    );
  }
  return surface;
}
