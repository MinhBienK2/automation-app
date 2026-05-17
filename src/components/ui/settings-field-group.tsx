import * as React from "react";
import { cn } from "@/lib/utils";

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

  return (
    <fieldset
      {...props}
      className={cn("settings-field-group", className)}
      aria-describedby={describedBy}
    >
      <legend>{title}</legend>
      {description ? (
        <div className="settings-field-group-header">
          <p id={descriptionId} className="settings-field-group-description">
            {description}
          </p>
        </div>
      ) : null}
      <div className="settings-field-group-grid">{children}</div>
      {footer ? (
        <p id={footerId} className="settings-field-group-footer">
          {footer}
        </p>
      ) : null}
    </fieldset>
  );
}

export { SettingsFieldGroup };
