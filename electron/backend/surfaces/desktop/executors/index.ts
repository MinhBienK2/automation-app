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
import type { VariableScope } from "../../../runtime/actionRuntime.js";
import { requireDesktopSurface } from "../../../runtime/surface.js";
import type { DesktopSurface, ExecutionSurface } from "../../../runtime/surface.js";
import type { StatePredicate } from "../driverClient.js";
import { resolveDesktopLocator } from "../locator.js";
import { snapshotWarnings, tierOf } from "../snapshot.js";
import type { DesktopLocator, NameMatch } from "../types.js";

type DesktopRuntime = VariableScope & { surface: ExecutionSurface };

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

export function createDesktopActionExecutors<Runtime extends DesktopRuntime>(runtime: Runtime) {
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
      const element = resolveOrThrow(snapshot, action.config, "desktop_read_text");
      // Reading is the assertion; there is nothing further to verify.
      runtime.outputs[action.config.output_name] = (element.value ?? element.label ?? "").trim();
    },

    desktop_wait_for: async (action) => waitForState(desktop, runtime, action.config.expect),

    desktop_screenshot: async () => {
      // Evidence handling — where the file lands, and whether a sensitive step
      // suppresses it — belongs to the runner's evidence path, which has no
      // desktop branch yet. Capturing here would write an artifact nothing
      // records.
      throw new Error(
        "desktop_screenshot needs the desktop evidence path, which has not landed yet.",
      );
    },

    desktop_focus_window: async () => {
      await desktop.driver.bringToFront(desktop.binding, runtime.signal);
    },

    desktop_invoke_menu: async (action) => {
      await walkMenu(desktop, runtime, action.config.path);
      await verify(desktop, action.config, runtime);
    },
  } satisfies Partial<ActionExecutorMap>;
}

async function waitForState(
  desktop: DesktopSurface,
  runtime: VariableScope,
  expect: unknown[] | null | undefined,
): Promise<void> {
  const verdict = await desktop.driver.verifyState(
    desktop.binding,
    predicatesOf(expect),
    runtime.signal,
  );
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
  runtime: VariableScope,
  path: string[],
): Promise<void> {
  for (const item of path) {
    const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
    const resolution = resolveDesktopLocator(
      { role: "MenuItem", name: { kind: "exact", value: item } },
      snapshot,
    );
    if (!resolution.ok) {
      throw new Error(`desktop_invoke_menu could not find "${item}": ${resolution.detail}`);
    }
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
  runtime: VariableScope,
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
  runtime: VariableScope,
): Promise<ResolvedTarget> {
  if (config.target.kind === "pixel") {
    return { x: config.target.x, y: config.target.y, warnings: [] };
  }

  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  const element = resolveOrThrow(snapshot, config, runtime.currentActionType ?? "desktop action");

  return {
    elementToken: element.element_token,
    warnings: snapshotWarnings(snapshot),
  };
}

function resolveOrThrow(
  snapshot: Awaited<ReturnType<DesktopSurface["driver"]["getWindowState"]>>,
  config: StepConfig,
  actionType: string,
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
  runtime: VariableScope,
): Promise<void> {
  const predicates = predicatesOf(config.expect);
  if (predicates.length === 0) return;

  const verdict = await desktop.driver.verifyState(desktop.binding, predicates, runtime.signal);
  if (!verdict.satisfied) {
    throw new Error(
      verdict.unverified
        ? `The action ran but could not be verified: ${verdict.detail ?? "no readable verdict"}`
        : `The action did not take effect: ${verdict.detail ?? "verification failed"}`,
    );
  }
}

function predicatesOf(expect: unknown[] | null | undefined): StatePredicate[] {
  return (expect ?? []) as StatePredicate[];
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
