import { validationError } from "../../shared/records.js";
import {
  firstValidation,
  requiredActionString,
  optionalPositive,
} from "../validation.js";
import {
  safeArtifactNameValidation,
} from "../validateKit.js";
import {
  outputNameRequired,
  outputVariableNameRequired,
  sourceOutputRequired,
  sourceVariableNameRequired,
} from "../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../validation.js";

export type FilesValidators = Pick<
  ActionValidatorMap,
  "write_text_file" | "read_text_file" | "parse_csv_excel" | "write_csv_excel" |
  "file_operation" | "http_request" | "date_time_operation" | "crypto_operation"
>;

export function createFilesValidators(): FilesValidators {
  return {
    write_text_file: (config) =>
      firstValidation(
        requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
        requiredActionString(config.config.path, "path", "Text file path is required"),
        safeArtifactNameValidation(
          config.config.path,
          "path",
          "Text file path must be a safe artifact name",
        ),
        requiredActionString(config.config.output_name, "output_name", outputNameRequired),
      ),
    read_text_file: (config) =>
      firstValidation(
        requiredActionString(config.config.path, "path", "File path is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    parse_csv_excel: (config) =>
      firstValidation(
        requiredActionString(config.config.path, "path", "File path is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    write_csv_excel: (config) =>
      firstValidation(
        requiredActionString(config.config.path, "path", "File path is required"),
        requiredActionString(config.config.source_name, "source_name", sourceVariableNameRequired),
      ),
    file_operation: (config) => {
      if (!["exists", "delete", "rename", "move"].includes(config.config.operation)) {
        return validationError("operation", "File operation is invalid");
      }
      if (!config.config.path || !config.config.path.trim()) {
        return validationError("path", "File path is required");
      }
      if (["rename", "move"].includes(config.config.operation) && (!config.config.target_path || !config.config.target_path.trim())) {
        return validationError("target_path", "Target path is required");
      }
      return null;
    },
    http_request: (config) =>
      firstValidation(
        requiredActionString(config.config.url, "url", "URL is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        optionalPositive(config.config.timeout_ms, "timeout_ms", "Timeout must be greater than 0"),
      ),
    date_time_operation: (config) => {
      if (!["current_timestamp", "format", "add_subtract", "diff"].includes(config.config.operation)) {
        return validationError("operation", "Date-time operation is invalid");
      }
      if (!config.config.output_name || !config.config.output_name.trim()) {
        return validationError("output_name", outputVariableNameRequired);
      }
      if (config.config.operation === "add_subtract") {
        if (config.config.offset_value == null) {
          return validationError("offset_value", "Offset value is required");
        }
        if (!config.config.offset_unit) {
          return validationError("offset_unit", "Offset unit is required");
        }
      }
      return null;
    },
    crypto_operation: (config) =>
      firstValidation(
        requiredActionString(config.config.value, "value", "Value to hash/decode is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
  };
}
