/**
 * One look at a Desktop Target's window, for authoring.
 *
 * The element picker cannot work from anything stored: a Desktop Locator is
 * resolved against a *live* tree, and there is no live tree until an
 * application is running. So authoring an element step means launching the
 * application, taking one snapshot, and closing again — the same launch, bind
 * and teardown a run does, minus the run.
 *
 * The snapshot never leaves this module intact. `toPickerTree` strips element
 * values before anything crosses the IPC boundary, because a `Document`
 * element's value is the whole open file (#46) and the renderer has no business
 * holding it.
 *
 * Specs: `docs/domain/desktop/locator-model.md` (authoring),
 * `docs/domain/desktop/secrets-and-evidence.md` (what may not be persisted).
 */

import { toPickerTree } from "./picker.js";
import { openDesktopSession } from "./session.js";
import type { DesktopSessionDependencies } from "./session.js";
import { snapshotWarnings, tierOf } from "./snapshot.js";
import { createUtilityProcessHost } from "./hostProcess.js";
import type {
  CapabilityTier,
  DesktopInspection,
  DesktopTarget,
} from "../../../../src/types/desktopTargets.js";

export type { DesktopInspection };

export type DesktopInspectorOptions = {
  /** Injected in tests; defaults to a real Electron utility process. */
  startHost?: DesktopSessionDependencies["startHost"];
  /**
   * A picking session snapshots a real window, so what it sees is a
   * measurement, not the authoring-time guess `capability-tiers.md` rules out.
   * Recorded the same way a run's is.
   */
  onTierObserved?: (targetId: string, tier: CapabilityTier) => Promise<void> | void;
};

export function createDesktopInspector(options: DesktopInspectorOptions = {}) {
  const startHost = options.startHost ?? createUtilityProcessHost();

  return async function inspectDesktopTarget(
    target: DesktopTarget,
    signal?: AbortSignal,
  ): Promise<DesktopInspection> {
    const session = await openDesktopSession(
      {
        target,
        // Not a run id. It reaches the host only as a label, and calling it one
        // would put a picking session into anything that groups by run.
        runId: `authoring-${target.id}`,
        // The operator opened a picker, not an application. Whatever this
        // launched is closed again; whatever was already open is left alone.
        retention: "close",
        signal,
      },
      { startHost },
    );

    try {
      const snapshot = await session.surface.driver.getWindowState(
        session.surface.binding,
        signal,
      );
      const tier = tierOf(snapshot);

      if (tier !== target.observed_tier) {
        try {
          await options.onTierObserved?.(target.id, tier);
        } catch {
          // A hint for the next authoring session, never a reason to fail one.
        }
      }

      return {
        tier,
        tree: toPickerTree(snapshot),
        warnings: [...session.warnings, ...snapshotWarnings(snapshot)],
      };
    } finally {
      await session.close();
    }
  };
}
