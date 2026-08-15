// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { DesktopDriverClient, DesktopDriverError } from "./driverClient.js";
import type { DriverTransport } from "./driverClient.js";
import type { WindowBinding } from "./types.js";

/**
 * The client is the hand-written typed layer ADR-0001 requires: 31 of the
 * driver's 54 tools — including every element-addressed one — exist only
 * behind `callTool(name, argumentsJson)`.
 *
 * Two measured behaviours drive most of what is asserted here:
 * a missing required field raises a Rust panic that kills the host process,
 * and `isError` has been observed true for a successful click.
 */

const BINDING: WindowBinding = { pid: "4212", windowId: "131204", attached: false };

function transportOf(reply: unknown = { ok: true }) {
  const callTool = vi.fn(async () => reply);
  return { transport: { callTool } as DriverTransport, callTool };
}

function argsOf(callTool: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  return callTool.mock.calls[call][1] as Record<string, unknown>;
}

const SNAPSHOT_REPLY = {
  content: [
    {
      type: "text",
      text: JSON.stringify({
        snapshot_id: "s00000001",
        element_count: 1,
        elements: [{ depth: 1, element_index: 0, element_token: "s00000001:0", role: "Button", label: "Seven" }],
      }),
    },
  ],
};

describe("argument construction", () => {
  test("injects the mandatory scope, which cannot be left to the caller", () => {
    // `DesktopScope` has one legal value and omitting it panics the process.
    const { transport, callTool } = transportOf();

    return new DesktopDriverClient(transport).typeText(BINDING, { text: "hello" }).then(() => {
      expect(argsOf(callTool)).toMatchObject({ scope: 0, text: "hello" });
    });
  });

  test("sends ids JSON can carry, and reads back the bigint ones the SDK returns", async () => {
    // The SDK types pid and windowId as bigint, and structured clone carries
    // bigint through the utility-process port intact — where JSON.stringify
    // would throw. Ids are strings from the moment they enter this layer.
    const { transport, callTool } = transportOf({ pid: 4212n, windows: [] });

    const launched = await new DesktopDriverClient(transport).launchApp({
      kind: "app_id",
      value: "notepad",
    });

    expect(launched.pid).toBe("4212");
    expect(() => JSON.stringify(argsOf(callTool))).not.toThrow();
  });

  test("names the bound window on every window-scoped call, as integers", async () => {
    // Ids are strings inside the application, because they arrive as bigint and
    // `JSON.stringify` refuses those. On the wire they must be numbers: the
    // driver answers "Missing required integer field pid." to a string.
    const { transport, callTool } = transportOf(SNAPSHOT_REPLY);

    await new DesktopDriverClient(transport).getWindowState(BINDING);

    expect(argsOf(callTool)).toMatchObject({ pid: 4212, window_id: 131204 });
  });

  test("refuses an id the driver could not read as an integer", async () => {
    const { transport, callTool } = transportOf(SNAPSHOT_REPLY);

    await expect(
      new DesktopDriverClient(transport).getWindowState({
        pid: "not-a-pid",
        windowId: "131204",
        attached: false,
      }),
    ).rejects.toBeInstanceOf(DesktopDriverError);
    expect(callTool).not.toHaveBeenCalled();
  });

  test("addresses elements by token, never by the bare index the driver rejects", async () => {
    const { transport, callTool } = transportOf();

    await new DesktopDriverClient(transport).click(BINDING, { elementToken: "s00000001:27" });

    expect(argsOf(callTool)).toMatchObject({ element_token: "s00000001:27" });
    expect(argsOf(callTool)).not.toHaveProperty("element_index");
  });

  test("routes button and count to the tool the driver actually exposes", async () => {
    const { transport, callTool } = transportOf();
    const client = new DesktopDriverClient(transport);

    await client.click(BINDING, { elementToken: "t:1", button: "right" });
    await client.click(BINDING, { elementToken: "t:1", count: 2 });
    await client.click(BINDING, { elementToken: "t:1", button: "middle" });

    expect(callTool.mock.calls[0][0]).toBe("right_click");
    expect(callTool.mock.calls[1][0]).toBe("double_click");
    expect(callTool.mock.calls[2][0]).toBe("click");
    expect(argsOf(callTool, 2)).toMatchObject({ button: "middle" });
  });

  test("refuses a right double-click rather than quietly making it a left one", async () => {
    // `double_click` has no measured way to say which button. Doing something
    // other than what the step says is worse than not running.
    const { transport, callTool } = transportOf();

    await expect(
      new DesktopDriverClient(transport).click(BINDING, {
        elementToken: "t:1",
        button: "right",
        count: 2,
      }),
    ).rejects.toThrow(/double click is left-button only/i);
    expect(callTool).not.toHaveBeenCalled();
  });

  test("refuses a count the desktop action family does not define", async () => {
    const { transport } = transportOf();

    await expect(
      new DesktopDriverClient(transport).click(BINDING, { elementToken: "t:1", count: 3 }),
    ).rejects.toBeInstanceOf(DesktopDriverError);
  });

  test("refuses a request missing a required field instead of sending it", async () => {
    // Sending it would panic the driver host. Failing here costs one action;
    // panicking costs the whole run and takes the host with it.
    const { transport, callTool } = transportOf();

    await expect(
      new DesktopDriverClient(transport).click(BINDING, { elementToken: "" }),
    ).rejects.toBeInstanceOf(DesktopDriverError);
    expect(callTool).not.toHaveBeenCalled();
  });

  test("refuses a pixel target with no coordinates rather than clicking (0,0)", async () => {
    const { transport, callTool } = transportOf();

    await expect(
      new DesktopDriverClient(transport).click(BINDING, { x: 10 } as never),
    ).rejects.toBeInstanceOf(DesktopDriverError);
    expect(callTool).not.toHaveBeenCalled();
  });
});

describe("isError is recorded, never believed", () => {
  test("a click reporting failure with a Win32 success code does not throw", async () => {
    // Measured: isError=true carrying "The operation completed successfully."
    const { transport } = transportOf({
      isError: true,
      content: [{ type: "text", text: "The operation completed successfully. (0x00000000)" }],
    });

    const ack = await new DesktopDriverClient(transport).click(BINDING, { elementToken: "t:1" });

    expect(ack.driverReportedError).toBe(true);
    expect(ack.message).toContain("operation completed successfully");
  });

  test("a click reporting success is not treated as verified either", async () => {
    const { transport } = transportOf({ isError: false });

    const ack = await new DesktopDriverClient(transport).click(BINDING, { elementToken: "t:1" });

    expect(ack).toMatchObject({ driverReportedError: false, verified: false });
  });
});

describe("getWindowState", () => {
  test("returns a parsed snapshot from the driver's text envelope", async () => {
    const { transport } = transportOf(SNAPSHOT_REPLY);

    const snapshot = await new DesktopDriverClient(transport).getWindowState(BINDING);

    expect(snapshot.snapshot_id).toBe("s00000001");
    expect(snapshot.elements[0].label).toBe("Seven");
  });

  test("reads a structuredJson payload as readily as a text one", async () => {
    const { transport } = transportOf({
      structuredJson: { snapshot_id: "s2", element_count: 0, elements: [] },
    });

    const snapshot = await new DesktopDriverClient(transport).getWindowState(BINDING);

    expect(snapshot.snapshot_id).toBe("s2");
  });

  test("takes the cheap path — a snapshot per action is the normal case", async () => {
    const { transport, callTool } = transportOf(SNAPSHOT_REPLY);

    await new DesktopDriverClient(transport).getWindowState(BINDING);

    expect(argsOf(callTool)).toMatchObject({ include_screenshot: false });
  });

  test("a degraded window is returned, not thrown — the caller needs the reason", async () => {
    const { transport } = transportOf({
      structuredJson: {
        snapshot_id: "s3",
        element_count: 0,
        elements: [],
        degraded: true,
        degraded_reason: "ax_tree_empty: the UIA walk returned no actionable elements.",
      },
    });

    const snapshot = await new DesktopDriverClient(transport).getWindowState(BINDING);

    expect(snapshot.degraded).toBe(true);
  });

  test("a failed parse describes the shape and never the contents", async () => {
    // A Document element's value is the whole open file, and this message
    // lands in the run's steps. Shape only — see secrets-and-evidence.md.
    const { transport } = transportOf({
      structuredJson: {
        snapshot_id: "s1",
        elements: [{ role: "Document", value: "hunter2 — live credentials" }],
      },
    });

    const failure = await new DesktopDriverClient(transport)
      .getWindowState(BINDING)
      .catch((error: Error) => error);

    expect(failure).toBeInstanceOf(DesktopDriverError);
    expect((failure as Error).message).not.toContain("hunter2");
    expect((failure as Error).message).toContain("element_token");
  });

  test("an unparseable payload says so without quoting it", async () => {
    const { transport } = transportOf({ content: [{ type: "text", text: "not json at all" }] });

    const failure = await new DesktopDriverClient(transport)
      .getWindowState(BINDING)
      .catch((error: Error) => error);

    expect((failure as Error).message).toMatch(/unusable snapshot/i);
    expect((failure as Error).message).not.toContain("not json at all");
  });
});

describe("listAppPids", () => {
  test("collects the pids a launch is compared against", async () => {
    const { transport } = transportOf({ apps: [{ pid: 4212n, name: "notepad" }, { pid: "8800" }] });

    await expect(new DesktopDriverClient(transport).listAppPids()).resolves.toEqual(["4212", "8800"]);
  });

  test("a payload with no app list fails rather than reporting nothing running", async () => {
    // An empty list would make `classifyLaunch` call every single-instance
    // hand-off a fresh launch.
    const { transport } = transportOf({ unexpected: true });

    await expect(new DesktopDriverClient(transport).listAppPids()).rejects.toBeInstanceOf(
      DesktopDriverError,
    );
  });
});

describe("secrets", () => {
  test("clamps driver status text so a stray payload cannot land in a trace", async () => {
    const { transport } = transportOf({
      isError: false,
      content: [{ type: "text", text: "x".repeat(5000) }],
    });

    const ack = await new DesktopDriverClient(transport).click(BINDING, { elementToken: "t:1" });

    expect(ack.message?.length).toBeLessThan(600);
    expect(ack.message).toContain("truncated");
  });
});

describe("verifyState", () => {
  test("sends the predicates ANDed, in the shape the driver accepts", async () => {
    // Measured. The earlier guess was a tagged union and the driver rejected it
    // outright: "unknown field `kind`, expected `window` or `element`".
    const { transport, callTool } = transportOf({
      structuredJson: JSON.stringify({ status: "satisfied", stable: true }),
    });

    const verdict = await new DesktopDriverClient(transport).verifyState(BINDING, [
      { window: { exists: true } },
      { element: { selector: { role: "Edit" }, value_equals: "hello" } },
    ]);

    expect(argsOf(callTool).expect).toHaveLength(2);
    expect(verdict.satisfied).toBe(true);
  });

  test("reads an unsatisfied verdict as a verdict, not as an unreadable answer", async () => {
    const { transport } = transportOf({
      structuredJson: JSON.stringify({ status: "unsatisfied", stable: true }),
    });

    const verdict = await new DesktopDriverClient(transport).verifyState(BINDING, [
      { window: { exists: true } },
    ]);

    expect(verdict).toMatchObject({ satisfied: false });
    expect(verdict.unverified).toBeUndefined();
  });

  test("anything other than a verdict reports unverified", async () => {
    // "unknown" is a real status the driver returns, and it is not a failure —
    // it is the driver declining to answer, which the caller must not read as
    // either outcome.
    const { transport } = transportOf({
      structuredJson: JSON.stringify({ status: "unknown", stable: false }),
    });

    const verdict = await new DesktopDriverClient(transport).verifyState(BINDING, [
      { window: { exists: true } },
    ]);

    expect(verdict).toMatchObject({ satisfied: false, unverified: true });
  });

  test("rejects an empty predicate set instead of verifying nothing", async () => {
    const { transport, callTool } = transportOf();

    await expect(new DesktopDriverClient(transport).verifyState(BINDING, [])).rejects.toBeInstanceOf(
      DesktopDriverError,
    );
    expect(callTool).not.toHaveBeenCalled();
  });

  test("rejects more than the eight predicates the driver accepts", async () => {
    const { transport } = transportOf();
    const nine = Array.from({ length: 9 }, () => ({ window: { exists: true } }));

    await expect(new DesktopDriverClient(transport).verifyState(BINDING, nine)).rejects.toThrow(
      /8/,
    );
  });

  test("an unrecognised verdict shape reports unverified, never satisfied", async () => {
    // The response shape of verify_state has not been measured against a real
    // driver. Guessing "satisfied" here would manufacture the exact false
    // success the verification step exists to prevent.
    const { transport } = transportOf({ structuredJson: { something_else: true } });

    const verdict = await new DesktopDriverClient(transport).verifyState(BINDING, [
      { kind: "window_exists" },
    ]);

    expect(verdict).toMatchObject({ satisfied: false, unverified: true });
  });
});

describe("cancellation", () => {
  test("forwards the run's signal to the driver", async () => {
    const { transport, callTool } = transportOf();
    const controller = new AbortController();

    await new DesktopDriverClient(transport).typeText(BINDING, { text: "x" }, controller.signal);

    expect(callTool.mock.calls[0][2]).toBe(controller.signal);
  });

  test("an already-cancelled run never reaches the driver", async () => {
    const { transport, callTool } = transportOf();
    const controller = new AbortController();
    controller.abort();

    await expect(
      new DesktopDriverClient(transport).typeText(BINDING, { text: "x" }, controller.signal),
    ).rejects.toMatchObject({ reason: "cancelled" });
    expect(callTool).not.toHaveBeenCalled();
  });
});
