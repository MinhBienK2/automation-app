import type { ActionConfig } from "../../../types/workflow";

export type ActionConfigField =
  | "behavior"
  | "block"
  | "direction"
  | "iframe_xpath"
  | "inline"
  | "max_attempts"
  | "mode"
  | "pixels"
  | "seconds"
  | "text"
  | "url"
  | "wait_ms"
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
      return { type: "click", config: { xpath: value } };
    case "scroll":
      return updateScrollConfigField(config, field, value);
  }
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
