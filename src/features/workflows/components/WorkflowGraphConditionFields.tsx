import type { WorkflowCondition } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";

type ConditionFieldsProps = {
  condition: WorkflowCondition;
  onChange: (condition: WorkflowCondition) => void;
};

export function ConditionFields({ condition, onChange }: ConditionFieldsProps) {
  return (
    <>
      <Label>
        Condition kind
        <Select
          value={condition.kind}
          onChange={(event) => onChange(defaultCondition(event.currentTarget.value))}
        >
          <option value="output_equals">Output equals</option>
          <option value="output_contains">Output contains</option>
          <option value="text_visible">Text visible</option>
          <option value="url_contains">URL contains</option>
          <option value="element_visible">Element visible</option>
        </Select>
      </Label>
      {condition.kind === "output_equals" || condition.kind === "output_contains" ? (
        <>
          <Label>
            Output name
            <Input
              value={condition.name}
              onChange={(event) =>
                onChange({ ...condition, name: event.currentTarget.value })
              }
            />
          </Label>
          <Label>
            Value
            <Input
              value={condition.value}
              onChange={(event) =>
                onChange({ ...condition, value: event.currentTarget.value })
              }
            />
          </Label>
        </>
      ) : null}
      {condition.kind === "text_visible" ? (
        <Label>
          Text
          <Input
            value={condition.text}
            onChange={(event) =>
              onChange({ ...condition, text: event.currentTarget.value })
            }
          />
        </Label>
      ) : null}
      {condition.kind === "url_contains" ? (
        <Label>
          URL contains
          <Input
            value={condition.value}
            onChange={(event) =>
              onChange({ ...condition, value: event.currentTarget.value })
            }
          />
        </Label>
      ) : null}
      {condition.kind === "element_visible" ? (
        <Label>
          XPath
          <Input
            value={condition.xpath}
            onChange={(event) =>
              onChange({ ...condition, xpath: event.currentTarget.value })
            }
          />
        </Label>
      ) : null}
    </>
  );
}

export function conditionFromConfig(config: unknown): WorkflowCondition {
  const condition = objectConfig(config).condition;
  if (isWorkflowCondition(condition)) return condition;
  return { kind: "output_equals", name: "name", value: "" };
}

function defaultCondition(kind: string): WorkflowCondition {
  switch (kind) {
    case "output_contains":
      return { kind: "output_contains", name: "name", value: "" };
    case "text_visible":
      return { kind: "text_visible", text: "" };
    case "url_contains":
      return { kind: "url_contains", value: "" };
    case "element_visible":
      return { kind: "element_visible", xpath: "" };
    default:
      return { kind: "output_equals", name: "name", value: "" };
  }
}

function isWorkflowCondition(value: unknown): value is WorkflowCondition {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  return [
    "output_equals",
    "output_contains",
    "text_visible",
    "url_contains",
    "element_visible",
  ].includes(String((value as { kind: unknown }).kind));
}

function objectConfig(config: unknown): Record<string, unknown> {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}
