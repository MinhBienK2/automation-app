import type { ReactNode } from "react";

export function ActionConfigFieldGroup({
  title,
  nested = false,
  children,
}: {
  title: string;
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={
        nested
          ? "action-config-field-group action-config-field-group-nested"
          : "action-config-field-group"
      }
    >
      <legend>{title}</legend>
      <div className="action-config-field-group-grid">{children}</div>
    </fieldset>
  );
}
