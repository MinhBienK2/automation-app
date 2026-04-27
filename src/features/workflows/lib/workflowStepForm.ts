import type { ActionConfig } from "../../../types/workflow";

export type ActionConfigField =
  | "direction"
  | "pixels"
  | "seconds"
  | "text"
  | "url"
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
      return {
        type: "scroll",
        config:
          field === "direction"
            ? { ...config.config, direction: value as "up" | "down" }
            : { ...config.config, pixels: Number(value) },
      };
  }
}
