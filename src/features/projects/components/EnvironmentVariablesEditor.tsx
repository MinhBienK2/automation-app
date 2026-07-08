import { useState, useEffect } from "react";
import { X, Plus, AlertTriangle } from "lucide-react";
import type { VariableValueType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Switch } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { ArrayEditor } from "./ArrayEditor";
import { ObjectEditor } from "./ObjectEditor";

export type EditorVariable = {
  name: string;
  value_type: VariableValueType;
  value: string;
  persist: boolean;
};

type EnvironmentVariablesEditorProps = {
  variables: EditorVariable[];
  onChange: (variables: EditorVariable[]) => void;
  showPersistOptions: boolean;
};

type UIVariableType = "text" | "number" | "boolean" | "json" | "array" | "object";

function getUIValueType(type: string, value: string): UIVariableType {
  if (type === "json") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return "array";
      if (parsed && typeof parsed === "object") return "object";
    } catch {
      // fallback
    }
  }
  return (type as UIVariableType) || "text";
}

export function EnvironmentVariablesEditor({
  variables,
  onChange,
  showPersistOptions,
}: EnvironmentVariablesEditorProps) {
  const [mode, setMode] = useState<"custom" | "json">("custom");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync state to json text when entering JSON mode
  useEffect(() => {
    if (mode === "json") {
      const serialized = variables.map(v => {
        const item: Record<string, any> = {
          name: v.name,
          value_type: v.value_type,
          value: v.value,
        };
        if (showPersistOptions) {
          item.persist = v.persist;
        }
        return item;
      });
      setJsonText(JSON.stringify(serialized, null, 2));
      setJsonError(null);
    }
  }, [mode, showPersistOptions, variables]);

  const updateVariable = (index: number, patch: Partial<EditorVariable>) => {
    const next = variables.map((v, idx) => (idx === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const removeVariable = (index: number) => {
    const next = variables.filter((_, idx) => idx !== index);
    onChange(next);
  };

  const addVariable = () => {
    const next: EditorVariable = {
      name: "",
      value_type: "text",
      value: "",
      persist: false,
    };
    onChange([...variables, next]);
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      if (!text.trim()) {
        setJsonError(null);
        onChange([]);
        return;
      }
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setJsonError("JSON must be an array of variables");
        return;
      }
      const mapped: EditorVariable[] = [];
      for (const [idx, item] of parsed.entries()) {
        if (!item || typeof item !== "object") {
          setJsonError(`Item at index ${idx} must be an object`);
          return;
        }
        if (typeof item.name !== "string") {
          setJsonError(`Item at index ${idx} must have a 'name' string`);
          return;
        }
        const name = item.name.trim();
        const value_type: VariableValueType = item.value_type || "text";
        if (!["text", "number", "boolean", "json"].includes(value_type)) {
          setJsonError(`Item at index ${idx} has invalid 'value_type'`);
          return;
        }
        let value = "";
        if (item.value !== undefined) {
          value = typeof item.value === "string" ? item.value : JSON.stringify(item.value);
        }
        mapped.push({
          name,
          value_type,
          value,
          persist: showPersistOptions ? Boolean(item.persist) : false,
        });
      }
      setJsonError(null);
      onChange(mapped);
    } catch (err: any) {
      setJsonError(err.message || "Invalid JSON syntax");
    }
  };

  const duplicateNames = duplicateVariableNames(variables);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <SegmentedControl
          ariaLabel="Editor mode"
          value={mode}
          onValueChange={(val) => {
            if (mode === "json" && jsonError) return;
            setMode(val);
          }}
          options={[
            { label: "Custom Form", value: "custom" },
            { label: "Raw JSON", value: "json" },
          ]}
        />
        {mode === "custom" && (
          <Button type="button" onClick={addVariable} size="sm" aria-label="Add variable row" className="btn-sm flex items-center gap-1">
            <Plus className="h-4 w-4" />
            <span>Add Variable</span>
          </Button>
        )}
      </div>

      {mode === "custom" ? (
        <div className="flex flex-col gap-3">
          {variables.length === 0 ? (
            <div className="text-center py-8 text-xs text-secondary border border-dashed border-base-300 rounded-lg">
              No environment variables defined.
            </div>
          ) : (
            variables.map((variable, index) => {
              const uiType = getUIValueType(variable.value_type, variable.value);
              return (
                <div key={index} className="card bg-base-200 border border-base-300 card-body p-4 gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`var-name-${index}`} className="text-xs">Name</Label>
                      <Input
                        id={`var-name-${index}`}
                        aria-label={`Variable ${index + 1} name`}
                        placeholder="VARIABLE_NAME"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, { name: e.currentTarget.value })}
                        className="input-sm border-base-300 w-full"
                      />
                    </div>
                    {uiType !== "array" && uiType !== "object" && (
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`var-val-${index}`} className="text-xs">Value</Label>
                        {uiType === "boolean" ? (
                          <Select
                            id={`var-val-${index}`}
                            value={variable.value === "true" ? "true" : "false"}
                            onChange={(e) => updateVariable(index, { value: e.currentTarget.value })}
                            className="select-sm border-base-300 bg-base-100 w-full"
                          >
                            <option value="false">false</option>
                            <option value="true">true</option>
                          </Select>
                        ) : (
                          <Input
                            id={`var-val-${index}`}
                            placeholder="Value"
                            value={variable.value}
                            onChange={(e) => updateVariable(index, { value: e.currentTarget.value })}
                            className="input-sm border-base-300 w-full"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {uiType === "array" && (
                    <ArrayEditor
                      value={variable.value}
                      onChange={(value) => updateVariable(index, { value })}
                    />
                  )}

                  {uiType === "object" && (
                    <ObjectEditor
                      value={variable.value}
                      onChange={(value) => updateVariable(index, { value })}
                    />
                  )}

                  <div className="flex justify-between items-center mt-2 pt-3 border-t border-base-300 gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-secondary font-medium">Type:</span>
                      <Select
                        value={uiType}
                        onChange={(e) => {
                          const nextType = e.currentTarget.value as UIVariableType;
                          let value_type: VariableValueType = "text";
                          let value = variable.value;
                          if (nextType === "array") {
                            value_type = "json";
                            value = "[]";
                          } else if (nextType === "object") {
                            value_type = "json";
                            value = "{}";
                          } else if (nextType === "json") {
                            value_type = "json";
                            value = "";
                          } else {
                            value_type = nextType as VariableValueType;
                            if (nextType === "boolean") value = "false";
                            else if (nextType === "number") value = "0";
                            else value = "";
                          }
                          updateVariable(index, { value_type, value });
                        }}
                        className="select-xs border-base-300 bg-base-100 py-0"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="array">Array</option>
                        <option value="object">Object</option>
                        <option value="json">JSON Text</option>
                      </Select>
                    </div>

                    <div className="flex items-center gap-4">
                      {showPersistOptions && (
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`persist-${index}`}
                            checked={variable.persist}
                            onCheckedChange={(checked) => updateVariable(index, { persist: checked })}
                          />
                          <Label htmlFor={`persist-${index}`} className="text-xs text-secondary cursor-pointer select-none">
                            Persist value after run
                          </Label>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeVariable(index)}
                        className="btn-xs btn-circle text-secondary hover:text-error hover:bg-error/10"
                        aria-label="Remove variable"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {duplicateNames.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-warning mt-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Duplicate variables: {duplicateNames.join(", ")} (last one overrides)</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.currentTarget.value)}
            placeholder="[ { &quot;name&quot;: &quot;VAR&quot;, &quot;value_type&quot;: &quot;text&quot;, &quot;value&quot;: &quot;val&quot; } ]"
            rows={15}
            className="font-mono text-xs bg-base-200 border-base-300 w-full"
          />
          {jsonError && (
            <div className="alert alert-error text-xs p-2.5 mt-2">
              {jsonError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function duplicateVariableNames(variables: Array<{ name: string }>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const v of variables) {
    const name = v.name.trim();
    if (!name) continue;
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return [...duplicates];
}
