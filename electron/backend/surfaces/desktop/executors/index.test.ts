// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { executeRegisteredAction } from "../../../actions/execution.js";
import { DesktopDriverClient } from "../driverClient.js";
import type { DriverTransport } from "../driverClient.js";
import { createDesktopActionExecutors } from "./index.js";
import type { VariableScope } from "../../../runtime/actionRuntime.js";
import type { SurfaceStepTrace } from "../../../runtime/actionTrace.js";
import type { ActionConfig } from "../../../../src/types/workflow.js";

/**
 * Driven through a fake transport, so these run on any machine: the driver's
 * measured behaviour is what the client already encodes, and what matters here
 * is the cycle above it — snapshot, resolve, act, verify.
 */

const CALCULATOR = {
  snapshot_id: "s00000001",
  element_count: 3,
  elements: [
    { depth: 3, element_index: 1, element_token: "s00000001:1", role: "Text", label: "Display is 0" },
    { depth: 4, element_index: 27, element_token: "s00000001:27", role: "Button", label: "Seven" },
    { depth: 4, element_index: 30, element_token: "s00000001:30", role: "MenuItem", label: "File" },
  ],
};

/**
 * `structuredJson` is a **string** of JSON on the wire, not an object. Encoded
 * centrally here so every fixture below reads as the payload it is, and none of
 * them can quietly assert a shape the driver does not send.
 */
function asEnvelope(reply: unknown): unknown {
  const record = reply as { structuredJson?: unknown };
  if (record && typeof record === "object" && typeof record.structuredJson === "object") {
    return { ...record, structuredJson: JSON.stringify(record.structuredJson) };
  }
  return reply;
}

function surfaceWith(replies: Record<string, unknown>, fallback: unknown = { ok: true }) {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const transport: DriverTransport = {
    callTool: async (tool, args) => {
      calls.push({ tool, args });
      return asEnvelope(tool in replies ? replies[tool] : fallback);
    },
  };

  return {
    calls,
    surface: {
      kind: "desktop" as const,
      driver: new DesktopDriverClient(transport),
      binding: { pid: "4212", windowId: "131204", attached: false },
    },
  };
}

function runtimeFor(surface: ReturnType<typeof surfaceWith>["surface"]): VariableScope & {
  surface: typeof surface;
  currentSurfaceTrace: SurfaceStepTrace | null;
} {
  return {
    runId: "run-1",
    settings: {} as VariableScope["settings"],
    outputs: {},
    elementRefs: new Map(),
    clipboard: "",
    currentStepNumber: 1,
    currentStepId: "node-1",
    currentStepName: "Click Seven",
    currentActionType: null,
    currentActionSummary: null,
    currentActionSensitive: null,
    currentSurfaceTrace: null,
    currentStepMetadata: null,
    surface,
  };
}

const SEVEN = {
  kind: "element" as const,
  locator: { role: "Button", name: { kind: "exact" as const, value: "Seven" } },
};

const recordedEvidence: Array<{ actionType: string; relativePath: string }> = [];

function executorDeps(evidenceDir = "/tmp/desktop-evidence-unused") {
  return {
    evidenceDir,
    recordEvidence: (_runtime: unknown, artifact: { actionType: string; relativePath: string }) =>
      void recordedEvidence.push(artifact),
  };
}

async function run(runtime: ReturnType<typeof runtimeFor>, action: unknown, evidenceDir?: string) {
  await executeRegisteredAction(
    createDesktopActionExecutors(runtime, executorDeps(evidenceDir) as never),
    action as ActionConfig,
  );
}

describe("element-addressed actions", () => {
  test("take a fresh snapshot and act on the token it minted", async () => {
    // Never a stored token: `element_token` embeds the snapshot id, and the
    // driver rejects one from a snapshot that has been replaced.
    const { surface, calls } = surfaceWith({ get_window_state: { structuredJson: CALCULATOR } });

    await run(runtimeFor(surface), { type: "desktop_click", config: { target: SEVEN } });

    expect(calls.map((c) => c.tool)).toEqual(["get_window_state", "click"]);
    expect(calls[1].args).toMatchObject({ element_token: "s00000001:27" });
  });

  test("a missing element names the tier, so the operator repairs the right thing", async () => {
    const { surface } = surfaceWith({ get_window_state: { structuredJson: CALCULATOR } });

    await expect(
      run(runtimeFor(surface), {
        type: "desktop_click",
        config: {
          target: { kind: "element", locator: { role: "Button", name: { kind: "exact", value: "Nine" } } },
        },
      }),
    ).rejects.toThrow(/not_found.*window tier: element/);
  });

  test("a window that lost its tree reports degraded, not a missing element", async () => {
    const { surface } = surfaceWith({
      get_window_state: {
        structuredJson: {
          snapshot_id: "s3",
          element_count: 0,
          elements: [],
          degraded: true,
          degraded_reason: "ax_tree_empty: the UIA walk returned no actionable elements.",
        },
      },
    });

    await expect(
      run(runtimeFor(surface), { type: "desktop_click", config: { target: SEVEN } }),
    ).rejects.toThrow(/degraded.*window tier: pixel/);
  });

  test("a pixel target skips the snapshot entirely", async () => {
    const { surface, calls } = surfaceWith({});

    await run(runtimeFor(surface), {
      type: "desktop_click",
      config: { target: { kind: "pixel", x: 40, y: 405, origin: "window" } },
    });

    expect(calls.map((c) => c.tool)).toEqual(["click"]);
    expect(calls[0].args).toMatchObject({ x: 40, y: 405 });
  });
});

describe("verification", () => {
  test("a stated expectation is checked, and a failed check fails the action", async () => {
    const { surface } = surfaceWith({
      get_window_state: { structuredJson: CALCULATOR },
      verify_state: { structuredJson: { status: "unsatisfied" } },
    });

    await expect(
      run(runtimeFor(surface), {
        type: "desktop_set_value",
        config: { target: SEVEN, value: "42", expect: [{ kind: "window_exists" }] },
      }),
    ).rejects.toThrow(/did not take effect/);
  });

  test("an unreadable verdict fails as unverified rather than passing", async () => {
    // `isError` has been observed true for a successful click, so a driver
    // answer that cannot be read is not evidence of anything.
    const { surface } = surfaceWith({
      get_window_state: { structuredJson: CALCULATOR },
      verify_state: { structuredJson: { status: "unknown" } },
    });

    await expect(
      run(runtimeFor(surface), {
        type: "desktop_type_text",
        config: { target: SEVEN, text: "hello", expect: [{ kind: "window_exists" }] },
      }),
    ).rejects.toThrow(/could not be verified/);
  });

  test("a driver reporting failure on a verified action does not fail the step", async () => {
    const { surface } = surfaceWith({
      get_window_state: { structuredJson: CALCULATOR },
      click: {
        isError: true,
        content: [{ type: "text", text: "The operation completed successfully. (0x00000000)" }],
      },
      verify_state: { structuredJson: { status: "satisfied" } },
    });

    await expect(
      run(runtimeFor(surface), {
        type: "desktop_click",
        config: { target: SEVEN, expect: [{ kind: "window_exists" }] },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("the trace a step leaves", () => {
  test("names the element, how it matched, the tier and the verdict", async () => {
    const { surface } = surfaceWith({
      get_window_state: { structuredJson: CALCULATOR },
      verify_state: { structuredJson: { status: "satisfied" } },
    });
    const runtime = runtimeFor(surface);

    await run(runtime, {
      type: "desktop_click",
      config: { target: SEVEN, expect: [{ kind: "window_exists" }] },
    });

    expect(runtime.currentSurfaceTrace).toEqual({
      role: "Button",
      label: "Seven",
      matched: "name",
      tier: "element",
      verified: true,
    });
  });

  test("carries no value, however the element was read", async () => {
    // The leak #46 found is a `Document` element's `value` being the whole open
    // file. A trace that carried it would put that into every run's steps.
    const { surface } = surfaceWith({
      get_window_state: {
        structuredJson: {
          ...CALCULATOR,
          elements: [{ ...CALCULATOR.elements[0], value: "sk-live-not-for-the-trace" }],
        },
      },
    });
    const runtime = runtimeFor(surface);

    await run(runtime, {
      type: "desktop_read_text",
      config: {
        target: { kind: "element", locator: { role: "Text", name: { kind: "prefix", value: "Display" } } },
        output_name: "reading",
      },
    });

    expect(JSON.stringify(runtime.currentSurfaceTrace)).not.toContain("sk-live");
  });

  test("survives the failure it exists to explain", async () => {
    // The step that most needs a trace is the one that threw, and the useful
    // half — what the window was like when it looked — is known before the
    // resolution fails.
    const { surface } = surfaceWith({ get_window_state: { structuredJson: CALCULATOR } });
    const runtime = runtimeFor(surface);

    await expect(
      run(runtime, {
        type: "desktop_click",
        config: {
          target: { kind: "element", locator: { role: "Button", name: { kind: "exact", value: "Nine" } } },
        },
      }),
    ).rejects.toThrow();

    expect(runtime.currentSurfaceTrace).toEqual({ tier: "element" });
  });

  test("a step with nothing to check reads as unverified, not as success", async () => {
    const { surface } = surfaceWith({ get_window_state: { structuredJson: CALCULATOR } });
    const runtime = runtimeFor(surface);

    await run(runtime, { type: "desktop_click", config: { target: SEVEN } });

    expect(runtime.currentSurfaceTrace).toMatchObject({ verified: "unverified" });
  });

  test("a pixel step is marked as one, so its fragility is visible later", async () => {
    const { surface } = surfaceWith({});
    const runtime = runtimeFor(surface);

    await run(runtime, {
      type: "desktop_click",
      config: { target: { kind: "pixel", x: 120, y: 240, origin: "window" } },
    });

    expect(runtime.currentSurfaceTrace).toMatchObject({ matched: "pixel" });
  });

  test("records the ordinal that disambiguated, not the name that did not", async () => {
    // A step that used to match by name and now matches by ordinal is one
    // layout change away from acting on the wrong element.
    const { surface } = surfaceWith({
      get_window_state: {
        structuredJson: {
          snapshot_id: "s2",
          element_count: 2,
          elements: [
            { depth: 4, element_index: 1, element_token: "s2:1", role: "Button", label: "Seven" },
            { depth: 4, element_index: 2, element_token: "s2:2", role: "Button", label: "Seven" },
          ],
        },
      },
    });
    const runtime = runtimeFor(surface);

    await run(runtime, {
      type: "desktop_click",
      config: {
        target: {
          kind: "element",
          locator: { role: "Button", name: { kind: "exact", value: "Seven" }, ordinal: 1 },
        },
      },
    });

    expect(runtime.currentSurfaceTrace).toMatchObject({ matched: "ordinal" });
  });
});

describe("reading text", () => {
  test("writes the element's text into a named output", async () => {
    // This is the bridge into shared control flow: the output is an ordinary
    // run output, so `set_variable` and every assertion consume it unchanged.
    const { surface } = surfaceWith({
      get_window_state: {
        structuredJson: {
          ...CALCULATOR,
          elements: [{ ...CALCULATOR.elements[0], value: "  Display is 42  " }],
        },
      },
    });
    const runtime = runtimeFor(surface);

    await run(runtime, {
      type: "desktop_read_text",
      config: {
        target: { kind: "element", locator: { role: "Text", name: { kind: "prefix", value: "Display" } } },
        output_name: "reading",
      },
    });

    expect(runtime.outputs.reading).toBe("Display is 42");
  });
});

describe("menus", () => {
  test("re-snapshots per level, because a submenu does not exist until it opens", async () => {
    const { surface, calls } = surfaceWith({ get_window_state: { structuredJson: CALCULATOR } });

    await run(runtimeFor(surface), {
      type: "desktop_invoke_menu",
      config: { target: SEVEN, path: ["File", "File"] },
    });

    expect(calls.map((c) => c.tool)).toEqual([
      "get_window_state",
      "click",
      "get_window_state",
      "click",
    ]);
  });
});

describe("surface mismatch", () => {
  test("a desktop action on a web run says so plainly", () => {
    const webRuntime = runtimeFor({
      kind: "web",
      page: {},
      context: {},
    } as never);

    expect(() => createDesktopActionExecutors(webRuntime, executorDeps() as never)).toThrow(
      /belongs to exactly one surface/,
    );
  });
});

describe("screenshots", () => {
  test("write the window image and record it as evidence", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-executor-evidence-"));
    // The image is an envelope attachment, not a payload field — measured. The
    // payload carries only the dimensions and the mime type.
    const { surface } = surfaceWith({
      get_window_state: {
        structuredJson: { ...CALCULATOR, screenshot_width: 320, screenshot_mime_type: "image/png" },
        images: [{ mimeType: "image/png", dataBase64: Buffer.from("png").toString("base64") }],
      },
    });
    recordedEvidence.length = 0;

    await run(runtimeFor(surface), { type: "desktop_screenshot", config: {} }, dir);

    expect(recordedEvidence).toHaveLength(1);
    expect(recordedEvidence[0].actionType).toBe("desktop_screenshot");
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("a sensitive step records no artifact at all", async () => {
    // The image is never taken, not taken and discarded: a captured image
    // exists in the driver's memory and its logs before we could drop it.
    const { surface, calls } = surfaceWith({});
    recordedEvidence.length = 0;

    await run(runtimeFor(surface), {
      type: "desktop_screenshot",
      config: { sensitive: true, output_name: "shot" },
    });

    expect(recordedEvidence).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});
