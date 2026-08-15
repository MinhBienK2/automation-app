// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { createHostDispatcher, createPortTransport } from "./protocol.js";
import type { DriverPort, HostDriver } from "./protocol.js";

/**
 * The wire between the backend and the driver host.
 *
 * It exists because a missing field raises a Rust panic that terminates the
 * host process (ADR-0001). Everything asserted here is about surviving that:
 * pending calls must fail loudly when the host dies, never hang.
 */

/** A pair of ports wired to each other, standing in for the utility-process channel. */
function portPair(): { backend: DriverPort; host: DriverPort; killHost: () => void } {
  const listeners = { backend: [] as ((e: { data: unknown }) => void)[], host: [] as ((e: { data: unknown }) => void)[] };
  const closeListeners = [] as (() => void)[];

  const make = (side: "backend" | "host"): DriverPort => ({
    postMessage: (value: unknown) => {
      const target = side === "backend" ? listeners.host : listeners.backend;
      for (const listener of [...target]) listener({ data: value });
    },
    on: (event, listener) => {
      if (event === "message") listeners[side].push(listener as (e: { data: unknown }) => void);
      else closeListeners.push(listener as () => void);
    },
    start: () => {},
  });

  return {
    backend: make("backend"),
    host: make("host"),
    killHost: () => {
      for (const listener of closeListeners) listener();
    },
  };
}

function hostDriverOf(reply: unknown = { ok: true }): HostDriver {
  return { callTool: vi.fn(async () => reply) };
}

describe("round trip", () => {
  test("a call reaches the driver and its result comes back", async () => {
    const pair = portPair();
    const driver = hostDriverOf({ snapshot_id: "s1" });
    createHostDispatcher(pair.host, driver);

    const transport = createPortTransport(pair.backend);

    await expect(transport.callTool("get_window_state", { pid: "1" })).resolves.toEqual({
      snapshot_id: "s1",
    });
  });

  test("arguments cross the wire as the JSON string the untyped path wants", async () => {
    const pair = portPair();
    const driver = hostDriverOf();
    createHostDispatcher(pair.host, driver);

    await createPortTransport(pair.backend).callTool("set_value", { value: "hello" });

    expect(driver.callTool).toHaveBeenCalledWith("set_value", '{"value":"hello"}', expect.anything());
  });

  test("concurrent calls are matched by id, not by arrival order", async () => {
    const pair = portPair();
    const resolvers: Array<(value: unknown) => void> = [];
    createHostDispatcher(pair.host, {
      callTool: (tool) => new Promise((resolve) => resolvers.push(() => resolve({ tool }))),
    });

    const transport = createPortTransport(pair.backend);
    const first = transport.callTool("list_windows", {});
    const second = transport.callTool("get_window_state", {});

    resolvers[1](undefined);
    resolvers[0](undefined);

    await expect(second).resolves.toEqual({ tool: "get_window_state" });
    await expect(first).resolves.toEqual({ tool: "list_windows" });
  });
});

describe("failure", () => {
  test("a driver that throws becomes an error response, not a dead host", async () => {
    const pair = portPair();
    createHostDispatcher(pair.host, {
      callTool: async () => {
        throw new Error("bare element_index is not accepted in Cua Driver 0.17");
      },
    });

    await expect(createPortTransport(pair.backend).callTool("click", {})).rejects.toThrow(
      /bare element_index/,
    );
  });

  test("when the host dies, every pending call fails instead of hanging", async () => {
    // A Rust panic takes the host with it. The run must fail with a reason the
    // operator can act on, and the app must survive.
    const pair = portPair();
    const transport = createPortTransport(pair.backend);
    const pending = transport.callTool("type_text", { text: "x" });

    pair.killHost();

    await expect(pending).rejects.toThrow(/driver host/i);
  });

  test("calls made after the host died fail immediately", async () => {
    const pair = portPair();
    const transport = createPortTransport(pair.backend);
    pair.killHost();

    await expect(transport.callTool("type_text", { text: "x" })).rejects.toThrow(/driver host/i);
  });
});

describe("cancellation", () => {
  test("aborting rejects the call and tells the host to stop", async () => {
    const pair = portPair();
    const aborted = vi.fn();
    createHostDispatcher(pair.host, {
      callTool: (_tool, _args, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            aborted();
            reject(new Error("aborted"));
          });
        }),
    });

    const controller = new AbortController();
    const pending = createPortTransport(pair.backend).callTool("type_text", {}, controller.signal);
    controller.abort();

    await expect(pending).rejects.toThrow(/cancel/i);
    expect(aborted).toHaveBeenCalled();
  });

  test("an already-aborted call never reaches the wire", async () => {
    const pair = portPair();
    const driver = hostDriverOf();
    createHostDispatcher(pair.host, driver);

    const controller = new AbortController();
    controller.abort();

    await expect(
      createPortTransport(pair.backend).callTool("type_text", {}, controller.signal),
    ).rejects.toThrow(/cancel/i);
    expect(driver.callTool).not.toHaveBeenCalled();
  });
});

describe("dispatcher hygiene", () => {
  test("an unrecognised message is answered, never silently dropped", async () => {
    const pair = portPair();
    createHostDispatcher(pair.host, hostDriverOf());

    const replies: unknown[] = [];
    pair.backend.on("message", (e) => replies.push(e.data));
    pair.backend.postMessage({ id: 7, kind: "teleport" });

    await Promise.resolve();

    expect(replies).toEqual([
      { id: 7, ok: false, error: { reason: "unknown_request", message: expect.any(String) } },
    ]);
  });

  test("a message that is not a request at all is ignored without crashing the host", () => {
    const pair = portPair();
    createHostDispatcher(pair.host, hostDriverOf());

    expect(() => pair.backend.postMessage("hello")).not.toThrow();
    expect(() => pair.backend.postMessage(null)).not.toThrow();
  });
});
