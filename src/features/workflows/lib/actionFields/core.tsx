import type { ActionSchema } from "./schema";
import type { TypedFieldContext } from "./schema";
import { ElementTargetSourceFields } from "../../components/actionFields/ActionConfigElementSharedFields";

export const coreSchemas: Partial<Record<string, ActionSchema>> = {
  navigate: {
    sections: [
      {
        title: "Navigation target",
        fields: [{ widget: "template", key: "url", label: "URL" }],
      },
    ],
  },
  wait: {
    sections: [
      {
        title: "Wait condition",
        fields: [
          {
            widget: "select",
            key: "condition",
            label: "Condition",
            options: [
              { value: "duration" },
              { value: "element_visible" },
              { value: "element_hidden" },
              { value: "element_attached" },
              { value: "element_detached" },
              { value: "text_visible" },
              { value: "url_contains" },
              { value: "page_load" },
              { value: "element_enabled" },
              { value: "element_disabled" },
            ],
          },
        ],
      },
      {
        title: "Duration wait",
        when: (v) => v.condition === "duration",
        fields: [
          { widget: "numeric", key: "duration_ms", label: "Duration ms", min: 1 },
        ],
      },
      {
        title: "Element wait target",
        when: (v) => typeof v.condition === "string" && v.condition.startsWith("element_"),
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
        title: "Text wait",
        when: (v) => v.condition === "text_visible",
        fields: [{ widget: "template", key: "text", label: "Text" }],
      },
      {
        title: "URL wait",
        when: (v) => v.condition === "url_contains",
        fields: [{ widget: "template", key: "url", label: "URL contains" }],
      },
    ],
  },
  random_wait: {
    sections: [
      {
        title: "Wait range",
        fields: [
          { widget: "numeric", key: "min_ms", label: "Minimum wait ms", min: 1 },
          { widget: "numeric", key: "max_ms", label: "Maximum wait ms", min: 1 },
        ],
      },
    ],
  },
  input_text: {
    sections: [
      {
        title: "Fill target",
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
        title: "Text entry",
        fields: [{ widget: "textarea", key: "text", label: "Text" }],
      },
    ],
  },
};
