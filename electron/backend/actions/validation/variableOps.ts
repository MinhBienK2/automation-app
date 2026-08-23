import {
  firstValidation,
  requiredActionString,
  validateOptionalEnumValue,
  validateRequiredEnumValue,
  type ActionValidatorMap,
} from "./primitives.js";
import {
  outputVariableNameRequired,
  propertyKeyRequired,
  regexPatternRequired,
  sourceListVariableNameRequired,
  sourceVariableNameRequired,
  valueTypeMustBeVariableValueType,
  variableNameRequired,
} from "../../shared/validationMessages.js";
import { listVariableOperations } from "../../../../src/types/actionEnums.js";
import { validationError } from "../../shared/records.js";

const VARIABLE_VALUE_TYPES = ["text", "json", "number", "boolean"] as const;

export const variableOpValidators = {
  update_number_variable: (config) => {
    const operation = config.config.operation;
    const needsValue = ["add", "subtract", "multiply", "divide"].includes(operation);
    return firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      validateRequiredEnumValue(
        operation,
        ["increment", "decrement", "add", "subtract", "multiply", "divide"],
        "operation",
        "Operation must be increment, decrement, add, subtract, multiply, or divide",
      ),
      needsValue
        ? requiredActionString(config.config.value, "value", "Value is required")
        : null,
    );
  },
  set_number_variable: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  generate_random_number: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      requiredActionString(config.config.min, "min", "Minimum value is required"),
      requiredActionString(config.config.max, "max", "Maximum value is required"),
    ),
  parse_text_to_number: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source text is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  math_operation: (config) => {
    const operation = config.config.operation;
    const needsOperand2 = !["abs", "sqrt"].includes(operation);
    return firstValidation(
      requiredActionString(config.config.operand1, "operand1", "First operand is required"),
      validateRequiredEnumValue(
        operation,
        ["add", "subtract", "multiply", "divide", "modulo", "power", "abs", "sqrt", "min", "max"],
        "operation",
        "Operation is invalid",
      ),
      needsOperand2
        ? requiredActionString(config.config.operand2, "operand2", "Second operand is required")
        : null,
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    );
  },
  round_number: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source number is required"),
      validateRequiredEnumValue(
        config.config.mode,
        ["round", "floor", "ceil"],
        "mode",
        "Rounding mode must be round, floor, or ceil",
      ),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  format_number: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", "Source number is required"),
      validateRequiredEnumValue(
        config.config.format,
        ["decimal", "currency", "percent"],
        "format",
        "Format must be decimal, currency, or percent",
      ),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  compare_numbers: (config) =>
    firstValidation(
      requiredActionString(config.config.operand1, "operand1", "First operand is required"),
      validateRequiredEnumValue(
        config.config.operator,
        ["gt", "gte", "lt", "lte", "eq", "neq"],
        "operator",
        "Operator is invalid",
      ),
      requiredActionString(config.config.operand2, "operand2", "Second operand is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_number_range: (config) =>
    firstValidation(
      requiredActionString(config.config.value, "value", "Value to check is required"),
      requiredActionString(config.config.min, "min", "Minimum bound is required"),
      requiredActionString(config.config.max, "max", "Maximum bound is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_number_property: (config) =>
    firstValidation(
      requiredActionString(config.config.value, "value", "Value to check is required"),
      validateRequiredEnumValue(
        config.config.property,
        ["even", "odd", "integer", "positive", "negative"],
        "property",
        "Property is invalid",
      ),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  update_text_variable: (config) => {
    const operation = config.config.operation;
    const needsValue = ["append", "prepend", "replace"].includes(operation);
    const needsSearch = operation === "replace";
    return firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      validateRequiredEnumValue(
        operation,
        ["append", "prepend", "replace", "uppercase", "lowercase", "trim"],
        "operation",
        "Operation must be append, prepend, replace, uppercase, lowercase, or trim",
      ),
      needsValue
        ? requiredActionString(config.config.value, "value", "Value is required")
        : null,
      needsSearch
        ? requiredActionString(config.config.search_pattern, "search_pattern", "Search pattern is required")
        : null,
    );
  },
  set_text_variable: (config) =>
    requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
  append_text: (config) =>
    requiredActionString(config.config.name, "name", variableNameRequired),
  prepend_text: (config) =>
    requiredActionString(config.config.name, "name", variableNameRequired),
  replace_text: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      requiredActionString(config.config.search_pattern, "search_pattern", "Search pattern is required"),
    ),
  trim_text: (config) =>
    requiredActionString(config.config.name, "name", variableNameRequired),
  change_text_case: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      validateRequiredEnumValue(
        config.config.to_case,
        ["upper", "lower"],
        "to_case",
        "Invalid text case option",
      ),
    ),
  slice_text: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  regex_extract: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceVariableNameRequired),
      requiredActionString(config.config.pattern, "pattern", regexPatternRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  get_text_length: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_text_empty: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_text_contains: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceVariableNameRequired),
      requiredActionString(config.config.substring, "substring", "Substring is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_text_regex_matches: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceVariableNameRequired),
      requiredActionString(config.config.pattern, "pattern", regexPatternRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  update_list_variable: (config) => {
    const operation = config.config.operation;
    const needsValue = ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(operation);
    const needsValueType = ["push", "unshift", "push_unique", "merge", "merge_unique"].includes(operation);
    const needsIndex = operation === "remove_by_index";
    return firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      validateRequiredEnumValue(
        operation,
        listVariableOperations,
        "operation",
        `Operation must be ${listVariableOperations.slice(0, -1).join(", ")}, or ${listVariableOperations.at(-1)}`,
      ),
      needsValue
        ? requiredActionString(config.config.value, "value", "Value is required")
        : null,
      needsValueType
        ? validateRequiredEnumValue(
            config.config.value_type,
            VARIABLE_VALUE_TYPES,
            "value_type",
            valueTypeMustBeVariableValueType,
          )
        : null,
      needsIndex
        ? (config.config.index === null || config.config.index === undefined || String(config.config.index).trim() === ""
            ? validationError("index", "Index is required")
            : null)
        : null,
    );
  },
  create_empty_list: (config) =>
    requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
  create_list_manual: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      validateRequiredEnumValue(
        config.config.value_type,
        VARIABLE_VALUE_TYPES,
        "value_type",
        valueTypeMustBeVariableValueType,
      ),
    ),
  split_text_to_list: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      requiredActionString(config.config.source_text, "source_text", "Source text is required"),
      requiredActionString(config.config.delimiter, "delimiter", "Delimiter is required"),
    ),
  generate_number_range: (config) =>
    firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      requiredActionString(String(config.config.start ?? ""), "start", "Start value is required"),
      requiredActionString(String(config.config.end ?? ""), "end", "End value is required"),
    ),
  add_to_list: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      validateRequiredEnumValue(
        config.config.position,
        ["end", "start", "unique_end"],
        "position",
        "Position must be end, start, or unique_end",
      ),
      validateRequiredEnumValue(
        config.config.value_type,
        VARIABLE_VALUE_TYPES,
        "value_type",
        valueTypeMustBeVariableValueType,
      ),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  remove_from_list_by_index: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      requiredActionString(String(config.config.index ?? ""), "index", "Index is required"),
    ),
  remove_from_list_by_value: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      validateRequiredEnumValue(
        config.config.value_type,
        VARIABLE_VALUE_TYPES,
        "value_type",
        valueTypeMustBeVariableValueType,
      ),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  merge_lists: (config) =>
    firstValidation(
      requiredActionString(config.config.name, "name", variableNameRequired),
      requiredActionString(config.config.value, "value", "Value is required"),
    ),
  get_list_item: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      validateRequiredEnumValue(
        config.config.position,
        ["first", "last", "index"],
        "position",
        "Position must be first, last, or index",
      ),
      config.config.position === "index"
        ? requiredActionString(String(config.config.index ?? ""), "index", "Index is required")
        : null,
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  get_list_length: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  slice_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(String(config.config.start ?? ""), "start", "Start index is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  join_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.separator, "separator", "Separator is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  filter_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  map_list_property: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.property_key, "property_key", propertyKeyRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  sort_reverse_list: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      validateRequiredEnumValue(
        config.config.action,
        ["sort_asc", "sort_desc", "reverse"],
        "action",
        "Action must be sort_asc, sort_desc, or reverse",
      ),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  execute_list_script: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.script, "script", "Script code is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_list_empty: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_list_contains: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      validateRequiredEnumValue(
        config.config.value_type,
        VARIABLE_VALUE_TYPES,
        "value_type",
        valueTypeMustBeVariableValueType,
      ),
      requiredActionString(config.config.value, "value", "Value to check is required"),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_list_any_match: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  check_list_all_match: (config) =>
    firstValidation(
      requiredActionString(config.config.source, "source", sourceListVariableNameRequired),
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
    ),
  create_empty_object: (config) =>
    requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
  create_object_manual: (config) => {
    const fields = config.config.fields ?? [];
    return firstValidation(
      requiredActionString(config.config.output_name, "output_name", outputVariableNameRequired),
      fields.some((row: { key: { trim: () => string } }) => !row.key.trim())
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
        VARIABLE_VALUE_TYPES,
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
} satisfies Partial<ActionValidatorMap>;

export { validateOptionalEnumValue };
