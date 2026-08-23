import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../../runnerActionExecutors.js";
import { parseVariableValue, renderTemplate, writeVariableValue } from "../../variables.js";

export type BooleanVariablesExecutors = Pick<
  ActionExecutorMap,
  | "update_flag_variable" | "set_boolean_variable" | "generate_random_boolean" | "parse_to_boolean"
  | "boolean_logical_op" | "compare_booleans" | "check_boolean_property"
>;

export function createBooleanVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): BooleanVariablesExecutors {
  return {
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
  };
}
