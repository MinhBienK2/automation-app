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
   * Called with what the run's snapshots showed. Advisory — the tier is re-read
   * every run, so this only keeps the authoring UI's hint current.
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

      const reportTier = async (tier: CapabilityTier | null): Promise<void> => {
        // Null means a wholly pixel-addressed run that never looked. Writing a
        // guess would overwrite a measurement with an absence of one.
        if (tier === null || tier === request.target.observed_tier) return;
        try {
          await options.onTierObserved?.(request.target.id, tier);
        } catch {
          // A hint for the next authoring session. Nothing the operator can act
          // on, and never a reason to fail a run that has already finished.
        }
      };

      return {
        surface: session.surface,
        warnings: session.warnings,
        close: async () => {
          // At close, because that is the first moment the tier is known: the
          // session reads it from the run's own snapshots rather than spending
          // one at bind. Reported before the teardown so a failing `close`
          // cannot lose an observation the run already paid for.
          await reportTier(session.observedTier());
          await session.close();
        },
      };
    };
  };
}
