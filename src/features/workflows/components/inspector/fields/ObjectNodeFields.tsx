import type { GraphNode, ObjectFieldAssignment } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Select } from "../../../../../components/ui/select";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { CreateObjectManualFields } from "../../variables/VariableConfigFields";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../../variables/TemplateTextField";
import { objectConfig, stringConfig, arrayConfig, booleanConfig } from "../../../lib/configUtils";

export function ObjectNodeFields({
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
    case "create_empty_object": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "my_object");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Create Empty Object Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "create_object_manual": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "my_object");
      const fields = (arrayConfig(node.config, "fields") || []) as unknown as ObjectFieldAssignment[];
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Create Object (Manual) Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <CreateObjectManualFields
              fields={fields}
              onChange={(val: ObjectFieldAssignment[]) => updateConfig({ ...configObj, fields: val })}
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "parse_json_to_object": {
      const configObj = objectConfig(node.config);
      const source_text = stringConfig(node.config, "source_text", "");
      const output_name = stringConfig(node.config, "output_name", "my_object");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Parse JSON to Object Settings">
            <TemplateTextareaField
              label="JSON source text"
              value={source_text}
              onChange={(val: string) => updateConfig({ ...configObj, source_text: val })}
              placeholder='{"key": "value"}'
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "set_object_property": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const property_key = stringConfig(node.config, "property_key", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Set Object Property Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Property path (supports dot-path)"
              value={property_key}
              onChange={(val: string) => updateConfig({ ...configObj, property_key: val })}
              placeholder="e.g. user.profile.name"
              variableOptions={variableOptions}
            />
            <Label>
              Value type
              <Select
                value={value_type}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="Value"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "remove_object_property": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const property_key = stringConfig(node.config, "property_key", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Remove Object Property Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Property path"
              value={property_key}
              onChange={(val: string) => updateConfig({ ...configObj, property_key: val })}
              placeholder="e.g. temp_key"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "merge_objects": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value = stringConfig(node.config, "value", "");
      const deep = booleanConfig(node.config, "deep", false);
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Merge Objects Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Value to merge (JSON string or object variable)"
              value={value}
              onChange={(val: string) => updateConfig({ ...configObj, value: val })}
              placeholder='{"key": "value"}'
              variableOptions={variableOptions}
            />
            <Label>
              Merge depth
              <Select
                value={String(deep)}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateConfig({ ...configObj, deep: event.currentTarget.value === "true" })}
              >
                <option value="false">Shallow Merge</option>
                <option value="true">Deep Merge</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "rename_object_property": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const old_key = stringConfig(node.config, "old_key", "");
      const new_key = stringConfig(node.config, "new_key", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Rename Object Property Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val: string) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Old key path"
              value={old_key}
              onChange={(val: string) => updateConfig({ ...configObj, old_key: val })}
              placeholder="e.g. user.oldName"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="New key path"
              value={new_key}
              onChange={(val: string) => updateConfig({ ...configObj, new_key: val })}
              placeholder="e.g. user.newName"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_object_property": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const property_key = stringConfig(node.config, "property_key", "");
      const output_name = stringConfig(node.config, "output_name", "property_value");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get Object Property Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Property path"
              value={property_key}
              onChange={(val: string) => updateConfig({ ...configObj, property_key: val })}
              placeholder="e.g. user.profile.name"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. property_value"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_object_keys": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "object_keys");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get Object Keys Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. object_keys"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_object_values": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "object_values");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get Object Values Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. object_values"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "stringify_object": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "json_string");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Stringify Object Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. json_string"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "execute_object_script": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const script = stringConfig(node.config, "script", "return obj;");
      const output_name = stringConfig(node.config, "output_name", "script_result");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Run Script on Object Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="JavaScript Script (source bound to 'obj')"
              value={script}
              onChange={(val: string) => updateConfig({ ...configObj, script: val })}
              placeholder="return obj;"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. script_result"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_object_key_exists": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const property_key = stringConfig(node.config, "property_key", "");
      const output_name = stringConfig(node.config, "output_name", "key_exists");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Object Key Exists Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Property path"
              value={property_key}
              onChange={(val: string) => updateConfig({ ...configObj, property_key: val })}
              placeholder="e.g. user.profile.name"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. key_exists"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_object_empty": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "is_empty");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check Object Empty Settings">
            <TemplateTextField
              label="Source object variable name"
              value={source}
              onChange={(val: string) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_object"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val: string) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. is_empty"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    default:
      return null;
  }
}
