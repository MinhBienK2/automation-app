import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextareaField } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

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
        <ActionConfigFieldGroup title="Repeat count">
          <VariableNumericInput
            label="Times"
            value={config.config.times}
            min={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "times", val));
            }}
          />
        </ActionConfigFieldGroup>
      );
    case "repeat_for_each":
      return (
        <ActionConfigFieldGroup title="Iteration source">
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
            <TemplateTextareaField
              label="Items"
              value={config.config.items.join("\n")}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "items", val))
              }
            />
          )}
        </ActionConfigFieldGroup>
      );
    case "retry_block":
      return (
        <ActionConfigFieldGroup title="Retry policy">
          <VariableNumericInput
            label="Max attempts"
            value={config.config.max_attempts}
            min={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "max_attempts", val));
            }}
          />
          <VariableNumericInput
            label="Delay ms"
            value={config.config.delay_ms}
            min={0}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "delay_ms", val));
            }}
          />
        </ActionConfigFieldGroup>
      );
    case "stop_workflow":
      return (
        <ActionConfigFieldGroup title="Terminal result">
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
          <TemplateTextareaField
            label="Reason"
            value={config.config.reason ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "reason", val))
            }
          />
        </ActionConfigFieldGroup>
      );

    default:
      return null;
  }
}
