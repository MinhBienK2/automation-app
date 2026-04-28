import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--app-radius-sm)] border px-4 text-sm font-medium outline-none transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:border-[var(--app-accent-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "border-[var(--app-text)] bg-[var(--app-surface)] text-[var(--app-text)] hover:border-[var(--app-accent-border)]",
        secondary:
          "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] opacity-90 hover:border-[var(--app-border-hover)]",
        ghost:
          "border-transparent bg-transparent text-[var(--app-text)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)]",
        destructive:
          "border-[var(--app-danger-border)] bg-[var(--app-surface)] text-[var(--app-danger-text)] hover:border-[var(--app-danger-border-strong)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "size-9 px-0",
      },
      shape: {
        default: "rounded-[var(--app-radius-sm)]",
        pill: "rounded-[var(--app-radius-pill)] px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
