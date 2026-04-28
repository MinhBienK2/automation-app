import type { ActionConfig } from "../../../types/workflow";

export type ActionConfigField =
  | "behavior"
  | "block"
  | "button"
  | "clear_before_input"
  | "click_count"
  | "condition"
  | "delay_ms"
  | "direction"
  | "duration_ms"
  | "iframe_xpath"
  | "inline"
  | "key"
  | "keys"
  | "match_by"
  | "max_attempts"
  | "method"
  | "mode"
  | "offset_x"
  | "offset_y"
  | "pixels"
  | "position"
  | "post_click_wait_ms"
  | "retry_interval_ms"
  | "scroll_into_view"
  | "seconds"
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
  | "xpath";

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
