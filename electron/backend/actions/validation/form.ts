import {
  firstValidation,
  hasElementTargetSourceField,
  optionalPositive,
  requiredActionString,
  validateElementActionTiming,
  validateElementTargetSource,
  validateRequiredEnumValue,
  validateStringList,
  type ActionValidatorMap,
} from "./primitives.js";

export const formValidators = {
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
} satisfies Partial<ActionValidatorMap>;
