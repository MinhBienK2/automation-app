import { useState } from "react";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { Checkbox } from "../../../../components/ui/checkbox";
import { ActionConfigFieldGroup } from "../ActionConfigFieldGroup";
import { ConditionFields, conditionFromConfig } from "../WorkflowGraphConditionFields";
import { TemplateTextField, type VariableOption } from "../TemplateTextField";
import type { GraphNode } from "../../../../types/workflow";
import {
  arrayConfig,
  objectConfig,
  stringConfig,
} from "../../lib/configUtils";
import { VariableNumericInput } from "../VariableNumericInput";

type LoopNodeFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
};

export function LoopNodeFields({ node, onChange, variableOptions }: LoopNodeFieldsProps) {
  const hasAdvancedValues = Boolean(
    stringConfig(node.config, "start_index", "") ||
    stringConfig(node.config, "end_index", "") ||
    stringConfig(node.config, "max_loops", "") ||
    stringConfig(node.config, "min_loops", "")
  );
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedValues);

  function updateConfig(config: unknown) {
    onChange({ ...node, config });
  }

  if (node.node_type === "repeat_times") {
    return (
      <div className="graph-config-fields">
        <ActionConfigFieldGroup title="Repeat count">
          <VariableNumericInput
            label="Times"
            min={1}
            value={node.config && (node.config as any).times !== undefined ? (node.config as any).times : 1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              updateConfig({
                ...objectConfig(node.config),
                times: val,
              });
            }}
          />
        </ActionConfigFieldGroup>
      </div>
    );
  }

  if (node.node_type === "repeat_for_each") {
    const source = stringConfig(node.config, "array_variable", "")
      ? "variable_array"
      : "manual";
    return (
      <div className="graph-config-fields space-y-4">
        <ActionConfigFieldGroup title="Iteration source">
          <Label>
            Items source
            <Select
              value={source}
              onChange={(event) => {
                const nextSource = event.currentTarget.value;
                updateConfig({
                  ...objectConfig(node.config),
                  array_variable: nextSource === "variable_array" ? "items" : null,
                  items:
                    nextSource === "manual"
                      ? arrayConfig(node.config, "items").length
                        ? arrayConfig(node.config, "items")
                        : ["item"]
                      : [],
                });
              }}
            >
              <option value="manual">Manual list</option>
              <option value="variable_array">Variable array</option>
            </Select>
          </Label>
          <Label>
            Item name
            <Input
              value={stringConfig(node.config, "item_name", "item")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  item_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          {source === "variable_array" ? (
            <Label>
              Array variable
              <Input
                value={stringConfig(node.config, "array_variable", "items")}
                onChange={(event) =>
                  updateConfig({
                    ...objectConfig(node.config),
                    array_variable: event.currentTarget.value,
                    items: [],
                  })
                }
              />
            </Label>
          ) : (
            <Label>
              Items
              <Textarea
                value={arrayConfig(node.config, "items").join("\n")}
                onChange={(event) =>
                  updateConfig({
                    ...objectConfig(node.config),
                    array_variable: null,
                    items: event.currentTarget.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Label>
          )}
        </ActionConfigFieldGroup>

        <div className="flex items-center gap-2 p-1">
          <Checkbox
            id="show-advanced-loop-settings"
            checked={showAdvanced}
            onCheckedChange={(checked) => setShowAdvanced(Boolean(checked))}
          />
          <label
            htmlFor="show-advanced-loop-settings"
            className="text-sm font-semibold select-none cursor-pointer text-muted-foreground hover:text-foreground"
          >
            Advanced settings
          </label>
        </div>

        {showAdvanced && (
          <div className="space-y-4 border-t border-border/60 pt-4">
            {/* Range Selection Group */}
            <div className="p-3 border border-border/80 rounded-lg bg-surface-inset space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-secondary font-mono">
                Range Selection (Slice)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <TemplateTextField
                  label="Start Index"
                  placeholder="0"
                  value={stringConfig(node.config, "start_index", "")}
                  onChange={(val) =>
                    updateConfig({
                      ...objectConfig(node.config),
                      start_index: val || null,
                    })
                  }
                  variableOptions={variableOptions}
                />
                <TemplateTextField
                  label="End Index (Exclusive)"
                  placeholder="e.g. 5"
                  value={stringConfig(node.config, "end_index", "")}
                  onChange={(val) =>
                    updateConfig({
                      ...objectConfig(node.config),
                      end_index: val || null,
                    })
                  }
                  variableOptions={variableOptions}
                />
              </div>
            </div>

            {/* Loop Limits Group */}
            <div className="p-3 border border-border/80 rounded-lg bg-surface-inset space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-secondary font-mono">
                Loop Limits & Padding
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <TemplateTextField
                  label="Maximum loops"
                  placeholder="No limit"
                  value={stringConfig(node.config, "max_loops", "")}
                  onChange={(val) =>
                    updateConfig({
                      ...objectConfig(node.config),
                      max_loops: val || null,
                    })
                  }
                  variableOptions={variableOptions}
                />
                <TemplateTextField
                  label="Minimum loops"
                  placeholder="0"
                  value={stringConfig(node.config, "min_loops", "")}
                  onChange={(val) =>
                    updateConfig({
                      ...objectConfig(node.config),
                      min_loops: val || null,
                    })
                  }
                  variableOptions={variableOptions}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // while or repeat_until
  return (
    <div className="graph-config-fields">
      <ActionConfigFieldGroup title="Condition">
        <ConditionFields
          condition={conditionFromConfig(node.config)}
          onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
        />
      </ActionConfigFieldGroup>
      <ActionConfigFieldGroup title="Loop guard">
        <VariableNumericInput
          label="Loop max attempts"
          min={1}
          value={node.config && (node.config as any).max_attempts !== undefined ? (node.config as any).max_attempts : 10}
          onChange={(nextVal) => {
            const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
              ? typeof nextVal === "string" && nextVal.startsWith("{{")
                ? nextVal
                : Number(nextVal)
              : null;
            updateConfig({
              ...objectConfig(node.config),
              max_attempts: val,
            });
          }}
        />
        <VariableNumericInput
          label="Loop timeout ms"
          min={0}
          value={node.config && (node.config as any).timeout_ms !== undefined ? (node.config as any).timeout_ms : 0}
          onChange={(nextVal) => {
            const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
              ? typeof nextVal === "string" && nextVal.startsWith("{{")
                ? nextVal
                : Number(nextVal)
              : null;
            updateConfig({
              ...objectConfig(node.config),
              timeout_ms: val,
            });
          }}
          placeholder="No timeout"
        />
      </ActionConfigFieldGroup>
    </div>
  );
}
