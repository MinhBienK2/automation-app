import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { ActionConfigFieldGroup } from "../ActionConfigFieldGroup";
import { ConditionFields, conditionFromConfig } from "../WorkflowGraphConditionFields";
import type { GraphNode } from "../../../../types/workflow";
import {
  arrayConfig,
  numberConfig,
  objectConfig,
  stringConfig,
} from "../../lib/configUtils";

type LoopNodeFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
};

export function LoopNodeFields({ node, onChange }: LoopNodeFieldsProps) {
  function updateConfig(config: unknown) {
    onChange({ ...node, config });
  }

  if (node.node_type === "repeat_times") {
    return (
      <div className="graph-config-fields">
        <ActionConfigFieldGroup title="Repeat count">
          <Label>
            Times
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "times", 1)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  times: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </ActionConfigFieldGroup>
      </div>
    );
  }

  if (node.node_type === "repeat_for_each") {
    const source = stringConfig(node.config, "array_variable", "")
      ? "variable_array"
      : "manual";
    return (
      <div className="graph-config-fields">
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
        <Label>
          Loop max attempts
          <Input
            min="1"
            type="number"
            value={numberConfig(node.config, "max_attempts", 10)}
            onChange={(event) =>
              updateConfig({
                ...objectConfig(node.config),
                max_attempts: Number(event.currentTarget.value) || 1,
              })
            }
          />
        </Label>
        <Label>
          Loop timeout ms
          <Input
            min="0"
            type="number"
            value={numberConfig(node.config, "timeout_ms", 0)}
            onChange={(event) =>
              updateConfig({
                ...objectConfig(node.config),
                timeout_ms: Number(event.currentTarget.value) || null,
              })
            }
          />
        </Label>
      </ActionConfigFieldGroup>
    </div>
  );
}
