import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import { requireLocatorMethod } from "../runtimeHelpers.js";

export type ExtractionDomExecutors = Pick<
  ActionExecutorMap,
  | "extract_dimensions" | "extract_visibility" | "extract_element_state"
>;

export function createExtractionDomExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): ExtractionDomExecutors {
  return {
    extract_dimensions: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          };
        })) ?? {};
    },
    extract_visibility: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const inViewport =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);
          return {
            visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
            display: style.display,
            opacity: parseFloat(style.opacity || "1"),
            inViewport,
          };
        })) ?? { visible: false, display: "none", opacity: 0, inViewport: false };
    },
    extract_element_state: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          return {
            disabled: el.disabled === true,
            readonly: el.readOnly === true,
            required: el.required === true,
            focused: document.activeElement === el,
            editable: el.contentEditable === "true" || (el instanceof HTMLInputElement && !el.readOnly && !el.disabled),
          };
        })) ?? { disabled: false, readonly: false, required: false, focused: false, editable: false };
    },
  };
}
