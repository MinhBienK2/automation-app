import * as React from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

type AlertVariant = "error" | "warning" | "info" | "success";

export interface AlertProps extends React.ComponentProps<"div"> {
  variant?: AlertVariant;
  hideIcon?: boolean;
}

const variantClass: Record<AlertVariant, string> = {
  error: "bg-[var(--failure-bg)] text-[var(--failure)] border-[rgba(240,100,103,0.18)]",
  warning: "bg-[var(--attention-bg)] text-[var(--attention)] border-[rgba(244,183,64,0.18)]",
  info: "bg-[var(--accent-bg)] text-[var(--accent)] border-[rgba(50,211,230,0.18)]",
  success: "bg-[var(--success-bg)] text-[var(--success)] border-[rgba(57,217,138,0.18)]",
};

const variantIcon: Record<AlertVariant, React.ReactNode> = {
  error: <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />,
  info: <Info className="h-4 w-4 shrink-0 mt-0.5" />,
  success: <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />,
};

export function Alert({
  variant = "error",
  className,
  children,
  hideIcon = false,
  ...props
}: AlertProps) {
  const classes = [
    "border flex items-start gap-3 rounded-lg p-3 text-sm font-medium leading-relaxed transition-all duration-200",
    variantClass[variant],
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role={variant === "error" ? "alert" : variant === "info" ? "status" : undefined}
      className={classes}
      {...props}
    >
      {!hideIcon && variantIcon[variant]}
      <div className="flex-1 text-left">{children}</div>
    </div>
  );
}
