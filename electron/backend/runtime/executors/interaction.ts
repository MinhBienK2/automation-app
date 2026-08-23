import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import {
  blurElementTarget,
  rightClickTarget,
  selectRadioTarget,
  submitFormTarget,
} from "../interactionActions.js";
import { assertRuntimeEnumValue, requireLocatorMethod } from "../runtimeHelpers.js";
import { renderTemplate } from "../variables.js";

export type InteractionExecutors = Pick<
  ActionExecutorMap,
  | "click" | "hover" | "double_click" | "right_click"
  | "drag_and_drop" | "scroll" | "find_element" | "focus_element"
  | "blur_element" | "switch_frame" | "switch_to_parent_frame" | "input_text"
  | "clear_input" | "select_option" | "check" | "uncheck"
  | "toggle_checkbox" | "select_radio" | "upload_file" | "submit_form"
  | "select_custom_option" | "set_contenteditable" | "press_key" | "hotkey"
  | "type_sequence" | "set_clipboard" | "paste_clipboard"
>;

export function createInteractionExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): InteractionExecutors {
  return {
    input_text: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      if (action.config.clear_before_input) await locator.fill("");
      await locator.fill(renderTemplate(action.config.text, runtime.outputs));
    },
    clear_input: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill("");
    },
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
    focus_element: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    blur_element: async (action) => {
      await blurElementTarget(await deps.locatorForAction(runtime, action.config));
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
    switch_frame: async (action) => {
      const iframeXpath = renderTemplate(action.config.iframe_xpath, runtime.outputs);
      runtime.activeFrameXpath = iframeXpath;
    },
    switch_to_parent_frame: async () => {
      runtime.activeFrameXpath = null;
    },
  };
}
