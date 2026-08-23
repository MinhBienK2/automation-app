import type { WorkflowCondition } from "../../../../types/workflow";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SegmentedControl } from "../../../../components/ui/segmented-control";
import { Select } from "../../../../components/ui/select";
import { objectConfig } from "../../lib/configUtils";

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
          <option value="variable_is_true">Check variable (boolean)</option>
          <option value="text_visible">Text visible</option>
          <option value="url_contains">URL contains</option>
          <option value="element_visible">Element visible</option>
        </Select>
      </Label>
      {condition.kind === "variable_is_true" ? (
        <Label>
          Variable name
          <Input
            value={condition.name}
            onChange={(event) =>
              onChange({ ...condition, name: event.currentTarget.value })
            }
          />
        </Label>
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
        <>
          <div className="grid gap-1.5">
            <Label>Element source</Label>
            <SegmentedControl
              ariaLabel="Element source"
              value={condition.target_ref != null ? "ref" : "xpath"}
              options={[
                { label: "Use XPath", value: "xpath" },
                { label: "Use Find Element ref", value: "ref" },
              ]}
              onValueChange={(value) =>
                onChange({
                  ...condition,
                  target: value === "xpath" ? null : condition.target,
                  target_ref: value === "ref" ? (condition.target_ref ?? "") : null,
                })
              }
            />
          </div>
          {condition.target_ref != null ? (
            <Label>
              Target ref
              <Input
                value={condition.target_ref ?? ""}
                onChange={(event) =>
                  onChange({ ...condition, target_ref: event.currentTarget.value })
                }
              />
            </Label>
          ) : (
            <Label>
              XPath
              <Input
                value={condition.xpath ?? ""}
                onChange={(event) =>
                  onChange({ ...condition, xpath: event.currentTarget.value })
                }
              />
            </Label>
          )}
        </>
      ) : null}
    </>
  );
}

export function conditionFromConfig(config: unknown): WorkflowCondition {
  const condition = objectConfig(config).condition;
  if (isWorkflowCondition(condition)) return condition;
  return { kind: "variable_is_true", name: "name" };
}

function defaultCondition(kind: string): WorkflowCondition {
  switch (kind) {
    case "text_visible":
      return { kind: "text_visible", text: "" };
    case "url_contains":
      return { kind: "url_contains", value: "" };
    case "element_visible":
      return { kind: "element_visible", xpath: "" };
    default:
      return { kind: "variable_is_true", name: "name" };
  }
}

function isWorkflowCondition(value: unknown): value is WorkflowCondition {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  return [
    "variable_is_true",
    "text_visible",
    "url_contains",
    "element_visible",
  ].includes(String((value as { kind: unknown }).kind));
}
