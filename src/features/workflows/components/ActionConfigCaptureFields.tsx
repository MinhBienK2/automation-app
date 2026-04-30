import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";

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
    case "extract_attribute":
      return (
        <>
          <DataCaptureFields config={config} onChange={onChange} />
          <Label>
            Attribute
            <Input
              value={config.config.attribute}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "attribute", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "take_screenshot":
      return (
        <>
          <Label>
            Path
            <Input
              value={config.config.path}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "path", event.currentTarget.value))
              }
            />
          </Label>
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
      <Label>
        XPath
        <Input
          value={config.config.xpath}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
          }
        />
      </Label>
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
      <Label>
        Iframe XPath
        <Input
          value={config.config.iframe_xpath ?? ""}
          onChange={(event) =>
            onChange(
              updateActionConfigField(config, "iframe_xpath", event.currentTarget.value),
            )
          }
          placeholder="Optional iframe XPath"
        />
      </Label>
      <Label>
        Timeout ms
        <Input
          min="1"
          type="number"
          value={config.config.timeout_ms ?? 5000}
          onChange={(event) =>
            onChange(
              updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
            )
          }
        />
      </Label>
    </>
  );
}
