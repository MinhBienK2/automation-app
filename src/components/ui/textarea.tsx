import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition-colors",
        "placeholder:text-[var(--app-text-muted)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[var(--app-accent-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
