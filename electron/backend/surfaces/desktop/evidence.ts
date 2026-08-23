/**
 * What a desktop run is allowed to record.
 *
 * Resolves [#52](https://github.com/MinhBienK2/automation-app/issues/52), under
 * the constraint [#46](https://github.com/MinhBienK2/automation-app/issues/46)
 * established: on this surface the accessibility tree is a *larger* leak than
 * any screenshot, because a `Document` element's `value` is the whole open
 * file — plain text, no image involved. So the rule that matters most here is
 * about what this module refuses to touch.
 *
 * The split, stated once:
 *
 * - **Evidence** — a window screenshot, and the value a `desktop_read_text`
 *   step was asked to read. Both are things the operator chose to record.
 * - **Trace** — the locator that resolved, the role and label it matched, the
 *   `verify_state` verdict, the Capability Tier. These explain *how* a step
 *   behaved and belong on the step, not in the evidence directory.
 * - **Neither** — the Element Snapshot itself. Never persisted, in any form.
 *
 * Spec: `docs/domain/desktop/secrets-and-evidence.md`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { resolveEvidenceArtifact } from "../../evidence/artifacts.js";
import type { DesktopSurface } from "../../runtime/surface.js";
import type { SnapshotElement } from "./types.js";

/** UIA control types that hold a secret by construction. */
const PASSWORD_ROLES = new Set(["password", "passwordbox", "passwordedit"]);

export type DesktopCaptureRequest = {
  surface: DesktopSurface;
  evidenceDir: string;
  runId: string;
  stepNumber: number | null;
  nodeId: string | null;
  requestedName?: string | null;
  signal?: AbortSignal;
};

export type DesktopCapture =
  | { captured: true; relativePath: string }
  | { captured: false; reason: string };

/**
 * Writes a window screenshot, or explains why it did not.
 *
 * Never throws for a suppressed capture: "this step was marked sensitive" is a
 * normal outcome that the step should record, not a failure that should end a
 * run.
 */
export async function captureDesktopScreenshot(
  request: DesktopCaptureRequest & { sensitive?: boolean },
): Promise<DesktopCapture> {
  if (request.sensitive) {
    return {
      captured: false,
      reason: "The step is marked sensitive, so no image was written.",
    };
  }

  const artifact = resolveEvidenceArtifact({
    evidenceDir: request.evidenceDir,
    runId: request.runId,
    kind: "screenshots",
    stepNumber: request.stepNumber,
    nodeId: request.nodeId,
    requestedName: request.requestedName ?? undefined,
    fallbackName: "window",
    extension: ".png",
  });

  const base64 = await request.surface.driver.captureWindow(
    request.surface.binding,
    request.signal,
  );
  await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
  await fs.writeFile(artifact.absolutePath, Buffer.from(base64, "base64"));

  return { captured: true, relativePath: artifact.relativePath };
}

/**
 * Whether a step must not produce an image or a recorded value.
 *
 * The operator's flag wins when set. Where it is unset, a password-typed target
 * infers it: forgetting the flag once writes a password to disk permanently,
 * and the metadata that would have prevented it is already in the snapshot the
 * action took anyway.
 */
export function isSensitiveStep(options: {
  flag?: boolean | null;
  element?: SnapshotElement | null;
  /** True when the value being typed came from secret storage. */
  fromSecretStorage?: boolean;
}): boolean {
  if (options.flag === true) return true;
  if (options.fromSecretStorage) return true;
  if (options.flag === false) return false;
  return isPasswordElement(options.element);
}

export function isPasswordElement(element: SnapshotElement | null | undefined): boolean {
  if (!element) return false;
  return PASSWORD_ROLES.has(element.role.toLowerCase());
}

/**
 * The trace a desktop step leaves behind is `SurfaceStepTrace`, declared in
 * `runtime/actionTrace.ts` and written by the executors as a step proceeds.
 *
 * It lives there rather than here because ADR-0001 runs the dependency one way:
 * the runner composes the step's trace and must not import a surface to do it.
 * Its shape is the enforcement of #46 — there is no `value` field, so document
 * contents cannot reach a run's steps.
 */
