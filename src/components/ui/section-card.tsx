import * as React from "react";

interface SectionCardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function SectionCard({
  title,
  actions,
  children,
  className = "",
  id,
}: SectionCardProps) {
  return (
    <div
      id={id}
      className={`card bg-surface border border-border rounded-xl overflow-hidden ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-elevated/20">
          {title && <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6 flex flex-col">{children}</div>
    </div>
  );
}
