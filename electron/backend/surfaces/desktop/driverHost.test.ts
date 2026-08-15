// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { createHostDriver } from "./driverHost.js";
import type { CuaDriverModule } from "./driverHost.js";

/**
 * The host is thin by design — everything with logic lives in `protocol.ts`.
 * What is worth pinning here is the session, because its capture scope is
 * immutable once started and cannot be narrowed later.
 */

function moduleWith(driver: Record<string, unknown>): () => Promise<CuaDriverModule> {
  return async () => ({ CuaDriver: { create: async () => driver } }) as CuaDriverModule;
}

describe("createHostDriver", () => {
  test("pins the session to the bound window and never wider", async () => {
    // A desktop run happens while the operator is using the machine. A
    // desktop-wide capture would record their mail and their password manager.
    const startSession = vi.fn(async () => ({}));
    const load = moduleWith({ callTool: vi.fn(async () => ({})), startSession });

    await createHostDriver({ sessionId: "run-42", load });

    // `CaptureScope.Window` is 1. The enum is numeric and the string "Window"
    // is not accepted — measured, after this line asserted the string.
    expect(startSession).toHaveBeenCalledWith({ session: "run-42", captureScope: 1 });
  });

  test("always names a session, because the driver requires one", async () => {
    // `StartSessionInput.session` is required. Passing undefined fails inside
    // the native bridge with 'The "src" argument must be of type string',
    // which names nothing anyone could act on.
    const startSession = vi.fn(async () => ({}));
    const load = moduleWith({ callTool: vi.fn(async () => ({})), startSession });

    await createHostDriver({ load });

    expect(startSession).toHaveBeenCalledWith({
      session: expect.any(String),
      captureScope: 1,
    });
    expect(startSession.mock.calls[0][0].session).not.toBe("");
  });

  test("passes the run's signal through to the driver", async () => {
    const callTool = vi.fn(async () => ({ ok: true }));
    const controller = new AbortController();

    const host = await createHostDriver({ load: moduleWith({ callTool }) });
    await host.callTool("list_windows", "{}", controller.signal);

    expect(callTool).toHaveBeenCalledWith("list_windows", "{}", { signal: controller.signal });
  });

  test("starts even against a driver build without startSession", async () => {
    // The SDK is at 0.19.3 after 16 releases in three weeks; an absent method
    // should degrade to an unscoped session, not to a host that will not boot.
    const host = await createHostDriver({ load: moduleWith({ callTool: vi.fn(async () => ({})) }) });

    await expect(host.callTool("list_apps", "{}")).resolves.toBeDefined();
  });
});
