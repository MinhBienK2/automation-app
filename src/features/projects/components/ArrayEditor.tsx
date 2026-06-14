import { X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

type ArrayEditorProps = {
  value: string;
  onChange: (val: string) => void;
};

export function ArrayEditor({ value, onChange }: ArrayEditorProps) {
  let arr: string[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      arr = parsed.map(String);
    }
  } catch {
    // fallback
  }

  const updateItem = (index: number, val: string) => {
    const next = [...arr];
    next[index] = val;
    onChange(JSON.stringify(next));
  };

  const addItem = () => {
    const next = [...arr, ""];
    onChange(JSON.stringify(next));
  };

  const removeItem = (index: number) => {
    const next = arr.filter((_, i) => i !== index);
    onChange(JSON.stringify(next));
  };

  return (
    <div className="flex flex-col gap-2 pl-4 border-l border-[var(--app-border)] mt-3">
      <span className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider font-semibold">Array Elements</span>
      {arr.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(e) => updateItem(index, e.currentTarget.value)}
            placeholder={`Element ${index + 1}`}
            className="h-8 text-xs bg-[var(--app-surface-hover)] border-[var(--app-border)]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeItem(index)}
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
        onClick={addItem}
        className="self-start text-[11px] h-7 px-3 mt-1"
      >
        + Add Element
      </Button>
    </div>
  );
}
