import { outputNameRequired } from "../../shared/validationMessages.js";
import {
  firstValidation,
  optionalPositive,
  positiveValue,
  requiredActionString,
  validateDragTargetPosition,
  validateElementActionTiming,
  validateElementTarget,
  validateElementTargetSource,
  validateOptionalEnumValue,
  validateRequiredEnumValue,
  type ActionValidatorMap,
} from "./primitives.js";

export const elementInteractionValidators = {
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
  switch_frame: (config) =>
    requiredActionString(config.config.iframe_xpath, "iframe_xpath", "Iframe XPath is required"),
  switch_to_parent_frame: () => null,
} satisfies Partial<ActionValidatorMap>;
