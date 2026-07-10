import * as React from "react";

type CheckboxProps = React.ComponentPropsWithoutRef<"input"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ id, checked, className, disabled, onCheckedChange, onChange, ...props }, ref) => {
    const classes = [
      "checkbox checkbox-primary",
      className
    ]
      .filter(Boolean)
      .join(" ");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) onChange(e);
      if (onCheckedChange) onCheckedChange(e.target.checked);
    };

    return (
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={classes}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";

function CheckboxField({
  checked,
  className,
  description,
  disabled,
  id,
  label,
  onCheckedChange,
  ...props
}: {
  checked?: boolean;
  className?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  label: string;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<React.ComponentPropsWithoutRef<"input">, "checked" | "onChange">) {
  const generatedId = React.useId();
  const checkboxId = id ?? generatedId;
  const labelId = `${checkboxId}-label`;
  const descriptionId = description ? `${checkboxId}-description` : undefined;

  const containerClasses = [
    "flex items-center gap-3",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} data-slot="checkbox-field">
      <Checkbox
        id={checkboxId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        {...props}
      />
      <label htmlFor={checkboxId} className="flex flex-col cursor-pointer select-none">
        <strong id={labelId} className="text-sm font-semibold text-base-content">{label}</strong>
        {description ? (
          <span id={descriptionId} className="text-xs text-secondary">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

export { Checkbox, CheckboxField };
