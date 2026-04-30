import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { updateActionConfigField } from "../lib/workflowStepForm";

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
      );
    case "switch_tab":
      return (
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
      );
    case "close_tab":
      return (
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
      );
    case "switch_frame":
      return (
        <Label>
          XPath
          <Input
            value={config.config.xpath ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "xpath", event.currentTarget.value))
            }
            placeholder="Blank uses top frame"
          />
        </Label>
      );
    case "accept_dialog":
      return (
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
      );
    case "dismiss_dialog":
      return null;
    case "set_download_directory":
      return (
        <Label>
          Path
          <Input
            value={config.config.path}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "path", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "wait_for_download":
      return (
        <>
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
        </>
      );

    default:
      return null;
  }
}
