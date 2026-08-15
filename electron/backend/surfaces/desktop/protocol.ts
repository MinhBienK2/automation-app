/**
 * The wire between the backend and the desktop driver host.
 *
 * Both halves of one contract live here on purpose: a request shape that only
 * one side knows is how a protocol drifts. The host half is
 * `createHostDispatcher`, the backend half is `createPortTransport`, and
 * `driverHost.ts` is the thin entry point that wires the first to a real
 * `CuaDriver`.
 *
 * The whole reason this boundary exists: `cua-driver` raises Rust panics that
 * terminate the host process (ADR-0001). So the backend must treat host death
 * as a normal, expected event — every pending call fails with a reason, and
 * the app survives.
 */

import { isPlainRecord } from "../../shared/records.js";

export type DriverRequest =
  | { id: number; kind: "call_tool"; tool: string; args: Record<string, unknown> }
  | { id: number; kind: "cancel" };

export type DriverResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { reason: DriverFailureReason; message: string } };

export type DriverFailureReason = "driver_failed" | "unknown_request";

/**
 * The shape of Electron's `parentPort`, narrowed to what the host uses.
 * Messages arrive wrapped in an event carrying `data`.
 */
export type HostPort = {
  postMessage(value: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  start?(): void;
};

/**
 * The backend's end. It needs one thing the host's does not: notice when the
 * other side dies, because a driver panic is a normal event here.
 */
export type DriverPort = HostPort & {
  on(event: "close" | "exit", listener: () => void): void;
};

/** What the host needs from `CuaDriver`: the untyped path, and nothing else. */
export type HostDriver = {
  callTool(tool: string, argumentsJson: string, signal?: AbortSignal): Promise<unknown>;
};

/**
 * Host side. Turns requests into `callTool` invocations and always answers —
 * an unanswered request is a hung run.
 */
export function createHostDispatcher(port: HostPort, driver: HostDriver): void {
  const inFlight = new Map<number, AbortController>();

  port.on("message", (event) => {
    const request = asRequest(event.data);
    if (!request) return;

    if (request.kind === "cancel") {
      inFlight.get(request.id)?.abort();
      return;
    }

    if (request.kind !== "call_tool" || typeof request.tool !== "string") {
      port.postMessage(
        failure(request.id, "unknown_request", `Unrecognised request kind "${request.kind}".`),
      );
      return;
    }

    void dispatch(
      port,
      driver,
      { id: request.id, kind: "call_tool", tool: request.tool, args: request.args ?? {} },
      inFlight,
    );
  });

  port.start?.();
}

async function dispatch(
  port: HostPort,
  driver: HostDriver,
  request: Extract<DriverRequest, { kind: "call_tool" }>,
  inFlight: Map<number, AbortController>,
): Promise<void> {
  const controller = new AbortController();
  inFlight.set(request.id, controller);

  try {
    const result = await driver.callTool(
      request.tool,
      JSON.stringify(request.args ?? {}),
      controller.signal,
    );
    port.postMessage({ id: request.id, ok: true, result } satisfies DriverResponse);
  } catch (error) {
    port.postMessage(failure(request.id, "driver_failed", messageOf(error)));
  } finally {
    inFlight.delete(request.id);
  }
}

export class DesktopHostError extends Error {
  constructor(
    readonly reason: DriverFailureReason | "host_died" | "cancelled",
    message: string,
  ) {
    super(message);
    this.name = "DesktopHostError";
  }
}

/**
 * Backend side. Satisfies `DriverTransport`, so `DesktopDriverClient` cannot
 * tell a real host from the fake transport its tests use.
 */
export function createPortTransport(port: DriverPort): {
  callTool(tool: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
} {
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let hostDied: DesktopHostError | undefined;

  port.on("message", (event) => {
    const response = asResponse(event.data);
    if (!response) return;

    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);

    if (response.ok) waiter.resolve(response.result);
    else waiter.reject(new DesktopHostError(response.error.reason, response.error.message));
  });

  const die = () => {
    hostDied = new DesktopHostError(
      "host_died",
      "The desktop driver host stopped — most likely a driver panic. The run cannot continue; the next run will start a new host.",
    );
    for (const [, waiter] of pending) waiter.reject(hostDied);
    pending.clear();
  };

  port.on("close", die);
  port.on("exit", die);
  port.start?.();

  return {
    callTool(tool, args, signal) {
      if (hostDied) return Promise.reject(hostDied);
      if (signal?.aborted) {
        return Promise.reject(new DesktopHostError("cancelled", `The run was cancelled before ${tool}.`));
      }

      const id = nextId++;

      return new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject });

        signal?.addEventListener(
          "abort",
          () => {
            if (!pending.delete(id)) return;
            // Tell the host to stop too: the driver takes an AbortSignal on
            // every call, so cancellation is real rather than just ignored.
            port.postMessage({ id, kind: "cancel" } satisfies DriverRequest);
            reject(new DesktopHostError("cancelled", `${tool} was cancelled.`));
          },
          { once: true },
        );

        port.postMessage({ id, kind: "call_tool", tool, args } satisfies DriverRequest);
      });
    },
  };
}

function failure(id: number, reason: DriverFailureReason, message: string): DriverResponse {
  return { id, ok: false, error: { reason, message } };
}

/**
 * Deliberately loose: an unknown `kind` has to survive validation far enough
 * to be answered, because a dropped message is a hung run.
 */
function asRequest(
  value: unknown,
): { id: number; kind: string; tool?: unknown; args?: Record<string, unknown> } | undefined {
  const record = isPlainRecord(value) ? value : undefined;
  if (!record || typeof record.id !== "number" || typeof record.kind !== "string") return undefined;

  return {
    id: record.id,
    kind: record.kind,
    tool: record.tool,
    args: isPlainRecord(record.args) ? record.args : undefined,
  };
}

function asResponse(value: unknown): DriverResponse | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (typeof value.id !== "number" || typeof value.ok !== "boolean") return undefined;
  return value as unknown as DriverResponse;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
