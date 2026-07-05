import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--app-radius-sm)] border px-4 text-sm font-medium leading-5 outline-none transition-colors",
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
          "border-[var(--app-danger)] bg-[var(--app-danger)] text-[var(--app-danger-contrast)] hover:border-[var(--app-danger-hover)] hover:bg-[var(--app-danger-hover)]",
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
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  console.log("DEBUG: Button rendering", { className, disabled, loading, isTrueDisabled: loading || disabled });

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {loading && size === "icon" ? null : children}
    </Comp>
  );
}

export { Button };
