/**
 * Where the Web Surface meets the runner.
 *
 * Symmetric to `surfaces/desktop/surfaceOpener.ts`:
 * ADR-0001 forbids `runtime/` from importing `surfaces/web/`: the runner
 * knows the Execution Surface union, never its members. So the dependency runs
 * the other way — this module produces the `OpenedSurface` closure the runner
 * accepts, and the runner stays unaware that a web driver exists at all.
 *
 * `openWebSurface` does the launching, waiting, and session retention/cleanup;
 * this is the adapter between the browser session manager and the runner's
 * `OpenedSurface` shape.
 */

import { BrowserSessionManager, browserIdentityEvidence, retainedProfileKey } from "./sessionManager.js";
import type { BrowserDriver, RetainedSession } from "./sessionManager.js";
import type { OpenedSurface } from "../../runtime/runner.js";
import type { AppPaths } from "../../db/database.js";
import type { WorkflowSettings } from "../../../../src/types/workflow.js";
import type { WebSurface } from "../../runtime/surface.js";

export type WebSurfaceOpenerOptions = {
  /** Injected session manager, or created from options. */
  sessionManager?: BrowserSessionManager;
  appPaths?: AppPaths;
  driver?: BrowserDriver;
  retainedSessions?: Map<string, RetainedSession>;
  usesDefaultDriver?: boolean;
};

export type WebSurfaceOpenerRequest = {
  settings: WorkflowSettings;
  runId?: string | null;
  retention?: "close" | "retain";
  reuseRetainedSession?: boolean;
  retainedSessionWorkflowId?: string | null;
  signal?: AbortSignal;
};

export function createWebSurfaceOpener(options: WebSurfaceOpenerOptions = {}) {
  const sessionManager =
    options.sessionManager ??
    new BrowserSessionManager({
      appPaths: options.appPaths!,
      driver: options.driver,
      retainedSessions: options.retainedSessions,
      usesDefaultDriver: options.usesDefaultDriver,
    });

  const opener = function openWebSurface(
    request: WebSurfaceOpenerRequest,
  ): () => Promise<OpenedSurface> {
    return async () => {
      const launch = request.reuseRetainedSession
        ? await sessionManager.reuseRetainedSession({
            settings: request.settings,
            retainedSessionWorkflowId: request.retainedSessionWorkflowId,
          })
        : await sessionManager.launchFreshSession({
            settings: request.settings,
            retainedSessionWorkflowId: request.retainedSessionWorkflowId,
          });

      const surface: WebSurface = {
        kind: "web",
        context: launch.context,
        page: launch.page,
      };

      const retainedProfileName = retainedProfileKey(request.settings);
      const retainedWorkflowId = request.retainedSessionWorkflowId ?? null;

      let browserIdentity: Record<string, unknown> | null = null;
      if (request.runId) {
        try {
          browserIdentity = await browserIdentityEvidence(request.settings, request.runId);
        } catch {
          // Evidence collection should not fail session opening
        }
      }

      return {
        surface,
        warnings: [],
        outputs: browserIdentity ? { browser_identity: browserIdentity } : undefined,
        retainedSessionState: () =>
          sessionManager.getRetainedSessionState(retainedWorkflowId, retainedProfileName),
        close: async (closeOptions?: { status?: string; forceClose?: boolean }) => {
          const closeSurface =
            closeOptions?.forceClose === true ||
            request.retention === "close" ||
            (closeOptions?.status !== undefined && closeOptions.status !== "success") ||
            request.settings.browser_launch?.session_mode === "temporary";

          if (closeSurface) {
            await launch.context.close();
            sessionManager.forgetContext(launch.context);
          } else {
            sessionManager.retainSession(
              launch.context,
              launch.page,
              retainedWorkflowId,
              retainedProfileName,
            );
          }
        },
      };
    };
  };

  opener.sessionManager = sessionManager;
  return opener;
}
