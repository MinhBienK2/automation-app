import { useRef, useState, useId, forwardRef, useImperativeHandle, createContext } from "react";
import { Label } from "../../../components/ui/label";
import { MathIconButton, VariableIconButton } from "./WorkflowIconButtons";
import { VariableAutocompletePopover, type VariableOption } from "./VariableAutocompletePopover";

export const VariableOptionsContext = createContext<VariableOption[]>([]);

export const defaultVariableOptions: VariableOption[] = [
  { name: "system.loop.index", source: "Loop current item" },
  { name: "system.loop.number", source: "Loop current item" },
  { name: "system.last_error", source: "System outputs" },
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
  isJs?: boolean;
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
      isJs = false,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const backdropRef = useRef<HTMLDivElement | null>(null);
    const inputId = useId();

    useImperativeHandle(ref, () => ({
      insertMath,
      toggleBraces: () => setOpen((current) => !current),
    }));

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
              <MathIconButton
                label={`Insert math for ${label}`}
                onClick={insertMath}
                size="sm"
              />
              <VariableIconButton
                open={open}
                label={`Insert variable for ${label}`}
                onClick={() => setOpen((current) => !current)}
                size="sm"
              />
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
              <MathIconButton
                label="Insert math"
                onClick={insertMath}
                size="sm"
              />
              <VariableIconButton
                open={open}
                label="Insert variable"
                onClick={() => setOpen((current) => !current)}
                size="sm"
              />
            </div>
          )}
        </div>

        <VariableAutocompletePopover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={containerRef}
          inputRef={inputRef}
          value={value}
          onChange={onChange}
          variableOptions={variableOptions}
          label={label}
          isJs={isJs}
        />
      </div>
    );
  }
);

type TemplateTextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variableOptions?: VariableOption[];
  showMath?: boolean;
  isJs?: boolean;
};

export function TemplateTextareaField({
  label,
  value,
  onChange,
  placeholder,
  variableOptions = defaultVariableOptions,
  showMath = true,
  isJs = false,
}: TemplateTextareaFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const textareaId = useId();

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
            <MathIconButton
              label={`Insert math for ${label}`}
              onClick={insertMath}
              size="sm"
            />
          )}
          <VariableIconButton
            open={open}
            label={`Insert variable for ${label}`}
            onClick={() => setOpen((current) => !current)}
            size="sm"
          />
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

      <VariableAutocompletePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={containerRef}
        inputRef={textareaRef}
        value={value}
        onChange={onChange}
        variableOptions={variableOptions}
        label={label}
        isJs={isJs}
      />
    </div>
  );
}

export function rememberVariableOptions(_options: VariableOption[]) {
  // Deprecated: No longer needed as we use VariableOptionsContext to retrieve active variables reactively
}

export function getAvailableVariableOptions(extraOptions: VariableOption[] = [], contextOptions: VariableOption[] = []): VariableOption[] {
  const seen = new Set<string>();
  return [...extraOptions, ...contextOptions, ...defaultVariableOptions].filter((option) => {
    const key = `${option.source}:${option.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
