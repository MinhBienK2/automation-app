import {
  firstValidation,
  optionalPositive,
  requiredActionString,
  statusValidation,
  validateHeaderPairs,
  validateStringList,
  type ActionValidatorMap,
} from "./primitives.js";
import { outputVariableNameRequired } from "../../shared/validationMessages.js";

export const networkValidators = {
  set_extra_headers: (config) => validateHeaderPairs(config.config.headers),
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
  http_request: (config) =>
    firstValidation(
      requiredActionString(config.config.url, "url", "URL is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
  execute_js: (config) =>
    firstValidation(
      requiredActionString(config.config.script, "script", "Script is required"),
      optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
    ),
} satisfies Partial<ActionValidatorMap>;
