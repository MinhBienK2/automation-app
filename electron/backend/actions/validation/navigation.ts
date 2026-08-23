import {
  firstValidation,
  optionalPositive,
  requiredActionString,
  validateElementActionTiming,
  validateElementTargetSource,
  zeroOrPositiveInteger,
  type ActionValidatorMap,
} from "./primitives.js";

export const navigationValidators = {
  navigate: (config) =>
    firstValidation(
      requiredActionString(config.config.url, "url", "URL is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  go_back: () => null,
  go_forward: () => null,
  reload: () => null,
  open_new_tab: () => null,
  open_link_in_new_tab: (config) =>
    firstValidation(
      validateElementTargetSource(config.config),
      validateElementActionTiming(config.config),
    ),
  switch_tab: (config) =>
    zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater"),
  close_tab: (config) =>
    config.config.index == null
      ? null
      : zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater"),
} satisfies Partial<ActionValidatorMap>;
