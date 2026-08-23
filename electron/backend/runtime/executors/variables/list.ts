import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../../runnerActionExecutors.js";
import { parseVariableValue, renderTemplate, writeVariableValue } from "../../variables.js";
import { getMockValueForVariable } from "./core.js";
import { evaluateRuleGroup } from "../support.js";

export type ListVariablesExecutors = Pick<
  ActionExecutorMap,
  | "update_list_variable" | "create_empty_list" | "create_list_manual" | "split_text_to_list"
  | "generate_number_range" | "add_to_list" | "remove_from_list_by_index" | "remove_from_list_by_value"
  | "merge_lists" | "get_list_item" | "get_list_length" | "slice_list"
  | "join_list" | "filter_list" | "map_list_property" | "sort_reverse_list"
  | "execute_list_script" | "check_list_empty" | "check_list_contains" | "check_list_any_match"
  | "check_list_all_match"
>;

export function createListVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): ListVariablesExecutors {
  return {
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
    split_text_to_list: async (action) => {
      const { output_name, source_text, delimiter } = action.config;
      if (!output_name) return;
      const text = renderTemplate(source_text || "", runtime.outputs);
      const parsedDelimiter = renderTemplate(delimiter ?? ",", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, text.split(parsedDelimiter));
    },
    generate_number_range: async (action) => {
      const { output_name, start, end, step } = action.config;
      if (!output_name) return;
      const evaluatedStart = Number(renderTemplate(String(start ?? 0), runtime.outputs));
      const evaluatedEnd = Number(renderTemplate(String(end ?? 0), runtime.outputs));
      const evaluatedStep = Number(renderTemplate(String(step ?? 1), runtime.outputs)) || 1;
      
      const list: number[] = [];
      if (evaluatedStep > 0) {
        for (let i = evaluatedStart; i <= evaluatedEnd; i += evaluatedStep) {
          list.push(i);
        }
      } else if (evaluatedStep < 0) {
        for (let i = evaluatedStart; i >= evaluatedEnd; i += evaluatedStep) {
          list.push(i);
        }
      }
      writeVariableValue(runtime.outputs, output_name, list);
    },
    add_to_list: async (action) => {
      const { name, position, value_type, value } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
      
      if (position === "start") {
        array.unshift(parsedVal);
      } else if (position === "unique_end") {
        const exists = array.some((item) => {
          if (typeof item === "object" && item !== null && typeof parsedVal === "object" && parsedVal !== null) {
            return JSON.stringify(item) === JSON.stringify(parsedVal);
          }
          return item === parsedVal;
        });
        if (!exists) {
          array.push(parsedVal);
        }
      } else {
        array.push(parsedVal);
      }
      writeVariableValue(runtime.outputs, name, array);
    },
    remove_from_list_by_index: async (action) => {
      const { name, index } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      const idx = Number(renderTemplate(String(index ?? ""), runtime.outputs));
      if (!Number.isNaN(idx)) {
        array.splice(idx, 1);
      }
      writeVariableValue(runtime.outputs, name, array);
    },
    remove_from_list_by_value: async (action) => {
      const { name, value_type, value } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
      const nextArray = array.filter((item) => {
        if (typeof item === "object" && item !== null && typeof parsedVal === "object" && parsedVal !== null) {
          return JSON.stringify(item) !== JSON.stringify(parsedVal);
        }
        return item !== parsedVal;
      });
      writeVariableValue(runtime.outputs, name, nextArray);
    },
    merge_lists: async (action) => {
      const { name, value, unique } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      
      let valToMerge: unknown;
      const varMatch = value?.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
      if (varMatch) {
        valToMerge = runtime.outputs[varMatch[1]];
      } else if (value !== null && value !== undefined) {
        valToMerge = parseVariableValue("json", value, runtime.outputs);
      }
      
      if (valToMerge !== undefined) {
        const itemsToMerge = Array.isArray(valToMerge) ? valToMerge : [valToMerge];
        if (unique) {
          for (const item of itemsToMerge) {
            const exists = array.some((existingItem) => {
              if (typeof existingItem === "object" && existingItem !== null && typeof item === "object" && item !== null) {
                return JSON.stringify(existingItem) === JSON.stringify(item);
              }
              return existingItem === item;
            });
            if (!exists) {
              array.push(item);
            }
          }
        } else {
          array.push(...itemsToMerge);
        }
      }
      writeVariableValue(runtime.outputs, name, array);
    },
    get_list_item: async (action) => {
      const { source, position, index, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array) || array.length === 0) {
        if (runtime.currentStepId?.startsWith("__prelude:loop_item:")) {
          const mockVal = getMockValueForVariable(output_name);
          writeVariableValue(runtime.outputs, output_name, mockVal);
          return;
        }
        writeVariableValue(runtime.outputs, output_name, undefined);
        return;
      }
      
      let result: unknown;
      if (position === "first") {
        result = array[0];
      } else if (position === "last") {
        result = array[array.length - 1];
      } else if (position === "index") {
        const idx = Number(renderTemplate(String(index ?? ""), runtime.outputs));
        result = array[idx];
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    get_list_length: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      writeVariableValue(runtime.outputs, output_name, Array.isArray(array) ? array.length : 0);
    },
    slice_list: async (action) => {
      const { source, start, end, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      const evaluatedStart = Number(renderTemplate(String(start ?? 0), runtime.outputs)) || 0;
      const evaluatedEnd = end !== undefined && end !== null && end !== "" 
        ? Number(renderTemplate(String(end), runtime.outputs))
        : undefined;
      writeVariableValue(runtime.outputs, output_name, array.slice(evaluatedStart, evaluatedEnd));
    },
    join_list: async (action) => {
      const { source, separator, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, "");
        return;
      }
      const parsedSeparator = renderTemplate(separator ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, array.join(parsedSeparator));
    },
    filter_list: async (action) => {
      const { source, rules_group, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      
      const filtered: unknown[] = [];
      const oldItem = runtime.outputs["item"];
      for (const item of array) {
        runtime.outputs["item"] = item;
        const matches = await evaluateRuleGroup(rules_group, runtime);
        if (matches) {
          filtered.push(item);
        }
      }
      
      if (oldItem === undefined) {
        delete runtime.outputs["item"];
      } else {
        runtime.outputs["item"] = oldItem;
      }
      writeVariableValue(runtime.outputs, output_name, filtered);
    },
    map_list_property: async (action) => {
      const { source, property_key, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      const mapped = array.map((item) => {
        if (item && typeof item === "object") {
          return (item as any)[property_key];
        }
        return undefined;
      });
      writeVariableValue(runtime.outputs, output_name, mapped);
    },
    sort_reverse_list: async (action) => {
      const { source, action: sortAction, sort_key, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      
      const copied = [...array];
      if (sortAction === "reverse") {
        copied.reverse();
      } else {
        copied.sort((a: any, b: any) => {
          let valA = a;
          let valB = b;
          if (sort_key) {
            valA = a && typeof a === "object" ? a[sort_key] : undefined;
            valB = b && typeof b === "object" ? b[sort_key] : undefined;
          }
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          
          if (typeof valA === "string" && typeof valB === "string") {
            return sortAction === "sort_asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return sortAction === "sort_asc" ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
      }
      writeVariableValue(runtime.outputs, output_name, copied);
    },
    execute_list_script: async (action) => {
      const { source, script, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        throw new Error(`Source variable "${source}" is not an array.`);
      }
      if (!script) throw new Error("Script is required");
      
      const result = await runtime.page.evaluate((args) => {
        if (!args) throw new Error("Arguments are required");
        const { scriptText, list } = args;
        try {
          const fn = new Function("list", `return (${scriptText});`);
          return fn(list);
        } catch (err: any) {
          throw new Error(`Failed to evaluate JS on list: ${err.message}`);
        }
      }, { scriptText: script, list: array });
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_list_empty: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      writeVariableValue(runtime.outputs, output_name, Array.isArray(array) ? array.length === 0 : true);
    },
    check_list_contains: async (action) => {
      const { source, value_type, value, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, false);
        return;
      }
      const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
      const exists = array.some((item) => {
        if (typeof item === "object" && item !== null && typeof parsedVal === "object" && parsedVal !== null) {
          return JSON.stringify(item) === JSON.stringify(parsedVal);
        }
        return item === parsedVal;
      });
      writeVariableValue(runtime.outputs, output_name, exists);
    },
    check_list_any_match: async (action) => {
      const { source, rules_group, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, false);
        return;
      }
      
      let matches = false;
      const oldItem = runtime.outputs["item"];
      for (const item of array) {
        runtime.outputs["item"] = item;
        const currentMatches = await evaluateRuleGroup(rules_group, runtime);
        if (currentMatches) {
          matches = true;
          break;
        }
      }
      
      if (oldItem === undefined) {
        delete runtime.outputs["item"];
      } else {
        runtime.outputs["item"] = oldItem;
      }
      writeVariableValue(runtime.outputs, output_name, matches);
    },
    check_list_all_match: async (action) => {
      const { source, rules_group, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, false);
        return;
      }
      
      let matches = true;
      const oldItem = runtime.outputs["item"];
      for (const item of array) {
        runtime.outputs["item"] = item;
        const currentMatches = await evaluateRuleGroup(rules_group, runtime);
        if (!currentMatches) {
          matches = false;
          break;
        }
      }
      
      if (oldItem === undefined) {
        delete runtime.outputs["item"];
      } else {
        runtime.outputs["item"] = oldItem;
      }
      writeVariableValue(runtime.outputs, output_name, matches);
    },
  };
}
