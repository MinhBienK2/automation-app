import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";

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
          <Label>
            URL
            <Input
              value={config.config.url ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "url", event.currentTarget.value))
              }
              placeholder="Optional URL"
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "switch_tab":
      return (
        <ActionConfigFieldGroup title="Tab selection">
          <Label>
            Tab index
            <Input
              min="0"
              type="number"
              value={config.config.index}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "index", event.currentTarget.value))
              }
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "close_tab":
      return (
        <ActionConfigFieldGroup title="Tab selection">
          <Label>
            Tab index
            <Input
              min="0"
              type="number"
              value={config.config.index ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "index", event.currentTarget.value))
              }
              placeholder="Current tab"
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "accept_dialog":
      return (
        <ActionConfigFieldGroup title="Dialog response">
          <Label>
            Prompt text
            <Input
              value={config.config.prompt_text ?? ""}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "prompt_text", event.currentTarget.value),
                )
              }
              placeholder="Optional prompt response"
            />
          </Label>
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
            <Label>
              Timeout ms
              <Input
                min="1"
                type="number"
                value={config.config.timeout_ms ?? 30000}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(config, "timeout_ms", event.currentTarget.value),
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
