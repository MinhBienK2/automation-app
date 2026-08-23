import { useRef } from "react";
import type { VariableValueType } from "../../../../types/workflow";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { X } from "lucide-react";
import { VariableIconButton } from "../graph/WorkflowIconButtons";
import { TemplateTextField, type TemplateTextFieldRef, type VariableOption } from "./TemplateTextField";

export type KeyValueRowBase = {
  value_type: VariableValueType;
  value: string;
};

/** Names of rows whose key collides with an earlier row. */
export function duplicateRowKeys<K extends string>(
  rows: Array<Record<K, string>>,
  keyProp: K,
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = row[keyProp].trim();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

export type KeyValueRowsProps<T extends KeyValueRowBase & Record<string, unknown>> = {
  rows: T[];
  onChange: (rows: T[]) => void;
  emptyRow: () => T;
  /** Property holding the row's identity ("name" or "key"). */
  keyProp: "name" | "key";
  /** Field label above the key input ("Name" / "Key Path"). */
  keyLabel: string;
  keyPlaceholder: string;
  /** Lower-case entity word used to build aria labels ("variable" / "field"). */
  entity: "variable" | "field";
  /** Capitalized form for aria labels ("Variable" / "Field"). */
  Entity: string;
  /** Warning prefix, e.g. "Duplicate paths overwrite earlier rows:". */
  duplicateWarningPrefix: string;
  addLabel: string;
  variableOptions?: VariableOption[];
};

/**
 * One add/remove/type-tagged list of key→template-value rows. The variance
 * between callers is the row record and its labels — everything else
 * (add/remove/duplicate-warning/insert-variable) lives here once.
 */
export function KeyValueRows<T extends KeyValueRowBase & Record<string, unknown>>({
  rows,
  onChange,
  emptyRow,
  keyProp,
  keyLabel,
  keyPlaceholder,
  entity,
  Entity,
  duplicateWarningPrefix,
  addLabel,
  variableOptions,
}: KeyValueRowsProps<T>) {
  const itemRefs = useRef<(TemplateTextFieldRef | null)[]>([]);
  const keyWord = keyProp === "name" ? "name" : "key";
  const duplicates = duplicateRowKeys(
    rows as unknown as Array<Record<"name", string>>,
    keyProp as "name",
  );

  function updateRow(index: number, patch: Partial<T>) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(nextRows.length ? nextRows : [emptyRow()]);
    itemRefs.current.splice(index, 1);
  }

  return (
    <div className="variable-row-table-v2">
      {rows.map((row, index) => (
        <div className="variable-row-group-card" key={index}>
          {/* Row 1: Key and Value */}
          <div className="variable-row-line-one">
            <div className="variable-row-field">
              <Label htmlFor={`kv-${entity}-key-${index}`} className="text-xs text-[var(--app-text-secondary)] font-medium">{keyLabel}</Label>
              <Input
                id={`kv-${entity}-key-${index}`}
                aria-label={`${Entity} ${index + 1} ${keyWord}`}
                placeholder={keyPlaceholder}
                value={row[keyProp] as string}
                onChange={(event) => updateRow(index, { [keyProp]: event.currentTarget.value } as Partial<T>)}
                className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)]"
              />
            </div>
            <div className="variable-row-field">
              <Label htmlFor={`kv-${entity}-value-${index}`} className="text-xs text-[var(--app-text-secondary)] font-medium">Value</Label>
              <TemplateTextField
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                id={`kv-${entity}-value-${index}`}
                label=""
                value={row.value}
                onChange={(value) => updateRow(index, { value } as Partial<T>)}
                placeholder="Value"
                hideCompactButtons={true}
                variableOptions={variableOptions}
              />
            </div>
          </div>

          {/* Row 2: Type and Action Buttons */}
          <div className="variable-row-line-two">
            <div className="variable-row-type-select">
              <span className="text-xs text-[var(--app-text-secondary)] font-medium">Type:</span>
              <Select
                aria-label={`${Entity} ${index + 1} type`}
                value={row.value_type}
                onChange={(event) =>
                  updateRow(index, { value_type: event.currentTarget.value as VariableValueType } as Partial<T>)
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
              <VariableIconButton
                label={`Insert variable for ${entity} ${index + 1}`}
                onClick={() => itemRefs.current[index]?.toggleBraces()}
                size="md"
              />
              <Button
                aria-label={`Remove ${entity} ${index + 1}`}
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
      ))}
      {duplicates.length ? (
        <p className="variable-warning">
          {duplicateWarningPrefix} {duplicates.join(", ")}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...rows, emptyRow()])}
        className="mt-2 text-xs"
      >
        {addLabel}
      </Button>
    </div>
  );
}
