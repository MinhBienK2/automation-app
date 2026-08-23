import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { parseVariableValue, renderTemplate, writeVariableValue } from "../variables.js";

export function buildVariableData2Executors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
slice_text: async (action) => {
      const { source, start, end, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const startIdx = Number(renderTemplate(String(start ?? 0), runtime.outputs));
      const endIdx = end != null ? Number(renderTemplate(String(end), runtime.outputs)) : undefined;
      const newVal = text.slice(startIdx, endIdx);
      writeVariableValue(runtime.outputs, output_name, newVal);
    },
regex_extract: async (action) => {
      const { source, pattern, group_index, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const regexStr = renderTemplate(pattern ?? "", runtime.outputs);
      const groupIdx = group_index != null ? Number(renderTemplate(String(group_index), runtime.outputs)) : 1;
      try {
        const regex = new RegExp(regexStr);
        const match = text.match(regex);
        if (match) {
          writeVariableValue(runtime.outputs, output_name, match[groupIdx] ?? match[0] ?? "");
        } else {
          writeVariableValue(runtime.outputs, output_name, "");
        }
      } catch {
        writeVariableValue(runtime.outputs, output_name, "");
      }
    },
get_text_length: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      writeVariableValue(runtime.outputs, output_name, text.length);
    },
check_text_empty: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const val = runtime.outputs[source];
      const isEmpty = val === undefined || val === null || String(val).trim() === "";
      writeVariableValue(runtime.outputs, output_name, isEmpty);
    },
check_text_contains: async (action) => {
      const { source, substring, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const search = renderTemplate(substring ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, text.includes(search));
    },
check_text_regex_matches: async (action) => {
      const { source, pattern, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const regexStr = renderTemplate(pattern ?? "", runtime.outputs);
      try {
        const regex = new RegExp(regexStr);
        writeVariableValue(runtime.outputs, output_name, regex.test(text));
      } catch {
        writeVariableValue(runtime.outputs, output_name, false);
      }
    },
update_flag_variable: async (action) => {
      const { name, operation } = action.config;
      if (!name) return;

      const existing = Boolean(runtime.outputs[name]);
      let newVal = existing;

      if (operation === "toggle") {
        newVal = !existing;
      } else if (operation === "set_true") {
        newVal = true;
      } else if (operation === "set_false") {
        newVal = false;
      }

      writeVariableValue(runtime.outputs, name, newVal);
    },
set_boolean_variable: async (action) => {
      const { output_name, value } = action.config;
      if (!output_name) return;
      const parsedVal = parseVariableValue("boolean", value, runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, parsedVal);
    },
generate_random_boolean: async (action) => {
      const { output_name, probability } = action.config;
      if (!output_name) return;
      const probStr = probability != null ? String(probability) : "0.5";
      const probVal = Number(parseVariableValue("number", probStr, runtime.outputs));
      const threshold = Number.isNaN(probVal) ? 0.5 : probVal;
      const rand = deps.random();
      writeVariableValue(runtime.outputs, output_name, rand < threshold);
    },
parse_to_boolean: async (action) => {
      const { source, fallback, output_name } = action.config;
      if (!output_name) return;
      const text = renderTemplate(source, runtime.outputs).trim().toLowerCase();
      let result: boolean;
      if (text === "true" || text === "1" || text === "yes" || text === "on") {
        result = true;
      } else if (text === "false" || text === "0" || text === "no" || text === "off" || text === "") {
        result = false;
      } else {
        const fallbackText = fallback != null ? renderTemplate(fallback, runtime.outputs).trim().toLowerCase() : "false";
        result = (fallbackText === "true" || fallbackText === "1" || fallbackText === "yes" || fallbackText === "on");
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
boolean_logical_op: async (action) => {
      const { operand1, operation, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = parseVariableValue("boolean", operand1, runtime.outputs);
      let result = false;
      if (operation === "not") {
        result = !op1;
      } else {
        if (operand2 == null) throw new Error(`Operand 2 is required for operation: ${operation}`);
        const op2 = parseVariableValue("boolean", operand2, runtime.outputs);
        if (operation === "and") result = op1 && op2;
        else if (operation === "or") result = op1 || op2;
        else if (operation === "xor") result = op1 !== op2;
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
compare_booleans: async (action) => {
      const { operand1, operator, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = parseVariableValue("boolean", operand1, runtime.outputs);
      const op2 = parseVariableValue("boolean", operand2, runtime.outputs);
      const result = operator === "eq" ? op1 === op2 : op1 !== op2;
      writeVariableValue(runtime.outputs, output_name, result);
    },
check_boolean_property: async (action) => {
      const { source, property, output_name } = action.config;
      if (!output_name) return;
      const val = parseVariableValue("boolean", source, runtime.outputs);
      const result = property === "is_true" ? val === true : val === false;
      writeVariableValue(runtime.outputs, output_name, result);
    },
update_list_variable: async (action) => {
      const { name, operation, value, value_type, index } = action.config;
      if (!name) return;

      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];

      if (["push", "unshift", "push_unique"].includes(operation)) {
        const parsedValue = parseVariableValue(
          value_type ?? "text",
          value ?? "",
          runtime.outputs,
        );
        if (operation === "push") {
          array.push(parsedValue);
        } else if (operation === "unshift") {
          array.unshift(parsedValue);
        } else if (operation === "push_unique") {
          const exists = array.some((item) => {
            if (
              typeof item === "object" &&
              item !== null &&
              typeof parsedValue === "object" &&
              parsedValue !== null
            ) {
              return JSON.stringify(item) === JSON.stringify(parsedValue);
            }
            return item === parsedValue;
          });
          if (!exists) {
            array.push(parsedValue);
          }
        }
      } else if (["merge", "merge_unique"].includes(operation)) {
        let valToMerge: unknown;
        const varMatch = value?.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
        if (varMatch) {
          valToMerge = runtime.outputs[varMatch[1]];
        } else if (value !== null && value !== undefined) {
          valToMerge = parseVariableValue(
            value_type ?? "json",
            value,
            runtime.outputs,
          );
        }

        if (valToMerge !== undefined) {
          const itemsToMerge = Array.isArray(valToMerge) ? valToMerge : [valToMerge];
          if (operation === "merge") {
            array.push(...itemsToMerge);
          } else if (operation === "merge_unique") {
            for (const item of itemsToMerge) {
              const exists = array.some((existingItem) => {
                if (
                  typeof existingItem === "object" &&
                  existingItem !== null &&
                  typeof item === "object" &&
                  item !== null
                ) {
                  return JSON.stringify(existingItem) === JSON.stringify(item);
                }
                return existingItem === item;
              });
              if (!exists) {
                array.push(item);
              }
            }
          }
        }
      } else if (operation === "pop") {
        array.pop();
      } else if (operation === "shift") {
        array.shift();
      } else if (operation === "remove_by_index") {
        const idx = Number(renderTemplate(String(index ?? ""), runtime.outputs));
        if (!Number.isNaN(idx)) {
          array.splice(idx, 1);
        }
      } else if (operation === "remove_by_value") {
        const valToRemove = parseVariableValue(
          value_type ?? "text",
          value ?? "",
          runtime.outputs,
        );
        const nextArray = array.filter((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof valToRemove === "object" &&
            valToRemove !== null
          ) {
            return JSON.stringify(item) !== JSON.stringify(valToRemove);
          }
          return item !== valToRemove;
        });
        array.length = 0;
        array.push(...nextArray);
      }

      writeVariableValue(runtime.outputs, name, array);
    },
create_empty_list: async (action) => {
      const { output_name } = action.config;
      if (!output_name) return;
      writeVariableValue(runtime.outputs, output_name, []);
    },
create_list_manual: async (action) => {
      const { output_name, value_type, items } = action.config;
      if (!output_name) return;
      const parsedItems = (items || []).map((item) =>
        parseVariableValue(value_type || "text", item, runtime.outputs),
      );
      writeVariableValue(runtime.outputs, output_name, parsedItems);
    },
  };
}
