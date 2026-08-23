import type { ActionConfig } from "../../../../types/workflow";
import { updateActionConfigField } from "../../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextField } from "../variables/TemplateTextField";
import { VariableNumericInput } from "../variables/VariableNumericInput";

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
      <TemplateTextField
        label="URL contains"
        value={config.config.url_contains}
        onChange={(val) =>
          onChange(updateActionConfigField(config, "url_contains", val))
        }
      />
      {includeStatus && config.type === "wait_for_response" ? (
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
      ) : null}
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
  );
}
