import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { updateActionConfigField } from "../workflowStepForm";
import { VariableNumericInput } from "../../components/variables/VariableNumericInput";
import {
  ElementTargetFields,
  ElementTargetSourceFields,
  StructuredTargetFields,
} from "../../components/actionFields/ActionConfigElementSharedFields";
import { numericOrTemplate } from "./coerce";
import type { TypedFieldContext } from "./schema";
import type { ActionSchema, FieldDef, SchemaSection } from "./schema";

const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;

export const elementTargetField: FieldDef = {
  widget: "custom",
  render: ({ config, onChange }: TypedFieldContext) => (
    <ElementTargetSourceFields config={config} onChange={onChange} />
  ),
};

export const elementTargetSection = (title: string): SchemaSection => ({
  title,
  fields: [elementTargetField],
});

const scrollModeField: FieldDef = {
  widget: "custom",
  render: ({ config, onChange }: TypedFieldContext) => {
    const values = config.config as Record<string, unknown>;
    return (
      <Label>
        Mode
        <Select
          value={(values.mode as string | undefined) ?? "page"}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "mode", event.currentTarget.value))
          }
        >
          <option value="page">Page Scroll</option>
          <option value="into_view">Scroll To Element</option>
          <option value="until_element_visible">Scroll Until Element Visible</option>
        </Select>
      </Label>
    );
  },
};

const scrollStyleField: FieldDef = {
  widget: "custom",
  render: ({ config, onChange }: TypedFieldContext) => {
    const values = config.config as Record<string, unknown>;
    return (
      <Label>
        Scroll style
        <Select
          value={(values.scroll_style as string | undefined) ?? "human_like"}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "scroll_style", event.currentTarget.value))
          }
        >
          <option value="human_like">Human-like</option>
          <option value="smooth_single">Smooth single wheel</option>
        </Select>
      </Label>
    );
  },
};

const scrollDirectionField: FieldDef = {
  widget: "custom",
  render: ({ config, onChange }: TypedFieldContext) => {
    const values = config.config as Record<string, unknown>;
    return (
      <Label>
        Direction
        <Select
          value={(values.direction as string | undefined) ?? "down"}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "direction", event.currentTarget.value))
          }
        >
          <option value="down">Down</option>
          <option value="up">Up</option>
          <option value="right">Right</option>
          <option value="left">Left</option>
        </Select>
      </Label>
    );
  },
};

const scrollTimeoutField: FieldDef = {
  widget: "custom",
  render: ({ config, onChange }: TypedFieldContext) => {
    if (config.type !== "scroll") return null;
    return (
      <VariableNumericInput
        label="Timeout ms"
        value={config.config.timeout_ms ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS}
        min={1}
        onChange={(nextVal) =>
          onChange(updateActionConfigField(config, "timeout_ms", numericOrTemplate(nextVal)))
        }
      />
    );
  },
};

const iframeXpathField: FieldDef = {
  widget: "template",
  key: "iframe_xpath",
  label: "Iframe XPath",
  placeholder: "Optional iframe XPath",
};

export const elementSchemas: Partial<Record<string, ActionSchema>> = {
  clear_input: { sections: [elementTargetSection("Element target")] },
  click: { sections: [elementTargetSection("Element target")] },
  open_link_in_new_tab: { sections: [elementTargetSection("Element target")] },
  hover: { sections: [elementTargetSection("Element target")] },
  double_click: { sections: [elementTargetSection("Element target")] },
  right_click: { sections: [elementTargetSection("Element target")] },
  focus_element: { sections: [elementTargetSection("Element target")] },
  blur_element: { sections: [elementTargetSection("Element target")] },
  paste_clipboard: { sections: [elementTargetSection("Element target")] },

  find_element: {
    sections: [
      {
        title: "Element search",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "find_element" ? (
                <ElementTargetFields config={config} onChange={onChange} />
              ) : null,
          },
        ],
      },
      {
        title: "Element result",
        fields: [{ widget: "text", key: "output_name", label: "Output name" }],
      },
      {
        title: "Match ranking",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "find_element") return null;
              return (
                <Label>
                  In viewport
                  <Select
                    value={config.config.filter?.in_viewport === false ? "false" : "true"}
                    onChange={(event) =>
                      onChange(
                        updateActionConfigField(config, "in_viewport", event.currentTarget.value),
                      )
                    }
                  >
                    <option value="true">Required</option>
                    <option value="false">Any matched element</option>
                  </Select>
                </Label>
              );
            },
          },
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "find_element") return null;
              return (
                <Label>
                  Rank
                  <Select
                    value={config.config.rank ?? "nearest_viewport_center"}
                    onChange={(event) =>
                      onChange(updateActionConfigField(config, "rank", event.currentTarget.value))
                    }
                  >
                    <option value="nearest_viewport_center">Nearest viewport center</option>
                    <option value="largest_visible_area">Largest visible area</option>
                    <option value="first">First match</option>
                  </Select>
                </Label>
              );
            },
          },
        ],
      },
    ],
  },

  scroll: {
    sections: [
      {
        title: "Scroll mode",
        fields: [scrollModeField],
      },
      {
        title: "Page scroll gesture",
        when: (v) => (v.mode ?? "page") === "page",
        fields: [
          scrollStyleField,
          scrollDirectionField,
          { widget: "numeric", key: "pixels", label: "Pixels", min: 1 },
        ],
      },
      {
        title: "Scroll target",
        when: (v) => v.mode === "into_view",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "scroll" ? (
                <ElementTargetSourceFields
                  config={config}
                  onChange={onChange}
                  showConstraints={false}
                />
              ) : null,
          },
          { ...iframeXpathField, when: (v) => v.target_ref == null },
          scrollTimeoutField,
        ],
      },
      {
        title: "Search target",
        when: (v) => v.mode === "until_element_visible",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "scroll" ? (
                <StructuredTargetFields
                  config={config}
                  onChange={onChange}
                  showConstraints={false}
                />
              ) : null,
          },
          iframeXpathField,
          scrollTimeoutField,
        ],
      },
      {
        title: "Search scroll gesture",
        when: (v) => v.mode === "until_element_visible",
        fields: [
          scrollDirectionField,
          { widget: "numeric", key: "pixels", label: "Pixels", min: 1 },
        ],
      },
    ],
  },
};
