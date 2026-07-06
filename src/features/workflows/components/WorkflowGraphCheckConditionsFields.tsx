import type { GraphNode } from "../../../types/workflow";
import type { VariableOption } from "./TemplateTextField";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { TemplateTextField, TemplateTextareaField } from "./TemplateTextField";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { Trash2, Plus } from "lucide-react";
import { objectConfig } from "../lib/configUtils";
import type { CheckConditionsConfig, LogicRuleGroup, LogicRule } from "../../../types/workflowCore";

type CheckConditionsFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
};

export function WorkflowGraphCheckConditionsFields({
  node,
  onChange,
  variableOptions = [],
}: CheckConditionsFieldsProps) {
  const config = objectConfig(node.config) as CheckConditionsConfig;
  const outputName = config.output_name ?? "";
  const mode = config.mode ?? "visual";
  const script = config.script ?? "";
  const rulesGroup: LogicRuleGroup = config.rules_group ?? { operator: "and", rules: [] };
  const rules = rulesGroup.rules as LogicRule[];

  const updateConfig = (nextConfig: Partial<CheckConditionsConfig>) => {
    onChange({
      ...node,
      config: {
        ...config,
        ...nextConfig,
      },
    });
  };

  const handleAddRule = () => {
    const nextRules = [
      ...rules,
      {
        type: "value_compare" as const,
        left_operand: "",
        comparison: "equals" as const,
        right_operand: "",
      },
    ];
    updateConfig({
      rules_group: {
        ...rulesGroup,
        rules: nextRules,
      },
    });
  };

  const handleRemoveRule = (index: number) => {
    const nextRules = rules.filter((_, i) => i !== index);
    updateConfig({
      rules_group: {
        ...rulesGroup,
        rules: nextRules,
      },
    });
  };

  const handleUpdateRule = (index: number, nextRule: Partial<LogicRule>) => {
    const nextRules = [...rules];
    nextRules[index] = {
      ...nextRules[index],
      ...nextRule,
    } as LogicRule;
    updateConfig({
      rules_group: {
        ...rulesGroup,
        rules: nextRules,
      },
    });
  };

  return (
    <div className="graph-config-fields space-y-4">
      <ActionConfigFieldGroup title="Basic Settings">
        <Label>
          Result Output Variable Name
          <Input
            placeholder="e.g. is_valid_user"
            value={outputName}
            onChange={(event) => updateConfig({ output_name: event.currentTarget.value })}
          />
        </Label>

        <div className="grid gap-1.5 mt-2">
          <Label>Evaluation Mode</Label>
          <SegmentedControl
            ariaLabel="Evaluation Mode"
            options={[
              { label: "Visual Rules", value: "visual" },
              { label: "JavaScript Script", value: "script" },
            ]}
            value={mode}
            onValueChange={(value) => updateConfig({ mode: value })}
          />
        </div>

        <div className="grid gap-1.5 mt-2">
          <Label>Evaluation Type</Label>
          <SegmentedControl
            ariaLabel="Evaluation Type"
            options={[
              { label: "Static (Calculate Now)", value: "static" },
              { label: "Dynamic (Lazy Evaluation)", value: "dynamic" },
            ]}
            value={config.evaluation_type ?? "static"}
            onValueChange={(value) => updateConfig({ evaluation_type: value as "static" | "dynamic" })}
          />
        </div>
      </ActionConfigFieldGroup>

      {mode === "script" ? (
        <ActionConfigFieldGroup title="Script Settings">
          <TemplateTextareaField
            label="JavaScript Expression"
            value={script}
            placeholder="outputs.counter > 5 && page.url().includes('login')"
            variableOptions={variableOptions}
            showMath={false}
            isJs={true}
            onChange={(value) => updateConfig({ script: value })}
          />
          <div className="text-xs text-muted-foreground mt-1.5 space-y-1">
            <p>Expression should evaluate to a boolean value.</p>
            <p>
              {"Use {{name}} to insert variables (resolved before execution), or outputs.name for direct access. "}
              {"Also available: page (Playwright Page instance)."}
            </p>
          </div>
        </ActionConfigFieldGroup>
      ) : (
        <ActionConfigFieldGroup title="Rules Settings">
          <Label>
            Combine Operator
            <Select
              value={rulesGroup.operator}
              onChange={(event) =>
                updateConfig({
                  rules_group: {
                    ...rulesGroup,
                    operator: event.currentTarget.value as "and" | "or",
                  },
                })
              }
            >
              <option value="and">All conditions must be met (AND)</option>
              <option value="or">Any condition can be met (OR)</option>
            </Select>
          </Label>

          <div className="space-y-4 mt-3">
            {rules.map((rule, index) => (
              <div key={index} className="p-3 border border-border rounded-lg space-y-2 relative bg-surface-inset">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-secondary">Rule #{index + 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive-hover"
                    onClick={() => handleRemoveRule(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete rule</span>
                  </Button>
                </div>

                <Label>
                  Rule Type
                  <Select
                    value={rule.type}
                    onChange={(event) =>
                      handleUpdateRule(index, {
                        type: event.currentTarget.value as LogicRule["type"],
                        // reset specific properties
                        comparison: "equals",
                        left_operand: "",
                        right_operand: "",
                        element_source: "xpath",
                        xpath: "",
                        target_ref: "",
                        element_property: "visible",
                        url_comparison: "contains",
                        url_value: "",
                      })
                    }
                  >
                    <option value="value_compare">Value Comparison</option>
                    <option value="element_state">Element State</option>
                    <option value="url_check">Browser URL</option>
                  </Select>
                </Label>

                {rule.type === "value_compare" && (
                  <div className="space-y-2">
                    <TemplateTextField
                      label="Left value / Variable"
                      value={rule.left_operand ?? ""}
                      placeholder="e.g. {{outputs.status}}"
                      variableOptions={variableOptions}
                      onChange={(val) => handleUpdateRule(index, { left_operand: val })}
                    />
                    <Label>
                      Comparison Operator
                      <Select
                        value={rule.comparison ?? "equals"}
                        onChange={(event) =>
                          handleUpdateRule(index, {
                            comparison: event.currentTarget.value as LogicRule["comparison"],
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
                        label="Right value / Variable"
                        value={rule.right_operand ?? ""}
                        placeholder="e.g. success"
                        variableOptions={variableOptions}
                        onChange={(val) => handleUpdateRule(index, { right_operand: val })}
                      />
                    )}
                  </div>
                )}

                {rule.type === "element_state" && (
                  <div className="space-y-2">
                    <div className="grid gap-1">
                      <Label>Element Source</Label>
                      <SegmentedControl
                        ariaLabel="Element Source"
                        options={[
                          { label: "XPath", value: "xpath" },
                          { label: "Ref", value: "ref" },
                        ]}
                        value={rule.element_source ?? "xpath"}
                        onValueChange={(val) => handleUpdateRule(index, { element_source: val })}
                      />
                    </div>
                    {rule.element_source === "ref" ? (
                      <TemplateTextField
                        label="Element Ref Name"
                        value={rule.target_ref ?? ""}
                        placeholder="e.g. my_button"
                        variableOptions={variableOptions}
                        onChange={(val) => handleUpdateRule(index, { target_ref: val })}
                      />
                    ) : (
                      <TemplateTextField
                        label="XPath Locator"
                        value={rule.xpath ?? ""}
                        placeholder="e.g. //button[@type='submit']"
                        variableOptions={variableOptions}
                        onChange={(val) => handleUpdateRule(index, { xpath: val })}
                      />
                    )}
                    <Label>
                      Property to Check
                      <Select
                        value={rule.element_property ?? "visible"}
                        onChange={(event) =>
                          handleUpdateRule(index, {
                            element_property: event.currentTarget.value as LogicRule["element_property"],
                          })
                        }
                      >
                        <option value="visible">Is Visible</option>
                        <option value="hidden">Is Hidden</option>
                        <option value="enabled">Is Enabled</option>
                        <option value="disabled">Is Disabled</option>
                        <option value="checked">Is Checked/Selected</option>
                        <option value="unchecked">Is Unchecked</option>
                      </Select>
                    </Label>
                  </div>
                )}

                {rule.type === "url_check" && (
                  <div className="space-y-2">
                    <Label>
                      URL Comparison
                      <Select
                        value={rule.url_comparison ?? "contains"}
                        onChange={(event) =>
                          handleUpdateRule(index, {
                            url_comparison: event.currentTarget.value as LogicRule["url_comparison"],
                          })
                        }
                      >
                        <option value="contains">URL contains</option>
                        <option value="not_contains">URL does not contain</option>
                        <option value="matches_regex">URL matches regex</option>
                      </Select>
                    </Label>
                    <TemplateTextField
                      label="URL Match Value"
                      value={rule.url_value ?? ""}
                      placeholder="e.g. dashboard"
                      variableOptions={variableOptions}
                      onChange={(val) => handleUpdateRule(index, { url_value: val })}
                    />
                  </div>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full flex items-center justify-center gap-1.5"
              onClick={handleAddRule}
            >
              <Plus className="h-4 w-4" />
              Add Condition Rule
            </Button>
          </div>
        </ActionConfigFieldGroup>
      )}
    </div>
  );
}
