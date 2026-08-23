import { validationError } from "../../../shared/records.js";
import {
  firstValidation,
  requiredActionString,
  validateRequiredEnumValue,
} from "../../validation.js";
import {
  outputVariableNameRequired,
  propertyKeyRequired,
  sourceVariableNameRequired,
  valueTypeMustBeVariableValueType,
  variableNameRequired,
} from "../../../shared/validationMessages.js";

import type { ActionValidatorMap } from "../../validation.js";

export type ObjectVariablesValidators = Pick<
  ActionValidatorMap,
  "create_empty_object" | "create_object_manual" | "parse_json_to_object" | "set_object_property" |
  "remove_object_property" | "merge_objects" | "rename_object_property" | "get_object_property" |
  "get_object_keys" | "get_object_values" | "stringify_object" | "execute_object_script" |
  "check_object_key_exists" | "check_object_empty"
>;

export function createObjectVariablesValidators(): ObjectVariablesValidators {
  return {
    create_empty_object: (config) =>
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    create_object_manual: (config) => {
      const fields = config.config.fields ?? [];
      return firstValidation(
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
        fields.some((row) => !row.key.trim())
          ? validationError("fields", "Field key is required")
          : null,
      );
    },
    parse_json_to_object: (config) =>
      firstValidation(
        requiredActionString(config.config.source_text, "source_text", "Source text is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    set_object_property: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(config.config.property_key, "property_key", propertyKeyRequired),
        validateRequiredEnumValue(
          config.config.value_type,
          ["text", "json", "number", "boolean"],
          "value_type",
          valueTypeMustBeVariableValueType,
        ),
        requiredActionString(config.config.value, "value", "Value is required"),
      ),
    remove_object_property: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(config.config.property_key, "property_key", propertyKeyRequired),
      ),
    merge_objects: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(config.config.value, "value", "Value to merge is required"),
      ),
    rename_object_property: (config) =>
      firstValidation(
        requiredActionString(config.config.name, "name", variableNameRequired),
        requiredActionString(config.config.old_key, "old_key", "Old key is required"),
        requiredActionString(config.config.new_key, "new_key", "New key is required"),
      ),
    get_object_property: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.property_key, "property_key", propertyKeyRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    get_object_keys: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    get_object_values: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    stringify_object: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    execute_object_script: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.script, "script", "Script code is required"),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_object_key_exists: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.property_key, "property_key", propertyKeyRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
    check_object_empty: (config) =>
      firstValidation(
        requiredActionString(config.config.source, "source", sourceVariableNameRequired),
        requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      ),
  };
}
