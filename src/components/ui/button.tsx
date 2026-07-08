import * as React from "react";

type ButtonVariant = "default" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "lg" | "icon";
type ButtonShape = "default" | "pill";

export interface ButtonProps
  extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  default: "btn-primary",
  secondary: "btn-outline",
  ghost: "btn-ghost",
  destructive: "btn-error",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-square btn-sm",
};

function Button({
  className,
  variant = "default",
  size = "default",
  shape = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    variantClass[variant],
    sizeClass[size],
    shape === "pill" ? "rounded-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      data-slot="button"
      className={classes}
      disabled={loading || disabled}
      {...props}
    >
      {loading && (
        <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      )}
      {loading && size === "icon" ? null : children}
    </button>
  );
}

export { Button };
