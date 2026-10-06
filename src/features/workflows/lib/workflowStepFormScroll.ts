import type { ActionConfig } from "../../../types/workflow";
import type { ActionConfigField } from "./workflowStepFormTypes";

const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;
const originalNumber = globalThis.Number;
function Number(val: unknown): unknown {
  if (typeof val === "string" && val.trim().startsWith("{{") && val.trim().endsWith("}}")) {
    return val.trim();
  }
  return originalNumber(val);
}

export function updateScrollConfigField(
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

