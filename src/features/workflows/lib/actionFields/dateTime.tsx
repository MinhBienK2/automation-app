import type { ActionSchema } from "./schema";
import type { TypedFieldContext } from "./schema";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { updateActionConfigField } from "../workflowStepForm";

export const dateTimeSchemas: Partial<Record<string, ActionSchema>> = {
  date_time_operation: {
    sections: [
      {
        title: "Operation",
        fields: [
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "current_timestamp", label: "Get Current Timestamp" },
              { value: "format", label: "Format Date" },
              { value: "add_subtract", label: "Add/Subtract Time" },
              { value: "diff", label: "Calculate Difference (Ms)" },
            ],
          },
        ],
      },
      {
        title: "Base date",
        fields: [
          {
            widget: "template",
            key: "value",
            label: "Base Date Value (Optional - defaults to Now)",
          },
        ],
      },
      {
        title: "Format",
        when: (v) => v.operation === "format",
        fields: [
          {
            widget: "template",
            key: "format_pattern",
            label: "Format Pattern (e.g., YYYY-MM-DD HH:mm:ss)",
          },
        ],
      },
      {
        title: "Difference",
        when: (v) => v.operation === "diff",
        fields: [
          { widget: "template", key: "format_pattern", label: "Second Date Value" },
        ],
      },
      {
        title: "Offset",
        when: (v) => v.operation === "add_subtract",
        fields: [
          {
            widget: "numeric",
            key: "offset_value",
            label: "Offset Value (Positive to add, Negative to subtract)",
          },
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              const values = config.config as Record<string, unknown>;
              return (
                <Label>
                  Offset Unit
                  <Select
                    value={(values.offset_unit as string | undefined) ?? "days"}
                    onChange={(e) =>
                      onChange(
                        updateActionConfigField(config, "offset_unit", e.currentTarget.value),
                      )
                    }
                  >
                    <option value="days">Days</option>
                    <option value="hours">Hours</option>
                    <option value="minutes">Minutes</option>
                  </Select>
                </Label>
              );
            },
          },
        ],
      },
      {
        title: "Output",
        fields: [{ widget: "text", key: "output_name", label: "Output name" }],
      },
    ],
  },
  crypto_operation: {
    sections: [
      {
        title: "Operation",
        fields: [
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "md5", label: "MD5 Hash" },
              { value: "sha256", label: "SHA-256 Hash" },
              { value: "base64_encode", label: "Base64 Encode" },
              { value: "base64_decode", label: "Base64 Decode" },
            ],
          },
        ],
      },
      {
        title: "Value",
        fields: [{ widget: "template", key: "value", label: "Value to process" }],
      },
      {
        title: "Output",
        fields: [{ widget: "text", key: "output_name", label: "Output name" }],
      },
    ],
  },
};
