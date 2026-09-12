import {
  createActionExecutorMap,
  type ActionExecutorMap,
} from "../actions/execution.js";
import type {
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "./executors/types.js";
import { buildNavigationExecutors } from "./executors/navigation.js";
import { buildBrowserContextExecutors } from "./executors/browserContext.js";
import { buildFormExecutors } from "./executors/form.js";
import { buildElementInteractionExecutors } from "./executors/elementInteraction.js";
import { buildKeyboardExecutors } from "./executors/keyboard.js";
import { buildExtractionExecutors } from "./executors/extraction.js";
import { buildFilesExecutors } from "./executors/files.js";
import { buildAssertionsExecutors } from "./executors/assertions.js";
import { buildVariableNumberExecutors } from "./executors/variableNumber.js";
import { buildVariableTextExecutors } from "./executors/variableText.js";
import { buildVariableBooleanExecutors } from "./executors/variableBoolean.js";
import { buildVariableListExecutors } from "./executors/variableList.js";
import { buildVariableObjectExecutors } from "./executors/variableObject.js";
// Control-Action family lives outside the surface executors (candidate 2).
import { buildVariablesExecutors } from "./control/variables.js";
import { buildFlowControlExecutors } from "./control/flowControl.js";
import { buildNetworkExecutors } from "./executors/network.js";
import { createDesktopActionExecutors } from "../surfaces/desktop/executors/index.js";

export type { RunnerActionRuntime, RunnerActionExecutorDependencies } from "./executors/types.js";

function createDesktopActionExecutorsLazily<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
) {
  let cached: ReturnType<typeof createDesktopActionExecutors> | null = null;
  const get = () => {
    if (!cached) {
      cached = createDesktopActionExecutors(runtime as any, {
        evidenceDir: deps.appPaths.evidenceDir,
        recordEvidence: deps.recordEvidence,
      });
    }
    return cached;
  };
  return {
    desktop_click: (action: any) => get().desktop_click(action),
    desktop_set_value: (action: any) => get().desktop_set_value(action),
    desktop_type_text: (action: any) => get().desktop_type_text(action),
    desktop_press_key: (action: any) => get().desktop_press_key(action),
    desktop_hotkey: (action: any) => get().desktop_hotkey(action),
    desktop_read_text: (action: any) => get().desktop_read_text(action),
    desktop_wait_for: (action: any) => get().desktop_wait_for(action),
    desktop_screenshot: (action: any) => get().desktop_screenshot(action),
    desktop_focus_window: () => get().desktop_focus_window(),
    desktop_invoke_menu: (action: any) => get().desktop_invoke_menu(action),
    desktop_scroll: (action: any) => get().desktop_scroll(action),
    desktop_drag: (action: any) => get().desktop_drag(action),
    desktop_read_clipboard: (action: any) => get().desktop_read_clipboard(action),
    desktop_set_clipboard: (action: any) => get().desktop_set_clipboard(action),
    desktop_read_table: (action: any) => get().desktop_read_table(action),
    desktop_hover: (action: any) => get().desktop_hover(action),
  };
}

/**
 * Composition of the owner-group executor modules. Coverage over every
 * registered action type is asserted here — a missing executor fails at import
 * time instead of surfacing as an undefined call mid-run.
 */
export function createRunnerActionExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): ActionExecutorMap {
  const desktopFamily = createDesktopActionExecutorsLazily(runtime, deps);

  return createActionExecutorMap({
    ...desktopFamily,
    ...buildNavigationExecutors(runtime as any, deps as any),
    ...buildBrowserContextExecutors(runtime as any, deps as any),
    ...buildFormExecutors(runtime as any, deps as any),
    ...buildElementInteractionExecutors(runtime as any, deps as any),
    ...buildKeyboardExecutors(runtime as any, deps as any),
    ...buildExtractionExecutors(runtime as any, deps as any),
    ...buildFilesExecutors(runtime as any, deps as any),
    ...buildAssertionsExecutors(runtime as any, deps as any),
    ...buildVariablesExecutors(runtime as any, deps as any),
    ...buildVariableNumberExecutors(runtime as any, deps as any),
    ...buildVariableTextExecutors(runtime as any, deps as any),
    ...buildVariableBooleanExecutors(runtime as any, deps as any),
    ...buildVariableListExecutors(runtime as any, deps as any),
    ...buildVariableObjectExecutors(runtime as any, deps as any),
    ...buildFlowControlExecutors(runtime as any, deps as any),
    ...buildNetworkExecutors(runtime as any, deps as any),
  } as any);
}
