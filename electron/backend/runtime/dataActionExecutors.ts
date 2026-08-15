/**
 * Executors that never touch a browser.
 *
 * Number, text, boolean, list, object, date, crypto, file, HTTP and every
 * flow-control action live here. They receive a `VariableScope` — run outputs
 * and step identity — and the compiler is what keeps them honest: there is no
 * `page` on that type to reach for.
 *
 * That is the property #32 exists to create. It makes these executors testable
 * with no browser and no temp directory, and it is why adding a second
 * execution surface costs nothing for the majority of actions.
 *
 * Spec: `docs/architecture/runner.md`.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ActionExecutorMap } from "../actions/execution.js";
import { isPlainRecord } from "../shared/records.js";
import { withLoopScope } from "./loopScope.js";
import type { DataActionDependencies, VariableScope } from "./actionRuntime.js";
import {
  parseVariableValue,
  renderTemplate,
  setVariables,
  writeVariableValue,
} from "./variables.js";
import {
  assertRuntimeEnumValue,
  weightedRandomChoice,
} from "./runtimeHelpers.js";
import { getPath, setPath, deletePath, hasPath } from "./objectHelpers.js";
import {
  dedupeStrings,
  formatDateTime,
  getMockValueForVariable,
  outputValueToList,
  outputValueToText,
  parseCSV,
  regexFromActionConfig,
  writeCSV,
} from "./actionValueHelpers.js";

/**
 * Returned without an explicit type annotation on purpose: the inferred keys
 * are what let the caller's spread prove, at compile time, that the two halves
 * together cover every action in the registry.
 */
export function createDataActionExecutors<Runtime extends VariableScope>(
  runtime: Runtime,
  deps: DataActionDependencies<Runtime>,
) {
  const cleanFlattenedKeys = (outputs: Record<string, unknown>, varName: string) => {
    const prefix = varName + ".";
    for (const key of Object.keys(outputs)) {
      if (key.startsWith(prefix)) {
        delete outputs[key];
      }
    }
  };

  const deepMerge = (target: Record<string, any>, source: Record<string, any>): Record<string, any> => {
    const result = { ...target };
    for (const [key, val] of Object.entries(source)) {
      if (isPlainRecord(val) && isPlainRecord(result[key])) {
        result[key] = deepMerge(result[key], val);
      } else {
        result[key] = val;
      }
    }
    return result;
  };

  return {
    random_wait: async (action) => {
      const waitMs =
        action.config.min_ms +
        Math.floor(deps.random() * (action.config.max_ms - action.config.min_ms + 1));
      await deps.sleep(waitMs, runtime.signal);
    },
    set_clipboard: async (action) => {
      runtime.clipboard = action.config.text;
    },
    extract_regex_matches: async (action) => {
      const source = outputValueToText(runtime.outputs[action.config.source_name]);
      const regex = regexFromActionConfig(action.config.pattern, action.config.flags);
      const matches = Array.from(source.matchAll(regex), (match) => match[0]).filter(Boolean);
      const existing = action.config.append
        ? outputValueToList(runtime.outputs[action.config.output_name])
        : [];
      const nextValues = [...existing, ...matches];
      runtime.outputs[action.config.output_name] = action.config.dedupe
        ? dedupeStrings(nextValues)
        : nextValues;
    },
    extract_numbers: async (action) => {
      const sourceVal = String(runtime.outputs[action.config.source_name] ?? "");
      const matches = sourceVal.match(/-?\d+(?:\.\d+)?/g);
      runtime.outputs[action.config.output_name] = matches ? matches.map(Number) : [];
    },
    extract_urls: async (action) => {
      const sourceVal = String(runtime.outputs[action.config.source_name] ?? "");
      const urlRegex = /https?:\/\/[^\s$.?#].[^\s]*/g;
      const matches = sourceVal.match(urlRegex);
      runtime.outputs[action.config.output_name] = matches ?? [];
    },
    extract_emails: async (action) => {
      const sourceVal = String(runtime.outputs[action.config.source_name] ?? "");
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = sourceVal.match(emailRegex);
      runtime.outputs[action.config.output_name] = matches ?? [];
    },
    set_variable: async (action) => {
      setVariables(runtime.outputs, action.config);
    },
    set_json_variables: async (action) => {
      const parsed = JSON.parse(renderTemplate(action.config.json, runtime.outputs));
      if (!isPlainRecord(parsed)) throw new Error("JSON variables must be an object");
      for (const [key, val] of Object.entries(parsed)) {
        writeVariableValue(runtime.outputs, key, val);
      }
    },
    update_number_variable: async (action) => {
      const { name, operation, value } = action.config;
      if (!name) return;

      let existing = Number(runtime.outputs[name]);
      if (Number.isNaN(existing)) {
        existing = 0;
      }

      let newVal = existing;
      if (operation === "increment") {
        newVal = existing + 1;
      } else if (operation === "decrement") {
        newVal = existing - 1;
      } else {
        const parsedVal = Number(parseVariableValue("number", value ?? "0", runtime.outputs));
        const val = Number.isNaN(parsedVal) ? 0 : parsedVal;
        if (operation === "add") newVal = existing + val;
        else if (operation === "subtract") newVal = existing - val;
        else if (operation === "multiply") newVal = existing * val;
        else if (operation === "divide") newVal = val !== 0 ? existing / val : 0;
      }

      writeVariableValue(runtime.outputs, name, newVal);
    },
    set_number_variable: async (action) => {
      const { output_name, value } = action.config;
      if (!output_name) return;
      const num = Number(parseVariableValue("number", value, runtime.outputs));
      writeVariableValue(runtime.outputs, output_name, Number.isNaN(num) ? 0 : num);
    },
    generate_random_number: async (action) => {
      const { output_name, min, max, integer } = action.config;
      if (!output_name) return;
      const minVal = Number(parseVariableValue("number", min, runtime.outputs));
      const maxVal = Number(parseVariableValue("number", max, runtime.outputs));
      if (Number.isNaN(minVal) || Number.isNaN(maxVal)) {
        throw new Error("Min and Max must be valid numbers");
      }
      const rand = deps.random();
      let result = minVal + rand * (maxVal - minVal);
      if (integer) {
        result = Math.floor(minVal + rand * (maxVal - minVal + 1));
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    parse_text_to_number: async (action) => {
      const { source, fallback, output_name } = action.config;
      if (!output_name) return;
      const text = renderTemplate(source, runtime.outputs);
      let num = Number(text);
      if (Number.isNaN(num)) {
        const fallbackText = fallback != null ? renderTemplate(fallback, runtime.outputs) : "0";
        num = Number(fallbackText);
        if (Number.isNaN(num)) {
          num = 0;
        }
      }
      writeVariableValue(runtime.outputs, output_name, num);
    },
    math_operation: async (action) => {
      const { operand1, operation, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = Number(parseVariableValue("number", operand1, runtime.outputs));
      if (Number.isNaN(op1)) throw new Error("Operand 1 must be a valid number");

      let result = 0;
      if (["add", "subtract", "multiply", "divide", "modulo", "power", "min", "max"].includes(operation)) {
        if (operand2 == null) throw new Error(`Operand 2 is required for operation: ${operation}`);
        const op2 = Number(parseVariableValue("number", operand2, runtime.outputs));
        if (Number.isNaN(op2)) throw new Error("Operand 2 must be a valid number");

        if (operation === "add") result = op1 + op2;
        else if (operation === "subtract") result = op1 - op2;
        else if (operation === "multiply") result = op1 * op2;
        else if (operation === "divide") result = op2 !== 0 ? op1 / op2 : 0;
        else if (operation === "modulo") result = op2 !== 0 ? op1 % op2 : 0;
        else if (operation === "power") result = Math.pow(op1, op2);
        else if (operation === "min") result = Math.min(op1, op2);
        else if (operation === "max") result = Math.max(op1, op2);
      } else {
        if (operation === "abs") result = Math.abs(op1);
        else if (operation === "sqrt") result = Math.sqrt(op1);
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    round_number: async (action) => {
      const { source, mode, decimals, output_name } = action.config;
      if (!output_name) return;
      const num = Number(parseVariableValue("number", source, runtime.outputs));
      const decimalPlaces = Number(parseVariableValue("number", decimals ?? "0", runtime.outputs));
      if (Number.isNaN(num) || Number.isNaN(decimalPlaces)) {
        throw new Error("Source and decimals must be valid numbers");
      }
      const factor = Math.pow(10, Math.max(0, decimalPlaces));
      let result = num;
      if (mode === "round") result = Math.round(num * factor) / factor;
      else if (mode === "floor") result = Math.floor(num * factor) / factor;
      else if (mode === "ceil") result = Math.ceil(num * factor) / factor;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    format_number: async (action) => {
      const { source, format, decimals, currency_code, locale, output_name } = action.config;
      if (!output_name) return;
      const num = Number(parseVariableValue("number", source, runtime.outputs));
      if (Number.isNaN(num)) throw new Error("Source must be a valid number");

      const l = locale ? renderTemplate(locale, runtime.outputs) : undefined;
      const options: Intl.NumberFormatOptions = {};
      if (decimals != null) {
        const d = Number(parseVariableValue("number", decimals, runtime.outputs));
        if (!Number.isNaN(d)) {
          options.minimumFractionDigits = d;
          options.maximumFractionDigits = d;
        }
      }
      if (format === "currency") {
        options.style = "currency";
        options.currency = currency_code ? renderTemplate(currency_code, runtime.outputs) : "USD";
      } else if (format === "percent") {
        options.style = "percent";
      }
      
      const formatted = new Intl.NumberFormat(l, options).format(num);
      writeVariableValue(runtime.outputs, output_name, formatted);
    },
    compare_numbers: async (action) => {
      const { operand1, operator, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = Number(parseVariableValue("number", operand1, runtime.outputs));
      const op2 = Number(parseVariableValue("number", operand2, runtime.outputs));
      if (Number.isNaN(op1) || Number.isNaN(op2)) {
        throw new Error("Both operands must be valid numbers");
      }
      let result = false;
      if (operator === "gt") result = op1 > op2;
      else if (operator === "gte") result = op1 >= op2;
      else if (operator === "lt") result = op1 < op2;
      else if (operator === "lte") result = op1 <= op2;
      else if (operator === "eq") result = op1 === op2;
      else if (operator === "neq") result = op1 !== op2;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_number_range: async (action) => {
      const { value, min, max, inclusive, output_name } = action.config;
      if (!output_name) return;
      const val = Number(parseVariableValue("number", value, runtime.outputs));
      const minVal = Number(parseVariableValue("number", min, runtime.outputs));
      const maxVal = Number(parseVariableValue("number", max, runtime.outputs));
      if (Number.isNaN(val) || Number.isNaN(minVal) || Number.isNaN(maxVal)) {
        throw new Error("Value, Min, and Max must be valid numbers");
      }
      const result = inclusive
        ? val >= minVal && val <= maxVal
        : val > minVal && val < maxVal;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_number_property: async (action) => {
      const { value, property, output_name } = action.config;
      if (!output_name) return;
      const val = Number(parseVariableValue("number", value, runtime.outputs));
      if (Number.isNaN(val)) throw new Error("Value must be a valid number");
      let result = false;
      if (property === "even") result = val % 2 === 0;
      else if (property === "odd") result = Math.abs(val % 2) === 1;
      else if (property === "integer") result = Number.isInteger(val);
      else if (property === "positive") result = val > 0;
      else if (property === "negative") result = val < 0;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    update_text_variable: async (action) => {
      const { name, operation, value, search_pattern } = action.config;
      if (!name) return;

      const existing = String(runtime.outputs[name] ?? "");
      let newVal = existing;

      if (operation === "append") {
        newVal = existing + renderTemplate(value ?? "", runtime.outputs);
      } else if (operation === "prepend") {
        newVal = renderTemplate(value ?? "", runtime.outputs) + existing;
      } else if (operation === "replace") {
        const search = renderTemplate(search_pattern ?? "", runtime.outputs);
        const replaceVal = renderTemplate(value ?? "", runtime.outputs);
        let searchRegex: RegExp | string = search;
        const match = search.match(/^\/(.*?)\/([gimy]*)$/);
        if (match) {
          try {
            searchRegex = new RegExp(match[1], match[2]);
          } catch {
            // fallback
          }
        }
        if (typeof searchRegex === "string") {
          newVal = existing.replaceAll(searchRegex, replaceVal);
        } else {
          newVal = existing.replace(searchRegex, replaceVal);
        }
      } else if (operation === "uppercase") {
        newVal = existing.toUpperCase();
      } else if (operation === "lowercase") {
        newVal = existing.toLowerCase();
      } else if (operation === "trim") {
        newVal = existing.trim();
      }

      writeVariableValue(runtime.outputs, name, newVal);
    },
    set_text_variable: async (action) => {
      const { output_name, value } = action.config;
      if (!output_name) return;
      const evaluated = renderTemplate(value ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, evaluated);
    },
    append_text: async (action) => {
      const { name, value } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const newVal = existing + renderTemplate(value ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, name, newVal);
    },
    prepend_text: async (action) => {
      const { name, value } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const newVal = renderTemplate(value ?? "", runtime.outputs) + existing;
      writeVariableValue(runtime.outputs, name, newVal);
    },
    replace_text: async (action) => {
      const { name, search_pattern, replacement } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const search = renderTemplate(search_pattern ?? "", runtime.outputs);
      const replaceVal = renderTemplate(replacement ?? "", runtime.outputs);
      let searchRegex: RegExp | string = search;
      const match = search.match(/^\/(.*?)\/([gimy]*)$/);
      if (match) {
        try {
          searchRegex = new RegExp(match[1], match[2]);
        } catch {
          // fallback
        }
      }
      let newVal = existing;
      if (typeof searchRegex === "string") {
        newVal = existing.replaceAll(searchRegex, replaceVal);
      } else {
        newVal = existing.replace(searchRegex, replaceVal);
      }
      writeVariableValue(runtime.outputs, name, newVal);
    },
    trim_text: async (action) => {
      const { name } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      writeVariableValue(runtime.outputs, name, existing.trim());
    },
    change_text_case: async (action) => {
      const { name, to_case } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const newVal = to_case === "upper" ? existing.toUpperCase() : existing.toLowerCase();
      writeVariableValue(runtime.outputs, name, newVal);
    },
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
    graph_noop: async () => undefined,
    if_condition: async (action) => {
      await deps.executeActions(
        runtime,
        await deps.conditionMatches(runtime, action.config.condition)
          ? action.config.then_steps
          : action.config.else_steps,
      );
    },
    router_condition: async (action) => {
      for (const caseValue of action.config.cases) {
        let matched = false;
        try {
          matched = await deps.conditionMatches(runtime, caseValue.condition);
        } catch (error) {
          throw new Error(
            `Router ${runtime.currentStepId ?? "unknown"} case "${caseValue.label}" condition failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        if (matched) {
          await deps.executeActions(runtime, caseValue.steps);
          return;
        }
      }
      await deps.executeActions(runtime, action.config.default_steps);
    },
    random_choice: async (action) => {
      const choice = weightedRandomChoice(action.config.choices, deps.random);
      if (action.config.output_name?.trim()) {
        runtime.outputs[action.config.output_name] = choice.id;
      }
      await deps.executeActions(runtime, choice.steps);
    },
    repeat_times: async (action) => {
      await withLoopScope(runtime.outputs, async (iteration) => {
        for (let index = 0; index < action.config.times; index += 1) {
          iteration(index);
          const control = await deps.executeLoopBody(runtime, action.config.steps);
          if (control === "break") break;
        }
      });
    },
    repeat_for_each: async (action) => {
      const items = action.config.array_variable
        ? (runtime.outputs[action.config.array_variable] as unknown[])
        : action.config.items;
      if (!Array.isArray(items)) throw new Error("repeat_for_each source is not an array");

      let processedItems = [...items];

      // 1. Range Slicing
      let start = 0;
      if (action.config.start_index) {
        const renderedStart = renderTemplate(action.config.start_index, runtime.outputs);
        const parsedStart = parseInt(renderedStart, 10);
        if (!isNaN(parsedStart)) {
          start = parsedStart;
        }
      }

      let end: number | undefined;
      if (action.config.end_index) {
        const renderedEnd = renderTemplate(action.config.end_index, runtime.outputs);
        const parsedEnd = parseInt(renderedEnd, 10);
        if (!isNaN(parsedEnd)) {
          end = parsedEnd;
        }
      }

      if (end !== undefined) {
        processedItems = processedItems.slice(start, end);
      } else {
        processedItems = processedItems.slice(start);
      }

      // 2. Max loops (limit)
      if (action.config.max_loops) {
        const renderedMax = renderTemplate(action.config.max_loops, runtime.outputs);
        const parsedMax = parseInt(renderedMax, 10);
        if (!isNaN(parsedMax) && parsedMax >= 0) {
          processedItems = processedItems.slice(0, parsedMax);
        }
      }

      // 3. Min loops (padding)
      if (action.config.min_loops) {
        const renderedMin = renderTemplate(action.config.min_loops, runtime.outputs);
        const parsedMin = parseInt(renderedMin, 10);
        if (!isNaN(parsedMin) && parsedMin > 0) {
          while (processedItems.length < parsedMin) {
            processedItems.push(null);
          }
        }
      }

      await withLoopScope(runtime.outputs, async (iteration) => {
        let index = 0;
        for (const item of processedItems) {
          writeVariableValue(runtime.outputs, action.config.item_name, item);
          iteration(index);
          const control = await deps.executeLoopBody(runtime, action.config.steps);
          index += 1;
          if (control === "break") break;
        }
      });
    },
    retry_block: async (action) => {
      await deps.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, action.config.steps, action.config.failed_steps ?? []);
    },
    switch_condition: async (action) => {
      const value = String(runtime.outputs[action.config.expression] ?? action.config.expression);
      const branch = action.config.cases.find((candidate) => candidate.value === value);
      await deps.executeActions(runtime, branch?.steps ?? action.config.default_steps);
    },
    while_loop: async (action) => {
      await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        () => deps.conditionMatches(runtime, action.config.condition),
        action.config.timeout_ms ?? null,
      );
    },
    repeat_until: async (action) => {
      const result = await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        async () => !(await deps.conditionMatches(runtime, action.config.condition)),
        action.config.timeout_ms ?? null,
      );
      if (
        (result === "max_attempts" || result === "timeout") &&
        !(await deps.conditionMatches(runtime, action.config.condition))
      ) {
        await deps.executeActions(runtime, action.config.timeout_steps);
      }
    },
    try_catch: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.try_steps);
        await deps.executeActions(runtime, action.config.success_steps);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.outputs["last_error"] = message;
        runtime.outputs["system.last_error"] = message;
        if (action.config.error_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.error_steps);
      } finally {
        await deps.executeActions(runtime, action.config.finally_steps);
      }
    },
    fallback_block: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.primary_steps);
      } catch (error) {
        if (action.config.fallback_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.fallback_steps);
      }
    },
    break_loop: async () => {
      throw deps.createLoopControl("break");
    },
    continue_loop: async () => {
      throw deps.createLoopControl("continue");
    },
    stop_workflow: async (action) => {
      throw deps.createRunnerStop(
        action.config.status === "success" ? "success" : "failure",
        action.config.reason ?? "Workflow stopped",
        Boolean(action.config.close_browser),
      );
    },
    transform_variable: async (action) => {
      runtime.outputs[action.config.target_name] = renderTemplate(action.config.expression, runtime.outputs);
    },
    assert_output: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_mode,
        ["contains", "equals"],
        "Match mode must be contains or equals",
      );
      const actual = String(runtime.outputs[action.config.name] ?? "");
      if (action.config.match_mode === "equals" && actual !== action.config.value) {
        throw new Error(`Output ${action.config.name} did not equal ${action.config.value}`);
      }
      if (action.config.match_mode === "contains" && !actual.includes(action.config.value)) {
        throw new Error(`Output ${action.config.name} did not contain ${action.config.value}`);
      }
    },
    read_text_file: async (action) => {
      const { path: filePath, output_name, encoding } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);
      const content = await fs.readFile(resolvedPath, { encoding: (encoding as "utf-8" | "base64") ?? "utf-8" });
      writeVariableValue(runtime.outputs, output_name, content);
    },
    parse_csv_excel: async (action) => {
      const { path: filePath, output_name, has_headers, delimiter } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);
      
      if (resolvedPath.endsWith(".xlsx") || resolvedPath.endsWith(".xls")) {
        throw new Error("Excel format (.xlsx/.xls) is not natively supported. Please convert to CSV.");
      }
      
      const content = await fs.readFile(resolvedPath, { encoding: "utf-8" });
      const parsed = parseCSV(content, delimiter ?? ",", has_headers);
      writeVariableValue(runtime.outputs, output_name, parsed);
    },
    write_csv_excel: async (action) => {
      const { path: filePath, source_name, mode, has_headers } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);

      if (resolvedPath.endsWith(".xlsx") || resolvedPath.endsWith(".xls")) {
        throw new Error("Excel format (.xlsx/.xls) is not natively supported. Please convert to CSV.");
      }

      const sourceVal = runtime.outputs[source_name];
      if (!Array.isArray(sourceVal)) {
        throw new Error(`Source variable "${source_name}" must be an array to write to CSV.`);
      }

      const csvContent = writeCSV(sourceVal, has_headers);
      
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      if (mode === "append") {
        await fs.appendFile(resolvedPath, csvContent, { encoding: "utf-8" });
      } else {
        await fs.writeFile(resolvedPath, csvContent, { encoding: "utf-8" });
      }
    },
    file_operation: async (action) => {
      const { operation, path: filePath, target_path, output_name } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);

      if (operation === "exists") {
        let exists = false;
        try {
          await fs.access(resolvedPath);
          exists = true;
        } catch {
          // not exists
        }
        if (output_name) {
          writeVariableValue(runtime.outputs, output_name, exists);
        }
      } else if (operation === "delete") {
        await fs.rm(resolvedPath, { force: true, recursive: true });
      } else if (operation === "rename" || operation === "move") {
        if (!target_path) throw new Error("Target path is required for rename/move operations");
        const renderedTarget = renderTemplate(target_path, runtime.outputs);
        const resolvedTarget = path.isAbsolute(renderedTarget)
          ? renderedTarget
          : path.resolve(deps.appPaths.rootDir, renderedTarget);
        
        await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
        await fs.rename(resolvedPath, resolvedTarget);
        if (output_name) {
          writeVariableValue(runtime.outputs, output_name, resolvedTarget);
        }
      }
    },
    http_request: async (action) => {
      const { method, url: targetUrl, headers, body, content_type, output_name, timeout_ms } = action.config;
      const renderedUrl = renderTemplate(targetUrl, runtime.outputs);
      
      const requestHeaders: Record<string, string> = {};
      if (content_type) {
        requestHeaders["Content-Type"] = content_type;
      }
      if (headers) {
        for (const pair of headers) {
          requestHeaders[pair.name] = renderTemplate(pair.value, runtime.outputs);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout_ms ?? 30000);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          fetchOptions.body = renderTemplate(body, runtime.outputs);
        }

        const response = await fetch(renderedUrl, fetchOptions);
        clearTimeout(timeoutId);

        const responseText = await response.text();
        let parsedBody: any = responseText;
        try {
          parsedBody = JSON.parse(responseText);
        } catch {
          // keep as string
        }

        const result = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
        };

        writeVariableValue(runtime.outputs, output_name, result);
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw new Error(`HTTP Request failed: ${err.message}`);
      }
    },
    date_time_operation: async (action) => {
      const { operation, value, format_pattern, offset_value, offset_unit, output_name } = action.config;
      let date = new Date();
      if (value) {
        const renderedVal = renderTemplate(value, runtime.outputs);
        const parsedTime = Date.parse(renderedVal);
        if (!Number.isNaN(parsedTime)) {
          date = new Date(parsedTime);
        }
      }

      if (operation === "current_timestamp") {
        writeVariableValue(runtime.outputs, output_name, date.toISOString());
      } else if (operation === "format") {
        const pattern = format_pattern ?? "YYYY-MM-DD HH:mm:ss";
        writeVariableValue(runtime.outputs, output_name, formatDateTime(date, pattern));
      } else if (operation === "add_subtract") {
        const offset = offset_value ?? 0;
        if (offset_unit === "days") {
          date.setDate(date.getDate() + offset);
        } else if (offset_unit === "hours") {
          date.setHours(date.getHours() + offset);
        } else if (offset_unit === "minutes") {
          date.setMinutes(date.getMinutes() + offset);
        }
        writeVariableValue(runtime.outputs, output_name, date.toISOString());
      } else if (operation === "diff") {
        const val2 = format_pattern ? renderTemplate(format_pattern, runtime.outputs) : "";
        const parsedTime2 = Date.parse(val2);
        if (Number.isNaN(parsedTime2)) {
          throw new Error(`Second date value "${val2}" is invalid`);
        }
        const diffMs = date.getTime() - parsedTime2;
        writeVariableValue(runtime.outputs, output_name, diffMs);
      }
    },
    crypto_operation: async (action) => {
      const { operation, value, output_name } = action.config;
      const renderedVal = renderTemplate(value, runtime.outputs);
      
      let result = "";
      if (operation === "md5") {
        const { createHash } = await import("node:crypto");
        result = createHash("md5").update(renderedVal).digest("hex");
      } else if (operation === "sha256") {
        const { createHash } = await import("node:crypto");
        result = createHash("sha256").update(renderedVal).digest("hex");
      } else if (operation === "base64_encode") {
        result = Buffer.from(renderedVal, "utf-8").toString("base64");
      } else if (operation === "base64_decode") {
        result = Buffer.from(renderedVal, "base64").toString("utf-8");
      }

      writeVariableValue(runtime.outputs, output_name, result);
    },
    quarantined: async () => {
      // No-op: quarantined nodes are skipped at compile time.
      // This executor exists only to satisfy the registry coverage assertion.
    },
  } satisfies Partial<ActionExecutorMap>;
}
