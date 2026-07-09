import * as React from "react";

type AlertVariant = "error" | "warning" | "info" | "success";

export interface AlertProps extends React.ComponentProps<"div"> {
  variant?: AlertVariant;
}

const variantClass: Record<AlertVariant, string> = {
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info",
  success: "alert-success",
};

export function Alert({
  variant = "error",
  className,
  children,
  ...props
}: AlertProps) {
  const classes = ["alert", variantClass[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role={variant === "error" ? "alert" : variant === "info" ? "status" : undefined}
      className={classes}
      {...props}
    >
      {children}
    </div>
  );
}
