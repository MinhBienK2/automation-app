import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../../variables/TemplateTextField";
import { objectConfig, stringConfig } from "../../../lib/configUtils";

export function ListConditionFields({
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
    case "check_list_empty": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "is_empty");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check List Empty Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. is_empty"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_list_contains": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      const output_name = stringConfig(node.config, "output_name", "contains_item");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check List Contains Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
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
              label="Value to check"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. contains_item"
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
