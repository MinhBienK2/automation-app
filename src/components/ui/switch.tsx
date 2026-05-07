import * as React from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<
  React.ComponentProps<"button">,
  "aria-checked" | "onChange" | "role"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function Switch({
  checked,
  className,
  disabled,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <button
      {...props}
      aria-checked={checked}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-[var(--app-radius-pill)] border p-0.5 outline-none transition-colors",
        checked
          ? "border-[var(--app-accent-border)] bg-[rgba(62,207,142,0.18)]"
          : "border-[var(--app-border)] bg-[var(--app-surface)]",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:border-[var(--app-accent-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
        className,
      )}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-4 rounded-[var(--app-radius-pill)] transition-transform",
          checked
            ? "translate-x-5 bg-[var(--app-accent)]"
            : "translate-x-0 bg-[var(--app-text-secondary)]",
        )}
      />
    </button>
  );
}

function SwitchField({
  checked,
  className,
  description,
  disabled,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  className?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const generatedId = React.useId();
  const switchId = id ?? generatedId;
  const labelId = `${switchId}-label`;
  const descriptionId = description ? `${switchId}-description` : undefined;

  return (
    <div className={cn("switch-field", className)} data-slot="switch-field">
      <Switch
        id={switchId}
        aria-describedby={descriptionId}
        aria-labelledby={labelId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <span className="switch-field-copy">
        <strong id={labelId}>{label}</strong>
        {description ? <small id={descriptionId}>{description}</small> : null}
      </span>
    </div>
  );
}

export { Switch, SwitchField };
