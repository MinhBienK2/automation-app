import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../../variables/TemplateTextField";
import { objectConfig, stringConfig } from "../../../lib/configUtils";

export function ListProcessingFields({
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
    case "get_list_item": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const position = stringConfig(node.config, "position", "first") as "first" | "last" | "index";
      const index = stringConfig(node.config, "index", "");
      const output_name = stringConfig(node.config, "output_name", "list_item");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get List Item Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Position
              <Select
                value={position}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, position: event.currentTarget.value })}
              >
                <option value="first">First item</option>
                <option value="last">Last item</option>
                <option value="index">Specific Index</option>
              </Select>
            </Label>
            {position === "index" && (
              <TemplateTextField
                label="Index (0-based number or variable)"
                value={index}
                onChange={(val: string) => updateConfig({ ...configObj, index: val })}
                placeholder="0"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. selected_item"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_list_length": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "list_length");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get List Length Settings">
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
              placeholder="e.g. list_size"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "slice_list": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const start = stringConfig(node.config, "start", "0");
      const end = stringConfig(node.config, "end", "");
      const output_name = stringConfig(node.config, "output_name", "sliced_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Slice List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Start index (0-based)"
              value={start}
              onChange={(val: string) => updateConfig({ ...configObj, start: val })}
              placeholder="0"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="End index (optional, exclusive)"
              value={end}
              onChange={(val: string) => updateConfig({ ...configObj, end: val })}
              placeholder="e.g. 5"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. sub_list"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "join_list": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const separator = stringConfig(node.config, "separator", ", ");
      const output_name = stringConfig(node.config, "output_name", "joined_string");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Join List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Separator text"
              value={separator}
              onChange={(val: string) => updateConfig({ ...configObj, separator: val })}
              placeholder="e.g. , "
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. csv_text"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "filter_list":
    case "check_list_any_match":
    case "check_list_all_match": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", node.node_type === "filter_list" ? "filtered_list" : "has_match");
      const rulesGroup = (configObj.rules_group as any) || { operator: "and", rules: [] };
      const rules = (rulesGroup.rules as any[]) || [];

      const handleAddRule = () => {
        const nextRules = [
          ...rules,
          {
            type: "value_compare" as const,
            left_operand: "{{item}}",
            comparison: "equals" as const,
            right_operand: "",
          },
        ];
        updateConfig({
          ...configObj,
          rules_group: {
            ...rulesGroup,
            operator: rulesGroup.operator || "and",
            rules: nextRules,
          },
        });
      };

      const handleRemoveRule = (index: number) => {
        const nextRules = rules.filter((_, i) => i !== index);
        updateConfig({
          ...configObj,
          rules_group: {
            ...rulesGroup,
            rules: nextRules,
          },
        });
      };

      const handleUpdateRule = (index: number, nextRule: any) => {
        const nextRules = [...rules];
        nextRules[index] = {
          ...nextRules[index],
          ...nextRule,
        };
        updateConfig({
          ...configObj,
          rules_group: {
            ...rulesGroup,
            rules: nextRules,
          },
        });
      };

      return (
        <div className="graph-config-fields space-y-4">
          <ActionConfigFieldGroup title={`${node.node_type === "filter_list" ? "Filter List" : "List Match"} Settings`}>
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
              placeholder="e.g. result"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>

          <ActionConfigFieldGroup title="Filter Rules (Evaluated for each element 'item')">
            <Label>
              Combine Operator
              <Select
                value={rulesGroup.operator || "and"}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    rules_group: {
                      ...rulesGroup,
                      operator: event.currentTarget.value as "and" | "or",
                    },
                  })
                }
              >
                <option value="and">All rules must match (AND)</option>
                <option value="or">Any rule can match (OR)</option>
              </Select>
            </Label>

            <div className="space-y-4 mt-3">
              {rules.map((rule, idx) => (
                <div key={idx} className="p-3 border border-border rounded-lg space-y-2 relative bg-surface-inset">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary font-mono">Rule #{idx + 1}</span>
                    <button
                      type="button"
                      className="text-destructive hover:text-destructive-hover p-1 text-xs"
                      onClick={() => handleRemoveRule(idx)}
                    >
                      Delete
                    </button>
                  </div>

                  <TemplateTextField
                    label="Left operand (e.g. {{item}} or {{item.property}})"
                    value={rule.left_operand ?? "{{item}}"}
                    placeholder="{{item}}"
                    variableOptions={variableOptions}
                    onChange={(val: string) => handleUpdateRule(idx, { left_operand: val })}
                  />

                  <Label>
                    Comparison
                    <Select
                      value={rule.comparison ?? "equals"}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        handleUpdateRule(idx, {
                          comparison: event.currentTarget.value,
                        })
                      }
                    >
                      <option value="equals">Equals (=)</option>
                      <option value="not_equals">Does not equal (!=)</option>
                      <option value="contains">Contains</option>
                      <option value="not_contains">Does not contain</option>
                      <option value="greater_than">Greater than (&gt;)</option>
                      <option value="less_than">Less than (&lt;)</option>
                      <option value="greater_than_or_equals">Greater or equal (&gt;=)</option>
                      <option value="less_than_or_equals">Less or equal (&lt;=)</option>
                      <option value="is_empty">Is Empty</option>
                      <option value="is_not_empty">Is Not Empty</option>
                      <option value="matches_regex">Matches Regex</option>
                    </Select>
                  </Label>

                  {!["is_empty", "is_not_empty"].includes(rule.comparison ?? "equals") && (
                    <TemplateTextField
                      label="Right operand / Expected value"
                      value={rule.right_operand ?? ""}
                      placeholder="e.g. active"
                      variableOptions={variableOptions}
                      onChange={(val: string) => handleUpdateRule(idx, { right_operand: val })}
                    />
                  )}
                </div>
              ))}

              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 p-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 mt-2"
                onClick={handleAddRule}
              >
                + Add Rule
              </button>
            </div>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "map_list_property": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const property_key = stringConfig(node.config, "property_key", "");
      const output_name = stringConfig(node.config, "output_name", "mapped_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Extract Property from List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Property key / path"
              value={property_key}
              onChange={(val: string) => updateConfig({ ...configObj, property_key: val })}
              placeholder="e.g. id"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. mapped_list"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "sort_reverse_list": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const action = stringConfig(node.config, "action", "sort_asc") as "sort_asc" | "sort_desc" | "reverse";
      const sort_key = stringConfig(node.config, "sort_key", "");
      const output_name = stringConfig(node.config, "output_name", "sorted_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Sort or Reverse List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Action
              <Select
                value={action}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, action: event.currentTarget.value })}
              >
                <option value="sort_asc">Sort Ascending</option>
                <option value="sort_desc">Sort Descending</option>
                <option value="reverse">Reverse Order</option>
              </Select>
            </Label>
            {action !== "reverse" && (
              <TemplateTextField
                label="Sort key (optional, for list of objects)"
                value={sort_key}
                onChange={(val: string) => updateConfig({ ...configObj, sort_key: val })}
                placeholder="e.g. price"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. sorted_list"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "execute_list_script": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const script = stringConfig(node.config, "script", "return list.map(item => item);");
      const output_name = stringConfig(node.config, "output_name", "script_result");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Run Script on List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="JavaScript Script (source bound to 'list')"
              value={script}
              onChange={(val: string) => updateConfig({ ...configObj, script: val })}
              placeholder="return list.map(item => item);"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. script_result"
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
