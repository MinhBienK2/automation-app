// @vitest-environment node

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createHostDriver } from "./driverHost.js";
import { DesktopDriverClient, type DriverTransport } from "./driverClient.js";
import { createDesktopActionExecutors } from "./executors/index.js";
import type { WindowBinding } from "./types.js";

/**
 * The real thing: OUR executors and OUR `DesktopDriverClient` driving a real
 * Windows application through the real `@trycua/cua-driver`. Not the fake
 * transport the unit tests use, and not the driver called directly the way
 * `scripts/desktop-smoke.mjs` does — the whole stack, end to end.
 *
 * Off by default, because it launches a real app and only runs on a machine
 * with the platform binary. Turn it on with:
 *
 *     RUN_DESKTOP_SMOKE=1 npx vitest run electron/backend/surfaces/desktop/realDriver.smoke.test.ts
 *
 * The transport bridges object-args to the driver's JSON string exactly as the
 * production `createHostDispatcher` does, so the client cannot tell this apart
 * from talking to the utility-process host.
 */

const enabled = process.env.RUN_DESKTOP_SMOKE === "1";

describe.runIf(enabled)("real driver + real Notepad, through our own executors", () => {
  let client: DesktopDriverClient;
  let binding: WindowBinding;
  let launchedPid: string | null = null;

  beforeAll(async () => {
    const host = await createHostDriver();
    const transport: DriverTransport = {
      callTool: (tool, args, signal) => host.callTool(tool, JSON.stringify(args), signal),
    };
    client = new DesktopDriverClient(transport);

    const launch = await client.launchApp({ kind: "app_id", value: "notepad.exe" });
    launchedPid = launch.pid;

    // The window is not always in the launch payload, and it needs a moment to
    // exist. Poll list_windows for one that belongs to the pid we launched.
    binding = await waitForWindow(client, launch.pid);
  }, 60_000);

  afterAll(async () => {
    if (launchedPid) {
      try {
        await client.killApp(launchedPid);
      } catch {
        // The driver only kills what it launched; if that guard refuses, the
        // operator closes the window. Not the test's failure to report.
      }
    }
  });

  function runtimeFor() {
    const runtime = {
      runId: "real-smoke",
      settings: {} as never,
      outputs: {} as Record<string, unknown>,
      elementRefs: new Map(),
      clipboard: "",
      currentStepNumber: 1,
      currentStepId: "node-1",
      currentStepName: null,
      currentActionType: null,
      currentActionSummary: null,
      currentActionSensitive: null,
      currentSurfaceTrace: null,
      currentStepMetadata: null,
      signal: undefined as AbortSignal | undefined,
      surface: { kind: "desktop" as const, driver: client, binding },
    };
    return runtime;
  }

  const deps = {
    evidenceDir: process.env.TEMP ?? ".",
    recordEvidence: () => {},
  };

  async function run(action: unknown) {
    const runtime = runtimeFor();
    const executors = createDesktopActionExecutors(runtime as never, deps as never);
    const executor = (executors as Record<string, (a: unknown) => Promise<void>>)[
      (action as { type: string }).type
    ];
    await executor(action);
    return runtime;
  }

  test("the window bound", () => {
    expect(binding.pid).toBeTruthy();
    expect(binding.windowId).toBeTruthy();
  });

  test("clipboard round-trips through set + read", async () => {
    const text = "cua real-smoke clipboard 42";
    await run({ type: "desktop_set_clipboard", config: { text } });
    const runtime = await run({ type: "desktop_read_clipboard", config: { output_name: "clip" } });
    expect(runtime.outputs.clip).toBe(text);
  });

  test("set_value then read_text round-trips through the editor's Document", async () => {
    const target = { kind: "element", locator: { role: "Document" } };
    const value = "hello from the real end-to-end test";
    await run({ type: "desktop_set_value", config: { target, value } });
    const runtime = await run({
      type: "desktop_read_text",
      config: { target, output_name: "doc" },
    });
    expect(String(runtime.outputs.doc)).toContain("hello from the real end-to-end test");
  });

  test("read_table returns rows for the window subtree", async () => {
    // The Notepad window is not a grid, but read_table is a generic subtree
    // reader; what matters here is that it resolves an element and returns an
    // array against a real accessibility tree rather than throwing.
    const runtime = await run({
      type: "desktop_read_table",
      config: { target: { kind: "element", locator: { role: "Document" } }, output_name: "rows" },
    });
    expect(Array.isArray(runtime.outputs.rows)).toBe(true);
  });

  test("scroll resolves an element and drives the real wheel", async () => {
    await expect(
      run({
        type: "desktop_scroll",
        config: { target: { kind: "element", locator: { role: "Document" } }, direction: "down" },
      }),
    ).resolves.toBeDefined();
  });

  test("hover moves the OS pointer onto a resolved element", async () => {
    await expect(
      run({
        type: "desktop_hover",
        config: { target: { kind: "element", locator: { role: "Document" } } },
      }),
    ).resolves.toBeDefined();
  });
});

async function waitForWindow(
  client: DesktopDriverClient,
  pid: string,
  attempts = 20,
): Promise<WindowBinding> {
  for (let i = 0; i < attempts; i += 1) {
    const windows = await client.listWindows();
    const match =
      windows.find((w) => w.pid === pid) ??
      windows.find((w) => (w.title ?? "").toLowerCase().includes("notepad"));
    if (match) {
      return { pid, windowId: match.window_id, title: match.title, attached: false };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No window for pid ${pid} after ${attempts} attempts`);
}
