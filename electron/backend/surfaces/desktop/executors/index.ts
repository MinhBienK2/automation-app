/**
 * Desktop Surface action executors.
 *
 * Every element-addressed action runs the same cycle, and the shape is forced
 * by the driver rather than chosen:
 *
 *     take Element Snapshot → resolve Desktop Locator → act → verify
 *
 * A snapshot per action, because `element_token` embeds the `snapshot_id` and
 * a stale token is rejected. Verification instead of the return value, because
 * `isError` has been observed `true` for a click that worked. Both are
 * measured behaviours, not caution — see `docs/research/cua-driver-windows.md`.
 *
 * Spec: `docs/domain/desktop/action-family.md`.
 */

import type { ActionExecutorMap } from "../../../actions/execution.js";
import type { SurfaceStepTrace } from "../../../runtime/actionTrace.js";
import type { VariableScope } from "../../../runtime/actionRuntime.js";
import { requireDesktopSurface } from "../../../runtime/surface.js";
import type { DesktopSurface, ExecutionSurface } from "../../../runtime/surface.js";
import type { StatePredicate } from "../driverClient.js";
import { captureDesktopScreenshot, isSensitiveStep } from "../evidence.js";
import { resolveDesktopLocator } from "../locator.js";
import { snapshotWarnings, tierOf } from "../snapshot.js";
import type { DesktopLocator, NameMatch } from "../types.js";

type DesktopRuntime = VariableScope & {
  surface: ExecutionSurface;
  runId: string;
  currentStepNumber: number | null;
  currentStepId: string | null;
  /**
   * Filled in as the step proceeds, read by the runner when it closes the step
   * out. Written field by field rather than at the end, because the step that
   * most needs a trace is the one that throws before reaching it.
   */
  currentSurfaceTrace: SurfaceStepTrace | null;
};

/**
 * The half of the runtime the resolution helpers write to.
 *
 * Narrower than `DesktopRuntime` on purpose: these functions read variables and
 * leave a trace, and nothing else about a run is theirs to touch.
 */
type StepScope = VariableScope & { currentSurfaceTrace: SurfaceStepTrace | null };

/**
 * Merged rather than assigned. The tier is known before the element is, and the
 * verdict after it, so each writer contributes the part it learned.
 */
function noteTrace(runtime: StepScope, fields: Partial<SurfaceStepTrace>): void {
  runtime.currentSurfaceTrace = { ...(runtime.currentSurfaceTrace ?? {}), ...fields };
}

/** What a resolved step carries into the driver call. */
type ResolvedTarget = {
  elementToken?: string;
  x?: number;
  y?: number;
  /** Everything the snapshot said that the operator should know about. */
  warnings: string[];
};

type LocatorConfig = {
  role: string;
  name?: { kind: "exact" | "prefix" | "pattern"; value: string } | null;
  ancestors?: Array<{ role: string; name?: { kind: string; value: string } | null }> | null;
  ordinal?: number | null;
  automation_id?: string | null;
};

type StepConfig = {
  target:
    | { kind: "element"; locator: LocatorConfig }
    | { kind: "pixel"; x: number; y: number; origin: "window" };
  expect?: unknown[] | null;
  timeout_ms?: number | null;
};

/**
 * What the desktop family needs from the runner beyond a surface.
 *
 * Only the evidence path, and only because writing an artifact the run does not
 * record would look like success. Everything else a desktop action does is
 * expressible against the driver alone.
 */
export type DesktopExecutorDependencies<Runtime> = {
  evidenceDir: string;
  recordEvidence: (
    runtime: Runtime,
    artifact: {
      actionType: string;
      artifactKind: "screenshot" | "download";
      relativePath: string;
    },
  ) => void;
};

export function createDesktopActionExecutors<Runtime extends DesktopRuntime>(
  runtime: Runtime,
  deps: DesktopExecutorDependencies<Runtime>,
) {
  // Narrowed once, here, exactly as the web family does at its own entry.
  const desktop = requireDesktopSurface(runtime.surface);

  return {
    desktop_click: async (action) => {
      const target = await resolveStep(desktop, action.config, runtime);
      await desktop.driver.click(
        desktop.binding,
        target.elementToken !== undefined
          ? {
              elementToken: target.elementToken,
              button: action.config.button ?? undefined,
              count: action.config.count ?? undefined,
            }
          : {
              x: target.x as number,
              y: target.y as number,
              button: action.config.button ?? undefined,
              count: action.config.count ?? undefined,
            },
        runtime.signal,
      );
      // The default check is that the window is still there and still
      // addressable. A caller who knows the expected effect states it.
      await verify(desktop, action.config, runtime);
    },

    desktop_set_value: async (action) => {
      const target = await resolveStep(desktop, action.config, runtime);
      await desktop.driver.setValue(
        desktop.binding,
        { elementToken: requireElement(target, "desktop_set_value"), value: action.config.value },
        runtime.signal,
      );
      await verify(desktop, action.config, runtime);
    },

    // Input synthesis goes to the focused control, so these resolve their
    // target to move focus there first, then act, then verify.
    desktop_type_text: async (action) =>
      typeInto(desktop, runtime, action.config, () =>
        desktop.driver.typeText(desktop.binding, { text: action.config.text }, runtime.signal),
      ),

    desktop_press_key: async (action) =>
      typeInto(desktop, runtime, action.config, () =>
        desktop.driver.pressKey(
          desktop.binding,
          { key: action.config.key, modifiers: action.config.modifiers ?? undefined },
          runtime.signal,
        ),
      ),

    desktop_hotkey: async (action) =>
      typeInto(desktop, runtime, action.config, () =>
        desktop.driver.hotkey(desktop.binding, { keys: action.config.keys }, runtime.signal),
      ),

    desktop_read_text: async (action) => {
      const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
      const warnings = snapshotWarnings(snapshot);
      noteTrace(runtime, {
        tier: tierOf(snapshot),
        ...(warnings.length > 0 ? { warnings } : {}),
      });
      const element = resolveOrThrow(snapshot, action.config, "desktop_read_text", runtime);
      // Reading is the assertion; there is nothing further to verify.
      noteTrace(runtime, { verified: true });
      runtime.outputs[action.config.output_name] = (element.value ?? element.label ?? "").trim();
    },

    desktop_wait_for: async (action) => waitForState(desktop, runtime, action.config.expect),

    desktop_screenshot: async (action) => screenshot(desktop, runtime, deps, action.config),

    desktop_focus_window: async () => {
      await desktop.driver.bringToFront(desktop.binding, runtime.signal);
    },

    desktop_invoke_menu: async (action) => {
      await walkMenu(desktop, runtime, action.config.path);
      await verify(desktop, action.config, runtime);
    },

    desktop_scroll: async (action) => scrollAt(desktop, runtime, action.config),

    desktop_drag: async (action) => dragBetween(desktop, runtime, action.config),

    desktop_read_clipboard: async (action) => readClipboard(desktop, runtime, action.config),

    desktop_set_clipboard: async (action) => setClipboard(desktop, runtime, action.config),

    desktop_read_table: async (action) => readTable(desktop, runtime, action.config),
  } satisfies Partial<ActionExecutorMap>;
}

async function scrollAt(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig & {
    direction: "up" | "down" | "left" | "right";
    by?: "line" | "page" | null;
    amount?: number | null;
  },
): Promise<void> {
  const point = await resolvePoint(desktop, config.target, runtime, "desktop_scroll");
  await desktop.driver.scroll(
    desktop.binding,
    {
      x: point.x,
      y: point.y,
      direction: config.direction,
      by: config.by ?? undefined,
      amount: config.amount ?? undefined,
    },
    runtime.signal,
  );
  await verify(desktop, config, runtime);
}

/**
 * One snapshot, both endpoints resolved against it: the source and the
 * destination belong to the same tree, and two reads would let the window move
 * between them and drag from a stale point.
 */
async function dragBetween(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig & {
    to: StepConfig["target"];
    button?: "left" | "right" | "middle" | null;
    duration_ms?: number | null;
    steps?: number | null;
  },
): Promise<void> {
  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  noteTrace(runtime, { tier: tierOf(snapshot) });
  const from = pointFromSnapshot(snapshot, config.target, runtime, "desktop_drag (from)");
  const to = pointFromSnapshot(snapshot, config.to, runtime, "desktop_drag (to)");
  await desktop.driver.drag(
    desktop.binding,
    {
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      button: config.button ?? undefined,
      durationMs: config.duration_ms ?? undefined,
      steps: config.steps ?? undefined,
    },
    runtime.signal,
  );
  await verify(desktop, config, runtime);
}

/**
 * Reading is the assertion. `supported: false` is a real answer — the clipboard
 * holds no text form — written through rather than silently turned into an
 * empty string the workflow would misread as a cleared clipboard.
 */
async function readClipboard(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: { output_name: string },
): Promise<void> {
  const clipboard = await desktop.driver.readClipboard(runtime.signal);
  noteTrace(runtime, { verified: true });
  runtime.outputs[config.output_name] = clipboard.supported ? (clipboard.text ?? "") : "";
}

/**
 * Write, then confirm by reading back. The clipboard has no `verify_state`
 * predicate, so this read is the only honest confirmation the write took.
 */
async function setClipboard(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: { text: string },
): Promise<void> {
  await desktop.driver.writeClipboard({ text: config.text }, runtime.signal);
  const readback = await desktop.driver.readClipboard(runtime.signal);
  const verified = readback.supported && readback.text === config.text;
  noteTrace(runtime, { verified });
  if (!verified) {
    throw new Error(
      "desktop_set_clipboard wrote the clipboard but the read-back did not match; the write may not have taken effect.",
    );
  }
}

async function readTable(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig & { output_name: string; max_rows?: number | null },
): Promise<void> {
  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  const warnings = snapshotWarnings(snapshot);
  noteTrace(runtime, {
    tier: tierOf(snapshot),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
  const element = resolveOrThrow(snapshot, config, "desktop_read_table", runtime);
  const rows = extractTable(snapshot, element.element_index, config.max_rows ?? undefined);
  noteTrace(runtime, { verified: true });
  runtime.outputs[config.output_name] = rows;
}

/**
 * A window-relative point for an input tool that only speaks coordinates.
 *
 * An element target resolves to the centre of its `frame`; a pixel target is
 * already a point. `scroll` needs a fresh snapshot for its element case, which
 * is why this takes one — `drag` resolves both ends against a single snapshot
 * instead and calls `pointFromSnapshot` directly.
 */
async function resolvePoint(
  desktop: DesktopSurface,
  target: StepConfig["target"],
  runtime: StepScope,
  actionType: string,
): Promise<{ x: number; y: number }> {
  if (target.kind === "pixel") {
    noteTrace(runtime, { matched: "pixel" });
    return { x: target.x, y: target.y };
  }
  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  noteTrace(runtime, { tier: tierOf(snapshot) });
  return pointFromSnapshot(snapshot, target, runtime, actionType);
}

function pointFromSnapshot(
  snapshot: Awaited<ReturnType<DesktopSurface["driver"]["getWindowState"]>>,
  target: StepConfig["target"],
  runtime: StepScope,
  actionType: string,
): { x: number; y: number } {
  if (target.kind === "pixel") {
    noteTrace(runtime, { matched: "pixel" });
    return { x: target.x, y: target.y };
  }
  const element = resolveOrThrow(snapshot, { target }, actionType, runtime);
  return centerOf(element, actionType);
}

/**
 * The centre of an element's frame.
 *
 * The frame is the driver's own coordinate system, and it is the same one the
 * input tools consume — element frame in, input coordinates out, no translation
 * between window and desktop origins that could put the point in the wrong
 * place. An element with no frame cannot be a coordinate target; the message
 * says to use a pixel one.
 */
function centerOf(element: { frame?: { x: number; y: number; w: number; h: number } }, actionType: string) {
  const frame = element.frame;
  if (!frame) {
    throw new Error(
      `${actionType} needs the element's on-screen position, but its accessibility node reported no frame. Point the step at a pixel target instead.`,
    );
  }
  return { x: Math.round(frame.x + frame.w / 2), y: Math.round(frame.y + frame.h / 2) };
}

/**
 * Flattens the subtree under a resolved element into rows of cell strings.
 *
 * A generic reader, not a UIA-table-aware one: direct children of the anchor
 * are rows, their own children are cells, and a row with no children of its own
 * contributes its own text as a single cell. That covers Table/DataGrid, List
 * and most grouped containers without guessing at a schema the tree does not
 * carry. Cell text is `value` when present, else `label`, trimmed.
 */
function extractTable(
  snapshot: { elements: Array<{ element_index: number; parent_index?: number; label?: string; value?: string }> },
  anchorIndex: number,
  maxRows?: number,
): string[][] {
  const childrenOf = (parent: number) =>
    snapshot.elements.filter((element) => element.parent_index === parent);
  const textOf = (element: { label?: string; value?: string }) =>
    (element.value ?? element.label ?? "").trim();

  const rows: string[][] = [];
  for (const row of childrenOf(anchorIndex)) {
    if (maxRows !== undefined && rows.length >= maxRows) break;
    const cells = childrenOf(row.element_index);
    rows.push(cells.length > 0 ? cells.map(textOf) : [textOf(row)]);
  }
  return rows;
}

/**
 * A window screenshot, or a recorded reason there is none.
 *
 * A suppressed capture is the policy working, not a failure, so it is written
 * into the step rather than thrown. Without that, a reader cannot tell a
 * sensitive step from one whose screenshot broke.
 */
async function screenshot(
  desktop: DesktopSurface,
  runtime: DesktopRuntime,
  deps: DesktopExecutorDependencies<never>,
  config: { path?: string | null; sensitive?: boolean | null; output_name?: string | null },
): Promise<void> {
  const capture = await captureDesktopScreenshot({
    surface: desktop,
    evidenceDir: deps.evidenceDir,
    runId: runtime.runId,
    stepNumber: runtime.currentStepNumber,
    nodeId: runtime.currentStepId,
    requestedName: config.path,
    sensitive: isSensitiveStep({ flag: config.sensitive }),
    signal: runtime.signal,
  });

  if (!capture.captured) {
    if (config.output_name) runtime.outputs[config.output_name] = capture.reason;
    return;
  }

  (deps.recordEvidence as (r: unknown, a: unknown) => void)(runtime, {
    actionType: "desktop_screenshot",
    artifactKind: "screenshot",
    relativePath: capture.relativePath,
  });
  if (config.output_name) runtime.outputs[config.output_name] = capture.relativePath;
}

async function waitForState(
  desktop: DesktopSurface,
  runtime: StepScope,
  expect: unknown[] | null | undefined,
): Promise<void> {
  const verdict = await desktop.driver.verifyState(
    desktop.binding,
    predicatesOf(expect),
    runtime.signal,
  );
  noteTrace(runtime, { verified: verdict.unverified ? "unverified" : verdict.satisfied });
  if (verdict.satisfied) return;

  throw new Error(
    verdict.unverified
      ? `desktop_wait_for could not read a verdict from the driver: ${verdict.detail ?? ""}`
      : `desktop_wait_for timed out: ${verdict.detail ?? "the expected state never held"}`,
  );
}

/**
 * Menus are a distinct UIA surface: a submenu does not exist in the tree until
 * its parent is open, so each level needs its own fresh snapshot.
 */
async function walkMenu(
  desktop: DesktopSurface,
  runtime: StepScope,
  path: string[],
): Promise<void> {
  for (const item of path) {
    const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
    noteTrace(runtime, { tier: tierOf(snapshot) });
    const resolution = resolveDesktopLocator(
      { role: "MenuItem", name: { kind: "exact", value: item } },
      snapshot,
    );
    if (!resolution.ok) {
      throw new Error(`desktop_invoke_menu could not find "${item}": ${resolution.detail}`);
    }
    // Overwritten each level, so the trace names the item the walk stopped at
    // — which for a failure is the level before the one that was missing.
    noteTrace(runtime, {
      role: resolution.element.role,
      ...(resolution.element.label !== undefined ? { label: resolution.element.label } : {}),
      matched: resolution.matchedBy,
    });
    await desktop.driver.click(
      desktop.binding,
      { elementToken: resolution.elementToken },
      runtime.signal,
    );
  }
}

/** Resolve the target, synthesise the input, confirm the effect. */
async function typeInto(
  desktop: DesktopSurface,
  runtime: StepScope,
  config: StepConfig,
  act: () => Promise<unknown>,
): Promise<void> {
  await resolveStep(desktop, config, runtime);
  await act();
  await verify(desktop, config, runtime);
}

/**
 * Takes the snapshot, resolves the locator, and turns any of the three
 * distinct failures into a message that says which repair is needed.
 */
async function resolveStep(
  desktop: DesktopSurface,
  config: StepConfig,
  runtime: StepScope,
): Promise<ResolvedTarget> {
  if (config.target.kind === "pixel") {
    // A coordinate has no role, no label and no tier to report. Recording that
    // it was pixel-addressed is the whole trace, and it is the one a reader of
    // a broken workflow most needs: this step was always going to be fragile.
    noteTrace(runtime, { matched: "pixel" });
    return { x: config.target.x, y: config.target.y, warnings: [] };
  }

  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  const warnings = snapshotWarnings(snapshot);
  // Noted before resolving, so a step that fails to find its element still says
  // what state the window was in when it looked.
  noteTrace(runtime, {
    tier: tierOf(snapshot),
    ...(warnings.length > 0 ? { warnings } : {}),
  });

  const element = resolveOrThrow(
    snapshot,
    config,
    runtime.currentActionType ?? "desktop action",
    runtime,
  );

  return { elementToken: element.element_token, warnings };
}

function resolveOrThrow(
  snapshot: Awaited<ReturnType<DesktopSurface["driver"]["getWindowState"]>>,
  config: StepConfig,
  actionType: string,
  runtime: StepScope,
) {
  if (config.target.kind !== "element") {
    throw new Error(`${actionType} needs an element target, not a pixel one.`);
  }

  const resolution = resolveDesktopLocator(toLocator(config.target.locator), snapshot);

  if (!resolution.ok) {
    // The tier is what separates "the element moved" from "this window has no
    // accessibility tree any more", and those need different repairs.
    const tier = tierOf(snapshot);
    throw new Error(
      `${actionType} could not resolve its target (${resolution.reason}, window tier: ${tier}): ${resolution.detail}`,
    );
  }

  noteTrace(runtime, {
    role: resolution.element.role,
    ...(resolution.element.label !== undefined ? { label: resolution.element.label } : {}),
    matched: resolution.matchedBy,
  });

  return resolution.element;
}

/**
 * Confirms the effect. The driver's own answer is not evidence, so an action
 * with no meaningful predicate records that it could not verify rather than
 * reporting a success it never confirmed.
 */
async function verify(
  desktop: DesktopSurface,
  config: StepConfig,
  runtime: StepScope,
): Promise<void> {
  const predicates = predicatesOf(config.expect);
  if (predicates.length === 0) {
    // A step with nothing to check reads as unverified rather than as success.
    // The driver's own `isError` has been observed `true` for a click that
    // worked, so silence is the only honest answer here.
    noteTrace(runtime, { verified: "unverified" });
    return;
  }

  const verdict = await desktop.driver.verifyState(desktop.binding, predicates, runtime.signal);
  noteTrace(runtime, { verified: verdict.unverified ? "unverified" : verdict.satisfied });

  if (!verdict.satisfied) {
    throw new Error(
      verdict.unverified
        ? `The action ran but could not be verified: ${verdict.detail ?? "no readable verdict"}`
        : `The action did not take effect: ${verdict.detail ?? "verification failed"}`,
    );
  }
}

/**
 * The authored predicate, translated into the one the driver accepts.
 *
 * These were the same shape until the driver was measured, and the cast that
 * assumed so sent `{ kind: "window_exists" }` into a tool that answers
 * *"unknown field `kind`, expected `window` or `element`"*. Keeping them
 * separate is the better arrangement anyway: a saved workflow should not carry
 * `cua-driver`'s wire format, or a driver release would invalidate stored
 * graphs.
 *
 * The driver's element selector is **weaker than a Desktop Locator** — role and
 * a label substring, with no ancestry, ordinal or automation id. So a stated
 * expectation can be less precise than the step's own target. That is a real
 * limit, and it is why verification says "something matching this is there"
 * rather than "the element I acted on changed".
 */
function predicatesOf(expect: unknown[] | null | undefined): StatePredicate[] {
  return (expect ?? []).map(toDriverPredicate);
}

function toDriverPredicate(authored: unknown): StatePredicate {
  const predicate = authored as {
    kind?: string;
    locator?: LocatorConfig;
    expected?: string;
  };

  switch (predicate.kind) {
    case "element_present":
      return { element: { selector: selectorOf(predicate.locator), exists: true } };
    case "element_value":
      return {
        element: { selector: selectorOf(predicate.locator), value_equals: predicate.expected ?? "" },
      };
    // `window_exists`, and anything a future build authored that this one does
    // not know: the window being there is the weakest true statement available,
    // and it is better than sending a shape the driver rejects outright.
    default:
      return { window: { exists: true } };
  }
}

function selectorOf(locator: LocatorConfig | undefined): {
  role?: string;
  label_contains?: string;
} {
  if (!locator) return {};
  return {
    ...(locator.role ? { role: locator.role } : {}),
    ...(locator.name?.value ? { label_contains: locator.name.value } : {}),
  };
}

function requireElement(target: ResolvedTarget, actionType: string): string {
  if (target.elementToken === undefined) {
    throw new Error(`${actionType} needs an element target; a pixel cannot carry a value.`);
  }
  return target.elementToken;
}

function toLocator(config: LocatorConfig): DesktopLocator {
  return {
    role: config.role,
    name: config.name ? (config.name as NameMatch) : undefined,
    ancestors:
      config.ancestors?.map((step) => ({
        role: step.role,
        name: step.name ? (step.name as NameMatch) : undefined,
      })) ?? undefined,
    ordinal: config.ordinal ?? undefined,
    automationId: config.automation_id ?? undefined,
  };
}
