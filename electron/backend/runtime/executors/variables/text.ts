import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../../runnerActionExecutors.js";
import { renderTemplate, writeVariableValue } from "../../variables.js";

export type TextVariablesExecutors = Pick<
  ActionExecutorMap,
  | "update_text_variable" | "set_text_variable" | "append_text" | "prepend_text"
  | "replace_text" | "trim_text" | "change_text_case" | "slice_text"
  | "regex_extract" | "get_text_length" | "check_text_empty" | "check_text_contains"
  | "check_text_regex_matches"
>;

export function createTextVariablesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  _deps: RunnerActionExecutorDependencies<Runtime>,
): TextVariablesExecutors {
  return {
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
  };
}
