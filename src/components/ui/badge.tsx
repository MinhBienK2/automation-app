import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "border-[var(--app-accent-border)] bg-[var(--app-surface)] text-[var(--app-accent)]",
        secondary: "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)]",
        destructive:
          "border-[var(--app-danger-border)] bg-[var(--app-surface)] text-[var(--app-danger-text)]",
        outline: "border-[var(--app-border-strong)] bg-transparent text-[var(--app-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-[var(--app-radius-pill)] border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]",
        muted:
          "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]",
        active:
          "border-[var(--app-accent-border)] bg-[var(--app-surface)] text-[var(--app-accent)]",
        success:
          "border-[var(--app-success-border)] bg-[var(--app-surface)] text-[var(--app-success)]",
        warning:
          "border-[var(--app-warning-border)] bg-[var(--app-surface)] text-[var(--app-warning)]",
        danger:
          "border-[var(--app-danger-border)] bg-[var(--app-surface)] text-[var(--app-danger-text)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

function StatusBadge({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>) {
  return (
    <span
      data-slot="status-badge"
      data-tone={tone ?? "neutral"}
      className={cn(statusBadgeVariants({ tone, size, className }))}
      {...props}
    />
  );
}

export { Badge, StatusBadge };
