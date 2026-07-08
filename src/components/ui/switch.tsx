import * as React from "react";

type SwitchProps = React.ComponentPropsWithoutRef<"input"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

function Switch({
  id,
  checked,
  className,
  disabled,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const classes = [
    "toggle toggle-primary",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      id={id}
      type="checkbox"
      role="switch"
      aria-checked={checked}
      className={classes}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange(e.target.checked)}
      {...props}
    />
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

  const containerClasses = [
    "flex items-center gap-3",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} data-slot="switch-field">
      <Switch
        id={switchId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <label htmlFor={switchId} className="flex flex-col cursor-pointer select-none">
        <strong id={labelId} className="text-sm font-semibold text-base-content">{label}</strong>
        {description ? (
          <span id={descriptionId} className="text-xs text-secondary">{description}</span>
        ) : null}
      </label>
    </div>
  );
}

export { Switch, SwitchField };

