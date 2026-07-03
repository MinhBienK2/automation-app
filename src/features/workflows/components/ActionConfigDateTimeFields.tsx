import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { TemplateTextField } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function DateTimeActionFields({ config, onChange }: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "date_time_operation":
      return (
        <>
          <Label>
            Operation
            <Select
              value={config.config.operation}
              onChange={(e) => onChange(updateActionConfigField(config, "operation", e.currentTarget.value))}
            >
              <option value="current_timestamp">Get Current Timestamp</option>
              <option value="format">Format Date</option>
              <option value="add_subtract">Add/Subtract Time</option>
              <option value="diff">Calculate Difference (Ms)</option>
            </Select>
          </Label>
          <TemplateTextField
            label="Base Date Value (Optional - defaults to Now)"
            value={config.config.value ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "value", val))}
          />
          {config.config.operation === "format" && (
            <TemplateTextField
              label="Format Pattern (e.g., YYYY-MM-DD HH:mm:ss)"
              value={config.config.format_pattern ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "format_pattern", val))}
            />
          )}
          {config.config.operation === "diff" && (
            <TemplateTextField
              label="Second Date Value"
              value={config.config.format_pattern ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "format_pattern", val))}
            />
          )}
          {config.config.operation === "add_subtract" && (
            <>
              <VariableNumericInput
                label="Offset Value (Positive to add, Negative to subtract)"
                value={config.config.offset_value}
                onChange={(nextVal) => {
                  const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                    ? typeof nextVal === "string" && nextVal.startsWith("{{")
                      ? nextVal
                      : Number(nextVal)
                    : null;
                  onChange(updateActionConfigField(config, "offset_value", val));
                }}
              />
              <Label>
                Offset Unit
                <Select
                  value={config.config.offset_unit ?? "days"}
                  onChange={(e) => onChange(updateActionConfigField(config, "offset_unit", e.currentTarget.value))}
                >
                  <option value="days">Days</option>
                  <option value="hours">Hours</option>
                  <option value="minutes">Minutes</option>
                </Select>
              </Label>
            </>
          )}
          <Label>
            Output name
            <Input
              value={config.config.output_name}
              onChange={(e) => onChange(updateActionConfigField(config, "output_name", e.currentTarget.value))}
            />
          </Label>
        </>
      );
    case "crypto_operation":
      return (
        <>
          <Label>
            Operation
            <Select
              value={config.config.operation}
              onChange={(e) => onChange(updateActionConfigField(config, "operation", e.currentTarget.value))}
            >
              <option value="md5">MD5 Hash</option>
              <option value="sha256">SHA-256 Hash</option>
              <option value="base64_encode">Base64 Encode</option>
              <option value="base64_decode">Base64 Decode</option>
            </Select>
          </Label>
          <TemplateTextField
            label="Value to process"
            value={config.config.value}
            onChange={(val) => onChange(updateActionConfigField(config, "value", val))}
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
    default:
      return null;
  }
}
