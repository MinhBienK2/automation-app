/**
 * Spawning the desktop driver host as an Electron utility process.
 *
 * This is the one module in `surfaces/desktop/` that cannot be unit-tested,
 * because its whole content is a call into Electron's process API. It is
 * therefore kept as thin as it can be: everything with a decision in it lives
 * in `protocol.ts` (the wire) or `session.ts` (the sequencing), both of which
 * take their collaborators by injection and run anywhere.
 *
 * Why a separate process at all: `cua-driver` raises Rust panics that terminate
 * whatever process hosts it, and only in-process `Embedded` mode is reachable
 * from npm. In the main process a panic would take Mission Control and every
 * in-flight run with it. See ADR-0001.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPortTransport } from "./protocol.js";
import type { DriverPort } from "./protocol.js";
import type { DesktopHost } from "./session.js";

/** Long enough for a cold Node start; short enough that a hang is visible. */
const SPAWN_TIMEOUT_MS = 10_000;

/**
 * The shape of `Electron.UtilityProcess`, narrowed to what is used here.
 *
 * Declared rather than imported so this module type-checks in a plain Node
 * toolchain, and so the one structural difference from `parentPort` — messages
 * arrive as the value, not wrapped in an event — is stated instead of assumed.
 */
type UtilityProcessLike = {
  postMessage(value: unknown): void;
  on(event: "message", listener: (value: unknown) => void): void;
  on(event: "exit" | "spawn", listener: () => void): void;
  once(event: "exit" | "spawn", listener: () => void): void;
  kill(): boolean;
};

type UtilityProcessApi = {
  fork(
    modulePath: string,
    args?: string[],
    options?: { env?: Record<string, string>; serviceName?: string; stdio?: string },
  ): UtilityProcessLike;
};

export type HostProcessOptions = {
  /** Overridable so a packaged build can point at its own layout. */
  hostModulePath?: string;
  loadElectron?: () => Promise<{ utilityProcess: UtilityProcessApi }>;
};

/**
 * Builds the `startHost` dependency `openDesktopSession` needs.
 *
 * One host per run, started lazily and stopped with the session. Sharing a host
 * across runs would mean one run's panic killing another's driver, which is the
 * failure this process boundary exists to contain.
 */
export function createUtilityProcessHost(options: HostProcessOptions = {}) {
  return async function startHost(request: {
    runId: string;
    env?: Record<string, string>;
  }): Promise<DesktopHost> {
    const { utilityProcess } = await (options.loadElectron ?? loadElectron)();

    const child = utilityProcess.fork(
      options.hostModulePath ?? defaultHostModulePath(),
      [],
      {
        env: {
          ...process.env as Record<string, string>,
          // Read by driverHost.ts to name the Driver Session, so a session in a
          // driver log can be tied back to a run in the run history.
          DESKTOP_RUN_ID: request.runId,
          // Per-app accessibility switches. Only ever reach an application this
          // run launches — see docs/domain/desktop/desktop-target.md.
          ...(request.env ?? {}),
        },
        serviceName: "desktop-driver-host",
      },
    );

    await waitForSpawn(child);

    return {
      transport: createPortTransport(asDriverPort(child)),
      stop: () => {
        child.kill();
      },
    };
  };
}

/**
 * Adapts a `UtilityProcess` to the `DriverPort` the transport expects.
 *
 * The asymmetry is Electron's, not ours: inside the utility process
 * `parentPort` emits a `MessageEvent` carrying `data`, while the parent's
 * handle emits the message value directly. `protocol.ts` speaks one shape, so
 * the re-wrapping happens here rather than as a branch in the transport.
 */
function asDriverPort(child: UtilityProcessLike): DriverPort {
  return {
    postMessage: (value) => child.postMessage(value),
    on(event: string, listener: (arg: never) => void) {
      if (event === "message") {
        child.on("message", (value) => (listener as (e: { data: unknown }) => void)({ data: value }));
        return;
      }
      // `close` has no utility-process equivalent; `exit` is the death signal,
      // and the transport treats both the same way.
      child.on("exit", listener as () => void);
    },
  } as DriverPort;
}

function waitForSpawn(child: UtilityProcessLike): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("The desktop driver host did not start within 10s."));
    }, SPAWN_TIMEOUT_MS);

    child.once("spawn", () => {
      clearTimeout(timer);
      resolve();
    });

    child.once("exit", () => {
      clearTimeout(timer);
      reject(
        new Error(
          "The desktop driver host exited during startup. `@trycua/cua-driver` is most likely not installed — it is an optional platform dependency.",
        ),
      );
    });
  });
}

/** Sits beside this module in the compiled output, under `dist-electron/`. */
function defaultHostModulePath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "driverHost.js");
}

async function loadElectron(): Promise<{ utilityProcess: UtilityProcessApi }> {
  // Imported by name at runtime so the backend stays importable — and testable
  // — outside an Electron main process.
  return (await import("electron")) as unknown as { utilityProcess: UtilityProcessApi };
}
