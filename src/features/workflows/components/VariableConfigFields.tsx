import type { VariableAssignment, VariableValueType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";

type SetVariableConfig = {
  name?: string | null;
  value?: string | null;
  value_type?: VariableValueType | null;
  variables?: VariableAssignment[];
};

type SetVariablesConfigFieldsProps = {
  config: SetVariableConfig;
  onChange: (config: SetVariableConfig) => void;
};

export function SetVariablesConfigFields({
  config,
  onChange,
}: SetVariablesConfigFieldsProps) {
  const rows = variableRowsFromConfig(config);
  const duplicateNames = duplicateVariableNames(rows);

  function updateRow(index: number, patch: Partial<VariableAssignment>) {
    onChange({
      variables: rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    });
  }

  function removeRow(index: number) {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange({ variables: nextRows.length ? nextRows : [emptyVariableRow()] });
  }

  return (
    <div className="variable-row-table">
      <div className="variable-row-grid variable-row-heading" aria-hidden="true">
        <span>Name</span>
        <span>Type</span>
        <span>Value</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div className="variable-row-grid" key={index}>
          <Label>
            <span className="sr-only">Variable {index + 1} name</span>
            <Input
              aria-label={`Variable ${index + 1} name`}
              value={row.name}
              onChange={(event) => updateRow(index, { name: event.currentTarget.value })}
            />
          </Label>
          <Label>
            <span className="sr-only">Variable {index + 1} type</span>
            <Select
              aria-label={`Variable ${index + 1} type`}
              value={row.value_type}
              onChange={(event) =>
                updateRow(index, { value_type: event.currentTarget.value as VariableValueType })
              }
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
            </Select>
          </Label>
          <Label>
            <span className="sr-only">Variable {index + 1} value</span>
            <Input
              aria-label={`Variable ${index + 1} value`}
              value={row.value}
              onChange={(event) => updateRow(index, { value: event.currentTarget.value })}
            />
          </Label>
          <Button
            aria-label={`Remove variable ${index + 1}`}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeRow(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      {duplicateNames.length ? (
        <p className="variable-warning">
          Duplicate paths overwrite earlier rows: {duplicateNames.join(", ")}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange({ variables: [...rows, emptyVariableRow()] })}
      >
        Add variable row
      </Button>
    </div>
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

function emptyVariableRow(): VariableAssignment {
  return { name: "", value_type: "text", value: "" };
}

function duplicateVariableNames(rows: VariableAssignment[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return [...duplicates];
}
