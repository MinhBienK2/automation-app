import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function LogicActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "if_condition":
    case "random_choice":
      return null;
    case "repeat_times":
      return (
        <Label>
          Times
          <Input
            min="1"
            type="number"
            value={config.config.times}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "times", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "repeat_for_each":
      return (
        <>
          <Label>
            Items source
            <Select
              value={config.config.array_variable ? "variable_array" : "manual"}
              onChange={(event) =>
                onChange(
                  event.currentTarget.value === "variable_array"
                    ? {
                        type: "repeat_for_each",
                        config: {
                          ...config.config,
                          array_variable: "items",
                          items: [],
                        },
                      }
                    : {
                        type: "repeat_for_each",
                        config: {
                          ...config.config,
                          array_variable: null,
                          items: config.config.items.length ? config.config.items : ["item"],
                        },
                      },
                )
              }
            >
              <option value="manual">Manual list</option>
              <option value="variable_array">Variable array</option>
            </Select>
          </Label>
          <Label>
            Item name
            <Input
              value={config.config.item_name}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "item_name", event.currentTarget.value))
              }
            />
          </Label>
          {config.config.array_variable ? (
            <Label>
              Array variable
              <Input
                value={config.config.array_variable}
                onChange={(event) =>
                  onChange(
                    updateActionConfigField(
                      config,
                      "array_variable",
                      event.currentTarget.value,
                    ),
                  )
                }
              />
            </Label>
          ) : (
            <Label>
              Items
              <Textarea
                value={config.config.items.join("\n")}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "items", event.currentTarget.value))
                }
              />
            </Label>
          )}
        </>
      );
    case "retry_block":
      return (
        <>
          <Label>
            Max attempts
            <Input
              min="1"
              type="number"
              value={config.config.max_attempts}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "max_attempts", event.currentTarget.value),
                )
              }
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="0"
              type="number"
              value={config.config.delay_ms ?? 0}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "delay_ms", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );
    case "stop_workflow":
      return (
        <>
          <Label>
            Status
            <Select
              value={config.config.status}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "status", event.currentTarget.value))
              }
            >
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </Select>
          </Label>
          <Label>
            Reason
            <Textarea
              value={config.config.reason ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "reason", event.currentTarget.value))
              }
            />
          </Label>
        </>
      );

    default:
      return null;
  }
}
