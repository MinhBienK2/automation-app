import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";
import {
  ElementTargetSourceFields,
  StructuredTargetFields,
} from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function FormActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "select_option":
      return (
        <>
          <ActionConfigFieldGroup title="Selection target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Option match">
            <Label>
              Match by
              <Select
                value={config.config.match_by}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "match_by", event.currentTarget.value))
                }
              >
                <option value="label">Label</option>
                <option value="value">Value</option>
              </Select>
            </Label>
            <Label>
              Value
              <Input
                value={config.config.value}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "value", event.currentTarget.value))
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "press_key":
      return (
        <Label>
          Key
          <Input
            value={config.config.key}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "key", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "hotkey":
      return (
        <Label>
          Keys
          <Input
            value={config.config.keys.join("+")}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "keys", event.currentTarget.value))
            }
            placeholder="Control+S"
          />
        </Label>
      );
    case "hover":
      return (
        <ActionConfigFieldGroup title="Element target">
          <ElementTargetSourceFields config={config} onChange={onChange} />
        </ActionConfigFieldGroup>
      );
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
      return (
        <ActionConfigFieldGroup title="Element target">
          <ElementTargetSourceFields config={config} onChange={onChange} />
        </ActionConfigFieldGroup>
      );
    case "drag_and_drop":
      return (
        <>
          <ActionConfigFieldGroup title="Drag source">
            <StructuredTargetFields
              config={config}
              onChange={onChange}
              targetField="source_target"
              labelPrefix="Source"
              showConstraints={false}
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Drop setup">
            <ActionConfigFieldGroup title="Drop target" nested>
              <StructuredTargetFields
                config={config}
                onChange={onChange}
                targetField="target_target"
                labelPrefix="Target"
                showConstraints={false}
              />
            </ActionConfigFieldGroup>
            <ActionConfigFieldGroup title="Drop point" nested>
              <DragTargetPositionFields config={config} onChange={onChange} />
            </ActionConfigFieldGroup>
          </ActionConfigFieldGroup>
        </>
      );
    case "type_sequence":
      return (
        <>
          <ActionConfigFieldGroup title="Typing target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Typed text">
            <Label>
              Text
              <Textarea
                value={config.config.text}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "text", event.currentTarget.value))
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "set_clipboard":
      return (
        <Label>
          Text
          <Textarea
            value={config.config.text}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "text", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "upload_file":
      return (
        <>
          <ActionConfigFieldGroup title="Upload target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="File list">
            <Label>
              Files
              <Textarea
                value={config.config.files.join("\n")}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "files", event.currentTarget.value))
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "submit_form":
      return (
        <ActionConfigFieldGroup title="Form target">
          <ElementTargetSourceFields config={config} onChange={onChange} />
        </ActionConfigFieldGroup>
      );
    case "select_custom_option":
      return (
        <>
          <ActionConfigFieldGroup title="Custom select trigger">
            <StructuredTargetFields
              config={config}
              onChange={onChange}
              targetField="trigger_target"
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Custom option">
            <Label>
              Option text
              <Input
                value={config.config.option_text}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "option_text", event.currentTarget.value),
                  )
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "set_contenteditable":
      return (
        <>
          <ActionConfigFieldGroup title="Editable target">
            <ElementTargetSourceFields config={config} onChange={onChange} />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Editable content">
            <Label>
              Text
              <Textarea
                value={config.config.text}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "text", event.currentTarget.value))
                }
              />
            </Label>
            <Label>
              Clear before input
              <Select
                value={String(config.config.clear_before_input)}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(
                      config,
                      "clear_before_input",
                      event.currentTarget.value,
                    ),
                  )
                }
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </>
      );


    default:
      return null;
  }
}
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
          <Label>
            X percent
            <Input
              type="number"
              min={0}
              max={100}
              value={position.x_percent}
              onChange={(event) =>
                updatePosition({
                  ...position,
                  x_percent: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label>
            Y percent
            <Input
              type="number"
              min={0}
              max={100}
              value={position.y_percent}
              onChange={(event) =>
                updatePosition({
                  ...position,
                  y_percent: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </>
      ) : null}

      {position.mode === "offset" ? (
        <>
          <Label>
            X offset px
            <Input
              type="number"
              value={position.x_px}
              onChange={(event) =>
                updatePosition({
                  ...position,
                  x_px: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label>
            Y offset px
            <Input
              type="number"
              value={position.y_px}
              onChange={(event) =>
                updatePosition({
                  ...position,
                  y_px: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </>
      ) : null}
    </>
  );
}
