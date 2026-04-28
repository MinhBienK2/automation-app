import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm font-medium outline-none transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:border-[rgba(62,207,142,0.68)] focus-visible:ring-2 focus-visible:ring-[rgba(62,207,142,0.18)]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "border-[#fafafa] bg-[#0f0f0f] text-[#fafafa] hover:border-[rgba(62,207,142,0.48)]",
        secondary:
          "border-[#2e2e2e] bg-[#0f0f0f] text-[#fafafa] opacity-90 hover:border-[#4d4d4d]",
        ghost:
          "border-transparent bg-transparent text-[#fafafa] hover:border-[#363636] hover:bg-[#0f0f0f]",
        destructive:
          "border-[rgba(255,99,71,0.38)] bg-[#0f0f0f] text-[#ffb4a8] hover:border-[rgba(255,99,71,0.64)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "size-9 px-0",
      },
      shape: {
        default: "rounded-md",
        pill: "rounded-full px-8",
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
