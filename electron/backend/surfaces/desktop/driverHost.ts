/**
 * Utility-process entry point for the desktop driver.
 *
 * This file runs in its own process and nowhere else. `cua-driver` raises Rust
 * panics that terminate whatever process hosts it, and only `Embedded` mode is
 * reachable from npm, so the isolation has to be ours: a panic here kills this
 * process, the active run fails with a reason, and Mission Control survives.
 * See ADR-0001 and `docs/architecture/desktop-runner.md`.
 *
 * Status: `@trycua/cua-driver` is not a dependency yet — it ships a 25 MB
 * platform binary and there is nothing to run against until the thin slice
 * (#48) runs on Windows. The package is therefore resolved at runtime, and
 * nothing spawns this process yet.
 */

import { createRequire } from "node:module";
import { createHostDispatcher } from "./protocol.js";
import type { HostDriver, HostPort } from "./protocol.js";

const DRIVER_PACKAGE = "@trycua/cua-driver";

/** `CaptureScope.Window`. Immutable for the life of a session, by design. */
const CAPTURE_SCOPE_WINDOW = "Window";

type CuaDriverLike = {
  callTool(tool: string, argumentsJson: string, asyncOpts?: { signal?: AbortSignal }): Promise<unknown>;
  startSession?(input: { session?: string; captureScope: string }): Promise<unknown>;
};

export type CuaDriverModule = {
  CuaDriver: { create(): Promise<CuaDriverLike> };
};

/**
 * Adapts `CuaDriver` to the one method the protocol needs, and pins the
 * session's capture scope to the bound window.
 *
 * Scope is fixed at session start and cannot be widened afterwards, which is
 * the point: a desktop run happens while the operator is using the machine,
 * and a full-screen capture would record everything the workflow never touched
 * (`docs/domain/desktop/secrets-and-evidence.md`).
 *
 * Only the untyped path is exposed on purpose: the typed `ClickInput` is
 * pixel-only, so element-addressed work goes through `callTool` regardless,
 * and two paths would mean two places to get the arguments wrong.
 */
export async function createHostDriver(
  options: { sessionId?: string; load?: () => Promise<CuaDriverModule> } = {},
): Promise<HostDriver> {
  const { CuaDriver } = await (options.load ?? defaultLoad)();
  const driver = await CuaDriver.create();

  await driver.startSession?.({
    session: options.sessionId,
    captureScope: CAPTURE_SCOPE_WINDOW,
  });

  return {
    callTool: (tool, argumentsJson, signal) => driver.callTool(tool, argumentsJson, { signal }),
  };
}

async function defaultLoad(): Promise<CuaDriverModule> {
  // Resolved at runtime so the backend type-checks and packages without the
  // platform binary present.
  return createRequire(import.meta.url)(DRIVER_PACKAGE) as CuaDriverModule;
}

export async function startDriverHost(port: HostPort, sessionId?: string): Promise<void> {
  createHostDispatcher(port, await createHostDriver({ sessionId }));
}

// Self-starts only when actually running as a utility process. Importing this
// module elsewhere — a test, a tool — must never spin up a driver.
// Electron types `parentPort` with its own event shape; structurally it is a
// HostPort, and the cast is the narrowing this module exists to contain.
const parentPort = (process as unknown as { parentPort?: HostPort }).parentPort;

if (parentPort) {
  startDriverHost(parentPort, process.env.DESKTOP_RUN_ID).catch((error: unknown) => {
    // A panic cannot be caught, but everything else should say why it died, or
    // the backend only ever sees "the host stopped".
    console.error("[desktop-driver-host] failed to start:", error);
    process.exit(1);
  });
}
