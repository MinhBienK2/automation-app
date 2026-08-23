import {
  firstValidation,
  requiredActionString,
  optionalPositive,
  zeroOrPositiveInteger,
  validateRequiredEnumValue,
  validateElementTargetSource,
  validateElementActionTiming,
  validateDataCaptureConfig,
} from "../validation.js";
import {
  regexPatternValidation,
  safeArtifactNameValidation,
} from "../validateKit.js";
import {
  outputNameRequired,
  regexPatternRequired,
  sourceOutputRequired,
} from "../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../validation.js";

export type ExtractionValidators = Pick<
  ActionValidatorMap,
  "extract_text" | "extract_attribute" | "extract_input_value" | "extract_table" |
  "extract_list" | "count_elements" | "extract_regex_matches" | "extract_text_content" |
  "extract_inner_html" | "extract_outer_html" | "extract_all_attributes" | "extract_data_attributes" |
  "extract_class_list" | "extract_descendant_attributes" | "extract_select_value" | "extract_select_options" |
  "extract_checkbox_state" | "extract_form_data" | "extract_table_headers" | "extract_dimensions" |
  "extract_visibility" | "extract_element_state" | "check_element_exists" | "extract_computed_style" |
  "extract_table_row" | "extract_table_column" | "extract_table_cell" | "extract_list_attributes" |
  "extract_structured_list" | "get_page_title" | "extract_page_links" | "get_meta_content" |
  "extract_numbers" | "extract_urls" | "extract_emails" | "take_screenshot" |
  "assert_element" | "assert_text" | "get_current_url"
>;

export function createExtractionValidators(): ExtractionValidators {
  return {
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
        requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
        requiredActionString(config.config.pattern, "pattern", regexPatternRequired),
        regexPatternValidation(config.config.pattern, config.config.flags),
        requiredActionString(config.config.output_name, "output_name", outputNameRequired),
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
  };
}
