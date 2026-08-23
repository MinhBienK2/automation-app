import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { assertRuntimeEnumValue, requireLocatorMethod } from "../runtimeHelpers.js";
import { renderTemplate } from "../variables.js";
import { selectRadioTarget, submitFormTarget } from "../interactionActions.js";

export function buildFormExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
input_text: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      if (action.config.clear_before_input) await locator.fill("");
      await locator.fill(renderTemplate(action.config.text, runtime.outputs));
    },
clear_input: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill("");
    },
select_option: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_by,
        ["label", "value"],
        "Match by must be label or value",
      );
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "selectOption",
        action.type,
      )(
        action.config.match_by === "label"
          ? { label: action.config.value }
          : { value: action.config.value },
      );
    },
check: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "check",
        action.type,
      )();
    },
select_radio: async (action) => {
      await selectRadioTarget(await deps.locatorForAction(runtime, action.config));
    },
uncheck: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "uncheck",
        action.type,
      )();
    },
toggle_checkbox: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
upload_file: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "setInputFiles",
        action.type,
      )(
        action.config.files,
      );
    },
submit_form: async (action) => {
      if (action.config.xpath || action.config.target || action.config.target_ref?.trim()) {
        await submitFormTarget(await deps.locatorForAction(runtime, action.config, "form"));
      } else {
        await deps.pressKeyHuman(runtime.page, "Enter", runtime.signal);
      }
    },
select_custom_option: async (action) => {
      await (await deps.locatorForCustomSelectTrigger(runtime, action)).click();
      await runtime.page.locator(`text=${action.config.option_text}`).click();
    },
set_contenteditable: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill(
        renderTemplate(action.config.text, runtime.outputs),
      );
    },
  };
}
