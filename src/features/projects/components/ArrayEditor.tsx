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
    <div className="flex flex-col gap-2 pl-4 border-l border-base-300 mt-2">
      <span className="text-[10px] text-secondary uppercase tracking-wider font-bold">Array Elements</span>
      {arr.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(e) => updateItem(index, e.currentTarget.value)}
            placeholder={`Element ${index + 1}`}
            className="input-xs border-base-300 w-full"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => removeItem(index)}
            className="btn-xs btn-circle text-secondary hover:text-error hover:bg-error/10"
            aria-label="Remove element"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={addItem}
        className="self-start btn-xs mt-1"
      >
        + Add Element
      </Button>
    </div>
  );
}
