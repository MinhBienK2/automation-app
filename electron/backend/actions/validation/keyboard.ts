import {
  firstValidation,
  optionalNonNegative,
  requiredActionString,
  validateElementActionTiming,
  validateElementTargetSource,
  validateStringList,
  type ActionValidatorMap,
} from "./primitives.js";

export const keyboardValidators = {
  press_key: (config) => requiredActionString(config.config.key, "key", "Key is required"),
  hotkey: (config) => validateStringList(config.config.keys, "keys", "Hotkey keys are required"),
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
} satisfies Partial<ActionValidatorMap>;
