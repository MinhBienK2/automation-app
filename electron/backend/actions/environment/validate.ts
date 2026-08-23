import {
  firstValidation,
  requiredActionString,
  positiveValue,
  optionalPositive,
  optionalNonNegative,
  validateStringList,
  validateHeaderPairs,
} from "../validation.js";
import {
  latitudeValidation,
  longitudeValidation,
  statusValidation,
} from "../validateKit.js";

import type { ActionValidatorMap } from "../validation.js";

export type EnvironmentValidators = Pick<
  ActionValidatorMap,
  "set_cookie" | "clear_cookies" | "set_viewport" | "set_geolocation" |
  "set_extra_headers" | "grant_permission" | "execute_js" | "wait_for_request" |
  "wait_for_response" | "block_request" | "mock_response" | "set_local_storage" |
  "set_session_storage"
>;

export function createEnvironmentValidators(): EnvironmentValidators {
  return {
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
    set_extra_headers: (config) => validateHeaderPairs(config.config.headers),
    grant_permission: (config) =>
      validateStringList(config.config.permissions, "permissions", "Permissions are required"),
    execute_js: (config) =>
      firstValidation(
        requiredActionString(config.config.script, "script", "Script is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    wait_for_request: (config) =>
      firstValidation(
        requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    wait_for_response: (config) =>
      firstValidation(
        requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
        statusValidation(config.config.status, "status", "Response status must be between 100 and 599"),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    block_request: (config) =>
      validateStringList(config.config.url_patterns, "url_patterns", "URL pattern is required"),
    mock_response: (config) =>
      firstValidation(
        requiredActionString(config.config.url_contains, "url_contains", "URL contains is required"),
        statusValidation(config.config.status, "status", "Mock response status must be between 100 and 599"),
      ),
    set_local_storage: (config) =>
      requiredActionString(config.config.key, "key", "Storage key is required"),
    set_session_storage: (config) =>
      requiredActionString(config.config.key, "key", "Storage key is required"),
  };
}
