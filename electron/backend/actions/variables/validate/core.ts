import { validationError } from "../../../shared/records.js";
import {
  firstValidation,
  requiredActionString,
} from "../../validation.js";
import {
  outputVariableNameRequired,
  sourceOutputRequired,
  variableNameRequired,
} from "../../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../../validation.js";

export type CoreVariablesValidators = Pick<
  ActionValidatorMap,
  "set_variable" | "set_json_variables" | "transform_variable" | "check_conditions" |
  "calculate_value"
>;

export function createCoreVariablesValidators(): CoreVariablesValidators {
  return {
    set_variable: (config) => {
      const variables = config.config.variables ?? [];
      if (variables.length > 0) {
        return variables.some((row) => !row.name.trim())
          ? validationError("variables", variableNameRequired)
          : null;
      }
      return config.config.name?.trim()
        ? null
        : validationError("name", variableNameRequired);
    },
    set_json_variables: (config) => {
      try {
        const parsed = JSON.parse(config.config.json);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? null
          : validationError("json", "JSON variables must be an object");
      } catch {
        return validationError("json", "JSON variables must be valid JSON");
      }
    },
    transform_variable: (config) =>
      firstValidation(
        requiredActionString(config.config.source_name, "source_name", sourceOutputRequired),
        requiredActionString(config.config.target_name, "target_name", "Target output is required"),
      ),
    check_conditions: (config) => {
      const { output_name, mode, script, rules_group, evaluation_type } = config.config;
      if (!output_name || !output_name.trim()) {
        return validationError("output_name", outputVariableNameRequired);
      }
      if (evaluation_type && !["static", "dynamic"].includes(evaluation_type)) {
        return validationError("evaluation_type", "Evaluation type must be static or dynamic");
      }
      if (mode === "script") {
        if (!script || !script.trim()) {
          return validationError("script", "JavaScript script is required in script mode");
        }
      } else if (mode === "visual") {
        if (!rules_group || !rules_group.operator || !["and", "or"].includes(rules_group.operator)) {
          return validationError("rules_group", "Invalid visual rules configuration");
        }
      } else {
        return validationError("mode", "Evaluation mode must be visual or script");
      }
      return null;
    },
    calculate_value: (config) => {
      const { output_name, expression, evaluation_type } = config.config;
      if (!output_name || !output_name.trim()) {
        return validationError("output_name", outputVariableNameRequired);
      }
      if (evaluation_type && !["static", "dynamic"].includes(evaluation_type)) {
        return validationError("evaluation_type", "Evaluation type must be static or dynamic");
      }
      if (!expression || !expression.trim()) {
        return validationError("expression", "Expression is required");
      }
      return null;
    },
  };
}
