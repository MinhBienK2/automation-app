import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../../variables/TemplateTextField";
import { objectConfig, stringConfig } from "../../../lib/configUtils";

export function TextNodeFields({
  node,
  onChange,
  variableOptions,
}: {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
}) {
  const updateConfig = (config: unknown) => {
    onChange({ ...node, config });
  };

  switch (node.node_type) {
    case "update_text_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "append") as
        | "append"
        | "prepend"
        | "replace"
        | "uppercase"
        | "lowercase"
        | "trim";
      const value = stringConfig(node.config, "value", "");
      const search_pattern = stringConfig(node.config, "search_pattern", "");

      const showValue = ["append", "prepend", "replace"].includes(operation);
      const showSearch = operation === "replace";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Text Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. message"
              variableOptions={variableOptions}
            />
            <Label>
              Operation
              <Select
                value={operation}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="append">Append</option>
                <option value="prepend">Prepend</option>
                <option value="replace">Replace</option>
                <option value="uppercase">To Uppercase</option>
                <option value="lowercase">To Lowercase</option>
                <option value="trim">Trim Whitespace</option>
              </Select>
            </Label>
            {showSearch && (
              <TemplateTextField
                label="Search pattern (string or /regex/)"
                value={search_pattern}
                onChange={(val: string) => updateConfig({ ...configObj, search_pattern: val })}
                placeholder="pattern"
                variableOptions={variableOptions}
              />
            )}
            {showValue && (
              <TemplateTextareaField
                label="Replacement / Value"
                value={value}
                onChange={(val: string) => updateConfig({ ...configObj, value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "set_text_variable": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "my_text");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Set Text Variable Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. message"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Value"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Text value (supports {{variable}})"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "append_text": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Append Text Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="Variable to append to"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Text to append"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Text to append (supports {{variable}})"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "prepend_text": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Prepend Text Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="Variable to prepend to"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Text to prepend"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Text to prepend (supports {{variable}})"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "replace_text": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const search_pattern = stringConfig(node.config, "search_pattern", "");
      const replacement = stringConfig(node.config, "replacement", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Replace Text Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="Variable to update"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Search pattern (string or /regex/)"
              value={search_pattern}
              onChange={(val: string) => updateConfig({ ...configObj, search_pattern: val })}
              placeholder="e.g. search string or /regex/gi"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Replacement text"
              value={replacement}
              onChange={(val: string) => updateConfig({ ...configObj, replacement: val })}
              placeholder="Replacement text"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "trim_text": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Trim Text Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="Variable to trim whitespace from"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "change_text_case": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const to_case = stringConfig(node.config, "to_case", "upper") as "upper" | "lower";
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Change Text Case Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="Variable to update"
              variableOptions={variableOptions}
            />
            <Label>
              Case target
              <Select
                value={to_case}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    to_case: event.currentTarget.value,
                  })
                }
              >
                <option value="upper">To Uppercase</option>
                <option value="lower">To Lowercase</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "slice_text": {
      const configObj = objectConfig(node.config);
      const configRecord = (node.config || {}) as Record<string, any>;
      const source = stringConfig(node.config, "source", "");
      const start = configRecord.start !== undefined ? String(configRecord.start) : "0";
      const end = configRecord.end !== undefined && configRecord.end !== null ? String(configRecord.end) : "";
      const output_name = stringConfig(node.config, "output_name", "sliced_text");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Slice Text Settings">
            <TemplateTextField
              label="Source variable"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="Variable to slice"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Start index"
              value={start}
              onChange={(val: string) => updateConfig({ ...configObj, start: val ? (isNaN(Number(val)) ? val : Number(val)) : 0 })}
              placeholder="0 (start position)"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="End index"
              value={end}
              onChange={(val: string) => updateConfig({ ...configObj, end: val ? (isNaN(Number(val)) ? val : Number(val)) : null })}
              placeholder="Optional end position"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "regex_extract": {
      const configObj = objectConfig(node.config);
      const configRecord = (node.config || {}) as Record<string, any>;
      const source = stringConfig(node.config, "source", "");
      const pattern = stringConfig(node.config, "pattern", "");
      const group_index = configRecord.group_index !== undefined ? String(configRecord.group_index) : "1";
      const output_name = stringConfig(node.config, "output_name", "extracted_text");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Regex Extract Settings">
            <TemplateTextField
              label="Source variable"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="Source text variable"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Regex pattern"
              value={pattern}
              onChange={(val: string) => updateConfig({ ...configObj, pattern: val })}
              placeholder="e.g. ID: (\d+)"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Capture group index"
              value={group_index}
              onChange={(val: string) => updateConfig({ ...configObj, group_index: val ? (isNaN(Number(val)) ? val : Number(val)) : 1 })}
              placeholder="1"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_text_length": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "text_length");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get Text Length Settings">
            <TemplateTextField
              label="Source variable"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="Source text variable"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_text_empty": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "is_empty");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Text Empty Settings">
            <TemplateTextField
              label="Source variable"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="Source text variable"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable (boolean)"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_text_contains": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const substring = stringConfig(node.config, "substring", "");
      const output_name = stringConfig(node.config, "output_name", "contains_text");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Text Contains Settings">
            <TemplateTextField
              label="Source variable"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="Source text variable"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Substring to search"
              value={substring}
              onChange={(val: string) => updateConfig({ ...configObj, substring: val })}
              placeholder="Text to search for"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable (boolean)"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_text_regex_matches": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const pattern = stringConfig(node.config, "pattern", "");
      const output_name = stringConfig(node.config, "output_name", "matches_regex");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Text Regex Matches Settings">
            <TemplateTextField
              label="Source variable"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="Source text variable"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Regex pattern"
              value={pattern}
              onChange={(val: string) => updateConfig({ ...configObj, pattern: val })}
              placeholder="e.g. ^[A-Za-z]+$"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable (boolean)"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    default:
      return null;
  }
}
