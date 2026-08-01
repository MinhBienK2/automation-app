import fs from "node:fs/promises";
import path from "node:path";
import type { AppPaths } from "../db/database.js";
import { resolveEvidenceArtifact } from "../features/evidence/artifacts.js";
import { finalizeEvidenceOutputs } from "../features/evidence/model.js";
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
  try {
    const pageOutputs = await runtime.page.evaluate<Record<string, unknown>>(
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
  if (!runtime.page.screenshot) return;
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
  const buffer = await runtime.page.screenshot({ fullPage: true });
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
  if (!runtime.page.waitForEvent) {
    throw new Error("wait_for_download requires driver download event support");
  }
  const download = await runtime.page.waitForEvent("download", {
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
