// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { executeRegisteredAction } from "../../../actions/execution.js";
import { DesktopDriverClient } from "../driverClient.js";
import type { DriverTransport } from "../driverClient.js";
import { createDesktopActionExecutors } from "./index.js";
import type { VariableScope } from "../../../runtime/actionRuntime.js";
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

function surfaceWith(replies: Record<string, unknown>, fallback: unknown = { ok: true }) {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const transport: DriverTransport = {
    callTool: async (tool, args) => {
      calls.push({ tool, args });
      return tool in replies ? replies[tool] : fallback;
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
    currentStepMetadata: null,
    surface,
  };
}

const SEVEN = {
  kind: "element" as const,
  locator: { role: "Button", name: { kind: "exact" as const, value: "Seven" } },
};

async function run(runtime: ReturnType<typeof runtimeFor>, action: unknown) {
  await executeRegisteredAction(createDesktopActionExecutors(runtime), action as ActionConfig);
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
      verify_state: { structuredJson: { satisfied: false } },
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
      verify_state: { structuredJson: { something_else: true } },
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
      verify_state: { structuredJson: { satisfied: true } },
    });

    await expect(
      run(runtimeFor(surface), {
        type: "desktop_click",
        config: { target: SEVEN, expect: [{ kind: "window_exists" }] },
      }),
    ).resolves.toBeUndefined();
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

    expect(() => createDesktopActionExecutors(webRuntime)).toThrow(/belongs to exactly one surface/);
  });
});

describe("screenshots", () => {
  test("refuse to run until the desktop evidence path exists", async () => {
    // Capturing an artifact nothing records would look like it worked.
    const { surface } = surfaceWith({});
    const spy = vi.fn();

    await expect(
      run(runtimeFor(surface), { type: "desktop_screenshot", config: {} }),
    ).rejects.toThrow(/evidence path/);
    expect(spy).not.toHaveBeenCalled();
  });
});
