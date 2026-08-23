import type { ActionSchema } from "./schema";

export const fileSchemas: Partial<Record<string, ActionSchema>> = {
  read_text_file: {
    sections: [
      {
        title: "File",
        fields: [
          { widget: "template", key: "path", label: "File path" },
          {
            widget: "select",
            key: "encoding",
            label: "Encoding",
            options: [{ value: "utf-8", label: "UTF-8 (Text)" }, { value: "base64" }],
          },
          { widget: "text", key: "output_name", label: "Output name" },
        ],
      },
    ],
  },
  parse_csv_excel: {
    sections: [
      {
        title: "CSV source",
        fields: [
          { widget: "template", key: "path", label: "CSV File path" },
          { widget: "template", key: "delimiter", label: "Delimiter", placeholder: "," },
          {
            widget: "switch",
            key: "has_headers",
            label: "Has headers (Use first row as keys)",
          },
          { widget: "text", key: "output_name", label: "Output name" },
        ],
      },
    ],
  },
  write_csv_excel: {
    sections: [
      {
        title: "CSV output",
        fields: [
          { widget: "template", key: "path", label: "Output File path" },
          { widget: "template", key: "source_name", label: "Source Variable Name" },
          {
            widget: "select",
            key: "mode",
            label: "Mode",
            options: [{ value: "overwrite", label: "Overwrite" }, { value: "append", label: "Append" }],
          },
          {
            widget: "switch",
            key: "has_headers",
            label: "Include headers",
          },
        ],
      },
    ],
  },
  file_operation: {
    sections: [
      {
        title: "Operation",
        fields: [
          {
            widget: "select",
            key: "operation",
            label: "Operation",
            options: [
              { value: "exists", label: "Check Exists" },
              { value: "delete", label: "Delete File" },
              { value: "rename", label: "Rename File" },
              { value: "move", label: "Move File" },
            ],
          },
          { widget: "template", key: "path", label: "Source path" },
          {
            widget: "template",
            key: "target_path",
            label: "Target path",
            when: (v) => v.operation === "rename" || v.operation === "move",
          },
          {
            widget: "text",
            key: "output_name",
            label: "Output name (Optional)",
            when: (v) =>
              v.operation === "exists" || v.operation === "rename" || v.operation === "move",
          },
        ],
      },
    ],
  },
};
