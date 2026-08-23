import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { evaluateRuleGroup } from "./internal.js";
import { formatDateTime } from "./dataFormat.js";
import { isPlainRecord } from "../../shared/records.js";
import { renderTemplate, setVariables, writeVariableValue } from "../variables.js";

export function buildVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
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
check_conditions: async (action) => {
      const { output_name, mode, script, rules_group, evaluation_type } = action.config;
      const resolvers = (runtime.outputs as any).__dynamicResolvers;
      if (evaluation_type === "dynamic" && resolvers) {
        const { findReferencedVariables } = await import("../variables.js");
        const refs = new Set<string>();
        if (mode === "script" && script) {
          findReferencedVariables(script, refs);
        } else if (mode === "visual" && rules_group) {
          findReferencedVariables(rules_group, refs);
        }
        resolvers.set(output_name, {
          dependencies: Array.from(refs),
          resolve: async () => {
            if (mode === "script") {
              if (!script) throw new Error("Script is required in script mode");
              const result = await runtime.page.evaluate((args) => {
                if (!args) throw new Error("Arguments are required");
                const { scriptText, outputs } = args;
                try {
                  const fn = new Function("outputs", `return (${scriptText});`);
                  return Boolean(fn(outputs));
                } catch (err: any) {
                  throw new Error(`Failed to evaluate JS: ${err.message}`);
                }
              }, { scriptText: renderTemplate(script, runtime.outputs), outputs: runtime.outputs });
              return result;
            } else {
              return await evaluateRuleGroup(rules_group, runtime);
            }
          },
        });
        runtime.outputs[output_name] = undefined;
      } else {
        if (resolvers) {
          resolvers.delete(output_name);
        }
        if (mode === "script") {
          if (!script) throw new Error("Script is required in script mode");
          const result = await runtime.page.evaluate((args) => {
            if (!args) throw new Error("Arguments are required");
            const { scriptText, outputs } = args;
            try {
              const fn = new Function("outputs", `return (${scriptText});`);
              return Boolean(fn(outputs));
            } catch (err: any) {
              throw new Error(`Failed to evaluate JS: ${err.message}`);
            }
          }, { scriptText: script, outputs: runtime.outputs });
          runtime.outputs[output_name] = result;
        } else {
          runtime.outputs[output_name] = await evaluateRuleGroup(rules_group, runtime);
        }
      }
    },
calculate_value: async (action) => {
      const { output_name, expression, evaluation_type } = action.config;
      const resolvers = (runtime.outputs as any).__dynamicResolvers;
      if (evaluation_type === "dynamic" && resolvers) {
        const { findReferencedVariables } = await import("../variables.js");
        const refs = new Set<string>();
        if (expression) {
          findReferencedVariables(expression, refs);
        }
        resolvers.set(output_name, {
          dependencies: Array.from(refs),
          resolve: async () => {
            if (!expression) throw new Error("Expression is required");
            const result = await runtime.page.evaluate((args) => {
              if (!args) throw new Error("Arguments are required");
              const { scriptText, outputs } = args;
              try {
                const fn = new Function("outputs", `return (${scriptText});`);
                return fn(outputs);
              } catch (err: any) {
                throw new Error(`Failed to evaluate JS: ${err.message}`);
              }
            }, { scriptText: renderTemplate(expression, runtime.outputs), outputs: runtime.outputs });
            return result;
          },
        });
        runtime.outputs[output_name] = undefined;
      } else {
        if (resolvers) {
          resolvers.delete(output_name);
        }
        if (!expression) throw new Error("Expression is required");
        const result = await runtime.page.evaluate((args) => {
          if (!args) throw new Error("Arguments are required");
          const { scriptText, outputs } = args;
          try {
            const fn = new Function("outputs", `return (${scriptText});`);
            return fn(outputs);
          } catch (err: any) {
            throw new Error(`Failed to evaluate JS: ${err.message}`);
          }
        }, { scriptText: expression, outputs: runtime.outputs });
        runtime.outputs[output_name] = result;
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
  };
}
