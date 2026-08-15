/**
 * Desktop Session: a Desktop Target becomes a bound window a run can act on.
 *
 * The Web Surface equivalent is `BrowserSessionManager.launchFreshSession`, and
 * the contrast is the whole design. A browser launch hands back a live `page`
 * that stays valid for the run. A desktop launch hands back a *process*, and
 * the window it will eventually show does not exist yet — so this module's real
 * job is the waiting, and then choosing among what appeared.
 *
 * Everything that decides is pure and already tested elsewhere: `selectWindow`
 * chooses, `classifyLaunch` tells a real launch from a single-instance hand-off.
 * What lives here is the sequencing, the timeout, and the teardown — the parts
 * that have no pure form.
 *
 * Binding deliberately takes **no** Element Snapshot. The Capability Tier comes
 * from the snapshots the run takes anyway, because on a window affected by the
 * UIA collapse defect a probe is one of the two reads it will ever answer.
 *
 * Specs: `docs/domain/desktop/desktop-target.md` (launch, binding, retention),
 * `docs/domain/desktop/capability-tiers.md` (read every snapshot, never infer).
 */

import { DesktopDriverClient } from "./driverClient.js";
import type { DriverTransport } from "./driverClient.js";
import { classifyLaunch, selectWindow } from "./windowBinding.js";
import type { CapabilityTier, DesktopTarget, DriverWindow, WindowBinding } from "./types.js";
import type { DesktopSurface } from "../../runtime/surface.js";

/** How long to wait for a window, when the target does not say. */
const DEFAULT_READY_TIMEOUT_MS = 15_000;

/** Long enough not to hammer the driver, short enough to feel immediate. */
const POLL_INTERVAL_MS = 250;

/**
 * A running driver host. Injected, because the real one is an Electron utility
 * process and a test must never spawn one.
 */
export type DesktopHost = {
  transport: DriverTransport;
  stop(): Promise<void> | void;
};

export type DesktopSessionRequest = {
  target: DesktopTarget;
  runId: string;
  /**
   * Reuses the Web Surface's Run Policy vocabulary rather than inventing a
   * parallel one. `close` terminates only what this run launched.
   */
  retention?: "close" | "retain";
  signal?: AbortSignal;
};

export type DesktopSessionDependencies = {
  startHost(options: { runId: string; env?: Record<string, string> }): Promise<DesktopHost>;
  sleep?(ms: number, signal?: AbortSignal): Promise<void>;
  now?(): number;
};

export type DesktopSession = {
  surface: DesktopSurface;
  /**
   * What the run's own snapshots showed, or `null` if it never took one — a
   * wholly pixel-addressed workflow never looks, and reporting a tier it did
   * not measure would be a guess.
   *
   * A function rather than a value because binding no longer knows: the answer
   * arrives with the first action. See `DesktopDriverClient.observedTier`.
   */
  observedTier(): CapabilityTier | null;
  /** What the operator should know before the first action runs. */
  warnings: string[];
  close(): Promise<void>;
};

export class DesktopLaunchError extends Error {
  constructor(
    readonly reason: "no_windows" | "ambiguous",
    message: string,
  ) {
    super(message);
    this.name = "DesktopLaunchError";
  }
}

export async function openDesktopSession(
  request: DesktopSessionRequest,
  deps: DesktopSessionDependencies,
): Promise<DesktopSession> {
  const { target, runId, signal } = request;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => Date.now());

  const host = await deps.startHost({
    runId,
    // Accessibility flags only reach an application this run starts — an
    // attached process was configured before we arrived.
    ...(target.accessibility?.env ? { env: target.accessibility.env } : {}),
  });
  const driver = new DesktopDriverClient(host.transport);

  try {
    const binding = await launchAndBind(driver, target, { sleep, now, signal });

    return {
      surface: { kind: "desktop", driver, binding },
      observedTier: () => driver.observedTier,
      warnings: attachmentWarnings(binding),
      close: () => closeSession(driver, binding, host, request.retention ?? "close", signal),
    };
  } catch (error) {
    // A host outlives its run only when a run is using it. Nothing else will
    // stop this one, because no caller has a handle to it yet.
    await stopQuietly(host);
    throw error;
  }
}

/**
 * Launch, then wait for a window, then choose deterministically.
 *
 * The pids are read *before* the launch because that is the only way to tell a
 * single-instance hand-off from a real launch — see `classifyLaunch`.
 */
async function launchAndBind(
  driver: DesktopDriverClient,
  target: DesktopTarget,
  ctx: { sleep: Sleep; now: () => number; signal?: AbortSignal },
): Promise<WindowBinding> {
  const pidsBefore = await readPidsQuietly(driver, ctx.signal);
  const launch = await driver.launchApp(target.launch, ctx.signal);
  const provenance = classifyLaunch(pidsBefore, launch.pid);
  const context = { pid: launch.pid, attached: provenance === "attached" };

  const deadline = ctx.now() + readyTimeoutOf(target);
  // The launch reply usually carries the windows, so the common path costs no
  // second call. It is only cold starts that poll.
  let windows: DriverWindow[] = launch.windows;
  let selection = selectWindow(windows, context, target.window);

  while (!selection.ok && selection.reason === "no_windows" && ctx.now() < deadline) {
    await ctx.sleep(POLL_INTERVAL_MS, ctx.signal);
    windows = await driver.listWindows(ctx.signal);
    selection = selectWindow(windows, context, target.window);
  }

  if (!selection.ok) {
    throw new DesktopLaunchError(
      selection.reason,
      `${target.name} could not be bound to a window: ${selection.detail}`,
    );
  }

  return selection.binding;
}

/**
 * `list_apps`'s payload shape is inferred rather than measured, so a failure
 * here must not fail the run. `classifyLaunch` reads a missing list as
 * "attached", which is the conservative answer: it warns about inherited state
 * instead of promising a clean process it cannot confirm.
 */
async function readPidsQuietly(
  driver: DesktopDriverClient,
  signal?: AbortSignal,
): Promise<string[] | undefined> {
  try {
    return await driver.listAppPids(signal);
  } catch {
    return undefined;
  }
}

async function closeSession(
  driver: DesktopDriverClient,
  binding: WindowBinding,
  host: DesktopHost,
  retention: "close" | "retain",
  signal?: AbortSignal,
): Promise<void> {
  // Attached applications are never terminated: this run did not start it and
  // cannot know what else it holds. The driver enforces the same rule, but
  // saying it here is what makes the intent readable.
  if (retention === "close" && !binding.attached) {
    try {
      await driver.killApp(binding.pid, signal);
    } catch {
      // A host that panicked cannot be asked to tidy up. Stopping it is next
      // regardless, and that is what actually reclaims the process.
    }
  }
  await stopQuietly(host);
}

async function stopQuietly(host: DesktopHost): Promise<void> {
  try {
    await host.stop();
  } catch {
    // Teardown failures must not mask the error that caused the teardown.
  }
}

function attachmentWarnings(binding: WindowBinding): string[] {
  return binding.attached
    ? [
        "This run attached to an application that was already open, so it inherited whatever state was left there. Launching did not give it a clean slate.",
      ]
    : [];
}

function readyTimeoutOf(target: DesktopTarget): number {
  const ready = target.launch.ready;
  if (ready?.kind === "window" && typeof ready.timeout_ms === "number") {
    return Math.max(0, ready.timeout_ms);
  }
  return DEFAULT_READY_TIMEOUT_MS;
}

type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("The run was cancelled while waiting for the application to start."));
      },
      { once: true },
    );
  });
}
