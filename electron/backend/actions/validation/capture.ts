import {
  validateRequiredEnumValue,
  firstValidation,
  optionalPositive,
  regexPatternValidation,
  requiredActionString,
  safeArtifactNameValidation,
  validateDataCaptureConfig,
  validateElementActionTiming,
  validateElementTargetSource,
  zeroOrPositiveInteger,
  type ActionValidator,
  type ActionValidatorMap,
} from "./primitives.js";
import {
  outputNameRequired,
  outputVariableNameRequired,
  regexPatternRequired,
  sourceOutputRequired,
  sourceVariableNameRequired,
} from "../../shared/validationMessages.js";
import { validationError } from "../../shared/records.js";
/**
 * Capture actions whose config is exactly the shared data-capture contract.
 * One table instead of twenty-five identical one-line validators.
 */
const dataCaptureOnlyTypes = [
  "extract_text",
  "extract_input_value",
  "extract_table",
  "extract_list",
  "count_elements",
  "extract_text_content",
  "extract_inner_html",
  "extract_outer_html",
  "extract_all_attributes",
  "extract_data_attributes",
  "extract_class_list",
  "extract_descendant_attributes",
  "extract_select_value",
  "extract_select_options",
  "extract_checkbox_state",
  "extract_form_data",
  "extract_table_headers",
  "extract_dimensions",
  "extract_visibility",
  "extract_element_state",
  "check_element_exists",
] as const;

function dataCaptureOnly(config: { config: Parameters<typeof validateDataCaptureConfig>[0] }) {
  return validateDataCaptureConfig(config.config);
}

const dataCaptureEntries = Object.fromEntries(
  dataCaptureOnlyTypes.map((type) => [type, dataCaptureOnly]),
) as Record<string, ActionValidator>;

export const captureValidators = {
  ...dataCaptureEntries,

  extract_attribute: (config) =>
    firstValidation(
      validateDataCaptureConfig(config.config),
      requiredActionString(config.config.attribute, "attribute", "Attribute is required"),
    ),
  extract_regex_matches: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
      requiredActionString(config.config.pattern, "pattern", regexPatternRequired),
      regexPatternValidation(config.config.pattern, config.config.flags),
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
    ),
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
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  extract_page_links: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  get_meta_content: (config) =>
    firstValidation(
      requiredActionString(config.config.meta_name, "meta_name", "Meta name is required"),
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  extract_numbers: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
    ),
  extract_urls: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
    ),
  extract_emails: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
    ),
  take_screenshot: (config) =>
    safeArtifactNameValidation(
      config.config.path,
      "path",
      "Screenshot path must be a safe artifact name",
    ),
  write_text_file: (config) =>
    firstValidation(
      requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
      requiredActionString(config.config.path, "path", "Text file path is required"),
      safeArtifactNameValidation(
        config.config.path,
        "path",
        "Text file path must be a safe artifact name",
      ),
      requiredActionString(config.config.output_name, "output_name", outputNameRequired),
    ),
  wait_for_download: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", "Download output name is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
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
  get_current_url: () => null,
  read_text_file: (config) =>
    firstValidation(
      requiredActionString(config.config.path, "path", "File path is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  parse_csv_excel: (config) =>
    firstValidation(
      requiredActionString(config.config.path, "path", "File path is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  write_csv_excel: (config) =>
    firstValidation(
      requiredActionString(config.config.path, "path", "File path is required"),
      requiredActionString(config.config.source_name, "source_name", sourceVariableNameRequired),
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
} satisfies Partial<ActionValidatorMap>;
