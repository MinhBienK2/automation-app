import { X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

type ObjectEditorProps = {
  value: string;
  onChange: (val: string) => void;
};

export function ObjectEditor({ value, onChange }: ObjectEditorProps) {
  let obj: Record<string, string> = {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      obj = {};
      for (const [k, v] of Object.entries(parsed)) {
        obj[k] = String(v);
      }
    }
  } catch {
    // fallback
  }

  const entries = Object.entries(obj);

  const updateEntryKey = (index: number, newKey: string) => {
    const next: Record<string, string> = {};
    entries.forEach(([k, v], i) => {
      const targetKey = i === index ? newKey : k;
      next[targetKey] = v;
    });
    onChange(JSON.stringify(next));
  };

  const updateEntryValue = (index: number, newVal: string) => {
    const next: Record<string, string> = {};
    entries.forEach(([k, v], i) => {
      next[k] = i === index ? newVal : v;
    });
    onChange(JSON.stringify(next));
  };

  const addField = () => {
    const next = { ...obj, [`key_${entries.length + 1}`]: "" };
    onChange(JSON.stringify(next));
  };

  const removeField = (keyToRemove: string) => {
    const next = { ...obj };
    delete next[keyToRemove];
    onChange(JSON.stringify(next));
  };

  return (
    <div className="flex flex-col gap-2 pl-4 border-l border-[var(--app-border)] mt-3">
      <span className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider font-semibold">Object Fields</span>
      {entries.map(([k, v], index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={k}
            onChange={(e) => updateEntryKey(index, e.currentTarget.value)}
            placeholder="Key"
            className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)] w-1/3"
          />
          <Input
            value={v}
            onChange={(e) => updateEntryValue(index, e.currentTarget.value)}
            placeholder="Value"
            className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)] flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeField(k)}
            className="h-8 w-8 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addField}
        className="self-start text-[11px] h-7 px-3 mt-1"
      >
        + Add Field
      </Button>
    </div>
  );
}
