import * as React from "react";
import { Label } from "./label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  description,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
        {label}
      </Label>
      {children}
      {description && <p className="text-xs text-fg-muted mt-0.5">{description}</p>}
      {error && <p className="text-xs text-error mt-0.5" role="alert">{error}</p>}
    </div>
  );
}
