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
import { buildCapture1Executors } from "./executors/capture1.js";
import { buildCapture2Executors } from "./executors/capture2.js";
import { buildVariablesExecutors } from "./executors/variables.js";
import { buildVariableData1Executors } from "./executors/variableData1.js";
import { buildVariableData2Executors } from "./executors/variableData2.js";
import { buildVariableData3Executors } from "./executors/variableData3.js";
import { buildVariableData4Executors } from "./executors/variableData4.js";
import { buildFlowControlExecutors } from "./executors/flowControl.js";
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
    ...buildCapture1Executors(runtime as any, deps as any),
    ...buildCapture2Executors(runtime as any, deps as any),
    ...buildVariablesExecutors(runtime as any, deps as any),
    ...buildVariableData1Executors(runtime as any, deps as any),
    ...buildVariableData2Executors(runtime as any, deps as any),
    ...buildVariableData3Executors(runtime as any, deps as any),
    ...buildVariableData4Executors(runtime as any, deps as any),
    ...buildFlowControlExecutors(runtime as any, deps as any),
    ...buildNetworkExecutors(runtime as any, deps as any),
  } as any);
}
