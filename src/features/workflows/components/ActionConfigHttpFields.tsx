import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { TemplateTextField, TemplateTextareaField } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function HttpActionFields({ config, onChange }: ActionFieldsProps): ReactNode | null {
  if (config.type !== "http_request") return null;

  return (
    <>
      <Label>
        Method
        <Select
          value={config.config.method}
          onChange={(e) => onChange(updateActionConfigField(config, "method", e.currentTarget.value))}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </Select>
      </Label>
      <TemplateTextField
        label="URL"
        value={config.config.url}
        onChange={(val) => onChange(updateActionConfigField(config, "url", val))}
      />
      <TemplateTextareaField
        label="Headers (One per line, e.g., Authorization: Bearer token)"
        value={config.config.headers ? config.config.headers.map(h => `${h.name}: ${h.value}`).join("\n") : ""}
        onChange={(val) => onChange(updateActionConfigField(config, "headers", val))}
      />
      {["POST", "PUT", "PATCH", "DELETE"].includes(config.config.method) && (
        <>
          <TemplateTextField
            label="Content Type"
            placeholder="application/json"
            value={config.config.content_type ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "content_type", val))}
          />
          <TemplateTextareaField
            label="Request Body"
            value={config.config.body ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "body", val))}
          />
        </>
      )}
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
      <Label>
        Output name
        <Input
          value={config.config.output_name}
          onChange={(e) => onChange(updateActionConfigField(config, "output_name", e.currentTarget.value))}
        />
      </Label>
    </>
  );
}
