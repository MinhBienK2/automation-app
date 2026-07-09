import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { Textarea } from "../../../../../components/ui/textarea";
import { SwitchField } from "../../../../../components/ui/switch";
import { ActionConfigFieldGroup } from "../../ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../../TemplateTextField";
import { objectConfig, stringConfig, arrayConfig, booleanConfig } from "../../../lib/configUtils";

export function ListNodeFields({
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
                showMath={value_type === "number"}
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
            <Label>
              List Items (One per line)
              <Textarea
                value={itemsText}
                placeholder="item1&#10;item2&#10;item3"
                rows={5}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  updateConfig({
                    ...configObj,
                    items: event.currentTarget.value.split("\n").filter(Boolean),
                  })
                }
              />
            </Label>
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
              showMath={value_type === "number"}
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
              showMath={value_type === "number"}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "merge_lists": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value = stringConfig(node.config, "value", "");
      const unique = booleanConfig(node.config, "unique", false);
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
    default:
      return null;
  }
}
