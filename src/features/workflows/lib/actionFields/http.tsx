import type { ActionSchema } from "./schema";
import type { TypedFieldContext } from "./schema";
import { updateActionConfigField } from "../workflowStepForm";
import { TemplateTextareaField } from "../../components/variables/TemplateTextField";

export const httpSchemas: Partial<Record<string, ActionSchema>> = {
  http_request: {
    sections: [
      {
        title: "Request",
        fields: [
          {
            widget: "select",
            key: "method",
            label: "Method",
            options: [
              { value: "GET" },
              { value: "POST" },
              { value: "PUT" },
              { value: "DELETE" },
              { value: "PATCH" },
            ],
          },
          { widget: "template", key: "url", label: "URL" },
        ],
      },
      {
        title: "Headers",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "http_request") return null;
              return (
                <TemplateTextareaField
                  label="Headers (One per line, e.g., Authorization: Bearer token)"
                  value={
                    config.config.headers
                      ? config.config.headers.map((h) => `${h.name}: ${h.value}`).join("\n")
                      : ""
                  }
                  onChange={(val) => onChange(updateActionConfigField(config, "headers", val))}
                />
              );
            },
          },
        ],
      },
      {
        title: "Body",
        when: (v) =>
          ["POST", "PUT", "PATCH", "DELETE"].includes(v.method as string),
        fields: [
          {
            widget: "template",
            key: "content_type",
            label: "Content Type",
            placeholder: "application/json",
          },
          { widget: "textarea", key: "body", label: "Request Body" },
        ],
      },
      {
        title: "Execution",
        fields: [
          { widget: "numeric", key: "timeout_ms", label: "Timeout ms", min: 1 },
          { widget: "text", key: "output_name", label: "Output name" },
        ],
      },
    ],
  },
};
