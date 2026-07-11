import { useRef } from "react";
import type { VariableAssignment, VariableValueType, ObjectFieldAssignment } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { X } from "lucide-react";
import { MathIconButton, VariableIconButton } from "./WorkflowIconButtons";
import { TemplateTextField, type TemplateTextFieldRef } from "./TemplateTextField";

type SetVariableConfig = {
  name?: string | null;
  value?: string | null;
  value_type?: VariableValueType | null;
  variables?: VariableAssignment[];
};


export function SetVariablesConfigFields({
  config,
  onChange,
}: {
  config: SetVariableConfig;
  onChange: (config: SetVariableConfig) => void;
}) {
  const rows = variableRowsFromConfig(config);
  const duplicateNames = duplicateVariableNames(rows);
  const itemRefs = useRef<(TemplateTextFieldRef | null)[]>([]);

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
    itemRefs.current.splice(index, 1);
  }

  return (
    <div className="variable-row-table-v2">
      {rows.map((row, index) => {
        const showMath = row.value_type !== "json" && row.value_type !== "boolean";
        return (
          <div className="variable-row-group-card" key={index}>
            {/* Row 1: Name and Value */}
            <div className="variable-row-line-one">
              <div className="variable-row-field">
                <Label htmlFor={`var-name-${index}`} className="text-xs text-[var(--app-text-secondary)] font-medium">Name</Label>
                <Input
                  id={`var-name-${index}`}
                  aria-label={`Variable ${index + 1} name`}
                  placeholder="Variable name"
                  value={row.name}
                  onChange={(event) => updateRow(index, { name: event.currentTarget.value })}
                  className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)]"
                />
              </div>
              <div className="variable-row-field">
                <Label htmlFor={`var-value-${index}`} className="text-xs text-[var(--app-text-secondary)] font-medium">Value</Label>
                <TemplateTextField
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  id={`var-value-${index}`}
                  label=""
                  value={row.value}
                  onChange={(value) => updateRow(index, { value })}
                  placeholder="Value"
                  hideCompactButtons={true}
                />
              </div>
            </div>

            {/* Row 2: Type and Action Buttons */}
            <div className="variable-row-line-two">
              <div className="variable-row-type-select">
                <span className="text-xs text-[var(--app-text-secondary)] font-medium">Type:</span>
                <Select
                  aria-label={`Variable ${index + 1} type`}
                  value={row.value_type}
                  onChange={(event) =>
                    updateRow(index, { value_type: event.currentTarget.value as VariableValueType })
                  }
                  className="h-7 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)] py-0"
                >
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </Select>
              </div>

              <div className="variable-row-actions">
                {showMath && (
                  <MathIconButton
                    label={`Insert math for variable ${index + 1}`}
                    onClick={() => itemRefs.current[index]?.insertMath()}
                    size="md"
                  />
                )}
                <VariableIconButton
                  label={`Insert variable for variable ${index + 1}`}
                  onClick={() => itemRefs.current[index]?.toggleBraces()}
                  size="md"
                />
                <Button
                  aria-label={`Remove variable ${index + 1}`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(index)}
                  className="h-7 w-7 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
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
        className="mt-2 text-xs"
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

export function CreateObjectManualFields({
  fields,
  onChange,
}: {
  fields: ObjectFieldAssignment[];
  onChange: (fields: ObjectFieldAssignment[]) => void;
}) {
  const rows = fields || [];
  const duplicateKeys = duplicateFieldKeys(rows);
  const itemRefs = useRef<(TemplateTextFieldRef | null)[]>([]);

  function updateRow(index: number, patch: Partial<ObjectFieldAssignment>) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function removeRow(index: number) {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(nextRows.length ? nextRows : [emptyFieldRow()]);
    itemRefs.current.splice(index, 1);
  }

  return (
    <div className="variable-row-table-v2">
      {rows.map((row, index) => {
        const showMath = row.value_type !== "json" && row.value_type !== "boolean";
        return (
          <div className="variable-row-group-card" key={index}>
            {/* Row 1: Key and Value */}
            <div className="variable-row-line-one">
              <div className="variable-row-field">
                <Label htmlFor={`field-key-${index}`} className="text-xs text-[var(--app-text-secondary)] font-medium">Key Path</Label>
                <Input
                  id={`field-key-${index}`}
                  aria-label={`Field ${index + 1} key`}
                  placeholder="e.g. name or user.age"
                  value={row.key}
                  onChange={(event) => updateRow(index, { key: event.currentTarget.value })}
                  className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)]"
                />
              </div>
              <div className="variable-row-field">
                <Label htmlFor={`field-value-${index}`} className="text-xs text-[var(--app-text-secondary)] font-medium">Value</Label>
                <TemplateTextField
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  id={`field-value-${index}`}
                  label=""
                  value={row.value}
                  onChange={(value) => updateRow(index, { value })}
                  placeholder="Value"
                  hideCompactButtons={true}
                />
              </div>
            </div>

            {/* Row 2: Type and Action Buttons */}
            <div className="variable-row-line-two">
              <div className="variable-row-type-select">
                <span className="text-xs text-[var(--app-text-secondary)] font-medium">Type:</span>
                <Select
                  aria-label={`Field ${index + 1} type`}
                  value={row.value_type}
                  onChange={(event) =>
                    updateRow(index, { value_type: event.currentTarget.value as VariableValueType })
                  }
                  className="h-7 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)] py-0"
                >
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </Select>
              </div>

              <div className="variable-row-actions">
                {showMath && (
                  <MathIconButton
                    label={`Insert math for field ${index + 1}`}
                    onClick={() => itemRefs.current[index]?.insertMath()}
                    size="md"
                  />
                )}
                <VariableIconButton
                  label={`Insert variable for field ${index + 1}`}
                  onClick={() => itemRefs.current[index]?.toggleBraces()}
                  size="md"
                />
                <Button
                  aria-label={`Remove field ${index + 1}`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(index)}
                  className="h-7 w-7 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      {duplicateKeys.length ? (
        <p className="variable-warning">
          Duplicate keys overwrite earlier rows: {duplicateKeys.join(", ")}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...rows, emptyFieldRow()])}
        className="mt-2 text-xs"
      >
        Add field row
      </Button>
    </div>
  );
}

function emptyFieldRow(): ObjectFieldAssignment {
  return { key: "", value_type: "text", value: "" };
}

function duplicateFieldKeys(rows: ObjectFieldAssignment[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}
