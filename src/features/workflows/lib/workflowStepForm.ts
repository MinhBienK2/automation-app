import type { ActionConfig } from "../../../types/workflow";

export type ActionConfigField =
  | "attribute"
  | "array_variable"
  | "body"
  | "clear_before_input"
  | "condition"
  | "content_type"
  | "delay_ms"
  | "dedupe"
  | "direction"
  | "domain"
  | "duration_ms"
  | "files"
  | "flags"
  | "iframe_xpath"
  | "include_trailing_newline"
  | "index"
  | "items"
  | "item_name"
  | "join_list"
  | "join_separator"
  | "json"
  | "key"
  | "keys"
  | "match_mode"
  | "match_by"
  | "max_ms"
  | "max_attempts"
  | "min_ms"
  | "mode"
  | "name"
  | "option_text"
  | "origin"
  | "operation"
  | "output_name"
  | "append"
  | "path"
  | "pattern"
  | "pixels"
  | "prompt_text"
  | "reason"
  | "script"
  | "scroll_style"
  | "seconds"
  | "separator"
  | "source_name"
  | "status"
  | "source_xpath"
  | "state"
  | "target_ref"
  | "rank"
  | "in_viewport"
  | "target_xpath"
  | "text"
  | "timeout_ms"
  | "url"
  | "url_contains"
  | "url_patterns"
  | "value"
  | "value_type"
  | "wait_until"
  | "xpath"
  | "trigger_xpath"
  | "trigger_ref"
  | "times"
  | "full_page"
  | "accuracy"
  | "headers"
  | "height"
  | "latitude"
  | "longitude"
  | "permissions"
  | "width"
  | "xpaths"
  | "search_pattern"
  | "property_key"
  | "property_value"
  | "property_value_type"
  | "encoding"
  | "has_headers"
  | "delimiter"
  | "target_path"
  | "method"
  | "format_pattern"
  | "offset_value"
  | "offset_unit"
  | "deep"
  | "old_key"
  | "new_key"
  | "fields"
  | "source_text"
  | "source";

const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;

const originalNumber = globalThis.Number;
function Number(val: any): any {
  if (typeof val === "string" && val.trim().startsWith("{{") && val.trim().endsWith("}}")) {
    return val.trim();
  }
  return originalNumber(val);
}

export function updateActionConfigField(
  config: ActionConfig,
  field: ActionConfigField,
  rawValue: string | number | null,
): ActionConfig {
  const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
  if (field === "target_ref" && actionSupportsTargetRef(config.type)) {
    return {
      ...config,
      config: { ...config.config, target_ref: value || null },
    } as ActionConfig;
  }

  switch (config.type) {
    case "navigate":
      return updateNavigateConfigField(config, field, value);
    case "wait":
      return updateWaitConfigField(config, field, value);
    case "random_wait":
      return updateRandomWaitConfigField(config, field, value);
    case "input_text":
      return updateInputTextConfigField(config, field, value);
    case "clear_input":
      return updateElementConfigField(config, field, value);
    case "click":
      return updateClickConfigField(config, field, value);
    case "find_element":
      return updateFindElementConfigField(config, field, value);
    case "scroll":
      return updateScrollConfigField(config, field, value);
    case "select_option":
      return updateSelectOptionConfigField(config, field, value);
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
    case "count_elements":
      return updateDataCaptureConfigField(config, field, value);
    case "extract_regex_matches":
      return updateExtractRegexMatchesConfigField(config, field, value);
    case "extract_attribute":
      return updateExtractAttributeConfigField(config, field, value);
    case "take_screenshot":
      return updateTakeScreenshotConfigField(config, field, value);
    case "write_text_file":
      return updateWriteTextFileConfigField(config, field, value);
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
    case "accept_dialog":
      return { type: "accept_dialog", config: { prompt_text: value || null } };
    case "dismiss_dialog":
      return config;
    case "wait_for_download":
      return updateWaitForDownloadConfigField(config, field, value);
    case "set_variable":
      return { type: "set_variable", config: { ...config.config, [field]: value } };
    case "update_number_variable":
      return { type: "update_number_variable", config: { ...config.config, [field]: value } };
    case "update_text_variable":
      return { type: "update_text_variable", config: { ...config.config, [field]: value || null } };
    case "update_flag_variable":
      return { type: "update_flag_variable", config: { ...config.config, [field]: value } };
    case "update_list_variable":
      if (field === "index") {
        return { type: "update_list_variable", config: { ...config.config, index: value ? Number(value) : null } };
      }
      return { type: "update_list_variable", config: { ...config.config, [field]: value || null } };
    case "create_empty_object":
    case "create_object_manual":
    case "parse_json_to_object":
    case "set_object_property":
    case "remove_object_property":
    case "rename_object_property":
    case "get_object_property":
    case "get_object_keys":
    case "get_object_values":
    case "stringify_object":
    case "execute_object_script":
    case "check_object_key_exists":
    case "check_object_empty":
      return { type: config.type, config: { ...config.config, [field]: value } } as ActionConfig;
    case "merge_objects":
      if (field === "deep") {
        return { type: "merge_objects", config: { ...config.config, deep: value === "true" } };
      }
      return { type: "merge_objects", config: { ...config.config, [field]: value } };
    case "create_empty_list":
    case "create_list_manual":
    case "split_text_to_list":
    case "generate_number_range":
    case "add_to_list":
    case "remove_from_list_by_index":
    case "remove_from_list_by_value":
    case "merge_lists":
    case "get_list_item":
    case "get_list_length":
    case "slice_list":
    case "join_list":
    case "filter_list":
    case "map_list_property":
    case "sort_reverse_list":
    case "execute_list_script":
    case "check_list_empty":
    case "check_list_contains":
    case "check_list_any_match":
    case "check_list_all_match":
      return { type: config.type, config: { ...config.config, [field]: value } } as ActionConfig;
    case "set_json_variables":
      return { type: "set_json_variables", config: { json: value } };
    case "assert_element":
      return updateAssertElementConfigField(config, field, value);
    case "assert_text":
      return updateAssertTextConfigField(config, field, value);
    case "graph_noop":
    case "if_condition":
    case "router_condition":
    case "random_choice":
      return config;
    case "repeat_times":
      return { type: "repeat_times", config: { ...config.config, times: Number(value) } };
    case "repeat_for_each":
      if (field === "array_variable") {
        return {
          type: "repeat_for_each",
          config: { ...config.config, array_variable: value || null },
        };
      }
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
    case "set_cookie":
      if (field === "domain" || field === "path") {
        return { type: "set_cookie", config: { ...config.config, [field]: value || null } };
      }
      return { type: "set_cookie", config: { ...config.config, [field]: value } };
    case "clear_cookies":
      return { type: "clear_cookies", config: { domain: value || null } };
    case "set_viewport":
      return updateSetViewportConfigField(config, field, value);
    case "set_geolocation":
      return updateSetGeolocationConfigField(config, field, value);
    case "set_extra_headers":
      return { type: "set_extra_headers", config: { headers: parseHeaderPairs(value) } };
    case "grant_permission":
      if (field === "origin") {
        return { type: "grant_permission", config: { ...config.config, origin: value || null } };
      }
      return {
        type: "grant_permission",
        config: { ...config.config, permissions: parseLineList(value) },
      };
    case "execute_js":
      if (field === "timeout_ms") {
        return { type: "execute_js", config: { ...config.config, timeout_ms: Number(value) } };
      }
      if (field === "output_name") {
        return { type: "execute_js", config: { ...config.config, output_name: value || null } };
      }
      return { type: "execute_js", config: { ...config.config, script: value } };
    case "wait_for_request":
      if (field === "timeout_ms") {
        return {
          type: "wait_for_request",
          config: { ...config.config, timeout_ms: Number(value) },
        };
      }
      return { type: "wait_for_request", config: { ...config.config, url_contains: value } };
    case "wait_for_response":
      if (field === "timeout_ms" || field === "status") {
        return {
          type: "wait_for_response",
          config: { ...config.config, [field]: value ? Number(value) : null },
        };
      }
      return { type: "wait_for_response", config: { ...config.config, url_contains: value } };
    case "block_request":
      return { type: "block_request", config: { url_patterns: parseLineList(value) } };
    case "mock_response":
      if (field === "status") {
        return { type: "mock_response", config: { ...config.config, status: Number(value) } };
      }
      if (field === "content_type") {
        return { type: "mock_response", config: { ...config.config, content_type: value || null } };
      }
      return { type: "mock_response", config: { ...config.config, [field]: value } };
    case "set_local_storage":
      return { type: "set_local_storage", config: { ...config.config, [field]: value } };
    case "set_session_storage":
      return { type: "set_session_storage", config: { ...config.config, [field]: value } };
    case "read_text_file":
      if (field === "encoding") {
        return { type: "read_text_file", config: { ...config.config, encoding: value as any || null } };
      }
      return { type: "read_text_file", config: { ...config.config, [field]: value } };
    case "parse_csv_excel":
      if (field === "has_headers") {
        return { type: "parse_csv_excel", config: { ...config.config, has_headers: value === "true" } };
      }
      if (field === "delimiter") {
        return { type: "parse_csv_excel", config: { ...config.config, delimiter: value || null } };
      }
      return { type: "parse_csv_excel", config: { ...config.config, [field]: value } };
    case "write_csv_excel":
      if (field === "has_headers") {
        return { type: "write_csv_excel", config: { ...config.config, has_headers: value === "true" } };
      }
      return { type: "write_csv_excel", config: { ...config.config, [field]: value } };
    case "file_operation":
      if (field === "target_path" || field === "output_name") {
        return { type: "file_operation", config: { ...config.config, [field]: value || null } };
      }
      return { type: "file_operation", config: { ...config.config, [field]: value } };
    case "http_request":
      if (field === "timeout_ms") {
        return { type: "http_request", config: { ...config.config, timeout_ms: value ? Number(value) : null } };
      }
      if (field === "headers") {
        return { type: "http_request", config: { ...config.config, headers: parseHeaderPairs(value) } };
      }
      if (field === "body" || field === "content_type") {
        return { type: "http_request", config: { ...config.config, [field]: value || null } };
      }
      return { type: "http_request", config: { ...config.config, [field]: value } };
    case "date_time_operation":
      if (field === "offset_value") {
        return { type: "date_time_operation", config: { ...config.config, offset_value: value ? Number(value) : null } };
      }
      if (field === "offset_unit" || field === "format_pattern" || field === "value") {
        return { type: "date_time_operation", config: { ...config.config, [field]: value || null } };
      }
      return { type: "date_time_operation", config: { ...config.config, [field]: value } };
    case "crypto_operation":
      return { type: "crypto_operation", config: { ...config.config, [field]: value } };
    case "switch_frame":
      return { type: "switch_frame", config: { iframe_xpath: value } };
    case "switch_to_parent_frame":
      return config;
    case "switch_condition":
    case "while_loop":
    case "repeat_until":
    case "try_catch":
    case "fallback_block":
    case "break_loop":
    case "continue_loop":
    case "transform_variable":
    case "assert_output":
    case "domain_allowlist":
    case "check_conditions":
    case "calculate_value":
    case "get_current_url":
    case "quarantined":
      return config;
  }
}

function actionSupportsTargetRef(actionType: ActionConfig["type"]): boolean {
  return (
    [
      "wait",
      "input_text",
      "clear_input",
      "click",
      "scroll",
      "select_option",
      "hover",
      "double_click",
      "right_click",
      "focus_element",
      "blur_element",
      "type_sequence",
      "paste_clipboard",
      "check",
      "uncheck",
      "toggle_checkbox",
      "select_radio",
      "upload_file",
      "submit_form",
      "set_contenteditable",
      "extract_text",
      "extract_attribute",
      "extract_input_value",
      "extract_table",
      "extract_list",
      "count_elements",
      "assert_element",
      "assert_text",
    ] as Array<ActionConfig["type"]>
  ).includes(actionType);
}

function updateSetViewportConfigField(
  config: Extract<ActionConfig, { type: "set_viewport" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "width" || field === "height") {
    return { type: "set_viewport", config: { ...config.config, [field]: Number(value) } };
  }

  return config;
}

function updateSetGeolocationConfigField(
  config: Extract<ActionConfig, { type: "set_geolocation" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "latitude" || field === "longitude" || field === "accuracy") {
    return { type: "set_geolocation", config: { ...config.config, [field]: Number(value) } };
  }

  return config;
}

function parseHeaderPairs(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return null;
      }

      const name = line.slice(0, separatorIndex).trim();
      const headerValue = line.slice(separatorIndex + 1).trim();
      if (!name || !headerValue) {
        return null;
      }

      return { name, value: headerValue };
    })
    .filter((header): header is { name: string; value: string } => Boolean(header));
}

function parseLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function updateRandomWaitConfigField(
  config: Extract<ActionConfig, { type: "random_wait" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "min_ms" || field === "max_ms") {
    return { type: "random_wait", config: { ...config.config, [field]: Number(value) } };
  }

  return config;
}

function updateInputTextConfigField(
  config: Extract<ActionConfig, { type: "input_text" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
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
    field === "timeout_ms"
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

  if (field === "target_ref") {
    return {
      type: "click",
      config: { ...config.config, target_ref: value || null },
    };
  }

  return {
    type: "click",
    config: { ...config.config, [field]: value },
  };
}

function updateFindElementConfigField(
  config: Extract<ActionConfig, { type: "find_element" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "find_element", config: { ...config.config, timeout_ms: Number(value) } };
  }
  if (field === "iframe_xpath") {
    return { type: "find_element", config: { ...config.config, iframe_xpath: value || null } };
  }
  if (field === "output_name") {
    return { type: "find_element", config: { ...config.config, output_name: value } };
  }
  if (field === "rank") {
    return {
      type: "find_element",
      config: {
        ...config.config,
        rank: value as Extract<ActionConfig, { type: "find_element" }>["config"]["rank"],
      },
    };
  }
  if (field === "in_viewport") {
    return {
      type: "find_element",
      config: {
        ...config.config,
        filter: { ...(config.config.filter ?? {}), in_viewport: value === "true" },
      },
    };
  }
  return { type: "find_element", config: { ...config.config, [field]: value } };
}

function updateScrollConfigField(
  config: Extract<ActionConfig, { type: "scroll" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "mode") {
    const mode =
      value === "into_view" || value === "until_element_visible" ? value : "page";
    if (mode === "page") {
      return {
        type: "scroll",
        config: {
          ...config.config,
          mode,
          direction: config.config.direction ?? "down",
          pixels: config.config.pixels ?? 500,
        },
      };
    }
    return {
      type: "scroll",
      config: {
        ...withoutPageOnlyScrollFields(config.config),
        mode,
        target: config.config.target ?? null,
        timeout_ms: config.config.timeout_ms ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS,
      },
    };
  }

  if (field === "pixels") {
    return {
      type: "scroll",
      config: { ...config.config, [field]: Number(value) },
    };
  }

  if (field === "timeout_ms") {
    return {
      type: "scroll",
      config: { ...config.config, timeout_ms: Number(value) },
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

function withoutPageOnlyScrollFields(
  config: Extract<ActionConfig, { type: "scroll" }>["config"],
) {
  const { scroll_style: _scrollStyle, ...targetConfig } = config;
  return targetConfig;
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
  config: Extract<ActionConfig, { type: "clear_input" | "hover" }>,
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

  if (field === "trigger_ref") {
    return {
      type: "select_custom_option",
      config: { ...config.config, trigger_ref: value || null },
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

function updateExtractRegexMatchesConfigField(
  config: Extract<ActionConfig, { type: "extract_regex_matches" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "append" || field === "dedupe") {
    return { type: "extract_regex_matches", config: { ...config.config, [field]: value === "true" } };
  }

  return { type: "extract_regex_matches", config: { ...config.config, [field]: value } };
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

function updateWriteTextFileConfigField(
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
