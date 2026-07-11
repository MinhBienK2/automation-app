import { useState, useMemo, useId, useContext } from "react";
import { Hash, Braces } from "lucide-react";
import { NumberInput } from "../../../components/ui/number-input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { getAvailableVariableOptions, VariableOptionsContext, type VariableOption } from "./TemplateTextField";

type VariableNumericInputProps = {
  label: string;
  value: number | string | null | undefined;
  onChange: (value: number | string | null | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  variableOptions?: VariableOption[];
};

export function VariableNumericInput({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  variableOptions,
}: VariableNumericInputProps) {
  const inputId = useId();
  const contextOptions = useContext(VariableOptionsContext);
  const options = useMemo(() => getAvailableVariableOptions(variableOptions, contextOptions), [variableOptions, contextOptions]);
  const isVar = typeof value === "string" && value.startsWith("{{") && value.endsWith("}}");
  const [localVarMode, setLocalVarMode] = useState(isVar);

  const activeMode = isVar || localVarMode;
  const currentVal = value && typeof value === "string" ? value : "";
  const hasMatchingOption = options.some((opt) => `{{${opt.name}}}` === currentVal);

  const handleToggle = () => {
    if (activeMode) {
      setLocalVarMode(false);
      onChange(null);
    } else {
      setLocalVarMode(true);
      const defaultVar = options[0]?.name ? `{{${options[0].name}}}` : "";
      onChange(defaultVar);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="text-sm font-medium text-[var(--app-text)]">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          title={activeMode ? "Switch to static number" : "Switch to variable"}
          className="h-5 w-5 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
        >
          {activeMode ? <Hash className="h-3 w-3" /> : <Braces className="h-3 w-3" />}
        </Button>
      </div>

      <div className="flex gap-2">
        {activeMode ? (
          <Select
            id={inputId}
            value={currentVal}
            onChange={(e) => onChange(e.currentTarget.value)}
          >
            <option value="" disabled>Select variable...</option>
            {currentVal && !hasMatchingOption && (
              <option value={currentVal}>
                {currentVal.slice(2, -2)} (Custom)
              </option>
            )}
            {options.map((opt) => (
              <option key={`${opt.source}:${opt.name}`} value={`{{${opt.name}}}`}>
                {opt.name} ({opt.source})
              </option>
            ))}
          </Select>
        ) : (
          <NumberInput
            id={inputId}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            value={value !== null && value !== undefined && !isVar ? Number(value) : null}
            onChange={onChange}
            allowDecimals={true}
          />
        )}
      </div>
    </div>
  );
}
