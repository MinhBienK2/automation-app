import type { ActionSchema } from "./schema";
import type { TypedFieldContext } from "./schema";
import { updateActionConfigField } from "../workflowStepForm";
import { ElementTargetSourceFields } from "../../components/actionFields/ActionConfigElementSharedFields";
import { TemplateTextareaField } from "../../components/variables/TemplateTextField";
import { SetVariablesConfigFields } from "../../components/variables/VariableConfigFields";

export const outputSchemas: Partial<Record<string, ActionSchema>> = {
  set_variable: {
    sections: [
      {
        title: "Variable rows",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange, variableOptions }: TypedFieldContext) => {
              if (config.type !== "set_variable") return null;
              return (
                <SetVariablesConfigFields
                  config={config.config}
                  onChange={(nextConfig) =>
                    onChange({ type: "set_variable", config: nextConfig })
                  }
                  variableOptions={variableOptions}
                />
              );
            },
          },
        ],
      },
    ],
  },
  set_json_variables: {
    sections: [
      {
        title: "JSON variables",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "set_json_variables") return null;
              return (
                <TemplateTextareaField
                  label="JSON variables"
                  value={config.config.json}
                  onChange={(val) =>
                    onChange(updateActionConfigField(config, "json", val))
                  }
                />
              );
            },
          },
        ],
      },
    ],
  },
  update_number_variable: {
    sections: [
      {
        title: "Update Number Variable Settings",
        fields: [
          {
            widget: "template",
            key: "name",
            label: "Variable name",
            placeholder: "e.g. counter",
          },
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "increment", label: "Increment (+1)" },
              { value: "decrement", label: "Decrement (-1)" },
              { value: "add", label: "Add" },
              { value: "subtract", label: "Subtract" },
              { value: "multiply", label: "Multiply" },
              { value: "divide", label: "Divide" },
            ],
          },
          {
            widget: "template",
            key: "value",
            label: "Value",
            placeholder: "Value",
            when: (v) =>
              ["add", "subtract", "multiply", "divide"].includes(
                v.operation as string,
              ),
          },
        ],
      },
    ],
  },
  update_text_variable: {
    sections: [
      {
        title: "Update Text Variable Settings",
        fields: [
          {
            widget: "template",
            key: "name",
            label: "Variable name",
            placeholder: "e.g. message",
          },
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "append", label: "Append" },
              { value: "prepend", label: "Prepend" },
              { value: "replace", label: "Replace" },
              { value: "uppercase", label: "To Uppercase" },
              { value: "lowercase", label: "To Lowercase" },
              { value: "trim", label: "Trim Whitespace" },
            ],
          },
          {
            widget: "template",
            key: "search_pattern",
            label: "Search pattern (string or /regex/)",
            placeholder: "pattern",
            when: (v) => v.operation === "replace",
          },
          {
            widget: "textarea",
            key: "value",
            label: "Replacement / Value",
            placeholder: "Value",
            when: (v) =>
              ["append", "prepend", "replace"].includes(
                (v.operation as string | undefined) ?? "append",
              ),
          },
        ],
      },
    ],
  },
  update_flag_variable: {
    sections: [
      {
        title: "Update Flag Variable Settings",
        fields: [
          {
            widget: "template",
            key: "name",
            label: "Variable name",
            placeholder: "e.g. isLoggedIn",
          },
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "toggle", label: "Toggle" },
              { value: "set_true", label: "Set True" },
              { value: "set_false", label: "Set False" },
            ],
          },
        ],
      },
    ],
  },
  update_list_variable: {
    sections: [
      {
        title: "Update List Variable Settings",
        fields: [
          {
            widget: "template",
            key: "name",
            label: "Variable name",
            placeholder: "e.g. items",
          },
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "push", label: "Push (Add to end)" },
              { value: "unshift", label: "Unshift (Add to start)" },
              { value: "push_unique", label: "Push Unique" },
              { value: "pop", label: "Pop (Remove from end)" },
              { value: "shift", label: "Shift (Remove from start)" },
              { value: "remove_by_index", label: "Remove by index" },
              { value: "remove_by_value", label: "Remove by value" },
              { value: "merge", label: "Merge" },
              { value: "merge_unique", label: "Merge Unique" },
            ],
          },
          {
            widget: "select",
            key: "value_type",
            label: "Value type",
            options: [
              { value: "text", label: "Text" },
              { value: "json", label: "JSON" },
              { value: "number", label: "Number" },
              { value: "boolean", label: "Boolean" },
            ],
            when: (v) =>
              ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(
                (v.operation as string | undefined) ?? "push",
              ),
          },
          {
            widget: "textarea",
            key: "value",
            label: "Value",
            placeholder: "Value",
            when: (v) =>
              ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(
                (v.operation as string | undefined) ?? "push",
              ),
          },
          {
            widget: "template",
            key: "index",
            label: "Index (0-based number or variable)",
            placeholder: "0",
            when: (v) => v.operation === "remove_by_index",
          },
        ],
      },
    ],
  },
  assert_element: {
    sections: [
      {
        title: "Assertion target",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => (
              <ElementTargetSourceFields config={config} onChange={onChange} />
            ),
          },
        ],
      },
      {
        title: "Element state",
        fields: [
          {
            widget: "select",
            key: "state",
            label: "State",
            options: [
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
              { value: "attached", label: "Attached" },
              { value: "enabled", label: "Enabled" },
              { value: "disabled", label: "Disabled" },
            ],
          },
        ],
      },
    ],
  },
  assert_text: {
    sections: [
      {
        title: "Assertion target",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => (
              <ElementTargetSourceFields config={config} onChange={onChange} />
            ),
          },
        ],
      },
      {
        title: "Text assertion",
        fields: [
          { widget: "textarea", key: "text", label: "Text" },
          {
            widget: "select",
            key: "match_mode",
            label: "Match mode",
            options: [
              { value: "contains", label: "Contains" },
              { value: "equals", label: "Equals" },
            ],
          },
          { widget: "numeric", key: "timeout_ms", label: "Timeout ms", min: 1 },
        ],
      },
    ],
  },
};
