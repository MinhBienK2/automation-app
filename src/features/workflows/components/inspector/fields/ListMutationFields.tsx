import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { SwitchField } from "../../../../../components/ui/switch";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../../variables/TemplateTextField";
import { objectConfig, stringConfig, arrayConfig } from "../../../lib/configUtils";

export function ListMutationFields({
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
    case "update_list_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "push") as
        | "push"
        | "unshift"
        | "push_unique"
        | "pop"
        | "shift"
        | "remove_by_index"
        | "remove_by_value"
        | "merge"
        | "merge_unique";
      const value = stringConfig(node.config, "value", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const index = stringConfig(node.config, "index", "");

      const showValue = ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(operation);
      const showValueType = showValue;
      const showIndex = operation === "remove_by_index";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update List Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. items"
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
                <option value="push">Push (Add to end)</option>
                <option value="unshift">Unshift (Add to start)</option>
                <option value="push_unique">Push Unique</option>
                <option value="pop">Pop (Remove from end)</option>
                <option value="shift">Shift (Remove from start)</option>
                <option value="remove_by_index">Remove by index</option>
                <option value="remove_by_value">Remove by value</option>
                <option value="merge">Merge</option>
                <option value="merge_unique">Merge Unique</option>
              </Select>
            </Label>
            {showValueType && (
              <Label>
                Value type
                <Select
                  value={value_type}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    updateConfig({
                      ...configObj,
                      value_type: event.currentTarget.value,
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </Select>
              </Label>
            )}
            {showValue && (
              <TemplateTextareaField
                label="Value"
                value={value}
                onChange={(val: string) => updateConfig({ ...configObj, value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
              />
            )}
            {showIndex && (
              <TemplateTextField
                label="Index (0-based number or variable)"
                value={index}
                onChange={(val: string) => updateConfig({ ...configObj, index: val })}
                placeholder="0"
                variableOptions={variableOptions}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "create_empty_list": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "empty_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Create Empty List Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "create_list_manual": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "my_list");
      const value_type = stringConfig(node.config, "value_type", "text");
      const items = arrayConfig(node.config, "items") || [];
      const itemsText = items.join("\n");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Create List Manual Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Item Value Type
              <Select
                value={value_type}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="List Items (One per line)"
              value={itemsText}
              onChange={(val: string) =>
                updateConfig({
                  ...configObj,
                  items: val.split("\n").filter(Boolean),
                })
              }
              placeholder="item1&#10;item2&#10;item3"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "split_text_to_list": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "split_list");
      const source_text = stringConfig(node.config, "source_text", "");
      const delimiter = stringConfig(node.config, "delimiter", ",");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Split Text to List Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Source text to split"
              value={source_text}
              onChange={(val: string) => updateConfig({ ...configObj, source_text: val })}
              placeholder="e.g. apple,banana,orange"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Delimiter"
              value={delimiter}
              onChange={(val: string) => updateConfig({ ...configObj, delimiter: val })}
              placeholder="e.g. ,"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "generate_number_range": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "range_list");
      const start = stringConfig(node.config, "start", "1");
      const end = stringConfig(node.config, "end", "10");
      const step = stringConfig(node.config, "step", "1");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Generate Number Range Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. range_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Start value"
              value={start}
              onChange={(val: string) => updateConfig({ ...configObj, start: val })}
              placeholder="1"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="End value (inclusive)"
              value={end}
              onChange={(val: string) => updateConfig({ ...configObj, end: val })}
              placeholder="10"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Step size"
              value={step}
              onChange={(val: string) => updateConfig({ ...configObj, step: val })}
              placeholder="1"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "add_to_list": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const position = stringConfig(node.config, "position", "end") as "end" | "start" | "unique_end";
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Add to List Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Add Position
              <Select
                value={position}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, position: event.currentTarget.value })}
              >
                <option value="end">End (Push)</option>
                <option value="start">Start (Unshift)</option>
                <option value="unique_end">End (Only if unique)</option>
              </Select>
            </Label>
            <Label>
              Value type
              <Select
                value={value_type}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="Value to add"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "remove_from_list_by_index": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const index = stringConfig(node.config, "index", "0");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Remove from List by Index Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Index (0-based number or variable)"
              value={index}
              onChange={(val: string) => updateConfig({ ...configObj, index: val })}
              placeholder="0"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "remove_from_list_by_value": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Remove from List by Value Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Value type
              <Select
                value={value_type}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="Value to match for removal"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "merge_lists": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value = stringConfig(node.config, "value", "");
      const unique = (configObj as any).unique || false;
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Merge Lists Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="List/Array to merge (variable template e.g. {{outputs.other_list}} or JSON array)"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="e.g. {{outputs.other_list}}"
              variableOptions={variableOptions}
            />
            <SwitchField
              label="Merge Unique items only"
              checked={unique}
              onCheckedChange={(val: boolean) => updateConfig({ ...configObj, unique: val })}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    default:
      return null;
  }
}
