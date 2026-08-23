import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { renderTemplate } from "../variables.js";
import { requireLocatorMethod } from "../runtimeHelpers.js";

export function buildKeyboardExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
press_key: async (action) => {
      await deps.pressKeyHuman(runtime.page, action.config.key, runtime.signal);
    },
hotkey: async (action) => {
      await deps.pressHotkeyHuman(runtime.page, action.config.keys, runtime.signal);
    },
type_sequence: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "type",
        action.type,
      )(
        renderTemplate(action.config.text, runtime.outputs),
        { delay: action.config.delay_ms ?? 0 },
      );
    },
set_clipboard: async (action) => {
      runtime.clipboard = action.config.text;
    },
paste_clipboard: async (action) => {
      await deps.executePasteClipboard(runtime, action);
    },
  };
}
