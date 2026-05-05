import { useMemo, useRef, useState } from "react";
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

type TemplateTextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function TemplateTextareaField({
  label,
  value,
  onChange,
  placeholder,
}: TemplateTextareaFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const options = useMemo(
    () =>
      normalizedQuery
        ? defaultVariableOptions.filter(
            (option) =>
              option.name.toLowerCase().includes(normalizedQuery) ||
              option.source.toLowerCase().includes(normalizedQuery),
          )
        : defaultVariableOptions,
    [normalizedQuery],
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

function highlightTemplateTokens(value: string) {
  const parts = value.split(/(\{\{\s*[a-zA-Z0-9_.:-]+\s*\}\})/g);
  return parts.map((part, index) =>
    /^\{\{\s*[a-zA-Z0-9_.:-]+\s*\}\}$/.test(part) ? (
      <span className="template-token-highlight" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}
