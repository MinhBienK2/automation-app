import * as React from "react";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "attention"
  | "failure"
  | "running";

export interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  default: "badge-primary badge-outline",
  secondary: "badge-ghost",
  destructive: "badge-error",
  outline: "badge-outline",
  success: "badge-success",
  attention: "badge-warning",
  failure: "badge-error",
  running: "badge-primary",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const classes = ["badge", variantClass[variant], className]
    .filter(Boolean)
    .join(" ");
  return <span data-slot="badge" className={classes} {...props} />;
}

export { Badge };
