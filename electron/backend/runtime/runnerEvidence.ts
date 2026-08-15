import fs from "node:fs/promises";
import path from "node:path";
import type { AppPaths } from "../db/database.js";
import { resolveEvidenceArtifact } from "../features/evidence/artifacts.js";
import { finalizeEvidenceOutputs } from "../features/evidence/model.js";
import { requireWebSurface } from "./surface.js";
import type { DesktopSurface } from "./surface.js";
import type { RunnerActionRuntime } from "./runnerActionExecutors.js";

export type RunEvidenceArtifact = {
  run_id: string;
  node_id: string | null;
  step_number: number | null;
  action_type: string;
  artifact_kind: "screenshot" | "download";
  path: string;
  created_at: string;
};

/**
 * Evidence collection is a runner-level concern, not an executor-level one: the
 * executor module never reads `evidence`. This is the narrow extra fact these
 * functions need on top of what an executor is given.
 */
export type RunnerEvidenceRuntime = RunnerActionRuntime & {
  evidence: RunEvidenceArtifact[];
};

export async function collectRunnerOutputs(runtime: RunnerActionRuntime) {
  // `__wamOutputs` is a browser-page convention and there is no desktop
  // equivalent — a window has no global object to read. Checked rather than
  // caught: relying on `requireWebSurface` to throw would make the normal
  // desktop path an exception, and hide a genuine web failure behind it.
  if (runtime.surface.kind !== "web") {
    return finalizeEvidenceOutputs(runtime.outputs);
  }

  try {
    // Inside the try on purpose: a page that refuses to evaluate means there
    // are no page outputs to merge, not that collecting outputs failed.
    const pageOutputs = await requireWebSurface(runtime.surface).page.evaluate<Record<string, unknown>>(
      "() => globalThis.window?.__wamOutputs ?? {}",
    );
    return finalizeEvidenceOutputs({ ...pageOutputs, ...runtime.outputs });
  } catch {
    return finalizeEvidenceOutputs(runtime.outputs);
  }
}

export async function captureFailureScreenshot(
  appPaths: AppPaths,
  runtime: RunnerEvidenceRuntime,
) {
  // This runs from inside the runner's catch block, so it must not throw: an
  // exception here would replace the failure the operator actually needs to
  // read with an error about capturing it.
  if (runtime.surface.kind === "desktop") {
    await captureDesktopFailureScreenshot(appPaths, runtime, runtime.surface);
    return;
  }
  if (runtime.surface.kind !== "web") return;

  const web = requireWebSurface(runtime.surface);
  if (!web.page.screenshot) return;
  const artifact = resolveEvidenceArtifact({
    evidenceDir: appPaths.evidenceDir,
    runId: runtime.runId,
    kind: "screenshots",
    stepNumber: runtime.currentStepNumber,
    nodeId: runtime.currentStepId,
    requestedName: "failure.png",
    fallbackName: "failure",
    extension: ".png",
  });
  await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
  const buffer = await web.page.screenshot({ fullPage: true });
  await fs.writeFile(artifact.absolutePath, buffer);
  recordRunnerEvidence(runtime, {
    actionType: runtime.currentActionType ?? "workflow",
    artifactKind: "screenshot",
    relativePath: artifact.relativePath,
  });
  runtime.outputs.failure_screenshot = artifact.relativePath;
}

export async function waitForRunnerDownload(
  appPaths: AppPaths,
  runtime: RunnerEvidenceRuntime,
  outputName: string,
  timeoutMs: number | null | undefined,
) {
  const web = requireWebSurface(runtime.surface);
  if (!web.page.waitForEvent) {
    throw new Error("wait_for_download requires driver download event support");
  }
  const download = await web.page.waitForEvent("download", {
    timeout: timeoutMs ?? undefined,
  });
  if (!download.saveAs) {
    throw new Error("wait_for_download requires driver download save support");
  }
  const suggestedName = download.suggestedFilename?.() ?? "download";
  const artifact = resolveEvidenceArtifact({
    evidenceDir: appPaths.evidenceDir,
    runId: runtime.runId,
    kind: "downloads",
    stepNumber: runtime.currentStepNumber,
    nodeId: runtime.currentStepId,
    requestedName: suggestedName,
    fallbackName: outputName || "download",
    extension: path.extname(suggestedName) || ".download",
  });
  await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
  await download.saveAs(artifact.absolutePath);
  recordRunnerEvidence(runtime, {
    actionType: "wait_for_download",
    artifactKind: "download",
    relativePath: artifact.relativePath,
  });
  return artifact.relativePath;
}

/**
 * The desktop half of failure capture.
 *
 * A failing step is exactly when the sensitivity flag matters most — the run is
 * already going wrong, and the web path bypassed step-level policy entirely. A
 * sensitive step that fails records the failure, the locator and the verdict,
 * and no image (`docs/domain/desktop/secrets-and-evidence.md`).
 *
 * The capture is written here rather than delegated to
 * `surfaces/desktop/evidence.ts`, at the cost of three duplicated lines,
 * because ADR-0001 keeps `runtime/` from importing a surface module. Reaching
 * the driver *through the surface* — whose type import erases at build time —
 * is what the union exists to allow.
 */
async function captureDesktopFailureScreenshot(
  appPaths: AppPaths,
  runtime: RunnerEvidenceRuntime,
  surface: DesktopSurface,
) {
  if (isSensitiveStep(runtime)) {
    runtime.outputs.failure_screenshot =
      "The step is marked sensitive, so no image was written.";
    return;
  }

  try {
    const artifact = resolveEvidenceArtifact({
      evidenceDir: appPaths.evidenceDir,
      runId: runtime.runId,
      kind: "screenshots",
      stepNumber: runtime.currentStepNumber,
      nodeId: runtime.currentStepId,
      requestedName: "failure.png",
      fallbackName: "failure",
      extension: ".png",
    });
    const base64 = await surface.driver.captureWindow(surface.binding, runtime.signal);
    await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
    await fs.writeFile(artifact.absolutePath, Buffer.from(base64, "base64"));

    recordRunnerEvidence(runtime, {
      actionType: runtime.currentActionType ?? "workflow",
      artifactKind: "screenshot",
      relativePath: artifact.relativePath,
    });
    runtime.outputs.failure_screenshot = artifact.relativePath;
  } catch {
    // The window may already be gone — that is often *why* the step failed.
    // Losing the image must not lose the error that caused it.
  }
}

function isSensitiveStep(runtime: RunnerEvidenceRuntime): boolean {
  return runtime.currentActionSensitive === true;
}

export function recordRunnerEvidence(
  runtime: RunnerEvidenceRuntime,
  artifact: {
    actionType: string;
    artifactKind: "screenshot" | "download";
    relativePath: string;
  },
) {
  runtime.evidence.push({
    run_id: runtime.runId,
    node_id: runtime.currentStepId,
    step_number: runtime.currentStepNumber,
    action_type: artifact.actionType,
    artifact_kind: artifact.artifactKind,
    path: artifact.relativePath,
    created_at: new Date().toISOString(),
  });
}
