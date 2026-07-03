import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { SwitchField } from "../../../components/ui/switch";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { TemplateTextField } from "./TemplateTextField";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function FileActionFields({ config, onChange }: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "read_text_file":
      return (
        <>
          <TemplateTextField
            label="File path"
            value={config.config.path}
            onChange={(val) => onChange(updateActionConfigField(config, "path", val))}
          />
          <Label>
            Encoding
            <Select
              value={config.config.encoding ?? "utf-8"}
              onChange={(e) => onChange(updateActionConfigField(config, "encoding", e.currentTarget.value))}
            >
              <option value="utf-8">UTF-8 (Text)</option>
              <option value="base64">Base64</option>
            </Select>
          </Label>
          <Label>
            Output name
            <Input
              value={config.config.output_name}
              onChange={(e) => onChange(updateActionConfigField(config, "output_name", e.currentTarget.value))}
            />
          </Label>
        </>
      );
    case "parse_csv_excel":
      return (
        <>
          <TemplateTextField
            label="CSV File path"
            value={config.config.path}
            onChange={(val) => onChange(updateActionConfigField(config, "path", val))}
          />
          <TemplateTextField
            label="Delimiter"
            placeholder=","
            value={config.config.delimiter ?? ""}
            onChange={(val) => onChange(updateActionConfigField(config, "delimiter", val))}
          />
          <SwitchField
            checked={config.config.has_headers}
            label="Has headers (Use first row as keys)"
            onCheckedChange={(checked) => onChange(updateActionConfigField(config, "has_headers", String(checked)))}
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
    case "write_csv_excel":
      return (
        <>
          <TemplateTextField
            label="Output File path"
            value={config.config.path}
            onChange={(val) => onChange(updateActionConfigField(config, "path", val))}
          />
          <TemplateTextField
            label="Source Variable Name"
            value={config.config.source_name}
            onChange={(val) => onChange(updateActionConfigField(config, "source_name", val))}
          />
          <Label>
            Mode
            <Select
              value={config.config.mode}
              onChange={(e) => onChange(updateActionConfigField(config, "mode", e.currentTarget.value))}
            >
              <option value="overwrite">Overwrite</option>
              <option value="append">Append</option>
            </Select>
          </Label>
          <SwitchField
            checked={config.config.has_headers}
            label="Include headers"
            onCheckedChange={(checked) => onChange(updateActionConfigField(config, "has_headers", String(checked)))}
          />
        </>
      );
    case "file_operation":
      return (
        <>
          <Label>
            Operation
            <Select
              value={config.config.operation}
              onChange={(e) => onChange(updateActionConfigField(config, "operation", e.currentTarget.value))}
            >
              <option value="exists">Check Exists</option>
              <option value="delete">Delete File</option>
              <option value="rename">Rename File</option>
              <option value="move">Move File</option>
            </Select>
          </Label>
          <TemplateTextField
            label="Source path"
            value={config.config.path}
            onChange={(val) => onChange(updateActionConfigField(config, "path", val))}
          />
          {["rename", "move"].includes(config.config.operation) && (
            <TemplateTextField
              label="Target path"
              value={config.config.target_path ?? ""}
              onChange={(val) => onChange(updateActionConfigField(config, "target_path", val))}
            />
          )}
          {["exists", "rename", "move"].includes(config.config.operation) && (
            <Label>
              Output name (Optional)
              <Input
                value={config.config.output_name ?? ""}
                onChange={(e) => onChange(updateActionConfigField(config, "output_name", e.currentTarget.value))}
              />
            </Label>
          )}
        </>
      );
    default:
      return null;
  }
}
