import type { ActionConfig } from "../../../types/workflow";

export type ActionConfigField =
  | "behavior"
  | "block"
  | "button"
  | "click_count"
  | "direction"
  | "iframe_xpath"
  | "inline"
  | "max_attempts"
  | "mode"
  | "offset_x"
  | "offset_y"
  | "pixels"
  | "position"
  | "post_click_wait_ms"
  | "retry_interval_ms"
  | "scroll_into_view"
  | "seconds"
  | "text"
  | "timeout_ms"
  | "url"
  | "wait_ms"
  | "wait_until"
  | "xpath";

export function updateActionConfigField(
  config: ActionConfig,
  field: ActionConfigField,
  value: string,
): ActionConfig {
  switch (config.type) {
    case "open_url":
      return { type: "open_url", config: { url: value } };
    case "sleep":
      return { type: "sleep", config: { seconds: Number(value) } };
    case "type_text":
      return {
        type: "type_text",
        config: { ...config.config, [field]: value },
      };
    case "click":
      return updateClickConfigField(config, field, value);
    case "scroll":
      return updateScrollConfigField(config, field, value);
  }
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
