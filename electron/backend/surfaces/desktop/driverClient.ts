/**
 * The typed layer over `cua-driver`.
 *
 * ADR-0001 makes this load-bearing: 31 of the driver's 54 tools — including
 * every element-addressed one — are reachable only through
 * `callTool(name, argumentsJson)` with hand-written JSON and hand-written
 * types. This module is where that hand-writing lives, and nowhere else.
 *
 * Three measured behaviours shape it:
 *
 * - A missing required field raises a **Rust panic that kills the host**, so
 *   arguments are validated here and a bad call never reaches the driver.
 * - `isError` has been observed `true` for a successful click, so it is
 *   recorded and never believed. Success is decided by `verifyState`.
 * - `pid` and `window_id` are `bigint`, which `JSON.stringify` refuses.
 *
 * The transport is injected: the real one talks to the driver host over the
 * utility-process port, and tests pass a fake. See
 * `docs/research/cua-driver-windows.md` and `docs/architecture/desktop-runner.md`.
 */

import { asRecord, isPlainRecord } from "../../shared/records.js";
import { clampMessage, summarisePayload } from "./payloads.js";
import { parseSnapshot, tierOf } from "./snapshot.js";
import { parseWindowList } from "./windowBinding.js";
import type {
  CapabilityTier,
  DesktopLaunchSpec,
  DriverWindow,
  ElementSnapshot,
  WindowBinding,
} from "./types.js";

/**
 * `DesktopScope.Desktop`. One legal value, mandatory, and omitting it panics
 * the process — which is exactly why callers never get to supply it.
 *
 * It is sent with the input-synthesis tools (click, type, key, hotkey) and no
 * others. That is where the panic was measured, on `typeText`; the untyped
 * window tools take `pid` and `window_id` instead and were exercised without
 * it. Both halves of that rule are inference from one measurement, so if a
 * tool panics on Windows, this constant is the first thing to widen.
 */
const DESKTOP_SCOPE = 0;

/** `verify_state` accepts 1–8 predicates, ANDed. */
const MAX_PREDICATES = 8;

export type DriverTransport = {
  callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
};

export type DriverErrorReason = "invalid_request" | "cancelled" | "malformed_response";

export class DesktopDriverError extends Error {
  constructor(
    readonly reason: DriverErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "DesktopDriverError";
  }
}

/**
 * What the driver said about a call.
 *
 * `verified` is always `false`: nothing the driver returns is evidence that an
 * action took effect. It exists so a caller that forgets to verify reads as
 * unverified rather than as success.
 */
export type DriverAck = {
  driverReportedError: boolean;
  message?: string;
  verified: false;
};

export type ClickRequest =
  | { elementToken: string; button?: "left" | "right" | "middle"; count?: number }
  | { x: number; y: number; button?: "left" | "right" | "middle"; count?: number };

/**
 * What `verify_state` accepts, measured against the driver.
 *
 * The earlier guess was a tagged union — `{ kind: "window_exists" }` and
 * friends — and the driver rejects it outright: *"unknown field `kind`,
 * expected `window` or `element`"*. It is two optional sub-records instead, and
 * the field names are snake_case on the wire (`label_contains`, not
 * `labelContains`, which is its own separate rejection).
 *
 * Absence cannot be asserted. `exists: false` is refused upstream, because an
 * element walk is not exhaustive on every platform and "I did not find it" is
 * not "it is not there".
 */
export type StatePredicate =
  | { window: { exists?: boolean; bounds?: BoundsExpectation } }
  | {
      element: {
        selector: { role?: string; label_contains?: string };
        exists?: boolean;
        value_equals?: string;
        enabled?: boolean;
        selected?: boolean;
      };
    };

export type BoundsExpectation = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  tolerance?: number;
};

export type VerifyVerdict = {
  satisfied: boolean;
  /** True when the driver's answer could not be read as a verdict at all. */
  unverified?: true;
  detail?: string;
};

export class DesktopDriverClient {
  constructor(private readonly transport: DriverTransport) {}

  private lastTier: CapabilityTier | null = null;

  /**
   * The Capability Tier of the most recent Element Snapshot, or `null` before
   * this session has taken one.
   *
   * Recorded as a side effect of snapshots the run was taking anyway, rather
   * than probed. A probe costs a whole `get_window_state`, and #49 measured UWP
   * windows whose UIA provider collapses after about two reads — on exactly the
   * windows with no reads to spare, a probe halved the budget to learn
   * something the next action re-reads regardless.
   */
  get observedTier(): CapabilityTier | null {
    return this.lastTier;
  }

  async listWindows(signal?: AbortSignal): Promise<DriverWindow[]> {
    const result = await this.call("list_windows", {}, signal);
    return this.windowsOf(result);
  }

  /**
   * The pids running before a launch attempt.
   *
   * Single-instance applications hand a launch off to a running process, and
   * comparing against this list is the only way to tell that apart from a real
   * launch — see `classifyLaunch`.
   */
  async listAppPids(signal?: AbortSignal): Promise<string[]> {
    const result = await this.call("list_apps", {}, signal);
    const payload = result.payload;
    const apps = Array.isArray(payload) ? payload : asRecord(payload).apps;

    if (!Array.isArray(apps)) {
      throw new DesktopDriverError(
        "malformed_response",
        `list_apps returned no app list (${summarisePayload(payload)}).`,
      );
    }

    return apps
      .map((app) => readId(asRecord(app).pid))
      .filter((pid): pid is string => pid !== undefined);
  }

  /**
   * Launches, or hands off to a running instance. Which of the two happened is
   * not decided here — see `classifyLaunch` in `windowBinding.ts`.
   */
  async launchApp(
    launch: DesktopLaunchSpec,
    signal?: AbortSignal,
  ): Promise<{ pid: string; windows: DriverWindow[] }> {
    requireText(launch.value, "launch.value");

    const result = await this.call(
      "launch_app",
      {
        ...(launch.kind === "app_id" ? { name: launch.value } : { path: launch.value }),
        ...(launch.args?.length ? { args: launch.args } : {}),
      },
      signal,
    );

    const pid = readId(asRecord(result.payload).pid);
    if (!pid) {
      throw new DesktopDriverError(
        "malformed_response",
        `launch_app returned no pid (${summarisePayload(result.payload)}).`,
      );
    }

    // The windows array is a convenience: `launch_app` usually carries it, and
    // when it does not, binding falls back to `listWindows`.
    const windows = asRecord(result.payload).windows === undefined ? [] : this.windowsOf(result);
    return { pid, windows };
  }

  /**
   * The driver refuses to terminate a process it did not launch, so this can
   * never close an application the operator opened themselves.
   */
  async killApp(pid: string, signal?: AbortSignal): Promise<DriverAck> {
    requireText(pid, "pid");
    return (await this.call("kill_app", { pid }, signal)).ack;
  }

  /**
   * One Element Snapshot. Taken per action, because `element_token` embeds the
   * snapshot id and a stale token is rejected.
   */
  async getWindowState(binding: WindowBinding, signal?: AbortSignal): Promise<ElementSnapshot> {
    const result = await this.call(
      "get_window_state",
      // The cheap path: screenshots are evidence, and evidence is a separate,
      // opt-in decision — see docs/domain/desktop/secrets-and-evidence.md.
      { ...scopeOf(binding), include_screenshot: false },
      signal,
    );

    const parsed = parseSnapshot(result.payload);
    if (!parsed.ok) {
      // Deliberately shape-only. A snapshot's element values include whole
      // document contents, and an error message lands in the run's steps —
      // see docs/domain/desktop/secrets-and-evidence.md.
      throw new DesktopDriverError(
        "malformed_response",
        `get_window_state returned an unusable snapshot (${parsed.detail}) from ${summarisePayload(result.payload)}.`,
      );
    }

    // `degraded` rides the envelope, not the payload — measured. Folding it in
    // here is what lets `tierOf` stay a pure function of a snapshot.
    const snapshot = result.degraded ? { ...parsed.snapshot, degraded: true } : parsed.snapshot;

    this.lastTier = tierOf(snapshot);
    return snapshot;
  }

  /**
   * A picture of the bound window, and nothing else on the screen.
   *
   * Deliberately **not** returning the tree that comes back with it. The same
   * call carries an Element Snapshot, and a `Document`'s `value` is the whole
   * open file — the largest incidental-secret source in the system. Dropping it
   * here means no caller can persist it by accident
   * (`docs/domain/desktop/secrets-and-evidence.md`).
   *
   * The window scope is the Driver Session's, fixed at session start and not
   * widenable, so this cannot capture the operator's other windows.
   *
   * Measured: the image is an entry in the envelope's `images` array as
   * `{ mimeType, dataBase64 }`. The payload carries only `screenshot_width`,
   * `screenshot_height` and `screenshot_mime_type` — the earlier guesses at a
   * payload field named `screenshot` or `image` were all wrong.
   */
  async captureWindow(binding: WindowBinding, signal?: AbortSignal): Promise<string> {
    const result = await this.call(
      "get_window_state",
      { ...scopeOf(binding), include_screenshot: true },
      signal,
    );

    const image = result.images.find(
      (entry) => typeof entry?.dataBase64 === "string" && entry.dataBase64 !== "",
    )?.dataBase64;

    if (image === undefined) {
      throw new DesktopDriverError(
        "malformed_response",
        `get_window_state returned no image (${result.images.length} attachments).`,
      );
    }

    // Both a bare base64 body and a data URL have been seen from tools of this
    // shape; the caller wants bytes either way.
    return image.startsWith("data:") ? (image.split(",", 2)[1] ?? "") : image;
  }

  async bringToFront(binding: WindowBinding, signal?: AbortSignal): Promise<DriverAck> {
    return (await this.call("bring_to_front", scopeOf(binding), signal)).ack;
  }

  async click(
    binding: WindowBinding,
    request: ClickRequest,
    signal?: AbortSignal,
  ): Promise<DriverAck> {
    const tool = clickToolFor(request);
    const button = request.button ?? "left";
    const target = "elementToken" in request
      ? { element_token: requireText(request.elementToken, "elementToken") }
      : pixelArgs(request);

    return (
      await this.call(
        tool,
        {
          ...scopeOf(binding),
          scope: DESKTOP_SCOPE,
          ...target,
          // `right_click` and `double_click` encode the variation in the tool
          // name; only the plain `click` takes a button, and its typed
          // counterpart `ClickInput` is where that is measured.
          ...(tool === "click" && button !== "left" ? { button } : {}),
        },
        signal,
      )
    ).ack;
  }

  /** Preferred over typing wherever the control supports it. */
  async setValue(
    binding: WindowBinding,
    request: { elementToken: string; value: string },
    signal?: AbortSignal,
  ): Promise<DriverAck> {
    requireText(request.elementToken, "elementToken");

    return (
      await this.call(
        "set_value",
        { ...scopeOf(binding), element_token: request.elementToken, value: request.value },
        signal,
      )
    ).ack;
  }

  async typeText(
    binding: WindowBinding,
    request: { text: string },
    signal?: AbortSignal,
  ): Promise<DriverAck> {
    return (
      await this.call(
        "type_text",
        { ...scopeOf(binding), scope: DESKTOP_SCOPE, text: request.text },
        signal,
      )
    ).ack;
  }

  async pressKey(
    binding: WindowBinding,
    request: { key: string; modifiers?: string[] },
    signal?: AbortSignal,
  ): Promise<DriverAck> {
    requireText(request.key, "key");

    return (
      await this.call(
        "press_key",
        {
          ...scopeOf(binding),
          scope: DESKTOP_SCOPE,
          key: request.key,
          ...(request.modifiers?.length ? { modifiers: request.modifiers } : {}),
        },
        signal,
      )
    ).ack;
  }

  /** A chord. Separate from `pressKey` because the failure modes differ. */
  async hotkey(
    binding: WindowBinding,
    request: { keys: string[] },
    signal?: AbortSignal,
  ): Promise<DriverAck> {
    if (!request.keys?.length) {
      throw new DesktopDriverError("invalid_request", "A hotkey needs at least one key.");
    }

    return (
      await this.call(
        "hotkey",
        { ...scopeOf(binding), scope: DESKTOP_SCOPE, keys: request.keys },
        signal,
      )
    ).ack;
  }

  /**
   * The authority on whether an action worked.
   *
   * Measured on both sides now. The verdict is a `status` string on the
   * payload — `satisfied`, and per-predicate outcomes beside it — and the same
   * verdict also rides the envelope as a typed `verification` record with a
   * numeric status. The string is read because it is the one that survives the
   * JSON round trip through the utility process intact.
   *
   * An unreadable answer still reports `unverified` rather than assuming
   * either verdict: this is the call every action's success rests on, and
   * "I could not tell" is a third outcome, not a failure.
   */
  async verifyState(
    binding: WindowBinding,
    predicates: StatePredicate[],
    signal?: AbortSignal,
  ): Promise<VerifyVerdict> {
    if (predicates.length === 0) {
      throw new DesktopDriverError(
        "invalid_request",
        "verify_state needs at least one predicate; verifying nothing is not verification.",
      );
    }
    if (predicates.length > MAX_PREDICATES) {
      throw new DesktopDriverError(
        "invalid_request",
        `verify_state accepts at most ${MAX_PREDICATES} predicates, got ${predicates.length}.`,
      );
    }

    const result = await this.call(
      "verify_state",
      { ...scopeOf(binding), expect: predicates },
      signal,
    );

    const status = asRecord(result.payload).status;

    // `satisfied` and `unsatisfied` are verdicts. Anything else — `unknown`,
    // an error payload, a shape this build does not recognise — is the driver
    // declining to answer, and saying so is the whole point of this method.
    if (status === "satisfied") return { satisfied: true, detail: clampMessage(result.text) };
    if (status === "unsatisfied") return { satisfied: false, detail: clampMessage(result.text) };

    return {
      satisfied: false,
      unverified: true,
      detail: `verify_state returned no readable verdict (${summarisePayload(result.payload)}).`,
    };
  }

  /** `parseWindowList` accepts both the bare array and the `{ windows }` envelope. */
  private windowsOf(result: DriverResult): DriverWindow[] {
    const parsed = parseWindowList(result.payload);

    if (!parsed.ok) {
      throw new DesktopDriverError(
        "malformed_response",
        `Unusable window list (${parsed.detail}) from ${summarisePayload(result.payload)}.`,
      );
    }

    return parsed.windows;
  }

  private async call(
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<DriverResult> {
    if (signal?.aborted) {
      throw new DesktopDriverError("cancelled", `The run was cancelled before ${tool}.`);
    }

    return interpret(await this.transport.callTool(tool, args, signal));
  }
}

type DriverResult = {
  payload: unknown;
  text?: string;
  /** Base64 images the driver attached. `get_window_state` puts the window shot here. */
  images: Array<{ mimeType?: string; dataBase64?: string }>;
  /** The driver's own degradation flag, which rides on the envelope. */
  degraded: boolean;
  ack: DriverAck;
};

/**
 * Unwraps the `ToolResult` envelope.
 *
 * Measured, having previously been inferred, and three of the inferences were
 * wrong. `structuredJson` is a **string** of JSON, not an object — reading it
 * directly gave every caller a string where it expected a record. `degraded`
 * sits on the envelope, not inside the payload. And the screenshot arrives as
 * `images[]`, not as a field of the payload at all.
 *
 * The `content`/`text` fallback is kept: it costs nothing and covers the older
 * envelope shape the research recorded.
 */
function interpret(raw: unknown): DriverResult {
  const record = asRecord(raw);
  const driverReportedError = record.isError === true;
  const text = textOf(record);

  let payload: unknown = parseStructured(record.structuredJson);
  if (payload === undefined && text !== undefined) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }
  if (payload === undefined && isPlainRecord(raw) && !("content" in raw) && !("isError" in raw)) {
    payload = raw;
  }

  return {
    payload,
    text,
    images: Array.isArray(record.images)
      ? (record.images as Array<{ mimeType?: string; dataBase64?: string }>)
      : [],
    degraded: record.degraded === true,
    // Clamped: status text is short, and anything long enough to matter is a
    // payload that got loose rather than a message worth recording.
    ack: { driverReportedError, message: clampMessage(text), verified: false },
  };
}

function parseStructured(structured: unknown): unknown {
  if (typeof structured !== "string") return structured;
  try {
    return JSON.parse(structured);
  } catch {
    return undefined;
  }
}

function textOf(record: Record<string, unknown>): string | undefined {
  if (typeof record.text === "string" && record.text !== "") return record.text;

  const content = record.content;
  if (!Array.isArray(content)) return undefined;

  const parts = content
    .map((entry) => asRecord(entry).text)
    .filter((value): value is string => typeof value === "string");

  return parts.length ? parts.join("\n") : undefined;
}

/**
 * Picks the tool, and refuses the combinations the driver has no measured way
 * to express.
 *
 * `double_click` takes no button in anything we have measured, so a right
 * double-click would silently become a left one — an action doing something
 * other than what the step says is worse than an action that will not run.
 */
function clickToolFor(request: ClickRequest): "click" | "double_click" | "right_click" {
  const count = request.count ?? 1;
  const button = request.button ?? "left";

  if (count !== 1 && count !== 2) {
    throw new DesktopDriverError(
      "invalid_request",
      `A desktop click is single or double; got count ${count}.`,
    );
  }

  if (count === 2) {
    if (button !== "left") {
      throw new DesktopDriverError(
        "invalid_request",
        `A double click is left-button only; ${button} double-click is not supported by the driver.`,
      );
    }
    return "double_click";
  }

  return button === "right" ? "right_click" : "click";
}

function pixelArgs(request: { x?: unknown; y?: unknown }): Record<string, unknown> {
  if (!Number.isFinite(request.x) || !Number.isFinite(request.y)) {
    throw new DesktopDriverError(
      "invalid_request",
      "A pixel target needs both x and y, relative to the window.",
    );
  }
  return { x: request.x, y: request.y };
}

/**
 * Every binding-scoped call names its window.
 *
 * The ids are **numbers** on the wire. They are normalised to strings at the
 * parse boundary because they arrive as `bigint` and `JSON.stringify` refuses
 * those — but sending them back as strings is refused too: measured, the driver
 * answers "Missing required integer field pid." Converting here rather than
 * storing numbers keeps one representation inside the application and one on
 * the wire, which is the seam this function is.
 */
function scopeOf(binding: WindowBinding): Record<string, unknown> {
  return { pid: numericId(binding.pid, "pid"), window_id: numericId(binding.windowId, "window_id") };
}

function numericId(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DesktopDriverError(
      "invalid_request",
      `${field} must be an integer the driver can read; got "${value}".`,
    );
  }
  return parsed;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DesktopDriverError("invalid_request", `${field} is required and was empty.`);
  }
  return value;
}

function readId(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}
