import path from "node:path";
import type {
  ActionConfig,
  WorkflowCondition,
} from "../../../src/types/workflow.js";
import {
  actionDefinitions,
  getActionDefinition,
  unsupportedActionTypeMessage,
  type ActionType,
} from "./registry.js";

export type ActionValidationError = {
  field: string;
  message: string;
};

type ActionValidator<T extends ActionConfig = ActionConfig> = (
  config: T,
) => ActionValidationError | null;

type ActionValidatorMap = {
  [Type in ActionType]: ActionValidator<Extract<ActionConfig, { type: Type }>>;
};

const actionValidators = createActionValidatorMap({
  navigate: (config) =>
    firstValidation(
      requiredActionString(config.config.url, "url", "URL is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  wait: (config) => {
    const condition = config.config.condition;
    const validConditions = [
      "duration",
      "element_visible",
      "element_hidden",
      "element_attached",
      "element_detached",
      "text_visible",
      "url_contains",
      "page_load",
      "element_enabled",
      "element_disabled",
    ];
    if (!validConditions.includes(condition)) {
      return validationError("condition", "Wait condition is invalid");
    }
    if (config.config.condition === "duration" && !positive(config.config.duration_ms)) {
      return validationError("duration_ms", "Wait duration must be greater than 0");
    }
    if (
      config.config.condition.startsWith("element_") &&
      !hasElementTargetField(config.config)
    ) {
      return validationError("xpath", "Element target is required");
    }
    if (config.config.condition === "text_visible") {
      const validation = requiredActionString(config.config.text, "text", "Text is required");
      if (validation) return validation;
    }
    if (config.config.condition === "url_contains") {
      const validation = requiredActionString(config.config.url, "url", "URL contains is required");
      if (validation) return validation;
    }
    return optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0");
  },
  random_wait: (config) =>
    !positive(config.config.min_ms) ||
    !positive(config.config.max_ms) ||
    config.config.max_ms < config.config.min_ms
      ? validationError("max_ms", "Random wait range is invalid")
      : null,
  input_text: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  clear_input: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  click: (config) =>
    firstValidation(
      config.config.target_ref
        ? requiredActionString(config.config.target_ref, "target_ref", "Target ref is required")
        : validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  find_element: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
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
      validateElementTarget(config.config),
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
      validateElementTarget(config.config),
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
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  double_click: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  right_click: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  drag_and_drop: (config) =>
    firstValidation(
      validateElementTarget(config.config, {
        xpathField: "source_xpath",
        targetField: "source_target",
        message: "Source element target is required",
      }),
      validateElementTarget(config.config, {
        xpathField: "target_xpath",
        targetField: "target_target",
        message: "Target element target is required",
      }),
      validateElementActionTiming(config.config),
    ),
  focus_element: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  blur_element: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  type_sequence: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      requiredActionString(config.config.text, "text", "Text is required"),
      optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
      validateElementActionTiming(config.config),
    ),
  set_clipboard: () => null,
  paste_clipboard: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  check: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  uncheck: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  toggle_checkbox: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  select_radio: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  upload_file: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateStringList(config.config.files, "files", "Upload files are required"),
      validateElementActionTiming(config.config),
    ),
  submit_form: (config) =>
    firstValidation(
      config.config.xpath || config.config.target
        ? validateElementTarget(config.config)
        : null,
      validateElementActionTiming(config.config),
    ),
  select_custom_option: (config) =>
    firstValidation(
      validateElementTarget(config.config, {
        xpathField: "trigger_xpath",
        targetField: "trigger_target",
        message: "Trigger element target is required",
      }),
      requiredActionString(config.config.option_text, "option_text", "Option text is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  set_contenteditable: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  extract_text: (config) => validateDataCaptureConfig(config.config),
  extract_attribute: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      requiredActionString(config.config.attribute, "attribute", "Attribute is required"),
    ),
  extract_input_value: (config) => validateDataCaptureConfig(config.config),
  extract_table: (config) => validateDataCaptureConfig(config.config),
  extract_list: (config) => validateDataCaptureConfig(config.config),
  take_screenshot: (config) =>
    safeArtifactNameValidation(
      config.config.path,
      "path",
      "Screenshot path must be a safe artifact name",
    ),
  go_back: () => null,
  go_forward: () => null,
  reload: () => null,
  open_new_tab: () => null,
  switch_tab: (config) =>
    zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater"),
  close_tab: (config) =>
    config.config.index == null
      ? null
      : zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater"),
  accept_dialog: () => null,
  dismiss_dialog: () => null,
  wait_for_download: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Download output name is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  set_variable: (config) => {
    const variables = config.config.variables ?? [];
    if (variables.length > 0) {
      return variables.some((row) => !row.name.trim())
        ? validationError("variables", "Variable name is required")
        : null;
    }
    return config.config.name?.trim()
      ? null
      : validationError("name", "Variable name is required");
  },
  set_json_variables: (config) => {
    try {
      const parsed = JSON.parse(config.config.json);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? null
        : validationError("json", "JSON variables must be an object");
    } catch {
      return validationError("json", "JSON variables must be valid JSON");
    }
  },
  assert_element: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      validateElementActionTiming(config.config),
    ),
  assert_text: (config) =>
    firstValidation(
      validateElementTarget(config.config),
      requiredActionString(config.config.text, "text", "Assertion text is required"),
      validateRequiredEnumValue(
        config.config.match_mode,
        ["contains", "equals"],
        "match_mode",
        "Match mode must be contains or equals",
      ),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  graph_noop: (config) =>
    config.config.kind === "merge"
      ? null
      : validationError("kind", "Graph no-op kind is invalid"),
  if_condition: (config) =>
    firstValidation(
      validateConditionConfig(config.config.condition),
      validateNestedActionArray(config.config.then_steps, "then_steps"),
      validateNestedActionArray(config.config.else_steps, "else_steps"),
    ),
  router_condition: (config) =>
    firstValidation(
      validateRequiredEnumValue(
        config.config.mode,
        ["first_match"],
        "mode",
        "Router mode must be first_match",
      ),
      validateRouterConditionCases(config.config.cases),
      validateNestedActionArray(config.config.default_steps, "default_steps"),
    ),
  random_choice: (config) => validateRandomChoiceCases(config.config.choices),
  repeat_times: (config) =>
    firstValidation(
      positiveValue(config.config.times, "times", "Repeat times must be greater than 0"),
      validateNestedActionArray(config.config.steps, "steps"),
    ),
  repeat_for_each: (config) =>
    firstValidation(
      requiredActionString(config.config.item_name, "item_name", "Item name is required"),
      config.config.array_variable
        ? null
        : validateStringList(config.config.items, "items", "Items are required"),
      validateNestedActionArray(config.config.steps, "steps"),
    ),
  retry_block: (config) =>
    firstValidation(
      positiveValue(config.config.max_attempts, "max_attempts", "Max attempts must be greater than 0"),
      optionalNonNegative(config.config.delay_ms, "delay_ms", "Delay must be zero or greater"),
      validateNestedActionArray(config.config.steps, "steps"),
      validateNestedActionArray(config.config.failed_steps ?? [], "failed_steps"),
    ),
  switch_condition: (config) =>
    firstValidation(
      requiredActionString(config.config.expression, "expression", "Switch expression is required"),
      validateSwitchCases(config.config.cases),
      validateNestedActionArray(config.config.default_steps, "default_steps"),
    ),
  while_loop: (config) =>
    firstValidation(
      validateConditionConfig(config.config.condition),
      validateLoopLimit(config.config),
      validateNestedActionArray(config.config.steps, "steps"),
    ),
  repeat_until: (config) =>
    firstValidation(
      validateConditionConfig(config.config.condition),
      validateLoopLimit(config.config),
      validateNestedActionArray(config.config.steps, "steps"),
      validateNestedActionArray(config.config.timeout_steps, "timeout_steps"),
    ),
  try_catch: (config) =>
    firstValidation(
      validateNestedActionArray(config.config.try_steps, "try_steps"),
      validateNestedActionArray(config.config.success_steps, "success_steps"),
      validateNestedActionArray(config.config.error_steps, "error_steps"),
      validateNestedActionArray(config.config.finally_steps, "finally_steps"),
    ),
  fallback_block: (config) =>
    firstValidation(
      validateNestedActionArray(config.config.primary_steps, "primary_steps"),
      validateNestedActionArray(config.config.fallback_steps, "fallback_steps"),
    ),
  break_loop: () => null,
  continue_loop: () => null,
  stop_workflow: (config) =>
    ["success", "failure"].includes(config.config.status)
      ? null
      : validationError("status", "Stop workflow status must be success or failure"),
  transform_variable: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", "Source output is required"),
      requiredActionString(config.config.target_name, "target_name", "Target output is required"),
    ),
  assert_output: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Output name is required"),
      validateRequiredEnumValue(
        config.config.match_mode,
        ["contains", "equals"],
        "match_mode",
        "Match mode must be contains or equals",
      ),
      requiredActionString(config.config.value, "value", "Expected output value is required"),
    ),
  domain_allowlist: (config) =>
    validateStringList(config.config.domains, "domains", "Allowed domains are required"),
  set_cookie: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Cookie name is required"),
      requiredActionString(config.config.value, "value", "Cookie value is required"),
    ),
  clear_cookies: () => null,
  set_viewport: (config) =>
    firstValidation(
      positiveValue(config.config.width, "width", "Viewport width must be greater than 0"),
      positiveValue(config.config.height, "height", "Viewport height must be greater than 0"),
    ),
  set_geolocation: (config) =>
    firstValidation(
      latitudeValidation(config.config.latitude),
      longitudeValidation(config.config.longitude),
      optionalNonNegative(config.config.accuracy, "accuracy", "Accuracy must be zero or greater"),
    ),
  set_extra_headers: (config) => validateHeaderPairs(config.config.headers),
  grant_permission: (config) =>
    validateStringList(config.config.permissions, "permissions", "Permissions are required"),
  execute_js: (config) =>
    firstValidation(
      requiredActionString(config.config.script, "script", "Script is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  wait_for_request: (config) =>
    firstValidation(
      requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  wait_for_response: (config) =>
    firstValidation(
      requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
      statusValidation(config.config.status, "status", "Response status must be between 100 and 599"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  block_request: (config) =>
    validateStringList(config.config.url_patterns, "url_patterns", "URL pattern is required"),
  mock_response: (config) =>
    firstValidation(
      requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
      statusValidation(config.config.status, "status", "Mock response status must be between 100 and 599"),
    ),
  set_local_storage: (config) =>
    requiredActionString(config.config.key, "key", "Storage key is required"),
  set_session_storage: (config) =>
    requiredActionString(config.config.key, "key", "Storage key is required"),
});

export function validateActionConfig(config: ActionConfig): ActionValidationError | null {
  const definition = getActionDefinition((config as { type?: unknown }).type);
  if (!definition) {
    return validationError(
      "type",
      unsupportedActionTypeMessage((config as { type?: unknown }).type),
    );
  }
  const validator = actionValidators[definition.type] as ActionValidator | undefined;
  if (!validator) {
    return validationError(
      "type",
      `Action ${definition.type} is registered without a validation handler`,
    );
  }
  return validator(config);
}

export function assertActionValidatorCoverage(
  validators: Partial<Record<ActionType, unknown>> = actionValidators,
): asserts validators is ActionValidatorMap {
  for (const definition of actionDefinitions) {
    if (typeof validators[definition.type] !== "function") {
      throw new Error(`Action ${definition.type} is registered without a validation handler`);
    }
  }
}

function createActionValidatorMap(validators: ActionValidatorMap): ActionValidatorMap {
  return validators;
}

function firstValidation(...validations: Array<ActionValidationError | null | undefined>) {
  return validations.find((validation): validation is ActionValidationError => Boolean(validation)) ?? null;
}

function requiredActionString(
  value: string | null | undefined,
  field: string,
  message: string,
) {
  return typeof value === "string" && value.trim()
    ? null
    : validationError(field, message);
}

function positiveValue(value: number | null | undefined, field: string, message: string) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? null
    : validationError(field, message);
}

function optionalPositive(value: number | null | undefined, field: string, message: string) {
  return value == null ? null : positiveValue(value, field, message);
}

function optionalNonNegative(value: number | null | undefined, field: string, message: string) {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= 0)
    ? null
    : validationError(field, message);
}

function zeroOrPositiveInteger(value: number | null | undefined, field: string, message: string) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
    ? null
    : validationError(field, message);
}

function validateElementTarget(
  config: unknown,
  options: {
    xpathField?: string;
    targetField?: string;
    message?: string;
  } = {},
) {
  const xpathField = options.xpathField ?? "xpath";
  return hasElementTargetField(config, xpathField, options.targetField ?? "target")
    ? null
    : validationError(xpathField, options.message ?? "Element target is required");
}

function validateElementActionTiming(config: unknown) {
  const record = asRecord(config);
  return firstValidation(
    validateOptionalEnumValue(
      record.wait_until,
      ["attached", "visible", "enabled", "clickable"],
      "wait_until",
      "Wait until must be attached, visible, enabled, or clickable",
    ),
    optionalPositive(record.timeout_ms as number | null | undefined, "timeout_ms", "Timeout must be greater than 0"),
  );
}

function validateOptionalEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  field: string,
  message: string,
) {
  return value == null || (typeof value === "string" && allowedValues.includes(value))
    ? null
    : validationError(field, message);
}

function validateRequiredEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  field: string,
  message: string,
) {
  return typeof value === "string" && allowedValues.includes(value)
    ? null
    : validationError(field, message);
}

function validateDataCaptureConfig(config: {
  xpath?: string | null;
  target?: unknown;
  output_name: string;
  timeout_ms?: number | null;
}) {
  return firstValidation(
    validateElementTarget(config),
    requiredActionString(config.output_name, "output_name", "Output name is required"),
    optionalPositive(config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
  );
}

function validateStringList(value: unknown, field: string, message: string) {
  return Array.isArray(value) &&
    value.some((item) => typeof item === "string" && item.trim())
    ? null
    : validationError(field, message);
}

function validateHeaderPairs(headers: unknown) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return validationError("headers", "Header name is required");
  }
  for (const header of headers) {
    if (!stringField(header, "name")) {
      return validationError("headers", "Header name is required");
    }
  }
  return null;
}

function validateConditionConfig(condition: unknown, field = "condition") {
  if (!condition || typeof condition !== "object") {
    return validationError(field, "Condition is required");
  }
  try {
    validateWorkflowCondition(condition as WorkflowCondition);
    return null;
  } catch (caught) {
    const serialized = serializeValidationError(caught);
    return validationError(`${field}.${serialized.field}`, serialized.message);
  }
}

function validateNestedActionArray(steps: unknown, field: string): ActionValidationError | null {
  if (!Array.isArray(steps)) {
    return validationError(field, "Nested steps must be an array");
  }
  for (let index = 0; index < steps.length; index += 1) {
    const validation = validateNestedActionValue(steps[index], `${field}[${index}]`);
    if (validation) return validation;
  }
  return null;
}

function validateNestedActionValue(stepValue: unknown, field: string): ActionValidationError | null {
  if (!isActionConfig(stepValue)) {
    return validationError(field, "Nested step must be an action config");
  }
  const validation = validateActionConfig(stepValue);
  return validation
    ? validationError(`${field}.${validation.field}`, validation.message)
    : null;
}

function validateSwitchCases(cases: unknown) {
  if (!Array.isArray(cases)) {
    return validationError("cases", "Switch cases must be an array");
  }
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    if (!stringField(caseValue, "value")) {
      return validationError(`cases[${index}].value`, "Switch case value is required");
    }
    const validation = validateNestedActionArray(caseValue.steps, `cases[${index}].steps`);
    if (validation) return validation;
  }
  return null;
}

function validateRouterConditionCases(cases: unknown) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return validationError("cases", "Router cases are required");
  }
  const seenIds = new Set<string>();
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    const id = stringField(caseValue, "id");
    if (!id) return validationError(`cases[${index}].id`, "Router case id is required");
    if (seenIds.has(id)) return validationError("cases", "Router case ids must be unique");
    seenIds.add(id);
    if (!stringField(caseValue, "label")) {
      return validationError(`cases[${index}].label`, "Router case labels are required");
    }
    const conditionValidation = validateConditionConfig(
      caseValue.condition,
      `cases[${index}].condition`,
    );
    if (conditionValidation) return conditionValidation;
    const stepsValidation = validateNestedActionArray(caseValue.steps, `cases[${index}].steps`);
    if (stepsValidation) return stepsValidation;
  }
  return null;
}

function validateRandomChoiceCases(cases: unknown) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return validationError("choices", "Random choices are required");
  }
  const seenIds = new Set<string>();
  for (let index = 0; index < cases.length; index += 1) {
    const caseValue = asRecord(cases[index]);
    const id = stringField(caseValue, "id");
    if (!id) return validationError(`choices[${index}].id`, "Random choice id is required");
    if (seenIds.has(id)) return validationError("choices", "Random choice ids must be unique");
    seenIds.add(id);
    if (!stringField(caseValue, "label")) {
      return validationError(`choices[${index}].label`, "Random choice labels are required");
    }
    const weight = caseValue.weight;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      return validationError(`choices[${index}].weight`, "Random choice weight must be greater than 0");
    }
    const stepsValidation = validateNestedActionArray(caseValue.steps, `choices[${index}].steps`);
    if (stepsValidation) return stepsValidation;
  }
  return null;
}

function validateLoopLimit(config: { max_attempts?: number | null; timeout_ms?: number | null }) {
  const maxAttemptsValidation = optionalPositive(
    config.max_attempts,
    "max_attempts",
    "Max attempts must be greater than 0",
  );
  if (maxAttemptsValidation) return maxAttemptsValidation;
  const timeoutValidation = optionalPositive(
    config.timeout_ms,
    "timeout_ms",
    "Timeout must be greater than 0",
  );
  if (timeoutValidation) return timeoutValidation;
  return config.max_attempts == null && config.timeout_ms == null
    ? validationError("max_attempts", "Loop actions require max attempts or timeout")
    : null;
}

function latitudeValidation(value: number) {
  return typeof value === "number" && value >= -90 && value <= 90
    ? null
    : validationError("latitude", "Latitude must be between -90 and 90");
}

function longitudeValidation(value: number) {
  return typeof value === "number" && value >= -180 && value <= 180
    ? null
    : validationError("longitude", "Longitude must be between -180 and 180");
}

function statusValidation(value: number | null | undefined, field: string, message: string) {
  return value == null || (Number.isInteger(value) && value >= 100 && value <= 599)
    ? null
    : validationError(field, message);
}

function safeArtifactNameValidation(
  value: string | null | undefined,
  field: string,
  message: string,
) {
  if (value == null || value.trim() === "") return null;
  return isSafeArtifactName(value)
    ? null
    : validationError(field, message);
}

function isSafeArtifactName(value: string) {
  const raw = value.trim();
  if (!raw) return false;
  if (
    /^file:/i.test(raw) ||
    path.isAbsolute(raw) ||
    raw.includes("/") ||
    raw.includes("\\") ||
    raw.split(/[\\/]+/).includes("..")
  ) {
    return false;
  }
  const parsed = path.parse(raw);
  return !(parsed.dir || parsed.base === ".." || parsed.name === "..");
}

function validateWorkflowCondition(condition: WorkflowCondition) {
  const conditionRecord = condition as { kind?: unknown };
  switch (condition.kind) {
    case "output_equals":
    case "output_contains":
      if (!condition.name.trim()) throw validationError("name", "Condition output name is required");
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "text_visible":
      if (!condition.text.trim()) throw validationError("text", "Condition text is required");
      break;
    case "url_contains":
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "element_visible":
      if (!condition.target && !condition.xpath?.trim()) throw validationError("xpath", "Condition XPath is required");
      break;
    default:
      throw validationError(
        "kind",
        `Unsupported condition kind: ${conditionKindLabel(conditionRecord.kind)}`,
      );
  }
}

function conditionKindLabel(kind: unknown) {
  return typeof kind === "string" && kind ? kind : "unknown";
}

function stringField(config: unknown, field: string): string | null {
  const value = asRecord(config)[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function hasElementTargetField(
  config: unknown,
  xpathField = "xpath",
  targetField = "target",
): boolean {
  const record = asRecord(config);
  const xpath = record[xpathField];
  return Boolean(
    (typeof xpath === "string" && xpath.trim()) ||
      hasStructuredElementTarget(record[targetField]),
  );
}

function hasStructuredElementTarget(target: unknown): boolean {
  const locators = asRecord(target).locators;
  return Array.isArray(locators) &&
    locators.some((locator) => {
      const value = asRecord(locator).value;
      return typeof value === "string" && value.trim();
    });
}

function positive(value: number | null | undefined) {
  return value != null && value > 0;
}

function isActionConfig(value: unknown): value is ActionConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "config" in value,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function validationError(field: string, message: string): ActionValidationError {
  return { field, message };
}

function serializeValidationError(error: unknown): ActionValidationError {
  return error && typeof error === "object" && "message" in error
    ? (error as ActionValidationError)
    : validationError("graph", "Invalid graph");
}
