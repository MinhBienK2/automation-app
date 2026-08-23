import {
  firstValidation,
  latitudeValidation,
  longitudeValidation,
  optionalNonNegative,
  optionalPositive,
  positive,
  positiveValue,
  requiredActionString,
  validateElementTargetSource,
  validateStringList,
  type ActionValidatorMap,
} from "./primitives.js";
import { validationError } from "../../shared/records.js";
import { waitConditions } from "../schemas/wait.js";

export const browserContextValidators = {
  wait: (config) => {
    const condition = config.config.condition;
    if (!waitConditions.includes(condition)) {
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
  accept_dialog: () => null,
  dismiss_dialog: () => null,
  set_cookie: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", "Cookie name is required"),
      requiredActionString(config.config.value, "value", "Cookie value is required"),
    ),
  clear_cookies: () => null,
  set_viewport: (config) =>
    firstValidation(
      positiveValue(config.config.width, "width", "Viewport width must be greater than 0"),
      positiveValue(config.config.height, "height", "Viewport height must be greater than 0"),
    ),
  set_geolocation: (config) =>
    firstValidation(
      latitudeValidation(config.config.latitude),
      longitudeValidation(config.config.longitude),
      optionalNonNegative(config.config.accuracy, "accuracy", "Accuracy must be zero or greater"),
    ),
  grant_permission: (config) =>
    validateStringList(config.config.permissions, "permissions", "Permissions are required"),
  set_local_storage: (config) =>
    requiredActionString(config.config.key, "key", "Storage key is required"),
  set_session_storage: (config) =>
    requiredActionString(config.config.key, "key", "Storage key is required"),
} satisfies Partial<ActionValidatorMap>;
