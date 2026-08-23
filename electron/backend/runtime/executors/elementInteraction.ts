import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { blurElementTarget, rightClickTarget } from "../interactionActions.js";
import { renderTemplate } from "../variables.js";
import { requireLocatorMethod } from "../runtimeHelpers.js";

export function buildElementInteractionExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
click: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
find_element: async (action) => {
      await deps.executeFindElement(runtime, action);
    },
hover: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "hover",
        action.type,
      )();
    },
double_click: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "dblclick",
        action.type,
      )();
    },
right_click: async (action) => {
      await rightClickTarget(
        runtime.page,
        await deps.locatorForAction(runtime, action.config),
        deps.sleep,
        deps.random,
        action.config.timeout_ms,
        runtime.signal,
      );
    },
drag_and_drop: async (action) => {
      await deps.executeDragAndDrop(runtime, action);
    },
scroll: async (action) => {
      await deps.executeScroll(runtime, action);
    },
focus_element: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
blur_element: async (action) => {
      await blurElementTarget(await deps.locatorForAction(runtime, action.config));
    },
switch_frame: async (action) => {
      const iframeXpath = renderTemplate(action.config.iframe_xpath, runtime.outputs);
      runtime.activeFrameXpath = iframeXpath;
    },
switch_to_parent_frame: async () => {
      runtime.activeFrameXpath = null;
    },
  };
}
