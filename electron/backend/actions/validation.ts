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
import {
  asRecord,
  stringField,
  validationError,
} from "../shared/records.js";

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
    if (config.config.condition.startsWith("element_")) {
      const validation = validateElementTargetSource(config.config);
      if (validation) return validation;
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
  extract_text: (config) => validateDataCaptureConfig(config.config),
  extract_attribute: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      requiredActionString(config.config.attribute, "attribute", "Attribute is required"),
    ),
  extract_input_value: (config) => validateDataCaptureConfig(config.config),
  extract_table: (config) => validateDataCaptureConfig(config.config),
  extract_list: (config) => validateDataCaptureConfig(config.config),
  count_elements: (config) => validateDataCaptureConfig(config.config),
  extract_regex_matches: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", "Source output is required"),
      requiredActionString(config.config.pattern, "pattern", "Regex pattern is required"),
      regexPatternValidation(config.config.pattern, config.config.flags),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
    ),
  extract_text_content: (config) => validateDataCaptureConfig(config.config),
  extract_inner_html: (config) => validateDataCaptureConfig(config.config),
  extract_outer_html: (config) => validateDataCaptureConfig(config.config),
  extract_all_attributes: (config) => validateDataCaptureConfig(config.config),
  extract_data_attributes: (config) => validateDataCaptureConfig(config.config),
  extract_class_list: (config) => validateDataCaptureConfig(config.config),
  extract_descendant_attributes: (config) => validateDataCaptureConfig(config.config),
  extract_select_value: (config) => validateDataCaptureConfig(config.config),
  extract_select_options: (config) => validateDataCaptureConfig(config.config),
  extract_checkbox_state: (config) => validateDataCaptureConfig(config.config),
  extract_form_data: (config) => validateDataCaptureConfig(config.config),
  extract_table_headers: (config) => validateDataCaptureConfig(config.config),
  extract_dimensions: (config) => validateDataCaptureConfig(config.config),
  extract_visibility: (config) => validateDataCaptureConfig(config.config),
  extract_element_state: (config) => validateDataCaptureConfig(config.config),
  check_element_exists: (config) => validateDataCaptureConfig(config.config),
  extract_computed_style: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      requiredActionString(config.config.property, "property", "Property is required"),
    ),
  extract_table_row: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      zeroOrPositiveInteger(config.config.row_index, "row_index", "Row index must be a non-negative integer"),
    ),
  extract_table_column: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      requiredActionString(config.config.column, "column", "Column is required"),
    ),
  extract_table_cell: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      zeroOrPositiveInteger(config.config.row, "row", "Row must be a non-negative integer"),
      requiredActionString(String(config.config.column), "column", "Column is required"),
    ),
  extract_list_attributes: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      requiredActionString(config.config.attribute, "attribute", "Attribute is required"),
    ),
  extract_structured_list: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      !Array.isArray(config.config.mappings) || config.config.mappings.length === 0
        ? { field: "mappings", message: "At least one mapping is required" }
        : null,
    ),
  get_page_title: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  extract_page_links: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  get_meta_content: (config) =>
    firstValidation(
      requiredActionString(config.config.meta_name, "meta_name", "Meta name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  extract_numbers: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", "Source output is required"),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
    ),
  extract_urls: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", "Source output is required"),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
    ),
  extract_emails: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", "Source output is required"),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
    ),
  take_screenshot: (config) =>
    safeArtifactNameValidation(
      config.config.path,
      "path",
      "Screenshot path must be a safe artifact name",
    ),
  write_text_file: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", "Source output is required"),
      requiredActionString(config.config.path, "path", "Text file path is required"),
      safeArtifactNameValidation(
        config.config.path,
        "path",
        "Text file path must be a safe artifact name",
      ),
      requiredActionString(config.config.output_name, "output_name", "Output name is required"),
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
  update_number_variable: (config) => {
    const operation = config.config.operation;
    const needsValue = ["add", "subtract", "multiply", "divide"].includes(operation);
    return firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        operation,
        ["increment", "decrement", "add", "subtract", "multiply", "divide"],
        "operation",
        "Operation must be increment, decrement, add, subtract, multiply, or divide",
      ),
      needsValue
        ? requiredActionString(config.config.value, "value", "Value is required")
        : null,
    );
  },
  set_number_variable: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  generate_random_number: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      requiredActionString(config.config.min, "min", "Minimum value is required"),
      requiredActionString(config.config.max, "max", "Maximum value is required"),
    ),
  parse_text_to_number: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source text is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  math_operation: (config) => {
    const operation = config.config.operation;
    const needsOperand2 = !["abs", "sqrt"].includes(operation);
    return firstValidation(
      requiredActionString(config.config.operand1, "operand1", "First operand is required"),
      validateRequiredEnumValue(
        operation,
        ["add", "subtract", "multiply", "divide", "modulo", "power", "abs", "sqrt", "min", "max"],
        "operation",
        "Operation is invalid",
      ),
      needsOperand2
        ? requiredActionString(config.config.operand2, "operand2", "Second operand is required")
        : null,
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    );
  },
  round_number: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source number is required"),
      validateRequiredEnumValue(
        config.config.mode,
        ["round", "floor", "ceil"],
        "mode",
        "Rounding mode must be round, floor, or ceil",
      ),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  format_number: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source number is required"),
      validateRequiredEnumValue(
        config.config.format,
        ["decimal", "currency", "percent"],
        "format",
        "Format must be decimal, currency, or percent",
      ),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  compare_numbers: (config) =>
    firstValidation(
      requiredActionString(config.config.operand1, "operand1", "First operand is required"),
      validateRequiredEnumValue(
        config.config.operator,
        ["gt", "gte", "lt", "lte", "eq", "neq"],
        "operator",
        "Operator is invalid",
      ),
      requiredActionString(config.config.operand2, "operand2", "Second operand is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_number_range: (config) =>
    firstValidation(
      requiredActionString(config.config.value, "value", "Value to check is required"),
      requiredActionString(config.config.min, "min", "Minimum bound is required"),
      requiredActionString(config.config.max, "max", "Maximum bound is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_number_property: (config) =>
    firstValidation(
      requiredActionString(config.config.value, "value", "Value to check is required"),
      validateRequiredEnumValue(
        config.config.property,
        ["even", "odd", "integer", "positive", "negative"],
        "property",
        "Property is invalid",
      ),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  update_text_variable: (config) => {
    const operation = config.config.operation;
    const needsValue = ["append", "prepend", "replace"].includes(operation);
    const needsSearch = operation === "replace";
    return firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        operation,
        ["append", "prepend", "replace", "uppercase", "lowercase", "trim"],
        "operation",
        "Operation must be append, prepend, replace, uppercase, lowercase, or trim",
      ),
      needsValue
        ? requiredActionString(config.config.value, "value", "Value is required")
        : null,
      needsSearch
        ? requiredActionString(config.config.search_pattern, "search_pattern", "Search pattern is required")
        : null,
    );
  },
  set_text_variable: (config) =>
    requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
  append_text: (config) =>
    requiredActionString(config.config.name, "name", "Variable name is required"),
  prepend_text: (config) =>
    requiredActionString(config.config.name, "name", "Variable name is required"),
  replace_text: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(config.config.search_pattern, "search_pattern", "Search pattern is required"),
    ),
  trim_text: (config) =>
    requiredActionString(config.config.name, "name", "Variable name is required"),
  change_text_case: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        config.config.to_case,
        ["upper", "lower"],
        "to_case",
        "Invalid text case option",
      ),
    ),
  slice_text: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  regex_extract: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.pattern, "pattern", "Regex pattern is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  get_text_length: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_text_empty: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_text_contains: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.substring, "substring", "Substring is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_text_regex_matches: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.pattern, "pattern", "Regex pattern is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  update_flag_variable: (config) => {
    return firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        config.config.operation,
        ["toggle", "set_true", "set_false"],
        "operation",
        "Operation must be toggle, set_true, or set_false",
      ),
    );
  },
  set_boolean_variable: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  generate_random_boolean: (config) =>
    requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
  parse_to_boolean: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  boolean_logical_op: (config) => {
    const operation = config.config.operation;
    const needsOperand2 = ["and", "or", "xor"].includes(operation);
    return firstValidation(
      requiredActionString(config.config.operand1, "operand1", "Operand 1 is required"),
      validateRequiredEnumValue(
        operation,
        ["and", "or", "not", "xor"],
        "operation",
        "Invalid logic operation option",
      ),
      needsOperand2
        ? requiredActionString(config.config.operand2, "operand2", "Operand 2 is required")
        : null,
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    );
  },
  compare_booleans: (config) =>
    firstValidation(
      requiredActionString(config.config.operand1, "operand1", "Operand 1 is required"),
      validateRequiredEnumValue(
        config.config.operator,
        ["eq", "neq"],
        "operator",
        "Operator is invalid",
      ),
      requiredActionString(config.config.operand2, "operand2", "Operand 2 is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_boolean_property: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source is required"),
      validateRequiredEnumValue(
        config.config.property,
        ["is_true", "is_false"],
        "property",
        "Property is invalid",
      ),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  update_list_variable: (config) => {
    const operation = config.config.operation;
    const needsValue = ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(operation);
    const needsValueType = ["push", "unshift", "push_unique", "merge", "merge_unique"].includes(operation);
    const needsIndex = operation === "remove_by_index";
    return firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        operation,
        ["push", "unshift", "push_unique", "pop", "shift", "remove_by_index", "remove_by_value", "merge", "merge_unique"],
        "operation",
        "Operation must be push, unshift, push_unique, pop, shift, remove_by_index, remove_by_value, merge, or merge_unique",
      ),
      needsValue
        ? requiredActionString(config.config.value, "value", "Value is required")
        : null,
      needsValueType
        ? validateRequiredEnumValue(
            config.config.value_type,
            ["text", "json", "number", "boolean"],
            "value_type",
            "Value type must be text, json, number, or boolean",
          )
        : null,
      needsIndex
        ? (config.config.index === null || config.config.index === undefined || String(config.config.index).trim() === ""
            ? validationError("index", "Index is required")
            : null)
        : null,
    );
  },
  create_empty_list: (config) =>
    requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
  create_list_manual: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      validateRequiredEnumValue(
        config.config.value_type,
        ["text", "json", "number", "boolean"],
        "value_type",
        "Value type must be text, json, number, or boolean",
      ),
    ),
  split_text_to_list: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      requiredActionString(config.config.source_text, "source_text", "Source text is required"),
      requiredActionString(config.config.delimiter, "delimiter", "Delimiter is required"),
    ),
  generate_number_range: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      requiredActionString(String(config.config.start ?? ""), "start", "Start value is required"),
      requiredActionString(String(config.config.end ?? ""), "end", "End value is required"),
    ),
  add_to_list: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        config.config.position,
        ["end", "start", "unique_end"],
        "position",
        "Position must be end, start, or unique_end",
      ),
      validateRequiredEnumValue(
        config.config.value_type,
        ["text", "json", "number", "boolean"],
        "value_type",
        "Value type must be text, json, number, or boolean",
      ),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  remove_from_list_by_index: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(String(config.config.index ?? ""), "index", "Index is required"),
    ),
  remove_from_list_by_value: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      validateRequiredEnumValue(
        config.config.value_type,
        ["text", "json", "number", "boolean"],
        "value_type",
        "Value type must be text, json, number, or boolean",
      ),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  merge_lists: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  get_list_item: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      validateRequiredEnumValue(
        config.config.position,
        ["first", "last", "index"],
        "position",
        "Position must be first, last, or index",
      ),
      config.config.position === "index"
        ? requiredActionString(String(config.config.index ?? ""), "index", "Index is required")
        : null,
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  get_list_length: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  slice_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(String(config.config.start ?? ""), "start", "Start index is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  join_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.separator, "separator", "Separator is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  filter_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  map_list_property: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.property_key, "property_key", "Property key is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  sort_reverse_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      validateRequiredEnumValue(
        config.config.action,
        ["sort_asc", "sort_desc", "reverse"],
        "action",
        "Action must be sort_asc, sort_desc, or reverse",
      ),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  execute_list_script: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.script, "script", "Script code is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_list_empty: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_list_contains: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      validateRequiredEnumValue(
        config.config.value_type,
        ["text", "json", "number", "boolean"],
        "value_type",
        "Value type must be text, json, number, or boolean",
      ),
      requiredActionString(config.config.value, "value", "Value to check is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_list_any_match: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_list_all_match: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source list variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  create_empty_object: (config) =>
    requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
  create_object_manual: (config) => {
    const fields = config.config.fields ?? [];
    return firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      fields.some((row) => !row.key.trim())
        ? validationError("fields", "Field key is required")
        : null,
    );
  },
  parse_json_to_object: (config) =>
    firstValidation(
      requiredActionString(config.config.source_text, "source_text", "Source text is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  set_object_property: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(config.config.property_key, "property_key", "Property key is required"),
      validateRequiredEnumValue(
        config.config.value_type,
        ["text", "json", "number", "boolean"],
        "value_type",
        "Value type must be text, json, number, or boolean",
      ),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  remove_object_property: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(config.config.property_key, "property_key", "Property key is required"),
    ),
  merge_objects: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(config.config.value, "value", "Value to merge is required"),
    ),
  rename_object_property: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Variable name is required"),
      requiredActionString(config.config.old_key, "old_key", "Old key is required"),
      requiredActionString(config.config.new_key, "new_key", "New key is required"),
    ),
  get_object_property: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.property_key, "property_key", "Property key is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  get_object_keys: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  get_object_values: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  stringify_object: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  execute_object_script: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.script, "script", "Script code is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_object_key_exists: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.property_key, "property_key", "Property key is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  check_object_empty: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source variable name is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  assert_element: (config) =>
    firstValidation(
      validateElementTargetSource(config.config),
      validateElementActionTiming(config.config),
    ),
  assert_text: (config) =>
    firstValidation(
      validateElementTargetSource(config.config),
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
  quarantined: () => null,
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
  get_current_url: () => null,
  check_conditions: (config) => {
    const { output_name, mode, script, rules_group, evaluation_type } = config.config;
    if (!output_name || !output_name.trim()) {
      return validationError("output_name", "Output variable name is required");
    }
    if (evaluation_type && !["static", "dynamic"].includes(evaluation_type)) {
      return validationError("evaluation_type", "Evaluation type must be static or dynamic");
    }
    if (mode === "script") {
      if (!script || !script.trim()) {
        return validationError("script", "JavaScript script is required in script mode");
      }
    } else if (mode === "visual") {
      if (!rules_group || !rules_group.operator || !["and", "or"].includes(rules_group.operator)) {
        return validationError("rules_group", "Invalid visual rules configuration");
      }
    } else {
      return validationError("mode", "Evaluation mode must be visual or script");
    }
    return null;
  },
  calculate_value: (config) => {
    const { output_name, expression, evaluation_type } = config.config;
    if (!output_name || !output_name.trim()) {
      return validationError("output_name", "Output variable name is required");
    }
    if (evaluation_type && !["static", "dynamic"].includes(evaluation_type)) {
      return validationError("evaluation_type", "Evaluation type must be static or dynamic");
    }
    if (!expression || !expression.trim()) {
      return validationError("expression", "Expression is required");
    }
    return null;
  },
  read_text_file: (config) =>
    firstValidation(
      requiredActionString(config.config.path, "path", "File path is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  parse_csv_excel: (config) =>
    firstValidation(
      requiredActionString(config.config.path, "path", "File path is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  write_csv_excel: (config) =>
    firstValidation(
      requiredActionString(config.config.path, "path", "File path is required"),
      requiredActionString(config.config.source_name, "source_name", "Source variable name is required"),
    ),
  file_operation: (config) => {
    if (!["exists", "delete", "rename", "move"].includes(config.config.operation)) {
      return validationError("operation", "File operation is invalid");
    }
    if (!config.config.path || !config.config.path.trim()) {
      return validationError("path", "File path is required");
    }
    if (["rename", "move"].includes(config.config.operation) && (!config.config.target_path || !config.config.target_path.trim())) {
      return validationError("target_path", "Target path is required");
    }
    return null;
  },
  http_request: (config) =>
    firstValidation(
      requiredActionString(config.config.url, "url", "URL is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  date_time_operation: (config) => {
    if (!["current_timestamp", "format", "add_subtract", "diff"].includes(config.config.operation)) {
      return validationError("operation", "Date-time operation is invalid");
    }
    if (!config.config.output_name || !config.config.output_name.trim()) {
      return validationError("output_name", "Output variable name is required");
    }
    if (config.config.operation === "add_subtract") {
      if (config.config.offset_value == null) {
        return validationError("offset_value", "Offset value is required");
      }
      if (!config.config.offset_unit) {
        return validationError("offset_unit", "Offset unit is required");
      }
    }
    return null;
  },
  crypto_operation: (config) =>
    firstValidation(
      requiredActionString(config.config.value, "value", "Value to hash/decode is required"),
      requiredActionString(config.config.output_name, "output_name", "Output variable name is required"),
    ),
  switch_frame: (config) =>
    requiredActionString(config.config.iframe_xpath, "iframe_xpath", "Iframe XPath is required"),
  switch_to_parent_frame: () => null,
  desktop_launch_app: (config) =>
    requiredActionString(config.config.app_executable_path, "app_executable_path", "Application executable path is required"),
  desktop_click: () => null,
  desktop_type_text: (config) =>
    requiredActionString(config.config.text, "text", "Text to type is required"),
  desktop_press_key: (config) =>
    requiredActionString(config.config.key, "key", "Key to press is required"),
  desktop_hotkey: (config) => {
    if (!Array.isArray(config.config.keys) || config.config.keys.length === 0) {
      return validationError("keys", "At least one key is required for hotkey combination");
    }
    return null;
  },
  desktop_scroll: () => null,
  desktop_screenshot: () => null,
  desktop_wait: () => null,
  desktop_hover: () => null,
  desktop_right_click: () => null,
  desktop_double_click: () => null,
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

function isTemplateVariable(value: unknown): boolean {
  return typeof value === "string" && /^\{\{\s*[^}]+?\s*\}\}$/.test(value.trim());
}

function positiveValue(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value > 0)
    ? null
    : validationError(field, message);
}

function optionalPositive(value: any, field: string, message: string) {
  return value == null || isTemplateVariable(value) ? null : positiveValue(value, field, message);
}

function optionalNonNegative(value: any, field: string, message: string) {
  return value == null || isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0)
    ? null
    : validationError(field, message);
}

function finiteValue(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value))
    ? null
    : validationError(field, message);
}

function percentValue(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)
    ? null
    : validationError(field, message);
}

function zeroOrPositiveInteger(value: any, field: string, message: string) {
  return isTemplateVariable(value) || (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  )
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

function validateElementTargetSource(
  config: unknown,
  options: {
    xpathField?: string;
    targetField?: string;
    refField?: string;
    message?: string;
    refMessage?: string;
  } = {},
) {
  const refField = options.refField ?? "target_ref";
  if (hasConfiguredField(config, refField)) {
    return requiredActionString(
      asRecord(config)[refField] as string | null | undefined,
      refField,
      options.refMessage ?? "Target ref is required",
    );
  }
  return validateElementTarget(config, options);
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

function validateDragTargetPosition(value: unknown) {
  if (value == null) return null;
  const position = asRecord(value);
  const modeValidation = validateRequiredEnumValue(
    position.mode,
    ["center", "percent", "offset"],
    "target_position.mode",
    "Target position mode must be center, percent, or offset",
  );
  if (modeValidation) return modeValidation;

  if (position.mode === "center") return null;

  if (position.mode === "percent") {
    return firstValidation(
      percentValue(
        position.x_percent,
        "target_position.x_percent",
        "Target X percent must be between 0 and 100",
      ),
      percentValue(
        position.y_percent,
        "target_position.y_percent",
        "Target Y percent must be between 0 and 100",
      ),
    );
  }

  return firstValidation(
    finiteValue(
      position.x_px,
      "target_position.x_px",
      "Target X offset must be a finite number",
    ),
    finiteValue(
      position.y_px,
      "target_position.y_px",
      "Target Y offset must be a finite number",
    ),
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
  target_ref?: string | null;
  output_name: string;
  timeout_ms?: number | null;
  separator?: string | null;
  join_list?: boolean | null;
  join_separator?: string | null;
}) {
  return firstValidation(
    validateElementTargetSource(config),
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

function regexPatternValidation(pattern: string, flags: string | null | undefined) {
  const normalizedFlags = flags?.trim() || "g";
  if (!/^[dgimsuvy]*$/.test(normalizedFlags)) {
    return validationError("flags", "Regex flags are invalid");
  }
  try {
    new RegExp(pattern, normalizedFlags);
    return null;
  } catch {
    return validationError("pattern", "Regex pattern is invalid");
  }
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
    case "variable_is_true":
      if (!condition.name.trim()) throw validationError("name", "Condition variable name is required");
      break;
    case "text_visible":
      if (!condition.text.trim()) throw validationError("text", "Condition text is required");
      break;
    case "url_contains":
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "element_visible": {
      const validation = validateElementTargetSource(condition, {
        message: "Condition XPath is required",
      });
      if (validation) throw validation;
      break;
    }
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

function hasElementTargetSourceField(
  config: unknown,
  xpathField = "xpath",
  targetField = "target",
  refField = "target_ref",
): boolean {
  return hasConfiguredField(config, refField) || hasElementTargetField(config, xpathField, targetField);
}

function hasConfiguredField(config: unknown, field: string): boolean {
  const record = asRecord(config);
  return Object.prototype.hasOwnProperty.call(record, field) && record[field] != null;
}

function hasStructuredElementTarget(target: unknown): boolean {
  const locators = asRecord(target).locators;
  return Array.isArray(locators) &&
    locators.some((locator) => {
      const value = asRecord(locator).value;
      return typeof value === "string" && value.trim();
    });
}

function positive(value: any) {
  return (value != null && value > 0) || isTemplateVariable(value);
}

function isActionConfig(value: unknown): value is ActionConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "config" in value,
  );
}

function serializeValidationError(error: unknown): ActionValidationError {
  return error && typeof error === "object" && "message" in error
    ? (error as ActionValidationError)
    : validationError("graph", "Invalid graph");
}
