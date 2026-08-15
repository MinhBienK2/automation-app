// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { openDesktopSession } from "./session.js";
import type { DesktopHost } from "./session.js";
import type { DesktopTarget } from "./types.js";

/**
 * The launch sequence, driven through a fake transport.
 *
 * Payload shapes follow `docs/research/cua-driver-windows.md`: `launch_app`
 * answers with a `pid` and usually a `windows` array, `list_apps` with an
 * `apps` array, `list_windows` with a bare array. Nothing here needs a driver,
 * which is the point — the sequencing is what can be wrong, and sequencing is
 * testable on any machine.
 */

const NOTEPAD: DesktopTarget = {
  id: "target-1",
  project_id: "project-1",
  name: "Notepad",
  launch: { kind: "app_id", value: "notepad" },
  window: { title: { kind: "prefix", value: "Untitled" } },
};

type ToolReply = unknown | ((args: Record<string, unknown>) => unknown);

/**
 * Successive replies for one tool. Marked explicitly rather than inferred from
 * an array, because `list_windows` legitimately answers *with* an array and the
 * two are otherwise indistinguishable.
 */
class Queue {
  constructor(readonly replies: ToolReply[]) {}
}

const queue = (...replies: ToolReply[]) => new Queue(replies);

function fakeHost(replies: Record<string, ToolReply | Queue>) {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const queues = new Map<string, ToolReply[]>();

  for (const [tool, reply] of Object.entries(replies)) {
    if (reply instanceof Queue) queues.set(tool, [...reply.replies]);
  }

  const host: DesktopHost = {
    transport: {
      callTool(tool, args) {
        calls.push({ tool, args });
        const pending = queues.get(tool);
        const reply = pending
          ? pending.length > 1
            ? pending.shift()
            : pending[0]
          : replies[tool];

        if (reply === undefined) {
          return Promise.reject(new Error(`unexpected tool ${tool}`));
        }
        if (typeof reply === "function") {
          return Promise.resolve((reply as (a: Record<string, unknown>) => unknown)(args));
        }
        // The measured envelope, not the bare payload: every tool answers with
        // `structuredJson` alongside `content` and `isError`
        // (docs/research/cua-driver-windows.md). `isError: true` on a call that
        // worked is exactly why nothing downstream is allowed to believe it.
        return Promise.resolve({ structuredJson: reply, isError: false });
      },
    },
    stop: vi.fn(async () => {}),
  };

  return { host, calls };
}

const WINDOW = { window_id: "131204", pid: "4212", title: "Untitled - Notepad" };

/** A tree with named elements, so the probe reports the Element tier. */
const HEALTHY_TREE = {
  snapshot_id: "snap-1",
  element_count: 2,
  elements: [
    { element_index: 0, element_token: "snap-1:0", role: "Window", label: "Untitled - Notepad", depth: 0 },
    { element_index: 1, element_token: "snap-1:1", role: "Document", parent_index: 0, depth: 1 },
  ],
};

function healthyReplies(over: Record<string, ToolReply | Queue> = {}) {
  return {
    list_apps: { apps: [{ pid: "1000" }] },
    launch_app: { pid: "4212", windows: [WINDOW] },
    get_window_state: HEALTHY_TREE,
    ...over,
  };
}

describe("openDesktopSession", () => {
  test("launches the target and binds the window the selector names", async () => {
    const { host, calls } = fakeHost(healthyReplies());

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.surface.kind).toBe("desktop");
    expect(session.surface.binding).toMatchObject({
      pid: "4212",
      windowId: "131204",
      attached: false,
    });
    // The window came back on the launch reply, so nothing looked twice.
    expect(calls.map((c) => c.tool)).not.toContain("list_windows");
  });

  test("falls back to list_windows when the launch reply carries none", async () => {
    const { host, calls } = fakeHost(
      healthyReplies({ launch_app: { pid: "4212" }, list_windows: [WINDOW] }),
    );

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.surface.binding.windowId).toBe("131204");
    expect(calls.map((c) => c.tool)).toContain("list_windows");
  });

  test("waits for a window instead of failing on an application that starts slowly", async () => {
    const sleep = vi.fn(async () => {});
    const { host } = fakeHost(
      healthyReplies({
        launch_app: { pid: "4212" },
        // Empty twice, then the window appears — a cold start.
        list_windows: queue([], [], [WINDOW]),
      }),
    );

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host, sleep },
    );

    expect(session.surface.binding.windowId).toBe("131204");
    // One wait before each lookup: two that found nothing, then the one that did.
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  test("gives up once the ready timeout passes, and says what it saw", async () => {
    let clock = 0;
    const { host } = fakeHost(healthyReplies({ launch_app: { pid: "4212" }, list_windows: [] }));

    await expect(
      openDesktopSession(
        {
          target: { ...NOTEPAD, launch: { ...NOTEPAD.launch, ready: { kind: "window", timeout_ms: 900 } } },
          runId: "run-1",
        },
        {
          startHost: async () => host,
          sleep: async () => {
            clock += 500;
          },
          now: () => clock,
        },
      ),
    ).rejects.toThrow(/no windows/i);
  });

  test("stops the host when binding fails, so a failed launch leaks no process", async () => {
    const { host } = fakeHost(healthyReplies({ launch_app: { pid: "4212" }, list_windows: [] }));

    await expect(
      openDesktopSession(
        {
          target: { ...NOTEPAD, launch: { ...NOTEPAD.launch, ready: { kind: "window", timeout_ms: 0 } } },
          runId: "run-1",
        },
        { startHost: async () => host, sleep: async () => {}, now: () => 0 },
      ),
    ).rejects.toThrow();

    expect(host.stop).toHaveBeenCalled();
  });

  test("records that it attached when the pid was already running", async () => {
    const { host } = fakeHost(healthyReplies({ list_apps: { apps: [{ pid: "4212" }] } }));

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.surface.binding.attached).toBe(true);
  });

  test("treats an unreadable list_apps as attached rather than claiming a clean launch", async () => {
    // `list_apps`'s payload shape is inferred, not measured — the honest
    // reading of "I could not tell" is the one that warns about inherited state.
    const { host } = fakeHost(healthyReplies({ list_apps: { unexpected: true } }));

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.surface.binding.attached).toBe(true);
  });

  test("probes the capability tier once at bind, so the operator sees it before acting", async () => {
    const { host } = fakeHost(healthyReplies());

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.tier).toBe("element");
  });

  test("binds a degraded window at the pixel tier rather than refusing the run", async () => {
    const { host } = fakeHost(
      healthyReplies({
        get_window_state: {
          snapshot_id: "snap-2",
          element_count: 0,
          elements: [],
          degraded: true,
          degraded_reason: "UIA provider returned no elements",
        },
      }),
    );

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.tier).toBe("pixel");
    expect(session.warnings.join(" ")).toContain("UIA provider returned no elements");
  });

  test("a failed probe leaves the session usable at the pixel tier", async () => {
    // The tier is advisory. A window that will not answer a snapshot is exactly
    // the window a pixel-tier workflow exists for.
    const { host } = fakeHost(healthyReplies({ get_window_state: { nonsense: true } }));

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1" },
      { startHost: async () => host },
    );

    expect(session.tier).toBe("pixel");
  });

  test("closing with the close policy terminates what this run launched", async () => {
    const { host, calls } = fakeHost(healthyReplies({ kill_app: { ok: true } }));

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1", retention: "close" },
      { startHost: async () => host },
    );
    await session.close();

    expect(calls.filter((c) => c.tool === "kill_app")).toHaveLength(1);
    expect(host.stop).toHaveBeenCalled();
  });

  test("never terminates an application it merely attached to", async () => {
    const { host, calls } = fakeHost(
      healthyReplies({ list_apps: { apps: [{ pid: "4212" }] }, kill_app: { ok: true } }),
    );

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1", retention: "close" },
      { startHost: async () => host },
    );
    await session.close();

    expect(calls.filter((c) => c.tool === "kill_app")).toHaveLength(0);
    expect(host.stop).toHaveBeenCalled();
  });

  test("the retain policy leaves the application running but still stops the host", async () => {
    // The two are separate decisions and only one is the operator's. Keeping
    // the host alive would leak an Electron utility process, and an embedded
    // driver, for every run — with no handle left to stop it.
    const { host, calls } = fakeHost(healthyReplies({ kill_app: { ok: true } }));

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1", retention: "retain" },
      { startHost: async () => host },
    );
    await session.close();

    expect(calls.filter((c) => c.tool === "kill_app")).toHaveLength(0);
    expect(host.stop).toHaveBeenCalled();
  });

  test("stops the host even when terminating the application fails", async () => {
    const { host } = fakeHost(
      healthyReplies({
        kill_app: () => {
          throw new Error("driver panicked");
        },
      }),
    );

    const session = await openDesktopSession(
      { target: NOTEPAD, runId: "run-1", retention: "close" },
      { startHost: async () => host },
    );
    await session.close();

    expect(host.stop).toHaveBeenCalled();
  });

  test("passes the accessibility environment to the host that launches the app", async () => {
    const { host } = fakeHost(healthyReplies());
    const startHost = vi.fn(async () => host);

    await openDesktopSession(
      {
        target: { ...NOTEPAD, accessibility: { env: { QT_ACCESSIBILITY: "1" } } },
        runId: "run-7",
      },
      { startHost },
    );

    expect(startHost).toHaveBeenCalledWith({
      runId: "run-7",
      env: { QT_ACCESSIBILITY: "1" },
    });
  });
});
