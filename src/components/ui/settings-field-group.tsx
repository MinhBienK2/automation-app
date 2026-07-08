import * as React from "react";

type SettingsFieldGroupProps = React.ComponentProps<"fieldset"> & {
  title: string;
  description?: string;
  footer?: React.ReactNode;
};

function SettingsFieldGroup({
  title,
  description,
  footer,
  className,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SettingsFieldGroupProps) {
  const descriptionId = React.useId();
  const footerId = React.useId();
  const describedBy = [
    description ? descriptionId : null,
    footer ? footerId : null,
    ariaDescribedBy,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const fieldsetClasses = [
    "fieldset bg-base-200 border border-base-300 rounded-box p-4 settings-field-group",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset
      {...props}
      className={fieldsetClasses}
      aria-describedby={describedBy}
    >
      <legend className="fieldset-legend text-sm font-semibold">{title}</legend>
      {description ? (
        <div className="mb-2">
          <p id={descriptionId} className="text-xs text-secondary">
            {description}
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 w-full">{children}</div>
      {footer ? (
        <p id={footerId} className="mt-2 text-xs text-secondary settings-field-group-footer">
          {footer}
        </p>
      ) : null}
    </fieldset>
  );
}

export { SettingsFieldGroup };

