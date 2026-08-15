/**
 * Where the Desktop Surface meets the runner.
 *
 * ADR-0001 forbids `runtime/` from importing `surfaces/desktop/`: the runner
 * knows the Execution Surface union, never its members. So the dependency runs
 * the other way — this module produces the `OpenedSurface` closure the runner
 * accepts, and the runner stays unaware that a desktop driver exists at all.
 *
 * Nothing here decides anything. `openDesktopSession` does the launching,
 * waiting and binding; this is the adapter between that and the runner's shape,
 * plus the one thing only this layer can do: write the probed tier back to the
 * Desktop Target it came from.
 */

import { createUtilityProcessHost } from "./hostProcess.js";
import { openDesktopSession } from "./session.js";
import type { DesktopSessionDependencies } from "./session.js";
import type { OpenedSurface } from "../../runtime/runner.js";
import type { CapabilityTier, DesktopTarget } from "../../../../src/types/desktopTargets.js";

export type DesktopSurfaceOpenerOptions = {
  /** Injected in tests; defaults to a real Electron utility process. */
  startHost?: DesktopSessionDependencies["startHost"];
  /**
   * Called with what the probe found. Advisory — the tier is re-read every run,
   * so this only keeps the authoring UI's hint current.
   */
  onTierObserved?: (targetId: string, tier: CapabilityTier) => Promise<void> | void;
};

export function createDesktopSurfaceOpener(options: DesktopSurfaceOpenerOptions = {}) {
  const startHost = options.startHost ?? createUtilityProcessHost();

  return function openDesktopSurface(request: {
    target: DesktopTarget;
    runId: string;
    retention?: "close" | "retain";
    signal?: AbortSignal;
  }): () => Promise<OpenedSurface> {
    return async () => {
      const session = await openDesktopSession(
        {
          target: request.target,
          runId: request.runId,
          retention: request.retention,
          signal: request.signal,
        },
        { startHost },
      );

      if (session.tier !== request.target.observed_tier) {
        // Never allowed to fail the run: the tier is a hint for the next
        // authoring session, and the run itself already has what it needs.
        try {
          await options.onTierObserved?.(request.target.id, session.tier);
        } catch {
          // Nothing the operator can act on mid-run.
        }
      }

      return {
        surface: session.surface,
        warnings: [describeTier(session.tier, request.target.name), ...session.warnings],
        close: session.close,
      };
    };
  };
}

/**
 * Stated on every run, not only the bad ones.
 *
 * `capability-tiers.md` asks that the operator know the tier *before* building
 * on it, and the tier is a property of the individual window rather than of the
 * application — measured backwards from the obvious guess on Windows, where a
 * WinUI Settings window exposed nothing and Electron apps exposed their chrome.
 */
function describeTier(tier: CapabilityTier, targetName: string): string {
  switch (tier) {
    case "element":
      return `${targetName} exposed a full accessibility tree, so elements are addressable by name.`;
    case "chrome":
      return `${targetName} exposed only its window frame. Minimise, restore and close will work; nothing inside the window is addressable.`;
    case "pixel":
      return `${targetName} exposed no accessibility tree. Only pixel addressing is available, and pixel steps break when the window moves or resizes.`;
  }
}
