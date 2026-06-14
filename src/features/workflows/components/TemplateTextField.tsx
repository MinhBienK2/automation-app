import { useMemo, useRef, useState, useEffect, useId, forwardRef, useImperativeHandle, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { Braces, Calculator } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";


type VariableOption = {
  name: string;
  source: string;
};

export const VariableOptionsContext = createContext<VariableOption[]>([]);

const defaultVariableOptions: VariableOption[] = [
  { name: "system.loop.index", source: "Loop current item" },
  { name: "system.loop.number", source: "Loop current item" },
  { name: "last_error", source: "System outputs" },
];

export interface TemplateTextFieldRef {
  insertMath: () => void;
  toggleBraces: () => void;
}

type TemplateTextFieldProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variableOptions?: VariableOption[];
  hideCompactButtons?: boolean;
};

export const TemplateTextField = forwardRef<TemplateTextFieldRef, TemplateTextFieldProps>(
  (
    {
      id,
      label,
      value,
      onChange,
      placeholder,
      variableOptions = defaultVariableOptions,
      hideCompactButtons = false,
    },
    ref,
  ) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();

  useImperativeHandle(ref, () => ({
    insertMath,
    toggleBraces: () => setOpen((current) => !current),
  }));

  const normalizedQuery = query.trim().toLowerCase();
  const contextOptions = useContext(VariableOptionsContext);
  const allOptions = useMemo(() => mergeVariableOptions(variableOptions, contextOptions), [variableOptions, contextOptions]);
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

  function insertMath() {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const selectedText = value.slice(start, end);

    if (!value.trim().startsWith("=")) {
      const mathText = selectedText ? `(${selectedText} + 1)` : `(1 + 1)`;
      const newValue = `=${value.slice(0, start)}${mathText}${value.slice(end)}`;
      onChange(newValue);
      
      setTimeout(() => {
        input.focus();
        if (selectedText) {
          input.setSelectionRange(0, newValue.length);
        } else {
          const selectStart = 1 + start;
          const selectEnd = selectStart + 5;
          input.setSelectionRange(selectStart, selectEnd);
        }
      }, 0);
    } else {
      const mathText = selectedText ? `(${selectedText} + 1)` : `(1 + 1)`;
      const newValue = `${value.slice(0, start)}${mathText}${value.slice(end)}`;
      onChange(newValue);
      
      setTimeout(() => {
        input.focus();
        if (selectedText) {
          input.setSelectionRange(start, start + mathText.length);
        } else {
          input.setSelectionRange(start, start + 5);
        }
      }, 0);
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const hasLabel = Boolean(label && label.trim());

  return (
    <div className={hasLabel ? "space-y-1.5" : ""} ref={containerRef}>
      {hasLabel && (
        <div className="flex items-center justify-between">
          <Label htmlFor={inputId} className="text-sm font-medium text-[var(--app-text)]">{label}</Label>
          <div className="flex items-center gap-1.5">
            <Button
              aria-label={`Insert math for ${label}`}
              type="button"
              variant="ghost"
              size="sm"
              onClick={insertMath}
              className="h-5 w-5 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
            >
              <Calculator className="h-3 w-3" />
            </Button>
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
        </div>
      )}

      <div className="highlight-input-container">
        <div ref={backdropRef} className="highlight-input-backdrop">
          {highlightTemplateTokens(value)}
        </div>
        <input
          id={id || inputId}
          ref={inputRef}
          type="text"
          className={`highlight-input-element ${
            hasLabel || hideCompactButtons ? "" : "highlight-input-element-compact"
          }`}
          value={value}
          placeholder={placeholder}
          onScroll={handleScroll}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {!hasLabel && !hideCompactButtons && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-[3]">
            <Button
              aria-label="Insert math"
              type="button"
              variant="ghost"
              size="sm"
              onClick={insertMath}
              className="h-5 w-5 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
            >
              <Calculator className="h-3 w-3" />
            </Button>
            <Button
              aria-expanded={open}
              aria-label="Insert variable"
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen((current) => !current)}
              className="h-5 w-5 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
            >
              <Braces className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {open && createPortal(
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
});

type TemplateTextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variableOptions?: VariableOption[];
  showMath?: boolean;
};

export function TemplateTextareaField({
  label,
  value,
  onChange,
  placeholder,
  variableOptions = defaultVariableOptions,
  showMath = true,
}: TemplateTextareaFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const textareaId = useId();

  const normalizedQuery = query.trim().toLowerCase();
  const contextOptions = useContext(VariableOptionsContext);
  const allOptions = useMemo(() => mergeVariableOptions(variableOptions, contextOptions), [variableOptions, contextOptions]);
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
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    setOpen(false);
    setQuery("");

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = start + token.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  function insertMath() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selectedText = value.slice(start, end);

    if (!value.trim().startsWith("=")) {
      const mathText = selectedText ? `(${selectedText} + 1)` : `(1 + 1)`;
      const newValue = `=${value.slice(0, start)}${mathText}${value.slice(end)}`;
      onChange(newValue);
      
      setTimeout(() => {
        textarea.focus();
        if (selectedText) {
          textarea.setSelectionRange(0, newValue.length);
        } else {
          const selectStart = 1 + start;
          const selectEnd = selectStart + 5;
          textarea.setSelectionRange(selectStart, selectEnd);
        }
      }, 0);
    } else {
      const mathText = selectedText ? `(${selectedText} + 1)` : `(1 + 1)`;
      const newValue = `${value.slice(0, start)}${mathText}${value.slice(end)}`;
      onChange(newValue);
      
      setTimeout(() => {
        textarea.focus();
        if (selectedText) {
          textarea.setSelectionRange(start, start + mathText.length);
        } else {
          textarea.setSelectionRange(start, start + 5);
        }
      }, 0);
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label htmlFor={textareaId} className="text-sm font-medium text-[var(--app-text)]">{label}</Label>
        <div className="flex items-center gap-1.5">
          {showMath && (
            <Button
              aria-label={`Insert math for ${label}`}
              type="button"
              variant="ghost"
              size="sm"
              onClick={insertMath}
              className="h-5 w-5 p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)]"
            >
              <Calculator className="h-3 w-3" />
            </Button>
          )}
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
      </div>

      <div className="highlight-textarea-container">
        <div ref={backdropRef} className="highlight-textarea-backdrop">
          {highlightTemplateTokens(value)}
        </div>
        <textarea
          id={textareaId}
          ref={textareaRef}
          className="highlight-textarea-element"
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
            top: popoverCoords.top,
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
  );}

function mergeVariableOptions(options: VariableOption[], contextOptions: VariableOption[] = []) {
  const seen = new Set<string>();
  return [...options, ...contextOptions, ...defaultVariableOptions].filter((option) => {
    const key = `${option.source}:${option.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rememberVariableOptions(_options: VariableOption[]) {
  // Deprecated: No longer needed as we use VariableOptionsContext to retrieve active variables reactively
}

export function getAvailableVariableOptions(extraOptions: VariableOption[] = []): VariableOption[] {
  return mergeVariableOptions(extraOptions, []);
}

export type { VariableOption };

function highlightTemplateTokens(value: string) {
  const isMath = value.trim().startsWith("=");
  const parts = value.split(/(\{\{\s*[a-zA-Z0-9_.:-]+\s*\}\})/g);
  return parts.map((part, index) => {
    if (/^\{\{\s*[a-zA-Z0-9_.:-]+\s*\}\}$/.test(part)) {
      return (
        <span className="template-token-highlight text-[var(--app-accent)]" key={`${part}-${index}`}>
          {part}
        </span>
      );
    } else {
      if (isMath) {
        const subparts = part.split(/([=()])/g);
        return (
          <span key={`${part}-${index}`}>
            {subparts.map((subpart, subIndex) =>
              /^[=()]$/.test(subpart) ? (
                <span className="math-token-highlight" key={`${subpart}-${subIndex}`}>
                  {subpart}
                </span>
              ) : (
                subpart
              ),
            )}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    }
  });
}
