import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../../runnerActionExecutors.js";
import { parseVariableValue, renderTemplate, writeVariableValue } from "../../variables.js";

export type NumberVariablesExecutors = Pick<
  ActionExecutorMap,
  | "update_number_variable" | "set_number_variable" | "generate_random_number" | "parse_text_to_number"
  | "math_operation" | "round_number" | "format_number" | "compare_numbers"
  | "check_number_range" | "check_number_property"
>;

export function createNumberVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): NumberVariablesExecutors {
  return {
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
  };
}
