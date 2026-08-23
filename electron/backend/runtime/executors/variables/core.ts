import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../../runnerActionExecutors.js";
import { isPlainRecord } from "../../../shared/records.js";
import { renderTemplate, setVariables, writeVariableValue } from "../../variables.js";
import { evaluateRuleGroup } from "../support.js";

export function getMockValueForVariable(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("video")) {
    return "https://www.tiktok.com/@tiktok/video/7350000000000000000";
  }
  if (lower.includes("url") || lower.includes("link")) {
    return "https://www.tiktok.com/@tiktok";
  }
  if (
    lower.includes("user") ||
    lower.includes("name") ||
    lower.includes("account") ||
    lower.includes("channel") ||
    lower.includes("profile")
  ) {
    return "tiktok";
  }
  if (lower.includes("id")) {
    return "1234567890";
  }
  if (lower.includes("num") || lower.includes("count") || lower.includes("index")) {
    return "1";
  }
  return `mock_${name}`;
}

export   const cleanFlattenedKeys = (outputs: Record<string, unknown>, varName: string) => {
    const prefix = varName + ".";
    for (const key of Object.keys(outputs)) {
      if (key.startsWith(prefix)) {
        delete outputs[key];
      }
    }
  };
export   const deepMerge = (target: Record<string, any>, source: Record<string, any>): Record<string, any> => {
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

export type CoreVariablesExecutors = Pick<
  ActionExecutorMap,
  | "set_variable" | "set_json_variables" | "transform_variable" | "check_conditions"
  | "calculate_value"
>;

export function createCoreVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): CoreVariablesExecutors {
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
    transform_variable: async (action) => {
      runtime.outputs[action.config.target_name] = renderTemplate(action.config.expression, runtime.outputs);
    },
    check_conditions: async (action) => {
      const { output_name, mode, script, rules_group, evaluation_type } = action.config;
      const resolvers = (runtime.outputs as any).__dynamicResolvers;
      if (evaluation_type === "dynamic" && resolvers) {
        const { findReferencedVariables } = await import("../../variables.js");
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
        const { findReferencedVariables } = await import("../../variables.js");
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
  };
}
