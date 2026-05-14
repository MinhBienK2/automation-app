import * as React from "react";
import { cn } from "@/lib/utils";

function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-10 w-full appearance-none rounded-[var(--app-radius-sm)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2 pr-9 text-sm leading-5 text-[var(--app-text)] outline-none transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[var(--app-accent-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
