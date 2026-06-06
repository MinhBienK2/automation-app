import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";

export function NetworkWaitFields({
  config,
  onChange,
  includeStatus,
}: {
  config: Extract<ActionConfig, { type: "wait_for_request" | "wait_for_response" }>;
  onChange: (config: ActionConfig) => void;
  includeStatus: boolean;
}) {
  return (
    <ActionConfigFieldGroup title="Network match">
      <Label>
        URL contains
        <Input
          value={config.config.url_contains}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "url_contains", event.currentTarget.value))
          }
        />
      </Label>
      {includeStatus && config.type === "wait_for_response" ? (
        <Label>
          Status
          <Input
            min="100"
            max="599"
            type="number"
            value={config.config.status ?? ""}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "status", event.currentTarget.value))
            }
          />
        </Label>
      ) : null}
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
    </ActionConfigFieldGroup>
  );
}
