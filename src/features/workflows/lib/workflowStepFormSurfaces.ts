import type { ActionConfig } from "../../../types/workflow";
import { updateScrollConfigField } from "./workflowStepFormScroll";
export { updateScrollConfigField };
import type { ActionConfigField } from "./workflowStepForm";

const originalNumber = globalThis.Number;
function Number(val: unknown): unknown {
  if (typeof val === "string" && val.trim().startsWith("{{") && val.trim().endsWith("}}")) {
    return val.trim();
  }
  return originalNumber(val);
}

export function updateSetViewportConfigField(
  config: Extract<ActionConfig, { type: "set_viewport" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "width" || field === "height") {
    return { type: "set_viewport", config: { ...config.config, [field]: Number(value) } };
  }

  return config;
}

export function updateSetGeolocationConfigField(
  config: Extract<ActionConfig, { type: "set_geolocation" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "latitude" || field === "longitude" || field === "accuracy") {
    return { type: "set_geolocation", config: { ...config.config, [field]: Number(value) } };
  }

  return config;
}

export function parseHeaderPairs(value: string) {
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

export function parseLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function updateNavigateConfigField(
  config: Extract<ActionConfig, { type: "navigate" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "timeout_ms") {
    return { type: "navigate", config: { ...config.config, [field]: Number(value) } };
  }

  return { type: "navigate", config: { ...config.config, [field]: value } };
}

export function updateWaitConfigField(
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

export function updateRandomWaitConfigField(
  config: Extract<ActionConfig, { type: "random_wait" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (field === "min_ms" || field === "max_ms") {
    return { type: "random_wait", config: { ...config.config, [field]: Number(value) } };
  }

  return config;
}

export function updateInputTextConfigField(
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

export function updateClickConfigField(
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

export function updateOpenLinkInNewTabConfigField(
  config: Extract<ActionConfig, { type: "open_link_in_new_tab" }>,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  if (
    field === "timeout_ms"
  ) {
    return {
      type: "open_link_in_new_tab",
      config: { ...config.config, [field]: Number(value) },
    };
  }

  if (field === "iframe_xpath") {
    return {
      type: "open_link_in_new_tab",
      config: { ...config.config, [field]: value || null },
    };
  }

  if (field === "target_ref") {
    return {
      type: "open_link_in_new_tab",
      config: { ...config.config, target_ref: value || null },
    };
  }

  return {
    type: "open_link_in_new_tab",
    config: { ...config.config, [field]: value },
  };
}

export function updateFindElementConfigField(
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

export function updateSelectOptionConfigField(
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

export function updateElementConfigField(
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

export function updatePhaseOneElementConfigField(
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

export function updateDragAndDropConfigField(
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

export function updateTypeSequenceConfigField(
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

export function updateUploadFileConfigField(
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

export function updateSubmitFormConfigField(
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

export function updateSelectCustomOptionConfigField(
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

export function updateSetContenteditableConfigField(
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

