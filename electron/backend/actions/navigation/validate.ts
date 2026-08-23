import { validationError } from "../../shared/records.js";
import {
  firstValidation,
  requiredActionString,
  positive,
  optionalPositive,
  zeroOrPositiveInteger,
  validateStringList,
  validateElementTargetSource,
  validateElementActionTiming,
} from "../validation.js";

import type { ActionValidatorMap } from "../validation.js";

export type NavigationValidators = Pick<
  ActionValidatorMap,
  "navigate" | "wait" | "random_wait" | "go_back" |
  "go_forward" | "reload" | "open_new_tab" | "open_link_in_new_tab" |
  "switch_tab" | "close_tab" | "accept_dialog" | "dismiss_dialog" |
  "wait_for_download" | "domain_allowlist"
>;

export function createNavigationValidators(): NavigationValidators {
  return {
    navigate: (config) =>
      firstValidation(
        requiredActionString(config.config.url, "url", "URL is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    wait: (config) => {
      const condition = config.config.condition;
      const validConditions = [
        "duration",
        "element_visible",
        "element_hidden",
        "element_attached",
        "element_detached",
        "text_visible",
        "url_contains",
        "page_load",
        "element_enabled",
        "element_disabled",
      ];
      if (!validConditions.includes(condition)) {
        return validationError("condition", "Wait condition is invalid");
      }
      if (config.config.condition === "duration" && !positive(config.config.duration_ms)) {
        return validationError("duration_ms", "Wait duration must be greater than 0");
      }
      if (config.config.condition.startsWith("element_")) {
        const validation = validateElementTargetSource(config.config);
        if (validation) return validation;
      }
      if (config.config.condition === "text_visible") {
        const validation = requiredActionString(config.config.text, "text", "Text is required");
        if (validation) return validation;
      }
      if (config.config.condition === "url_contains") {
        const validation = requiredActionString(config.config.url, "url", "URL contains is required");
        if (validation) return validation;
      }
      return optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0");
    },
    random_wait: (config) =>
      !positive(config.config.min_ms) ||
      !positive(config.config.max_ms) ||
      config.config.max_ms < config.config.min_ms
        ? validationError("max_ms", "Random wait range is invalid")
        : null,
    go_back: () => null,
    go_forward: () => null,
    reload: () => null,
    open_new_tab: () => null,
    open_link_in_new_tab: (config) =>
      firstValidation(
        validateElementTargetSource(config.config),
        validateElementActionTiming(config.config),
      ),
    switch_tab: (config) =>
      zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater"),
    close_tab: (config) =>
      config.config.index == null
        ? null
        : zeroOrPositiveInteger(config.config.index, "index", "Tab index must be zero or greater"),
    accept_dialog: () => null,
    dismiss_dialog: () => null,
    wait_for_download: (config) =>
      firstValidation(
        requiredActionString(config.config.output_name, "output_name", "Download output name is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    domain_allowlist: (config) =>
      validateStringList(config.config.domains, "domains", "Allowed domains are required"),
  };
}
