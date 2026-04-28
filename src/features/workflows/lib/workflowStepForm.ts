import type { ActionConfig } from "../../../types/workflow";

export type ActionConfigField =
  | "attribute"
  | "behavior"
  | "block"
  | "button"
  | "clear_before_input"
  | "click_count"
  | "condition"
  | "delay_ms"
  | "direction"
  | "duration_ms"
  | "files"
  | "iframe_xpath"
  | "index"
  | "inline"
  | "items"
  | "item_name"
  | "key"
  | "keys"
  | "match_mode"
  | "match_by"
  | "max_attempts"
  | "method"
  | "mode"
  | "name"
  | "offset_x"
  | "offset_y"
  | "option_text"
  | "output_name"
  | "path"
  | "pixels"
  | "position"
  | "post_click_wait_ms"
  | "prompt_text"
  | "reason"
  | "retry_interval_ms"
  | "scroll_into_view"
  | "seconds"
  | "status"
  | "source_xpath"
  | "state"
  | "target_xpath"
  | "text"
  | "timeout_ms"
  | "typing_mode"
  | "url"
  | "value"
  | "wait_ms"
  | "wait_until"
  | "xpath"
  | "trigger_xpath"
  | "times"
  | "full_page";

export function updateActionConfigField(
  config: ActionConfig,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  switch (config.type) {
    case "navigate":
      return updateNavigateConfigField(config, field, value);
    case "open_url":
      return { type: "open_url", config: { url: value } };
    case "sleep":
      return { type: "sleep", config: { seconds: Number(value) } };
    case "wait":
      return updateWaitConfigField(config, field, value);
    case "input_text":
      return updateInputTextConfigField(config, field, value);
    case "type_text":
      return {
        type: "type_text",
        config: { ...config.config, [field]: value },
      };
    case "clear_input":
      return updateElementConfigField(config, field, value);
    case "click":
      return updateClickConfigField(config, field, value);
    case "scroll":
      return updateScrollConfigField(config, field, value);
    case "select_option":
      return updateSelectOptionConfigField(config, field, value);
    case "set_checkbox":
      return updateElementConfigField(config, field, value);
    case "press_key":
      return { type: "press_key", config: { key: value } };
    case "hotkey":
      return {
        type: "hotkey",
        config: {
          keys: value
            .split("+")
            .map((key) => key.trim())
            .filter(Boolean),
        },
      };
    case "hover":
      return updateElementConfigField(config, field, value);
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
      return updatePhaseOneElementConfigField(config, field, value);
    case "drag_and_drop":
      return updateDragAndDropConfigField(config, field, value);
    case "type_sequence":
      return updateTypeSequenceConfigField(config, field, value);
    case "set_clipboard":
      return { type: "set_clipboard", config: { text: value } };
    case "upload_file":
      return updateUploadFileConfigField(config, field, value);
    case "submit_form":
      return updateSubmitFormConfigField(config, field, value);
    case "select_custom_option":
      return updateSelectCustomOptionConfigField(config, field, value);
    case "set_contenteditable":
      return updateSetContenteditableConfigField(config, field, value);
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return updateDataCaptureConfigField(config, field, value);
    case "extract_attribute":
      return updateExtractAttributeConfigField(config, field, value);
    case "take_screenshot":
      return updateTakeScreenshotConfigField(config, field, value);
    case "go_back":
    case "go_forward":
    case "reload":
      return config;
    case "open_new_tab":
      return { type: "open_new_tab", config: { url: value || null } };
    case "switch_tab":
      return { type: "switch_tab", config: { index: Number(value) } };
    case "close_tab":
      return { type: "close_tab", config: { index: value ? Number(value) : null } };
    case "switch_frame":
      return { type: "switch_frame", config: { xpath: value || null } };
    case "accept_dialog":
      return { type: "accept_dialog", config: { prompt_text: value || null } };
    case "dismiss_dialog":
      return config;
    case "set_download_directory":
      return { type: "set_download_directory", config: { path: value } };
    case "wait_for_download":
      return updateWaitForDownloadConfigField(config, field, value);
    case "set_variable":
      return { type: "set_variable", config: { ...config.config, [field]: value } };
    case "assert_element":
      return updateAssertElementConfigField(config, field, value);
    case "assert_text":
      return updateAssertTextConfigField(config, field, value);
    case "if_condition":
      return config;
    case "repeat_times":
      return { type: "repeat_times", config: { ...config.config, times: Number(value) } };
    case "repeat_for_each":
      if (field === "items") {
        return {
          type: "repeat_for_each",
          config: {
            ...config.config,
            items: value
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean),
          },
        };
      }
      return { type: "repeat_for_each", config: { ...config.config, [field]: value } };
    case "retry_block":
      if (field === "max_attempts" || field === "delay_ms") {
        return { type: "retry_block", config: { ...config.config, [field]: Number(value) } };
      }
      return config;
    case "stop_workflow":
      if (field === "reason") {
        return { type: "stop_workflow", config: { ...config.config, reason: value || null } };
      }
      return { type: "stop_workflow", config: { ...config.config, [field]: value } };
  }
}

function updateNavigateConfigField(
  config: Extract<ActionConfig, { type: "navigate" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "navigate", config: { ...config.config, [field]: Number(value) } };
  }

  return { type: "navigate", config: { ...config.config, [field]: value } };
}

function updateWaitConfigField(
  config: Extract<ActionConfig, { type: "wait" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "duration_ms" || field === "timeout_ms") {
    return { type: "wait", config: { ...config.config, [field]: Number(value) } };
  }

  if (field === "xpath" || field === "text" || field === "url") {
    return { type: "wait", config: { ...config.config, [field]: value || null } };
  }

  return { type: "wait", config: { ...config.config, [field]: value } };
}

function updateInputTextConfigField(
  config: Extract<ActionConfig, { type: "input_text" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "delay_ms" || field === "timeout_ms") {
    return {
      type: "input_text",
      config: { ...config.config, [field]: Number(value) },
    };
  }

  if (field === "clear_before_input") {
    return {
      type: "input_text",
      config: { ...config.config, clear_before_input: value === "true" },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "input_text",
      config: { ...config.config, iframe_xpath: value || null },
    };
  }

  return { type: "input_text", config: { ...config.config, [field]: value } };
}

function updateClickConfigField(
  config: Extract<ActionConfig, { type: "click" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (
    field === "click_count" ||
    field === "offset_x" ||
    field === "offset_y" ||
    field === "timeout_ms" ||
    field === "retry_interval_ms" ||
    field === "post_click_wait_ms"
  ) {
    return {
      type: "click",
      config: { ...config.config, [field]: Number(value) },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "click",
      config: { ...config.config, [field]: value || null },
    };
  }

  if (field === "scroll_into_view") {
    return {
      type: "click",
      config: { ...config.config, scroll_into_view: value === "true" },
    };
  }

  return {
    type: "click",
    config: { ...config.config, [field]: value },
  };
}

function updateScrollConfigField(
  config: Extract<ActionConfig, { type: "scroll" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "pixels" || field === "max_attempts" || field === "wait_ms") {
    return {
      type: "scroll",
      config: { ...config.config, [field]: Number(value) },
    };
  }

  if (field === "xpath" || field === "iframe_xpath") {
    return {
      type: "scroll",
      config: { ...config.config, [field]: value || null },
    };
  }

  return {
    type: "scroll",
    config: { ...config.config, [field]: value },
  };
}

function updateSelectOptionConfigField(
  config: Extract<ActionConfig, { type: "select_option" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return {
      type: "select_option",
      config: { ...config.config, timeout_ms: Number(value) },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "select_option",
      config: { ...config.config, iframe_xpath: value || null },
    };
  }

  return {
    type: "select_option",
    config: { ...config.config, [field]: value },
  };
}

function updateElementConfigField(
  config: Extract<ActionConfig, { type: "clear_input" | "set_checkbox" | "hover" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  switch (config.type) {
    case "clear_input":
      if (field === "timeout_ms") {
        return { type: "clear_input", config: { ...config.config, timeout_ms: Number(value) } };
      }
      if (field === "iframe_xpath") {
        return { type: "clear_input", config: { ...config.config, iframe_xpath: value || null } };
      }
      return { type: "clear_input", config: { ...config.config, [field]: value } };
    case "set_checkbox":
      if (field === "timeout_ms") {
        return { type: "set_checkbox", config: { ...config.config, timeout_ms: Number(value) } };
      }
      if (field === "iframe_xpath") {
        return { type: "set_checkbox", config: { ...config.config, iframe_xpath: value || null } };
      }
      return { type: "set_checkbox", config: { ...config.config, [field]: value } };
    case "hover":
      if (field === "timeout_ms") {
        return { type: "hover", config: { ...config.config, timeout_ms: Number(value) } };
      }
      if (field === "iframe_xpath") {
        return { type: "hover", config: { ...config.config, iframe_xpath: value || null } };
      }
      return { type: "hover", config: { ...config.config, [field]: value } };
  }
}

function updatePhaseOneElementConfigField(
  config: Extract<
    ActionConfig,
    {
      type:
        | "double_click"
        | "right_click"
        | "focus_element"
        | "blur_element"
        | "paste_clipboard"
        | "check"
        | "uncheck"
        | "toggle_checkbox"
        | "select_radio";
    }
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

  return { type: config.type, config: { ...config.config, [field]: value } };
}

function updateDragAndDropConfigField(
  config: Extract<ActionConfig, { type: "drag_and_drop" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "drag_and_drop", config: { ...config.config, timeout_ms: Number(value) } };
  }

  if (field === "iframe_xpath") {
    return {
      type: "drag_and_drop",
      config: { ...config.config, iframe_xpath: value || null },
    };
  }

  return { type: "drag_and_drop", config: { ...config.config, [field]: value } };
}

function updateTypeSequenceConfigField(
  config: Extract<ActionConfig, { type: "type_sequence" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "delay_ms" || field === "timeout_ms") {
    return { type: "type_sequence", config: { ...config.config, [field]: Number(value) } };
  }

  if (field === "iframe_xpath") {
    return { type: "type_sequence", config: { ...config.config, iframe_xpath: value || null } };
  }

  return { type: "type_sequence", config: { ...config.config, [field]: value } };
}

function updateUploadFileConfigField(
  config: Extract<ActionConfig, { type: "upload_file" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "files") {
    return {
      type: "upload_file",
      config: {
        ...config.config,
        files: value
          .split(/\r?\n/)
          .map((file) => file.trim())
          .filter(Boolean),
      },
    };
  }

  if (field === "timeout_ms") {
    return { type: "upload_file", config: { ...config.config, timeout_ms: Number(value) } };
  }

  if (field === "iframe_xpath") {
    return { type: "upload_file", config: { ...config.config, iframe_xpath: value || null } };
  }

  return { type: "upload_file", config: { ...config.config, [field]: value } };
}

function updateSubmitFormConfigField(
  config: Extract<ActionConfig, { type: "submit_form" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "submit_form", config: { ...config.config, timeout_ms: Number(value) } };
  }

  if (field === "xpath" || field === "iframe_xpath") {
    return { type: "submit_form", config: { ...config.config, [field]: value || null } };
  }

  return { type: "submit_form", config: { ...config.config, [field]: value } };
}

function updateSelectCustomOptionConfigField(
  config: Extract<ActionConfig, { type: "select_custom_option" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return {
      type: "select_custom_option",
      config: { ...config.config, timeout_ms: Number(value) },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "select_custom_option",
      config: { ...config.config, iframe_xpath: value || null },
    };
  }

  return { type: "select_custom_option", config: { ...config.config, [field]: value } };
}

function updateSetContenteditableConfigField(
  config: Extract<ActionConfig, { type: "set_contenteditable" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return {
      type: "set_contenteditable",
      config: { ...config.config, timeout_ms: Number(value) },
    };
  }

  if (field === "clear_before_input") {
    return {
      type: "set_contenteditable",
      config: { ...config.config, clear_before_input: value === "true" },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "set_contenteditable",
      config: { ...config.config, iframe_xpath: value || null },
    };
  }

  return { type: "set_contenteditable", config: { ...config.config, [field]: value } };
}

function updateDataCaptureConfigField(
  config: Extract<
    ActionConfig,
    { type: "extract_text" | "extract_input_value" | "extract_table" | "extract_list" }
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

  return { type: config.type, config: { ...config.config, [field]: value } };
}

function updateExtractAttributeConfigField(
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

function updateTakeScreenshotConfigField(
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

function updateWaitForDownloadConfigField(
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

function updateAssertElementConfigField(
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

function updateAssertTextConfigField(
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
