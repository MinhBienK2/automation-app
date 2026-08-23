import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { SwitchField } from "../../../../../components/ui/switch";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { TemplateTextField, type VariableOption } from "../../variables/TemplateTextField";
import { booleanConfig, objectConfig, stringConfig } from "../../../lib/configUtils";

export function MathNodeFields({
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
    case "set_number_variable": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "my_number");
      const value = stringConfig(node.config, "value", "0");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Set Number Variable Settings">
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. counter"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Value"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="e.g. 10"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "generate_random_number": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "random_number");
      const min = stringConfig(node.config, "min", "1");
      const max = stringConfig(node.config, "max", "100");
      const integer = booleanConfig(node.config, "integer", true);
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Generate Random Number Settings">
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. random_val"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Minimum value"
              value={min}
              onChange={(val: string) => updateConfig({ ...configObj, min: val })}
              placeholder="e.g. 1"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Maximum value"
              value={max}
              onChange={(val: string) => updateConfig({ ...configObj, max: val })}
              placeholder="e.g. 100"
              variableOptions={variableOptions}
            />
            <SwitchField
              label="Generate integer only"
              checked={integer}
              onCheckedChange={(val: boolean) => updateConfig({ ...configObj, integer: val })}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "parse_text_to_number": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const fallback = stringConfig(node.config, "fallback", "0");
      const output_name = stringConfig(node.config, "output_name", "parsed_number");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Parse Text to Number Settings">
            <TemplateTextField
              label="Source text"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. {{outputs.extracted_price}}"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Fallback value (if parsing fails)"
              value={fallback}
              onChange={(val: string) => updateConfig({ ...configObj, fallback: val })}
              placeholder="e.g. 0"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "math_operation": {
      const configObj = objectConfig(node.config);
      const operand1 = stringConfig(node.config, "operand1", "");
      const operation = stringConfig(node.config, "operation", "add") as
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "modulo"
        | "power"
        | "abs"
        | "sqrt"
        | "min"
        | "max";
      const operand2 = stringConfig(node.config, "operand2", "");
      const output_name = stringConfig(node.config, "output_name", "math_result");

      const showOperand2 = !["abs", "sqrt"].includes(operation);

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Math Operation Settings">
            <TemplateTextField
              label="Operand 1"
              value={operand1}
              onChange={(val: string) => updateConfig({ ...configObj, operand1: val })}
              placeholder="e.g. 5 or variable name"
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
                <option value="add">Add (+)</option>
                <option value="subtract">Subtract (-)</option>
                <option value="multiply">Multiply (*)</option>
                <option value="divide">Divide (/)</option>
                <option value="modulo">Modulo (%)</option>
                <option value="power">Power (^)</option>
                <option value="abs">Absolute Value (abs)</option>
                <option value="sqrt">Square Root (sqrt)</option>
                <option value="min">Minimum (min)</option>
                <option value="max">Maximum (max)</option>
              </Select>
            </Label>
            {showOperand2 && (
              <TemplateTextField
                label="Operand 2"
                value={operand2}
                onChange={(val: string) => updateConfig({ ...configObj, operand2: val })}
                placeholder="e.g. 2 or variable name"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "round_number": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const mode = stringConfig(node.config, "mode", "round") as "round" | "floor" | "ceil";
      const decimals = stringConfig(node.config, "decimals", "0");
      const output_name = stringConfig(node.config, "output_name", "rounded_number");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Round Number Settings">
            <TemplateTextField
              label="Source number"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. 3.14159"
              variableOptions={variableOptions}
            />
            <Label>
              Rounding mode
              <Select
                value={mode}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    mode: event.currentTarget.value,
                  })
                }
              >
                <option value="round">Round to nearest</option>
                <option value="floor">Round down (floor)</option>
                <option value="ceil">Round up (ceil)</option>
              </Select>
            </Label>
            <TemplateTextField
              label="Decimal places"
              value={decimals}
              onChange={(val: string) => updateConfig({ ...configObj, decimals: val })}
              placeholder="e.g. 2"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "format_number": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const format = stringConfig(node.config, "format", "decimal") as "decimal" | "percent" | "currency";
      const decimals = stringConfig(node.config, "decimals", "2");
      const currency_code = stringConfig(node.config, "currency_code", "USD");
      const locale = stringConfig(node.config, "locale", "en-US");
      const output_name = stringConfig(node.config, "output_name", "formatted_number");

      const showCurrency = format === "currency";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Format Number Settings">
            <TemplateTextField
              label="Source number"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. 1234.56"
              variableOptions={variableOptions}
            />
            <Label>
              Format style
              <Select
                value={format}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    format: event.currentTarget.value,
                  })
                }
              >
                <option value="decimal">Decimal</option>
                <option value="percent">Percentage</option>
                <option value="currency">Currency</option>
              </Select>
            </Label>
            <TemplateTextField
              label="Decimal places"
              value={decimals}
              onChange={(val: string) => updateConfig({ ...configObj, decimals: val })}
              placeholder="e.g. 2"
              variableOptions={variableOptions}
            />
            {showCurrency && (
              <TemplateTextField
                label="Currency code"
                value={currency_code}
                onChange={(val: string) => updateConfig({ ...configObj, currency_code: val })}
                placeholder="e.g. USD, EUR, VND"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Locale"
              value={locale}
              onChange={(val: string) => updateConfig({ ...configObj, locale: val })}
              placeholder="e.g. en-US, vi-VN"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "compare_numbers": {
      const configObj = objectConfig(node.config);
      const operand1 = stringConfig(node.config, "operand1", "");
      const operator = stringConfig(node.config, "operator", "gt") as "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
      const operand2 = stringConfig(node.config, "operand2", "");
      const output_name = stringConfig(node.config, "output_name", "compare_result");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Compare Numbers Settings">
            <TemplateTextField
              label="Operand 1"
              value={operand1}
              onChange={(val: string) => updateConfig({ ...configObj, operand1: val })}
              placeholder="e.g. 5"
              variableOptions={variableOptions}
            />
            <Label>
              Comparison operator
              <Select
                value={operator}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    operator: event.currentTarget.value,
                  })
                }
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="gte">Greater than or equal (&gt;=)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="lte">Less than or equal (&lt;=)</option>
                <option value="eq">Equal (==)</option>
                <option value="neq">Not equal (!=)</option>
              </Select>
            </Label>
            <TemplateTextField
              label="Operand 2"
              value={operand2}
              onChange={(val: string) => updateConfig({ ...configObj, operand2: val })}
              placeholder="e.g. 10"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_number_range": {
      const configObj = objectConfig(node.config);
      const value = stringConfig(node.config, "value", "");
      const min = stringConfig(node.config, "min", "");
      const max = stringConfig(node.config, "max", "");
      const inclusive = booleanConfig(node.config, "inclusive", true);
      const output_name = stringConfig(node.config, "output_name", "in_range");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Number Range Settings">
            <TemplateTextField
              label="Number value"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="e.g. 50"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Minimum bound"
              value={min}
              onChange={(val: string) => updateConfig({ ...configObj, min: val })}
              placeholder="e.g. 0"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Maximum bound"
              value={max}
              onChange={(val: string) => updateConfig({ ...configObj, max: val })}
              placeholder="e.g. 100"
              variableOptions={variableOptions}
            />
            <SwitchField
              label="Inclusive bounds (min <= value <= max)"
              checked={inclusive}
              onCheckedChange={(val: boolean) => updateConfig({ ...configObj, inclusive: val })}
            />
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_number_property": {
      const configObj = objectConfig(node.config);
      const value = stringConfig(node.config, "value", "");
      const property = stringConfig(node.config, "property", "even") as "even" | "odd" | "integer" | "positive" | "negative";
      const output_name = stringConfig(node.config, "output_name", "property_result");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Number Property Settings">
            <TemplateTextField
              label="Number value"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="e.g. 42"
              variableOptions={variableOptions}
            />
            <Label>
              Property to check
              <Select
                value={property}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  updateConfig({
                    ...configObj,
                    property: event.currentTarget.value,
                  })
                }
              >
                <option value="even">Even</option>
                <option value="odd">Odd</option>
                <option value="integer">Integer</option>
                <option value="positive">Positive (&gt; 0)</option>
                <option value="negative">Negative (&lt; 0)</option>
              </Select>
            </Label>
            <TemplateTextField
              label="Result variable"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="Result variable"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "update_number_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "increment") as
        | "increment"
        | "decrement"
        | "add"
        | "subtract"
        | "multiply"
        | "divide";
      const value = stringConfig(node.config, "value", "");

      const showValue = ["add", "subtract", "multiply", "divide"].includes(operation);

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Number Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. counter"
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
                <option value="increment">Increment (+1)</option>
                <option value="decrement">Decrement (-1)</option>
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="multiply">Multiply</option>
                <option value="divide">Divide</option>
              </Select>
            </Label>
            {showValue && (
              <TemplateTextField
                label="Value"
                value={value}
                onChange={(val: string) => updateConfig({ ...configObj, value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    default:
      return null;
  }
}
