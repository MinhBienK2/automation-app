import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { Input } from "../../../components/ui/input";
import { VariableOptionsContext } from "./TemplateTextField";

export type VariableOption = {
  name: string;
  source: string;
  evaluation_type?: "static" | "dynamic";
};

type VariableAutocompletePopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  variableOptions: VariableOption[];
  label: string;
  isJs?: boolean;
};

export function VariableAutocompletePopover({
  open,
  onClose,
  anchorRef,
  inputRef,
  value,
  onChange,
  variableOptions,
  label,
  isJs = false,
}: VariableAutocompletePopoverProps) {
  const [query, setQuery] = useState("");
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, width: 0 });
  const [activeTab, setActiveTab] = useState<"static" | "dynamic">("static");
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const contextOptions = useContext(VariableOptionsContext);
  const allOptions = useMemo(
    () => mergeVariableOptions(variableOptions, contextOptions),
    [variableOptions, contextOptions]
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setQuery("");
    }
  }, [open]);

  const options = useMemo(() => {
    const filteredByTab = allOptions.filter((option) => {
      const isDynamic = option.evaluation_type === "dynamic";
      return activeTab === "dynamic" ? isDynamic : !isDynamic;
    });
    return normalizedQuery
      ? filteredByTab.filter(
          (option) =>
            option.name.toLowerCase().includes(normalizedQuery) ||
            option.source.toLowerCase().includes(normalizedQuery)
        )
      : filteredByTab;
  }, [allOptions, normalizedQuery, activeTab]);

  const updateCoords = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverHeight = popoverRef.current ? popoverRef.current.offsetHeight : 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
        top = rect.top - popoverHeight - 4 + window.scrollY;
      } else {
        top = rect.bottom + 4 + window.scrollY;
      }

      setPopoverCoords({
        top,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      const timer = setTimeout(updateCoords, 0);
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
      };
    }
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  function insertVariable(name: string) {
    let token = `{{${name}}}`;
    if (isJs) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
        token = `outputs.${name}`;
      } else {
        token = `outputs["${name}"]`;
      }
    }
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    onClose();

    setTimeout(() => {
      if (input) {
        input.focus();
        const newPos = start + token.length;
        input.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="variable-picker absolute z-[9999] bg-[#0b1016] border border-[#233240] rounded-md shadow-lg p-2 flex flex-col gap-2"
      style={{
        top: popoverCoords.top,
        left: popoverCoords.left,
        width: popoverCoords.width,
      }}
      role="listbox"
      aria-label={`${label} variables`}
    >
      <div className="flex border-b border-[#233240]">
        <button
          type="button"
          className={`flex-1 py-1 text-center text-xs font-semibold border-b-2 transition-all ${
            activeTab === "static"
              ? "border-[var(--app-accent)] text-[var(--app-accent-text)]"
              : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          }`}
          onClick={() => setActiveTab("static")}
        >
          Static
        </button>
        <button
          type="button"
          className={`flex-1 py-1 text-center text-xs font-semibold border-b-2 transition-all ${
            activeTab === "dynamic"
              ? "border-[var(--app-accent)] text-[var(--app-accent-text)]"
              : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          }`}
          onClick={() => setActiveTab("dynamic")}
        >
          Dynamic
        </button>
      </div>
      <Input
        ref={searchInputRef}
        aria-label="Search variables"
        value={query}
        placeholder="Search variables..."
        onChange={(event) => setQuery(event.currentTarget.value)}
        className="h-8 text-xs"
      />
      <div className="variable-picker-options max-h-48 overflow-y-auto flex flex-col gap-0.5">
        {options.map((option) => (
          <button
            aria-label={`${
              isJs
                ? /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(option.name)
                  ? `outputs.${option.name}`
                  : `outputs["${option.name}"]`
                : option.name
            } ${option.source}`}
            key={`${option.source}:${option.name}`}
            role="option"
            type="button"
            className="w-full text-left px-2 py-1.5 hover:bg-[#121c26] text-xs text-[var(--app-text)] rounded flex justify-between items-center"
            onClick={() => insertVariable(option.name)}
          >
            <span className="font-mono">
              {isJs
                ? /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(option.name)
                  ? `outputs.${option.name}`
                  : `outputs["${option.name}"]`
                : option.name}
            </span>
            <small className="text-[9px] text-[var(--app-text-muted)]">{option.source}</small>
          </button>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-[var(--app-text-muted)] p-2 text-center">No variables found</p>
        )}
      </div>
    </div>,
    document.body
  );
}

function mergeVariableOptions(
  primary: VariableOption[],
  secondary: VariableOption[],
): VariableOption[] {
  const seen = new Set<string>();
  const results: VariableOption[] = [];
  for (const option of primary) {
    seen.add(option.name);
    results.push(option);
  }
  for (const option of secondary) {
    if (!seen.has(option.name)) {
      seen.add(option.name);
      results.push(option);
    }
  }
  return results;
}
