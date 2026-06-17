import type { GraphNode } from "../../../types/workflow";
import type { VariableOption } from "./TemplateTextField";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { TemplateTextareaField } from "./TemplateTextField";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { objectConfig } from "../lib/configUtils";
import type { EvaluateExpressionConfig } from "../../../types/workflowCore";

type EvaluateExpressionFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
};

export function WorkflowGraphEvaluateExpressionFields({
  node,
  onChange,
  variableOptions = [],
}: EvaluateExpressionFieldsProps) {
  const config = objectConfig(node.config) as EvaluateExpressionConfig;
  const outputName = config.output_name ?? "";
  const expression = config.expression ?? "";

  const updateConfig = (nextConfig: Partial<EvaluateExpressionConfig>) => {
    onChange({
      ...node,
      config: {
        ...config,
        ...nextConfig,
      },
    });
  };

  return (
    <div className="graph-config-fields space-y-4">
      <ActionConfigFieldGroup title="Basic Settings">
        <Label>
          Result Output Variable Name
          <Input
            placeholder="e.g. total_sum"
            value={outputName}
            onChange={(event) => updateConfig({ output_name: event.currentTarget.value })}
          />
        </Label>

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

      <ActionConfigFieldGroup title="Expression Settings">
        <TemplateTextareaField
          label="JavaScript / Math Expression"
          value={expression}
          placeholder="outputs.A + outputs.B"
          variableOptions={variableOptions}
          showMath={false}
          onChange={(value) => updateConfig({ expression: value })}
        />
        <div className="text-xs text-muted-foreground mt-1.5 space-y-1">
          <p>Expression will evaluate and return the raw value (number, string, etc.).</p>
          <p>
            {"Use {{name}} to insert variables (resolved before execution), or outputs.name for direct access. "}
            {"Also available: page (Playwright Page instance)."}
          </p>
        </div>
      </ActionConfigFieldGroup>
    </div>
  );
}
