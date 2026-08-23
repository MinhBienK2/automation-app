import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../../runnerActionExecutors.js";
import { isPlainRecord } from "../../../shared/records.js";
import { getPath, setPath, deletePath, hasPath } from "../../objectHelpers.js";
import { parseVariableValue, renderTemplate, writeVariableValue } from "../../variables.js";
import { cleanFlattenedKeys, deepMerge } from "./core.js";

export type ObjectVariablesExecutors = Pick<
  ActionExecutorMap,
  | "create_empty_object" | "create_object_manual" | "parse_json_to_object" | "set_object_property"
  | "remove_object_property" | "merge_objects" | "rename_object_property" | "get_object_property"
  | "get_object_keys" | "get_object_values" | "stringify_object" | "execute_object_script"
  | "check_object_key_exists" | "check_object_empty"
>;

export function createObjectVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): ObjectVariablesExecutors {
  return {
    create_empty_object: async (action) => {
      const { output_name } = action.config;
      if (!output_name) return;
      cleanFlattenedKeys(runtime.outputs, output_name);
      writeVariableValue(runtime.outputs, output_name, {});
    },
    create_object_manual: async (action) => {
      const { output_name, fields } = action.config;
      if (!output_name) return;
      const obj: Record<string, unknown> = {};
      for (const field of fields || []) {
        const parsedVal = parseVariableValue(field.value_type || "text", field.value || "", runtime.outputs);
        obj[field.key] = parsedVal;
      }
      cleanFlattenedKeys(runtime.outputs, output_name);
      writeVariableValue(runtime.outputs, output_name, obj);
    },
    parse_json_to_object: async (action) => {
      const { source_text, output_name } = action.config;
      if (!output_name) return;
      const rendered = renderTemplate(source_text || "{}", runtime.outputs);
      const parsedValue = JSON.parse(rendered);
      if (!isPlainRecord(parsedValue)) {
        throw new Error("Parsed value must be a JSON object");
      }
      cleanFlattenedKeys(runtime.outputs, output_name);
      writeVariableValue(runtime.outputs, output_name, parsedValue);
    },
    set_object_property: async (action) => {
      const { name, property_key, value_type, value } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const obj = isPlainRecord(existing) ? { ...existing } : {};
      const propKey = renderTemplate(property_key || "", runtime.outputs);
      if (propKey) {
        const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
        setPath(obj, propKey, parsedVal);
        cleanFlattenedKeys(runtime.outputs, name);
        writeVariableValue(runtime.outputs, name, obj);
      }
    },
    remove_object_property: async (action) => {
      const { name, property_key } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      if (isPlainRecord(existing)) {
        const obj = { ...existing };
        const propKey = renderTemplate(property_key || "", runtime.outputs);
        if (propKey) {
          deletePath(obj, propKey);
          cleanFlattenedKeys(runtime.outputs, name);
          writeVariableValue(runtime.outputs, name, obj);
        }
      }
    },
    merge_objects: async (action) => {
      const { name, value, deep } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const obj = isPlainRecord(existing) ? { ...existing } : {};
      const rendered = renderTemplate(value ?? "{}", runtime.outputs);
      const parsedValue = JSON.parse(rendered);
      if (!isPlainRecord(parsedValue)) {
        throw new Error("Merged value must be a JSON object");
      }
      const newObj = deep ? deepMerge(obj, parsedValue) : { ...obj, ...parsedValue };
      cleanFlattenedKeys(runtime.outputs, name);
      writeVariableValue(runtime.outputs, name, newObj);
    },
    rename_object_property: async (action) => {
      const { name, old_key, new_key } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      if (isPlainRecord(existing)) {
        const obj = { ...existing };
        const oldKeyResolved = renderTemplate(old_key || "", runtime.outputs);
        const newKeyResolved = renderTemplate(new_key || "", runtime.outputs);
        if (oldKeyResolved && newKeyResolved && oldKeyResolved in obj) {
          obj[newKeyResolved] = obj[oldKeyResolved];
          delete obj[oldKeyResolved];
          cleanFlattenedKeys(runtime.outputs, name);
          writeVariableValue(runtime.outputs, name, obj);
        }
      }
    },
    get_object_property: async (action) => {
      const { source, property_key, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const propKey = renderTemplate(property_key || "", runtime.outputs);
      const val = getPath(existing, propKey);
      writeVariableValue(runtime.outputs, output_name, val);
    },
    get_object_keys: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const keys = isPlainRecord(existing) ? Object.keys(existing) : [];
      writeVariableValue(runtime.outputs, output_name, keys);
    },
    get_object_values: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const values = isPlainRecord(existing) ? Object.values(existing) : [];
      writeVariableValue(runtime.outputs, output_name, values);
    },
    stringify_object: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const stringified = isPlainRecord(existing) ? JSON.stringify(existing) : "{}";
      writeVariableValue(runtime.outputs, output_name, stringified);
    },
    execute_object_script: async (action) => {
      const { source, script, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      if (!isPlainRecord(existing)) {
        throw new Error(`Source variable "${source}" is not an object.`);
      }
      if (!script) throw new Error("Script is required");
      
      const result = await runtime.page.evaluate((args) => {
        if (!args) throw new Error("Arguments are required");
        const { scriptText, obj } = args;
        try {
          const fn = new Function("obj", `return (${scriptText});`);
          return fn(obj);
        } catch (err: any) {
          throw new Error(`Failed to evaluate JS on object: ${err.message}`);
        }
      }, { scriptText: script, obj: existing });
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_object_key_exists: async (action) => {
      const { source, property_key, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const propKey = renderTemplate(property_key || "", runtime.outputs);
      const exists = hasPath(existing, propKey);
      writeVariableValue(runtime.outputs, output_name, exists);
    },
    check_object_empty: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const isEmpty = isPlainRecord(existing) ? Object.keys(existing).length === 0 : true;
      writeVariableValue(runtime.outputs, output_name, isEmpty);
    },
  };
}
