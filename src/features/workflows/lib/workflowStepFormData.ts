import type { ActionConfig } from "../../../types/workflow";
import type { ActionConfigField } from "./workflowStepForm";

const originalNumber = globalThis.Number;
function Number(val: unknown): unknown {
  if (typeof val === "string" && val.trim().startsWith("{{") && val.trim().endsWith("}}")) {
    return val.trim();
  }
  return originalNumber(val);
}

export function updateDataCaptureConfigField(
  config: Extract<
    ActionConfig,
    { type: "extract_text" | "extract_input_value" | "extract_table" | "extract_list" | "count_elements" }
  >,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: config.type, config: { ...config.config, timeout_ms: Number(value) } };
  }

  if (field === "iframe_xpath") {
    return { type: config.type, config: { ...config.config, iframe_xpath: value || null } };
  }

  if (field === "join_list") {
    return { type: config.type, config: { ...config.config, join_list: value === "true" } };
  }

  return { type: config.type, config: { ...config.config, [field]: value } };
}

export function updateExtractRegexMatchesConfigField(
  config: Extract<ActionConfig, { type: "extract_regex_matches" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "append" || field === "dedupe") {
    return { type: "extract_regex_matches", config: { ...config.config, [field]: value === "true" } };
  }

  return { type: "extract_regex_matches", config: { ...config.config, [field]: value } };
}

export function updateExtractAttributeConfigField(
  config: Extract<ActionConfig, { type: "extract_attribute" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return {
      type: "extract_attribute",
      config: { ...config.config, timeout_ms: Number(value) },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "extract_attribute",
      config: { ...config.config, iframe_xpath: value || null },
    };
  }

  return { type: "extract_attribute", config: { ...config.config, [field]: value } };
}

export function updateTakeScreenshotConfigField(
  config: Extract<ActionConfig, { type: "take_screenshot" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "full_page") {
    return {
      type: "take_screenshot",
      config: { ...config.config, full_page: value === "true" },
    };
  }

  if (field === "output_name") {
    return {
      type: "take_screenshot",
      config: { ...config.config, output_name: value || null },
    };
  }

  return { type: "take_screenshot", config: { ...config.config, [field]: value } };
}

export function updateWriteTextFileConfigField(
  config: Extract<ActionConfig, { type: "write_text_file" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "include_trailing_newline") {
    return {
      type: "write_text_file",
      config: { ...config.config, include_trailing_newline: value === "true" },
    };
  }

  return { type: "write_text_file", config: { ...config.config, [field]: value } };
}

export function updateWaitForDownloadConfigField(
  config: Extract<ActionConfig, { type: "wait_for_download" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return {
      type: "wait_for_download",
      config: { ...config.config, timeout_ms: Number(value) },
    };
  }

  return { type: "wait_for_download", config: { ...config.config, [field]: value } };
}

export function updateAssertElementConfigField(
  config: Extract<ActionConfig, { type: "assert_element" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "assert_element", config: { ...config.config, timeout_ms: Number(value) } };
  }

  if (field === "iframe_xpath") {
    return { type: "assert_element", config: { ...config.config, iframe_xpath: value || null } };
  }

  return { type: "assert_element", config: { ...config.config, [field]: value } };
}

export function updateAssertTextConfigField(
  config: Extract<ActionConfig, { type: "assert_text" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "assert_text", config: { ...config.config, timeout_ms: Number(value) } };
  }

  if (field === "xpath" || field === "iframe_xpath") {
    return { type: "assert_text", config: { ...config.config, [field]: value || null } };
  }

  return { type: "assert_text", config: { ...config.config, [field]: value } };
}

