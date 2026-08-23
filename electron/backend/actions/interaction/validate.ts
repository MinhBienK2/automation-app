import {
  firstValidation,
  requiredActionString,
  positiveValue,
  optionalPositive,
  optionalNonNegative,
  validateOptionalEnumValue,
  validateRequiredEnumValue,
  validateStringList,
  validateElementTarget,
  validateElementTargetSource,
  validateElementActionTiming,
  validateDragTargetPosition,
  hasElementTargetSourceField,
} from "../validation.js";
import {
  outputNameRequired,
} from "../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../validation.js";

export type InteractionValidators = Pick<
  ActionValidatorMap,
  "input_text" | "clear_input" | "click" | "find_element" |
  "scroll" | "select_option" | "press_key" | "hotkey" |
  "hover" | "double_click" | "right_click" | "drag_and_drop" |
  "focus_element" | "blur_element" | "type_sequence" | "set_clipboard" |
  "paste_clipboard" | "check" | "uncheck" | "toggle_checkbox" |
  "select_radio" | "upload_file" | "submit_form" | "select_custom_option" |
  "set_contenteditable" | "switch_frame" | "switch_to_parent_frame"
>;

export function createInteractionValidators(): InteractionValidators {
  return {
    input_text: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    clear_input: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    click: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    find_element: (config) =>
      firstValidation(
        validateElementTarget(config.config),
        requiredActionString(config.config.output_name, "output_name", outputNameRequired),
        validateOptionalEnumValue(
          config.config.rank,
          ["first", "nearest_viewport_center", "largest_visible_area"],
          "rank",
          "Rank must be first, nearest_viewport_center, or largest_visible_area",
        ),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    scroll: (config) => {
      const mode = config.config.mode ?? "page";
      const modeValidation = validateRequiredEnumValue(
        mode,
        ["page", "into_view", "until_element_visible"],
        "mode",
        "Scroll mode must be page, into_view, or until_element_visible",
      );
      if (modeValidation) return modeValidation;

      if (mode === "page") {
        return firstValidation(
          validateRequiredEnumValue(
            config.config.direction,
            ["up", "down", "left", "right"],
            "direction",
            "Scroll direction must be up, down, left, or right",
          ),
          positiveValue(config.config.pixels, "pixels", "Scroll pixels must be greater than 0"),
          validateOptionalEnumValue(
            config.config.scroll_style,
            ["human_like", "smooth_single"],
            "scroll_style",
            "Scroll style must be human_like or smooth_single",
          ),
        );
      }
      const targetValidation = firstValidation(
        mode === "into_view"
          ? validateElementTargetSource(config.config)
          : validateElementTarget(config.config),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      );
      if (targetValidation) return targetValidation;

      if (mode === "until_element_visible") {
        return firstValidation(
          validateRequiredEnumValue(
            config.config.direction ?? "down",
            ["up", "down", "left", "right"],
            "direction",
            "Scroll direction must be up, down, left, or right",
          ),
          positiveValue(config.config.pixels ?? 700, "pixels", "Scroll pixels must be greater than 0"),
          validateOptionalEnumValue(
            config.config.scroll_style,
            ["human_like", "smooth_single"],
            "scroll_style",
            "Scroll style must be human_like or smooth_single",
          ),
        );
      }
      return null;
    },
    select_option: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        requiredActionString(config.config.value, "value", "Option value is required"),
        validateRequiredEnumValue(
          config.config.match_by,
          ["label", "value"],
          "match_by",
          "Match by must be label or value",
        ),
        validateElementActionTiming(config.config),
      ),
    press_key: (config) => requiredActionString(config.config.key, "key", "Key is required"),
    hotkey: (config) => validateStringList(config.config.keys, "keys", "Hotkey keys are required"),
    hover: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    double_click: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    right_click: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    drag_and_drop: (config) =>
      firstValidation(
        validateElementTargetSource(config.config, {
          xpathField: "source_xpath",
          targetField: "source_target",
          refField: "source_ref",
          message: "Source element target is required",
          refMessage: "Source ref is required",
        }),
        validateElementTargetSource(config.config, {
          xpathField: "target_xpath",
          targetField: "target_target",
          refField: "target_ref",
          message: "Target element target is required",
          refMessage: "Target ref is required",
        }),
        validateElementActionTiming(config.config),
        validateDragTargetPosition(config.config.target_position),
      ),
    focus_element: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    blur_element: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    type_sequence: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        requiredActionString(config.config.text, "text", "Text is required"),
        optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
        validateElementActionTiming(config.config),
      ),
    set_clipboard: () => null,
    paste_clipboard: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    check: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    uncheck: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    toggle_checkbox: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    select_radio: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    upload_file: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateStringList(config.config.files, "files", "Upload files are required"),
        validateElementActionTiming(config.config),
      ),
    submit_form: (config) =>
      firstValidation(
        hasElementTargetSourceField(config.config)
          ? validateElementTargetSource(config.config)
          : null,
        validateElementActionTiming(config.config),
      ),
    select_custom_option: (config) =>
      firstValidation(
        validateElementTargetSource(config.config, {
          xpathField: "trigger_xpath",
          targetField: "trigger_target",
          refField: "trigger_ref",
          message: "Trigger element target is required",
          refMessage: "Trigger ref is required",
        }),
        requiredActionString(config.config.option_text, "option_text", "Option text is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    set_contenteditable: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    switch_frame: (config) =>
      requiredActionString(config.config.iframe_xpath, "iframe_xpath", "Iframe XPath is required"),
    switch_to_parent_frame: () => null,
  };
}
