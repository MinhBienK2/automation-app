import { useMemo, useRef, useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Braces } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";


type VariableOption = {
  name: string;
  source: string;
};

const defaultVariableOptions: VariableOption[] = [
  { name: "user.name", source: "Set JSON Variables" },
  { name: "roles", source: "Set JSON Variables" },
  { name: "loop.index", source: "Loop current item" },
  { name: "loop.number", source: "Loop current item" },
  { name: "last_error", source: "System outputs" },
];

let rememberedVariableOptions: VariableOption[] = [];

type TemplateTextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variableOptions?: VariableOption[];
};

export function TemplateTextField({
  label,
  value,
  onChange,
  placeholder,
  variableOptions = defaultVariableOptions,
}: TemplateTextFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();

  const normalizedQuery = query.trim().toLowerCase();
  const allOptions = useMemo(() => mergeVariableOptions(variableOptions), [variableOptions]);
  const options = useMemo(
    () =>
      normalizedQuery
        ? allOptions.filter(
            (option) =>
              option.name.toLowerCase().includes(normalizedQuery) ||
              option.source.toLowerCase().includes(normalizedQuery),
          )
        : allOptions,
    [allOptions, normalizedQuery],
  );

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPopoverCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        containerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    setOpen(false);
    setQuery("");

    setTimeout(() => {
      if (input) {
        input.focus();
        const newPos = start + token.length;
        input.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="text-sm font-medium text-[var(--app-text)]">{label}</Label>
        <Button
          aria-expanded={open}
          aria-label={`Insert variable for ${label}`}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((current) => !current)}
          className="h-5 w-5 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
        >
          <Braces className="h-3 w-3" />
        </Button>
      </div>

      <div className="highlight-input-container">
        <div ref={backdropRef} className="highlight-input-backdrop">
          {highlightTemplateTokens(value)}
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          className="highlight-input-element"
          value={value}
          placeholder={placeholder}
          onScroll={handleScroll}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="variable-picker absolute z-[9999] bg-[#0b1016] border border-[#233240] rounded-md shadow-lg p-2 flex flex-col gap-2"
          style={{
            top: popoverCoords.top + 4,
            left: popoverCoords.left,
            width: popoverCoords.width,
          }}
          role="listbox"
          aria-label={`${label} variables`}
        >
          <Input
            aria-label="Search variables"
            value={query}
            placeholder="Search variables..."
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="h-8 text-xs"
          />
          <div className="variable-picker-options max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {options.map((option) => (
              <button
                aria-label={`${option.name} ${option.source}`}
                key={`${option.source}:${option.name}`}
                role="option"
                type="button"
                className="w-full text-left px-2 py-1.5 hover:bg-[#121c26] text-xs text-[var(--app-text)] rounded flex justify-between items-center"
                onClick={() => insertVariable(option.name)}
              >
                <span className="font-mono">{option.name}</span>
                <small className="text-[9px] text-[var(--app-text-muted)]">{option.source}</small>
              </button>
            ))}
            {options.length === 0 && (
              <p className="text-xs text-[var(--app-text-muted)] p-2 text-center">No variables found</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

type TemplateTextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variableOptions?: VariableOption[];
};

export function TemplateTextareaField({
  label,
  value,
  onChange,
  placeholder,
  variableOptions = defaultVariableOptions,
}: TemplateTextareaFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const allOptions = useMemo(() => mergeVariableOptions(variableOptions), [variableOptions]);
  const options = useMemo(
    () =>
      normalizedQuery
        ? allOptions.filter(
            (option) =>
              option.name.toLowerCase().includes(normalizedQuery) ||
              option.source.toLowerCase().includes(normalizedQuery),
          )
        : allOptions,
    [allOptions, normalizedQuery],
  );

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="template-field">
      <Label>
        {label}
        <Textarea
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </Label>
      <div className="template-field-actions">
        <Button
          aria-expanded={open}
          aria-label={`Insert variable for ${label}`}
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((current) => !current)}
        >
          Insert variable
        </Button>
      </div>
      {open ? (
        <div className="variable-picker" role="listbox" aria-label={`${label} variables`}>
          <Input
            aria-label="Search variables"
            value={query}
            placeholder="Search variables..."
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <div className="variable-picker-options">
            {options.map((option) => (
              <button
                aria-label={`${option.name} ${option.source}`}
                key={`${option.source}:${option.name}`}
                role="option"
                type="button"
                onClick={() => insertVariable(option.name)}
              >
                <span>{option.name}</span>
                <small>{option.source}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {value.includes("{{") ? (
        <div className="template-preview" aria-label={`${label} token preview`}>
          {highlightTemplateTokens(value)}
        </div>
      ) : null}
    </div>
  );
}

function mergeVariableOptions(options: VariableOption[]) {
  const seen = new Set<string>();
  return [...options, ...rememberedVariableOptions, ...defaultVariableOptions].filter((option) => {
    const key = `${option.source}:${option.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rememberVariableOptions(options: VariableOption[]) {
  rememberedVariableOptions = mergeVariableOptions(options).filter(
    (option) => option.source !== "Loop current item" && option.source !== "System outputs",
  );
}

export function getAvailableVariableOptions(extraOptions: VariableOption[] = []): VariableOption[] {
  return mergeVariableOptions(extraOptions);
}

export type { VariableOption };

function highlightTemplateTokens(value: string) {
  const parts = value.split(/(\{\{\s*[a-zA-Z0-9_.:-]+\s*\}\})/g);
  return parts.map((part, index) =>
    /^\{\{\s*[a-zA-Z0-9_.:-]+\s*\}\}$/.test(part) ? (
      <span className="template-token-highlight text-[var(--app-accent)]" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}
