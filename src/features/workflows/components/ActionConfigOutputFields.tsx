import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function OutputActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "set_variable":
      return (
        <>
          <Label>
            Name
            <Input
              value={config.config.name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Value
            <Textarea
              value={config.config.value}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "value", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "assert_element":
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
            State
            <Select
              value={config.config.state}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "state", event.currentTarget.value))
              }
            >
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              <option value="attached">Attached</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </Select>
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
              value={config.config.timeout_ms ?? 3000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );
    case "assert_text":
      return (
        <>
          <Label>
            XPath
            <Input
              value={config.config.xpath ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
              placeholder="Blank checks whole page"
            />
          </Label>
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
            Match mode
            <Select
              value={config.config.match_mode}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "match_mode", event.currentTarget.value),
                )
              }
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
            </Select>
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 3000}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );

    default:
      return null;
  }
}
