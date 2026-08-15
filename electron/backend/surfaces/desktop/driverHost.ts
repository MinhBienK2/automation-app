/**
 * Utility-process entry point for the desktop driver.
 *
 * This file runs in its own process and nowhere else. `cua-driver` raises Rust
 * panics that terminate whatever process hosts it, and only `Embedded` mode is
 * reachable from npm, so the isolation has to be ours: a panic here kills this
 * process, the active run fails with a reason, and Mission Control survives.
 * See ADR-0001 and `docs/architecture/desktop-runner.md`.
 *
 * Status: `@trycua/cua-driver` is deliberately not a declared dependency — it
 * ships a 25 MB platform binary — so the package is resolved at runtime.
 */

import { createHostDispatcher } from "./protocol.js";
import type { HostDriver, HostPort } from "./protocol.js";

const DRIVER_PACKAGE = "@trycua/cua-driver";

/**
 * `CaptureScope.Window`. A **numeric** enum member, not the string "Window":
 * the package's own enum is `{ Auto: 0, Window: 1, Desktop: 2 }` and the string
 * is rejected. Immutable for the life of a session, by design — a session that
 * escalates to desktop scope can only get window scope back by ending and
 * starting a new one.
 */
const CAPTURE_SCOPE_WINDOW = 1;

/**
 * A session id the driver will accept.
 *
 * `StartSessionInput.session` is required, and passing `undefined` fails deep
 * inside the native bridge with "The \"src\" argument must be of type string",
 * which names nothing an operator or a log reader could act on.
 */
const ANONYMOUS_SESSION = "mission-control";

type CuaDriverLike = {
  callTool(tool: string, argumentsJson: string, asyncOpts?: { signal?: AbortSignal }): Promise<unknown>;
  startSession?(input: { session: string; captureScope: number }): Promise<unknown>;
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
    session: options.sessionId ?? ANONYMOUS_SESSION,
    captureScope: CAPTURE_SCOPE_WINDOW,
  });

  return {
    // `asyncOpts` is omitted entirely when there is no signal, never passed as
    // `{ signal: undefined }`. The SDK's generated wrapper reads
    // `asyncOpts?.signal.aborted` — optional on the options, not on the signal —
    // so the undefined form throws inside `@ubjs/core` before the tool is
    // called at all. Measured; every call without a run signal died here.
    callTool: (tool, argumentsJson, signal) =>
      signal
        ? driver.callTool(tool, argumentsJson, { signal })
        : driver.callTool(tool, argumentsJson),
  };
}

async function defaultLoad(): Promise<CuaDriverModule> {
  // Dynamic import, not `createRequire`. The package is `"type": "module"` and
  // its exports map declares only an `import` condition, so `require()` raises
  // ERR_PACKAGE_PATH_NOT_EXPORTED — measured, after this line had been written
  // the other way and never run.
  //
  // Still resolved at runtime, so the backend type-checks and packages without
  // the platform binary present.
  return (await import(/* @vite-ignore */ DRIVER_PACKAGE)) as CuaDriverModule;
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
