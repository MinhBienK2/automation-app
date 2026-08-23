import { updateActionConfigField } from "../workflowStepForm";
import { TemplateTextField } from "../../components/variables/TemplateTextField";
import type { TypedFieldContext } from "./schema";
import type { ActionSchema } from "./schema";
import { elementTargetSection } from "./element";

export const keyboardSchemas: Partial<Record<string, ActionSchema>> = {
  press_key: {
    sections: [
      {
        title: "Key",
        fields: [{ widget: "template", key: "key", label: "Key" }],
      },
    ],
  },

  hotkey: {
    sections: [
      {
        title: "Keys",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "hotkey") return null;
              return (
                <TemplateTextField
                  label="Keys"
                  value={config.config.keys.join("+")}
                  onChange={(val) => onChange(updateActionConfigField(config, "keys", val))}
                  placeholder="Control+S"
                />
              );
            },
          },
        ],
      },
    ],
  },

  type_sequence: {
    sections: [
      elementTargetSection("Typing target"),
      {
        title: "Typed text",
        fields: [{ widget: "textarea", key: "text", label: "Text" }],
      },
    ],
  },

  set_clipboard: {
    sections: [
      {
        title: "Clipboard content",
        fields: [{ widget: "textarea", key: "text", label: "Text" }],
      },
    ],
  },
};
