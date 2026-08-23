import type { VariableAssignment, VariableValueType, ObjectFieldAssignment } from "../../../../types/workflow";
import type { VariableOption } from "./TemplateTextField";
import { KeyValueRows, duplicateRowKeys } from "./KeyValueRows";

type SetVariableConfig = {
  name?: string | null;
  value?: string | null;
  value_type?: VariableValueType | null;
  variables?: VariableAssignment[];
};

export function SetVariablesConfigFields({
  config,
  onChange,
  variableOptions,
}: {
  config: SetVariableConfig;
  onChange: (config: SetVariableConfig) => void;
  variableOptions?: VariableOption[];
}) {
  const rows = variableRowsFromConfig(config);

  return (
    <KeyValueRows
      rows={rows}
      onChange={(nextRows) => onChange({ variables: nextRows })}
      emptyRow={() => ({ name: "", value_type: "text", value: "" })}
      keyProp="name"
      keyLabel="Name"
      keyPlaceholder="Variable name"
      entity="variable"
      Entity="Variable"
      duplicateWarningPrefix="Duplicate paths overwrite earlier rows:"
      addLabel="Add variable row"
      variableOptions={variableOptions}
    />
  );
}

export function variableRowsFromConfig(config: SetVariableConfig): VariableAssignment[] {
  if (config.variables?.length) {
    return config.variables.map((row) => ({
      name: row.name,
      value_type: row.value_type ?? "text",
      value: row.value ?? "",
    }));
  }

  return [
    {
      name: config.name ?? "name",
      value_type: config.value_type ?? "text",
      value: config.value ?? "",
    },
  ];
}

export function CreateObjectManualFields({
  fields,
  onChange,
  variableOptions,
}: {
  fields: ObjectFieldAssignment[];
  onChange: (fields: ObjectFieldAssignment[]) => void;
  variableOptions?: VariableOption[];
}) {
  return (
    <KeyValueRows
      rows={fields || []}
      onChange={onChange}
      emptyRow={() => ({ key: "", value_type: "text", value: "" })}
      keyProp="key"
      keyLabel="Key Path"
      keyPlaceholder="e.g. name or user.age"
      entity="field"
      Entity="Field"
      duplicateWarningPrefix="Duplicate keys overwrite earlier rows:"
      addLabel="Add field row"
      variableOptions={variableOptions}
    />
  );
}

// Re-exported for callers that validate duplicates outside the editors.
export { duplicateRowKeys as duplicateRowNames };
