import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextField } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function BrowserActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "go_back":
    case "go_forward":
    case "reload":
      return null;
    case "open_new_tab":
      return (
        <ActionConfigFieldGroup title="Tab target">
          <TemplateTextField
            label="URL"
            value={config.config.url ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "url", val))
            }
            placeholder="Optional URL"
          />
        </ActionConfigFieldGroup>
      );
    case "switch_tab":
      return (
        <ActionConfigFieldGroup title="Tab selection">
          <VariableNumericInput
            label="Tab index"
            value={config.config.index}
            min={0}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "index", val));
            }}
          />
        </ActionConfigFieldGroup>
      );
    case "close_tab":
      return (
        <ActionConfigFieldGroup title="Tab selection">
          <VariableNumericInput
            label="Tab index"
            value={config.config.index}
            min={0}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "index", val));
            }}
            placeholder="Current tab"
          />
        </ActionConfigFieldGroup>
      );
    case "accept_dialog":
      return (
        <ActionConfigFieldGroup title="Dialog response">
          <TemplateTextField
            label="Prompt text"
            value={config.config.prompt_text ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "prompt_text", val))
            }
            placeholder="Optional prompt response"
          />
        </ActionConfigFieldGroup>
      );
    case "dismiss_dialog":
      return null;
    case "wait_for_download":
      return (
        <>
          <ActionConfigFieldGroup title="Download output">
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
          <ActionConfigFieldGroup title="Download wait">
            <VariableNumericInput
              label="Timeout ms"
              value={config.config.timeout_ms}
              min={1}
              onChange={(nextVal) => {
                const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                  ? typeof nextVal === "string" && nextVal.startsWith("{{")
                    ? nextVal
                    : Number(nextVal)
                  : null;
                onChange(updateActionConfigField(config, "timeout_ms", val));
              }}
            />
          </ActionConfigFieldGroup>
        </>
      );

    default:
      return null;
  }
}
