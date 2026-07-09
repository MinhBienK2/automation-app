import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { ActionConfigFieldGroup } from "../../ActionConfigFieldGroup";
import { TemplateTextField, type VariableOption } from "../../TemplateTextField";
import { objectConfig, stringConfig } from "../../../lib/configUtils";

export function BooleanNodeFields({
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
    case "set_boolean_variable": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "");
      const value = stringConfig(node.config, "value", "true");

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Boolean: Set Value Settings">
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. isFlag"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Value"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="e.g. true or false"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "generate_random_boolean": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "");
      const probability = stringConfig(node.config, "probability", "0.5");

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Boolean: Random Settings">
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. isLucky"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Probability (0.0 to 1.0)"
              value={probability}
              onChange={(val: string) => updateConfig({ ...configObj, probability: val })}
              placeholder="e.g. 0.5"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "parse_to_boolean": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const fallback = stringConfig(node.config, "fallback", "false");
      const output_name = stringConfig(node.config, "output_name", "");

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Boolean: Convert Value Settings">
            <TemplateTextField
              label="Source value to convert"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. {{my_text}} or 1"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Fallback value"
              value={fallback}
              onChange={(val: string) => updateConfig({ ...configObj, fallback: val })}
              placeholder="e.g. false"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. resultBool"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "boolean_logical_op": {
      const configObj = objectConfig(node.config);
      const operand1 = stringConfig(node.config, "operand1", "");
      const operation = stringConfig(node.config, "operation", "and");
      const operand2 = stringConfig(node.config, "operand2", "");
      const output_name = stringConfig(node.config, "output_name", "");

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Boolean: Logical Op Settings">
            <TemplateTextField
              label="First operand"
              value={operand1}
              onChange={(val: string) => updateConfig({ ...configObj, operand1: val })}
              placeholder="e.g. {{flagA}}"
              variableOptions={variableOptions}
            />
            <Label>
              Logical Operation
              <Select
                value={operation}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
                <option value="not">NOT</option>
                <option value="xor">XOR</option>
              </Select>
            </Label>
            {operation !== "not" && (
              <TemplateTextField
                label="Second operand"
                value={operand2}
                onChange={(val: string) => updateConfig({ ...configObj, operand2: val })}
                placeholder="e.g. {{flagB}}"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. logicResult"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "compare_booleans": {
      const configObj = objectConfig(node.config);
      const operand1 = stringConfig(node.config, "operand1", "");
      const operator = stringConfig(node.config, "operator", "eq");
      const operand2 = stringConfig(node.config, "operand2", "");
      const output_name = stringConfig(node.config, "output_name", "");

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Boolean: Compare Settings">
            <TemplateTextField
              label="First operand"
              value={operand1}
              onChange={(val: string) => updateConfig({ ...configObj, operand1: val })}
              placeholder="e.g. {{flagA}}"
              variableOptions={variableOptions}
            />
            <Label>
              Operator
              <Select
                value={operator}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    operator: event.currentTarget.value,
                  })
                }
              >
                <option value="eq">Equals (==)</option>
                <option value="neq">Not Equals (!=)</option>
              </Select>
            </Label>
            <TemplateTextField
              label="Second operand"
              value={operand2}
              onChange={(val: string) => updateConfig({ ...configObj, operand2: val })}
              placeholder="e.g. {{flagB}}"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. compResult"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_boolean_property": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const property = stringConfig(node.config, "property", "is_true");
      const output_name = stringConfig(node.config, "output_name", "");

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Boolean: Check Property Settings">
            <TemplateTextField
              label="Source value"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. {{flag}}"
              variableOptions={variableOptions}
            />
            <Label>
              Property
              <Select
                value={property}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    property: event.currentTarget.value,
                  })
                }
              >
                <option value="is_true">Is True</option>
                <option value="is_false">Is False</option>
              </Select>
            </Label>
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. propResult"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "update_flag_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "toggle") as "toggle" | "set_true" | "set_false";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Flag Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. isLoggedIn"
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
                <option value="toggle">Toggle</option>
                <option value="set_true">Set True</option>
                <option value="set_false">Set False</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    default:
      return null;
  }
}
