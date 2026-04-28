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

export { Badge, badgeVariants };
