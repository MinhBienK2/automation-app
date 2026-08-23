import type { ActionSchema } from "./schema";
import type { TypedFieldContext } from "./schema";
import { updateActionConfigField } from "../workflowStepForm";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { TemplateTextareaField } from "../../components/variables/TemplateTextField";

export const logicSchemas: Partial<Record<string, ActionSchema>> = {
  // if_condition / random_choice render no fields (legacy null branches).
  repeat_times: {
    sections: [
      {
        title: "Repeat count",
        fields: [{ widget: "numeric", key: "times", label: "Times", min: 1 }],
      },
    ],
  },
  repeat_for_each: {
    sections: [
      {
        title: "Iteration source",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "repeat_for_each") return null;
              return (
                <Label>
                  Items source
                  <Select
                    value={config.config.array_variable ? "variable_array" : "manual"}
                    onChange={(event) =>
                      onChange(
                        event.currentTarget.value === "variable_array"
                          ? {
                              type: "repeat_for_each",
                              config: {
                                ...config.config,
                                array_variable: "items",
                                items: [],
                              },
                            }
                          : {
                              type: "repeat_for_each",
                              config: {
                                ...config.config,
                                array_variable: null,
                                items: config.config.items.length
                                  ? config.config.items
                                  : ["item"],
                              },
                            },
                      )
                    }
                  >
                    <option value="manual">Manual list</option>
                    <option value="variable_array">Variable array</option>
                  </Select>
                </Label>
              );
            },
          },
          { widget: "text", key: "item_name", label: "Item name" },
          {
            widget: "text",
            key: "array_variable",
            label: "Array variable",
            when: (v) => Boolean(v.array_variable),
          },
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "repeat_for_each" || config.config.array_variable)
                return null;
              return (
                <TemplateTextareaField
                  label="Items"
                  value={config.config.items.join("\n")}
                  onChange={(val) =>
                    onChange(updateActionConfigField(config, "items", val))
                  }
                />
              );
            },
          },
        ],
      },
    ],
  },
  retry_block: {
    sections: [
      {
        title: "Retry policy",
        fields: [
          {
            widget: "numeric",
            key: "max_attempts",
            label: "Max attempts",
            min: 1,
          },
          { widget: "numeric", key: "delay_ms", label: "Delay ms", min: 0 },
        ],
      },
    ],
  },
  stop_workflow: {
    sections: [
      {
        title: "Terminal result",
        fields: [
          {
            widget: "select",
            key: "status",
            label: "Status",
            options: [
              { value: "success", label: "Success" },
              { value: "failure", label: "Failure" },
            ],
          },
          { widget: "textarea", key: "reason", label: "Reason" },
        ],
      },
    ],
  },
};
