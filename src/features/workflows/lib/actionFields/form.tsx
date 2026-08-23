import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { updateActionConfigField } from "../workflowStepForm";
import { TemplateTextareaField } from "../../components/variables/TemplateTextField";
import { ElementTargetSourceFields } from "../../components/actionFields/ActionConfigElementSharedFields";
import type { TypedFieldContext } from "./schema";
import type { ActionSchema } from "./schema";
import { elementTargetSection } from "./element";

export const formSchemas: Partial<Record<string, ActionSchema>> = {
  check: { sections: [elementTargetSection("Element target")] },
  uncheck: { sections: [elementTargetSection("Element target")] },
  toggle_checkbox: { sections: [elementTargetSection("Element target")] },
  select_radio: { sections: [elementTargetSection("Element target")] },
  submit_form: { sections: [elementTargetSection("Form target")] },

  select_option: {
    sections: [
      elementTargetSection("Selection target"),
      {
        title: "Option match",
        fields: [
          {
            widget: "select",
            key: "match_by",
            label: "Match by",
            options: [
              { value: "label", label: "Label" },
              { value: "value", label: "Value" },
            ],
          },
          { widget: "template", key: "value", label: "Value" },
        ],
      },
    ],
  },

  upload_file: {
    sections: [
      elementTargetSection("Upload target"),
      {
        title: "File list",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "upload_file") return null;
              return (
                <TemplateTextareaField
                  label="Files"
                  value={config.config.files.join("\n")}
                  onChange={(val) => onChange(updateActionConfigField(config, "files", val))}
                />
              );
            },
          },
        ],
      },
    ],
  },

  select_custom_option: {
    sections: [
      {
        title: "Custom select trigger",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => (
              <ElementTargetSourceFields
                config={config}
                onChange={onChange}
                targetField="trigger_target"
                refField="trigger_ref"
                labelPrefix="Trigger"
                sourceLabel="Trigger source"
                refLabel="Trigger ref"
                description="This action opens the custom select with the element resolved by a previous Find Element node."
              />
            ),
          },
        ],
      },
      {
        title: "Custom option",
        fields: [{ widget: "template", key: "option_text", label: "Option text" }],
      },
    ],
  },

  set_contenteditable: {
    sections: [
      elementTargetSection("Editable target"),
      {
        title: "Editable content",
        fields: [
          { widget: "textarea", key: "text", label: "Text" },
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "set_contenteditable") return null;
              return (
                <Label>
                  Clear before input
                  <Select
                    value={String(config.config.clear_before_input)}
                    onChange={(event) =>
                      onChange(
                        updateActionConfigField(config, "clear_before_input", event.currentTarget.value),
                      )
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </Select>
                </Label>
              );
            },
          },
        ],
      },
    ],
  },
};
