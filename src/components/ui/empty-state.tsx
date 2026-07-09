import * as React from "react";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-surface/50 min-h-[250px]">
      {Icon && (
        <div className="p-4 bg-surface-elevated/40 border border-border rounded-full mb-4 text-fg-muted">
          <Icon className="w-6 h-6" size={24} />
        </div>
      )}
      <h3 className="text-base font-semibold text-fg-primary mb-1">{title}</h3>
      <p className="text-xs text-fg-secondary max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
