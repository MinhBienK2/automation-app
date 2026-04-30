import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";

type ElementConfig = Extract<
  ActionConfig,
  {
    type:
      | "clear_input"
      | "set_checkbox"
      | "hover"
      | "select_option"
      | "double_click"
      | "right_click"
      | "drag_and_drop"
      | "focus_element"
      | "blur_element"
      | "type_sequence"
      | "paste_clipboard"
      | "check"
      | "uncheck"
      | "toggle_checkbox"
      | "select_radio"
      | "upload_file"
      | "submit_form"
      | "set_contenteditable";
  }
>;


export function ElementTargetFields({
  config,
  onChange,
}: {
  config: Extract<
    ActionConfig,
    {
      type:
        | "clear_input"
        | "set_checkbox"
        | "hover"
        | "double_click"
        | "right_click"
        | "focus_element"
        | "blur_element"
        | "paste_clipboard"
        | "check"
        | "uncheck"
        | "toggle_checkbox"
        | "select_radio";
    }
  >;
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
      <ElementOptionalFields config={config} onChange={onChange} />
    </>
  );
}

export function ElementOptionalFields({
  config,
  onChange,
}: {
  config: ElementConfig;
  onChange: (config: ActionConfig) => void;
}) {
  return (
    <>
      <Label>
        Iframe XPath
        <Input
          value={config.config.iframe_xpath ?? ""}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "iframe_xpath", event.currentTarget.value))
          }
          placeholder="Optional iframe XPath"
        />
      </Label>
      <Label>
        Wait until
        <Select
          value={config.config.wait_until ?? "clickable"}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "wait_until", event.currentTarget.value))
          }
        >
          <option value="clickable">Clickable</option>
          <option value="visible">Visible</option>
          <option value="enabled">Enabled</option>
          <option value="attached">Attached</option>
        </Select>
      </Label>
      <Label>
        Timeout ms
        <Input
          min="1"
          type="number"
          value={config.config.timeout_ms ?? 5000}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
          }
        />
      </Label>
    </>
  );
}

