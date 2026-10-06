/**
 * Desktop Surface action executors.
 *
 * Every element-addressed action runs the same cycle:
 *     take Element Snapshot → resolve Desktop Locator → act → verify
 *
 * Spec: `docs/domain/desktop/action-family.md`.
 */

import type { ActionExecutorMap } from "../../../actions/execution.js";
import { requireDesktopSurface } from "../../../runtime/surface.js";
import { snapshotWarnings, tierOf } from "../snapshot.js";
import {
  requireElement,
  resolveOrThrow,
  resolveStep,
} from "./targetResolution.js";
import { verify, waitForState } from "./stateVerification.js";
import {
  dragBetween,
  hoverOver,
  readClipboard,
  readTable,
  screenshot,
  scrollAt,
  setClipboard,
  typeInto,
  walkMenu,
} from "./actionOperations.js";
import {
  noteTrace,
  type DesktopExecutorDependencies,
  type DesktopRuntime,
} from "./types.js";

export type { DesktopExecutorDependencies } from "./types.js";

export function createDesktopActionExecutors<Runtime extends DesktopRuntime>(
  runtime: Runtime,
  deps: DesktopExecutorDependencies<Runtime>,
) {
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

    desktop_hover: async (action) => hoverOver(desktop, runtime, action.config),
  } satisfies Partial<ActionExecutorMap>;
}
