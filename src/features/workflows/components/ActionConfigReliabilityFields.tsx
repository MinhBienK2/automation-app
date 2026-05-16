import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { NetworkWaitFields } from "./ActionConfigNetworkFields";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function ReliabilityActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "execute_js":
      return (
        <>
          <Label>
            Script
            <Textarea
              value={config.config.script}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "script", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Output name
            <Input
              value={config.config.output_name ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "output_name", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Timeout ms
            <Input
              min="1"
              type="number"
              value={config.config.timeout_ms ?? 1000}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "wait_for_request":
      return (
        <NetworkWaitFields config={config} onChange={onChange} includeStatus={false} />
      );
    case "wait_for_response":
      return <NetworkWaitFields config={config} onChange={onChange} includeStatus />;
    case "block_request":
      return (
        <Label>
          URL patterns
          <Textarea
            value={config.config.url_patterns.join("\n")}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "url_patterns", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "mock_response":
      return (
        <>
          <Label>
            URL contains
            <Input
              value={config.config.url_contains}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "url_contains", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Status
            <Input
              min="100"
              max="599"
              type="number"
              value={config.config.status}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "status", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Body
            <Textarea
              value={config.config.body}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "body", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Content type
            <Input
              value={config.config.content_type ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "content_type", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "set_local_storage":
    case "set_session_storage":
      return (
        <>
          <Label>
            Key
            <Input
              value={config.config.key}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "key", event.currentTarget.value))
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

    default:
      return null;
  }
}
