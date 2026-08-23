import type { TypedFieldContext } from "./schema";
import type { ActionSchema, FieldDef } from "./schema";
import { updateActionConfigField } from "../workflowStepForm";
import { TemplateTextField } from "../../components/variables/TemplateTextField";
import { ElementTargetSourceFields } from "../../components/actionFields/ActionConfigElementSharedFields";

/** Shared "Capture target" section: element/XPath source picker. */
const captureTargetSection = {
  title: "Capture target",
  fields: [
    {
      widget: "custom",
      render: ({ config, onChange }: TypedFieldContext) => (
        <ElementTargetSourceFields config={config} onChange={onChange} />
      ),
    },
  ],
} satisfies ActionSchema["sections"][number];

const captureOutputSection = {
  title: "Capture output",
  fields: [{ widget: "text", key: "output_name", label: "Output name" }],
} satisfies ActionSchema["sections"][number];

/**
 * Text field whose value escapes literal newlines/tabs/backslashes, so a
 * multi-line separator can be entered as `\n` / `\t`.
 */
function escapedTextField(
  key: "separator" | "join_separator",
  label: string,
  fallback = "",
): FieldDef {
  return {
    widget: "custom",
    render: ({ config, onChange }: TypedFieldContext) => {
      const raw = (config.config as Record<string, unknown>)[key] as
        | string
        | undefined;
      return (
        <TemplateTextField
          label={label}
          value={formatSeparatorInput(raw ?? fallback)}
          onChange={(val) =>
            onChange(updateActionConfigField(config, key, parseSeparatorInput(val)))
          }
        />
      );
    },
  };
}

export const captureSchemas: Partial<Record<string, ActionSchema>> = {
  extract_text: {
    sections: [
      captureTargetSection,
      {
        title: "Formatting options",
        fields: [escapedTextField("separator", "Child separator")],
      },
      captureOutputSection,
    ],
  },
  extract_input_value: {
    sections: [captureTargetSection, captureOutputSection],
  },
  extract_table: {
    sections: [captureTargetSection, captureOutputSection],
  },
  extract_list: {
    sections: [
      captureTargetSection,
      {
        title: "Formatting options",
        fields: [
          escapedTextField("separator", "Child separator"),
          {
            widget: "switch",
            key: "join_list",
            label: "Join list into single string",
          },
          {
            ...escapedTextField("join_separator", "List join separator"),
            when: (v) => Boolean(v.join_list),
          },
        ],
      },
      captureOutputSection,
    ],
  },
  count_elements: {
    sections: [captureTargetSection, captureOutputSection],
  },
  extract_attribute: {
    sections: [
      captureTargetSection,
      captureOutputSection,
      {
        title: "Extraction attribute",
        fields: [{ widget: "template", key: "attribute", label: "Attribute" }],
      },
    ],
  },
  extract_regex_matches: {
    sections: [
      {
        title: "Regex source",
        fields: [
          { widget: "template", key: "source_name", label: "Source output" },
        ],
      },
      {
        title: "Regex pattern",
        fields: [
          { widget: "template", key: "pattern", label: "Pattern" },
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "extract_regex_matches") return null;
              return (
                <TemplateTextField
                  label="Flags"
                  value={config.config.flags ?? "g"}
                  onChange={(val) =>
                    onChange(updateActionConfigField(config, "flags", val))
                  }
                />
              );
            },
          },
        ],
      },
      {
        title: "Regex output",
        fields: [
          { widget: "text", key: "output_name", label: "Output name" },
          { widget: "switch", key: "append", label: "Append", defaultOn: true },
          { widget: "switch", key: "dedupe", label: "Dedupe", defaultOn: true },
        ],
      },
    ],
  },
  take_screenshot: {
    sections: [
      {
        title: "Screenshot artifact",
        fields: [
          { widget: "template", key: "path", label: "Path" },
          {
            widget: "select",
            key: "full_page",
            label: "Full page",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
        ],
      },
      {
        title: "Screenshot output",
        fields: [{ widget: "text", key: "output_name", label: "Output name" }],
      },
    ],
  },
  write_text_file: {
    sections: [
      {
        title: "Text source",
        fields: [
          { widget: "template", key: "source_name", label: "Source output" },
        ],
      },
      {
        title: "Text artifact",
        fields: [
          { widget: "template", key: "path", label: "Path" },
          escapedTextField("separator", "Separator", "\n"),
          {
            widget: "switch",
            key: "include_trailing_newline",
            label: "Trailing newline",
            defaultOn: true,
          },
        ],
      },
      {
        title: "Text file output",
        fields: [{ widget: "text", key: "output_name", label: "Output name" }],
      },
    ],
  },
  // get_current_url has no configurable fields (old component returned null).
};

function formatSeparatorInput(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

function parseSeparatorInput(value: string) {
  return value
    .replace(/\\\\/g, "\u0000")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\u0000/g, "\\");
}
