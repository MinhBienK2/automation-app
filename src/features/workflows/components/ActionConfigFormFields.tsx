import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementOptionalFields, ElementTargetFields } from "./ActionConfigElementSharedFields";

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
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "set_checkbox":
      return (
        <>
          <ElementTargetFields config={config} onChange={onChange} />
          <Label>
            State
            <Select
              value={config.config.state}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "state", event.currentTarget.value))
              }
            >
              <option value="checked">Checked</option>
              <option value="unchecked">Unchecked</option>
            </Select>
          </Label>
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
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "drag_and_drop":
      return (
        <>
          <Label>
            Source XPath
            <Input
              value={config.config.source_xpath}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "source_xpath",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <Label>
            Target XPath
            <Input
              value={config.config.target_xpath}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "target_xpath",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "type_sequence":
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
            Text
            <Textarea
              value={config.config.text}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "text", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="1"
              type="number"
              value={config.config.delay_ms ?? 1}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "delay_ms", event.currentTarget.value))
              }
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
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
            Files
            <Textarea
              value={config.config.files.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "files", event.currentTarget.value))
              }
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "submit_form":
      return (
        <>
          <Label>
            XPath
            <Input
              value={config.config.xpath ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
              }
              placeholder="Optional form or field XPath"
            />
          </Label>
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );
    case "select_custom_option":
      return (
        <>
          <Label>
            Trigger XPath
            <Input
              value={config.config.trigger_xpath}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(
                    config,
                    "trigger_xpath",
                    event.currentTarget.value,
                  ),
                )
              }
            />
          </Label>
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
    case "set_contenteditable":
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
          <ElementOptionalFields config={config} onChange={onChange} />
        </>
      );


    default:
      return null;
  }
}
