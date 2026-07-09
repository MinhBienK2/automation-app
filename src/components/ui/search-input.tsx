import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "./input";

interface SearchInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  label = "Search",
  placeholder = "Search...",
  className = "",
  ...props
}: SearchInputProps) {
  const inputId = React.useId();

  return (
    <div className={`relative flex items-center w-full max-w-xs ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="absolute left-3 text-fg-muted pointer-events-none">
        <Search size={16} aria-hidden="true" />
      </div>
      <Input
        id={inputId}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8 py-1.5 w-full bg-surface border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-focus-ring outline-none"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-3 text-fg-muted hover:text-fg-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
