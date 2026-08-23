// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { captureDesktopScreenshot, isSensitiveStep } from "./evidence.js";
import type { DesktopSurface } from "../../runtime/surface.js";
import type { SnapshotElement } from "./types.js";

let evidenceDir: string;

beforeEach(async () => {
  evidenceDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-evidence-"));
});

afterEach(async () => {
  await fs.rm(evidenceDir, { recursive: true, force: true });
});

const PNG_BASE64 = Buffer.from("not really a png").toString("base64");

function surfaceWith(captureWindow: () => Promise<string>): DesktopSurface {
  return {
    kind: "desktop",
    driver: { captureWindow } as never,
    binding: { pid: "1", windowId: "2", attached: false },
  };
}

function element(over: Partial<SnapshotElement> = {}): SnapshotElement {
  return {
    element_index: 0,
    element_token: "snap:0",
    role: "Edit",
    depth: 1,
    ...over,
  };
}

describe("captureDesktopScreenshot", () => {
  test("writes the window image and returns a path relative to the evidence dir", async () => {
    const result = await captureDesktopScreenshot({
      surface: surfaceWith(async () => PNG_BASE64),
      evidenceDir,
      runId: "run-1",
      stepNumber: 3,
      nodeId: "node-a",
    });

    expect(result).toMatchObject({ captured: true });
    if (!result.captured) return;
    expect(result.relativePath).not.toContain(evidenceDir);
    await expect(
      fs.readFile(path.join(evidenceDir, result.relativePath), "utf8"),
    ).resolves.toBe("not really a png");
  });

  test("a sensitive step records why there is no image instead of failing", async () => {
    const captureWindow = vi.fn(async () => PNG_BASE64);

    const result = await captureDesktopScreenshot({
      surface: surfaceWith(captureWindow),
      evidenceDir,
      runId: "run-1",
      stepNumber: 1,
      nodeId: "node-a",
      sensitive: true,
    });

    expect(result).toMatchObject({ captured: false });
    // The point is that nothing was captured — not that an image was captured
    // and then discarded, which would have put it in the driver's memory and
    // its logs.
    expect(captureWindow).not.toHaveBeenCalled();
  });
});

describe("isSensitiveStep", () => {
  test("a password-typed target is sensitive without the operator saying so", () => {
    // Forgetting the flag once writes a password to disk permanently, and the
    // metadata that would prevent it is already in the snapshot.
    expect(isSensitiveStep({ element: element({ role: "PasswordBox" }) })).toBe(true);
  });

  test("an explicit flag beats the inference in both directions", () => {
    expect(isSensitiveStep({ flag: true, element: element({ role: "Edit" }) })).toBe(true);
    expect(isSensitiveStep({ flag: false, element: element({ role: "PasswordBox" }) })).toBe(
      false,
    );
  });

  test("a value from secret storage is sensitive whatever the control looks like", () => {
    // Provenance decides, not the shape of the target: a secret typed into a
    // plain text field is still a secret on the screen.
    expect(
      isSensitiveStep({ flag: false, fromSecretStorage: true, element: element() }),
    ).toBe(true);
  });

  test("an ordinary step with no flag is not sensitive", () => {
    expect(isSensitiveStep({ element: element({ role: "Button" }) })).toBe(false);
  });
});
