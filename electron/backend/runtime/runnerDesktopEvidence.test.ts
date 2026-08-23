// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { captureFailureScreenshot } from "./runnerEvidence.js";
import type { RunnerEvidenceRuntime } from "./runnerEvidence.js";
import type { AppPaths } from "../db/database.js";

/**
 * Failure capture on the Desktop Surface.
 *
 * The case that matters is the sensitive one, and it is the one that is easy to
 * get wrong: the flag lives on the *action config*, and a failure path reading
 * it from anywhere else silently degrades to "not sensitive" — writing exactly
 * the image the flag exists to prevent, at the moment the run is already going
 * wrong. See `docs/domain/desktop/secrets-and-evidence.md`.
 */

let evidenceDir: string;

beforeEach(async () => {
  evidenceDir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-desktop-evidence-"));
});

afterEach(async () => {
  await fs.rm(evidenceDir, { recursive: true, force: true });
});

function runtimeFor(
  captureWindow: () => Promise<string>,
  over: Partial<RunnerEvidenceRuntime> = {},
): RunnerEvidenceRuntime {
  return {
    runId: "run-1",
    outputs: {},
    evidence: [],
    currentStepNumber: 2,
    currentStepId: "node-a",
    currentActionType: "desktop_type_text",
    currentActionSensitive: null,
    currentStepMetadata: null,
    surface: {
      kind: "desktop",
      driver: { captureWindow } as never,
      binding: { pid: "1", windowId: "2", attached: false },
    },
    ...over,
  } as unknown as RunnerEvidenceRuntime;
}

const appPaths = { evidenceDir: "" } as AppPaths;

describe("captureFailureScreenshot on the Desktop Surface", () => {
  test("writes the window image for an ordinary failing step", async () => {
    const runtime = runtimeFor(async () => Buffer.from("png").toString("base64"));

    await captureFailureScreenshot({ ...appPaths, evidenceDir }, runtime);

    expect(runtime.evidence).toHaveLength(1);
    expect(String(runtime.outputs.failure_screenshot)).toContain("screenshots");
  });

  test("a step marked sensitive on its config produces no image", async () => {
    const captureWindow = vi.fn(async () => Buffer.from("png").toString("base64"));
    const runtime = runtimeFor(captureWindow, { currentActionSensitive: true });

    await captureFailureScreenshot({ ...appPaths, evidenceDir }, runtime);

    expect(runtime.evidence).toHaveLength(0);
    // Never captured, not captured and dropped: an image that reached the
    // driver has already been in its memory and its logs.
    expect(captureWindow).not.toHaveBeenCalled();
    expect(String(runtime.outputs.failure_screenshot)).toMatch(/sensitive/i);
  });

  test("a driver that cannot answer loses the image, never the failure", async () => {
    // The window is often gone — that is frequently *why* the step failed.
    const runtime = runtimeFor(async () => {
      throw new Error("the host panicked");
    });

    await expect(
      captureFailureScreenshot({ ...appPaths, evidenceDir }, runtime),
    ).resolves.toBeUndefined();
    expect(runtime.evidence).toHaveLength(0);
  });
});
