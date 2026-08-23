import type { ActionConfig } from "../../../../types/workflow";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { SegmentedControl } from "../../../../components/ui/segmented-control";
import { updateActionConfigField } from "../workflowStepForm";
import { TemplateTextField, TemplateTextareaField } from "../../components/variables/TemplateTextField";
import { VariableNumericInput } from "../../components/variables/VariableNumericInput";
import { ActionConfigFieldGroup } from "../../components/actionFields/ActionConfigFieldGroup";
import {
  ElementTargetFields,
  ElementTargetSourceFields,
  StructuredTargetFields,
} from "../../components/actionFields/ActionConfigElementSharedFields";
import type { TypedFieldContext } from "./schema";
import type { ActionSchema, FieldDef, SchemaSection } from "./schema";

const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;

const elementTargetField: FieldDef = {
  widget: "custom",
  render: ({ config, onChange }: TypedFieldContext) => (
    <ElementTargetSourceFields config={config} onChange={onChange} />
  ),
};

const elementTargetSection = (title: string): SchemaSection => ({
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

/** Coerce VariableNumericInput output to number | template | null (legacy semantics). */
function coerceNumeric(
  nextVal: string | number | null | undefined,
): number | string | null {
  return nextVal !== "" && nextVal !== null && nextVal !== undefined
    ? typeof nextVal === "string" && nextVal.startsWith("{{")
      ? nextVal
      : Number(nextVal)
    : null;
}

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
          onChange(updateActionConfigField(config, "timeout_ms", coerceNumeric(nextVal)))
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

function DragTargetPositionFields({
  config,
  onChange,
}: {
  config: Extract<ActionConfig, { type: "drag_and_drop" }>;
  onChange: (config: ActionConfig) => void;
}) {
  const position = config.config.target_position ?? { mode: "center" as const };

  const updatePosition = (
    targetPosition: NonNullable<typeof config.config.target_position>,
  ) => {
    onChange({
      type: "drag_and_drop",
      config: {
        ...config.config,
        target_position: targetPosition,
      },
    });
  };

  const numericOrNull = (nextVal: string | number | null | undefined): number | null => {
    const val = coerceNumeric(nextVal);
    return typeof val === "number" ? val : null;
  };

  return (
    <>
      <Label>
        Destination position
        <Select
          value={position.mode}
          onChange={(event) => {
            const mode = event.currentTarget.value;
            if (mode === "percent") {
              updatePosition({ mode: "percent", x_percent: 50, y_percent: 50 });
              return;
            }
            if (mode === "offset") {
              updatePosition({ mode: "offset", x_px: 0, y_px: 0 });
              return;
            }
            updatePosition({ mode: "center" });
          }}
        >
          <option value="center">Center of target</option>
          <option value="percent">Percent inside target</option>
          <option value="offset">Pixel offset inside target</option>
        </Select>
      </Label>

      {position.mode === "percent" ? (
        <>
          <VariableNumericInput
            label="X percent"
            min={0}
            max={100}
            value={position.x_percent}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                // Domain type is number; non-numeric input falls back like legacy coercion.
                x_percent: numericOrNull(nextVal) ?? position.x_percent,
              });
            }}
          />
          <VariableNumericInput
            label="Y percent"
            min={0}
            max={100}
            value={position.y_percent}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                // Domain type is number; non-numeric input falls back like legacy coercion.
                y_percent: numericOrNull(nextVal) ?? position.y_percent,
              });
            }}
          />
        </>
      ) : null}

      {position.mode === "offset" ? (
        <>
          <VariableNumericInput
            label="X offset px"
            value={position.x_px}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                // Domain type is number; non-numeric input falls back like legacy coercion.
                x_px: numericOrNull(nextVal) ?? position.x_px,
              });
            }}
          />
          <VariableNumericInput
            label="Y offset px"
            value={position.y_px}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                // Domain type is number; non-numeric input falls back like legacy coercion.
                y_px: numericOrNull(nextVal) ?? position.y_px,
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}

function DragEndpointSourceFields({
  config,
  onChange,
  refField,
  targetField,
  labelPrefix,
  selectionLabel,
  refLabel,
}: {
  config: Extract<ActionConfig, { type: "drag_and_drop" }>;
  onChange: (config: ActionConfig) => void;
  refField: "source_ref" | "target_ref";
  targetField: "source_target" | "target_target";
  labelPrefix: string;
  selectionLabel: string;
  refLabel: string;
}) {
  const rawConfig = config.config as Record<string, unknown>;
  const refValue = rawConfig[refField] as string | null | undefined;
  const targetSource = refValue != null ? "ref" : "locator";

  const updateRef = (nextValue: string | null) => {
    onChange({
      ...config,
      config: {
        ...config.config,
        [refField]: nextValue,
      },
    } as ActionConfig);
  };

  return (
    <>
      <div className="grid gap-1.5">
        <Label>{selectionLabel}</Label>
        <SegmentedControl
          ariaLabel={selectionLabel}
          value={targetSource}
          options={[
            { label: "Use locator", value: "locator" },
            { label: "Use Find Element ref", value: "ref" },
          ]}
          onValueChange={(value) => updateRef(value === "ref" ? (refValue ?? "") : null)}
        />
      </div>
      {targetSource === "ref" ? (
        <>
          <TemplateTextField
            label={refLabel}
            value={refValue ?? ""}
            onChange={(val) => updateRef(val)}
            placeholder="Output name from Find Element"
          />
          <p className="text-xs leading-5 text-[var(--app-text-muted)]">
            This endpoint uses the element resolved by a previous Find Element node in this run.
          </p>
        </>
      ) : (
        <StructuredTargetFields
          config={config}
          onChange={onChange}
          targetField={targetField}
          labelPrefix={labelPrefix}
          showConstraints={false}
        />
      )}
    </>
  );
}

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
  check: { sections: [elementTargetSection("Element target")] },
  uncheck: { sections: [elementTargetSection("Element target")] },
  toggle_checkbox: { sections: [elementTargetSection("Element target")] },
  select_radio: { sections: [elementTargetSection("Element target")] },
  submit_form: { sections: [elementTargetSection("Form target")] },

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

  drag_and_drop: {
    sections: [
      {
        title: "Drag source",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "drag_and_drop" ? (
                <DragEndpointSourceFields
                  config={config}
                  onChange={onChange}
                  refField="source_ref"
                  targetField="source_target"
                  labelPrefix="Source"
                  selectionLabel="Source selection"
                  refLabel="Source ref"
                />
              ) : null,
          },
        ],
      },
      {
        title: "Drop setup",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "drag_and_drop" ? (
                <>
                  <ActionConfigFieldGroup title="Drop target" nested>
                    <DragEndpointSourceFields
                      config={config}
                      onChange={onChange}
                      refField="target_ref"
                      targetField="target_target"
                      labelPrefix="Target"
                      selectionLabel="Drop target source"
                      refLabel="Drop target ref"
                    />
                  </ActionConfigFieldGroup>
                  <ActionConfigFieldGroup title="Drop point" nested>
                    <DragTargetPositionFields config={config} onChange={onChange} />
                  </ActionConfigFieldGroup>
                </>
              ) : null,
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
