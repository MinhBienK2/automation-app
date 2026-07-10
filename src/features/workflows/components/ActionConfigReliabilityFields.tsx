import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Input } from "../../../components/ui/input";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { NetworkWaitFields } from "./ActionConfigNetworkFields";
import { TemplateTextField, TemplateTextareaField } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

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
          <ActionConfigFieldGroup title="Script body">
            <TemplateTextareaField
              label="Script"
              value={config.config.script}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "script", val))
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Script result">
            <Label>
              Output name
              <Input
                type="text"
                value={config.config.output_name ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "output_name", event.currentTarget.value))
                }
              />
            </Label>
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
    case "wait_for_request":
      return (
        <NetworkWaitFields config={config} onChange={onChange} includeStatus={false} />
      );
    case "wait_for_response":
      return <NetworkWaitFields config={config} onChange={onChange} includeStatus />;
    case "block_request":
      return (
        <ActionConfigFieldGroup title="Blocked URLs">
          <TemplateTextareaField
            label="URL patterns"
            value={config.config.url_patterns.join("\n")}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "url_patterns", val))
            }
          />
        </ActionConfigFieldGroup>
      );
    case "mock_response":
      return (
        <>
          <ActionConfigFieldGroup title="Request match">
            <TemplateTextField
              label="URL contains"
              value={config.config.url_contains}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "url_contains", val))
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Mock response">
            <VariableNumericInput
              label="Status"
              value={config.config.status}
              min={100}
              max={599}
              onChange={(nextVal) => {
                const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                  ? typeof nextVal === "string" && nextVal.startsWith("{{")
                    ? nextVal
                    : Number(nextVal)
                  : null;
                onChange(updateActionConfigField(config, "status", val));
              }}
            />
            <TemplateTextareaField
              label="Body"
              value={config.config.body}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "body", val))
              }
            />
            <TemplateTextField
              label="Content type"
              value={config.config.content_type ?? ""}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "content_type", val))
              }
            />
          </ActionConfigFieldGroup>
        </>
      );
    case "set_local_storage":
    case "set_session_storage":
      return (
        <ActionConfigFieldGroup title="Storage entry">
          <TemplateTextField
            label="Key"
            value={config.config.key}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "key", val))
            }
          />
          <TemplateTextareaField
            label="Value"
            value={config.config.value}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "value", val))
            }
          />
        </ActionConfigFieldGroup>
      );

    default:
      return null;
  }
}
