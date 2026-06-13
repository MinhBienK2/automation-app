import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { TemplateTextField } from "./TemplateTextField";
import { Select } from "../../../components/ui/select";
import { SwitchField } from "../../../components/ui/switch";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetSourceFields } from "./ActionConfigElementSharedFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function CaptureActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return <DataCaptureFields config={config} onChange={onChange} />;
    case "extract_regex_matches":
      return (
        <>
          <ActionConfigFieldGroup title="Regex source">
            <TemplateTextField
              label="Source output"
              value={config.config.source_name}
              onChange={(val) =>
                onChange(
                  updateActionConfigField(config, "source_name", val),
                )
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Regex pattern">
            <TemplateTextField
              label="Pattern"
              value={config.config.pattern}
              onChange={(val) =>
                onChange(
                  updateActionConfigField(config, "pattern", val),
                )
              }
            />
            <TemplateTextField
              label="Flags"
              value={config.config.flags ?? "g"}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "flags", val))
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Regex output">
            <Label>
              Output name
              <Input
                value={config.config.output_name}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "output_name", event.currentTarget.value),
                  )
                }
              />
            </Label>
            <SwitchField
              checked={config.config.append !== false}
              label="Append"
              onCheckedChange={(checked) =>
                onChange(updateActionConfigField(config, "append", String(checked)))
              }
            />
            <SwitchField
              checked={config.config.dedupe !== false}
              label="Dedupe"
              onCheckedChange={(checked) =>
                onChange(updateActionConfigField(config, "dedupe", String(checked)))
              }
            />
          </ActionConfigFieldGroup>
        </>
      );
    case "extract_attribute":
      return (
        <>
          <DataCaptureFields config={config} onChange={onChange} />
          <ActionConfigFieldGroup title="Extraction attribute">
            <TemplateTextField
              label="Attribute"
              value={config.config.attribute}
              onChange={(val) =>
                onChange(
                  updateActionConfigField(config, "attribute", val),
                )
              }
            />
          </ActionConfigFieldGroup>
        </>
      );
    case "take_screenshot":
      return (
        <>
          <ActionConfigFieldGroup title="Screenshot artifact">
            <TemplateTextField
              label="Path"
              value={config.config.path}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "path", val))
              }
            />
            <Label>
              Full page
              <Select
                value={String(config.config.full_page)}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "full_page", event.currentTarget.value),
                  )
                }
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Screenshot output">
            <Label>
              Output name
              <Input
                value={config.config.output_name ?? ""}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "output_name", event.currentTarget.value),
                  )
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "write_text_file":
      return (
        <>
          <ActionConfigFieldGroup title="Text source">
            <TemplateTextField
              label="Source output"
              value={config.config.source_name}
              onChange={(val) =>
                onChange(
                  updateActionConfigField(config, "source_name", val),
                )
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Text artifact">
            <TemplateTextField
              label="Path"
              value={config.config.path}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "path", val))
              }
            />
            <TemplateTextField
              label="Separator"
              value={formatSeparatorInput(config.config.separator ?? "\n")}
              onChange={(val) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "separator",
                    parseSeparatorInput(val),
                  ),
                )
              }
            />
            <SwitchField
              checked={config.config.include_trailing_newline !== false}
              label="Trailing newline"
              onCheckedChange={(checked) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "include_trailing_newline",
                    String(checked),
                  ),
                )
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Text file output">
            <Label>
              Output name
              <Input
                value={config.config.output_name}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "output_name", event.currentTarget.value),
                  )
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );

    default:
      return null;
  }
}

type DataCaptureConfig = Extract<
  ActionConfig,
  {
    type:
      | "extract_text"
      | "extract_attribute"
      | "extract_input_value"
      | "extract_table"
      | "extract_list";
  }
>;


function DataCaptureFields({
  config,
  onChange,
}: {
  config: DataCaptureConfig;
  onChange: (config: ActionConfig) => void;
}) {
  return (
    <>
      <ActionConfigFieldGroup title="Capture target">
        <ElementTargetSourceFields config={config} onChange={onChange} />
      </ActionConfigFieldGroup>
      <ActionConfigFieldGroup title="Capture output">
        <Label>
          Output name
          <Input
            value={config.config.output_name}
            onChange={(event) =>
              onChange(
                updateActionConfigField(config, "output_name", event.currentTarget.value),
              )
            }
          />
        </Label>
      </ActionConfigFieldGroup>
    </>
  );
}

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
