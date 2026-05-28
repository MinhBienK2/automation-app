import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state-foundation">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="state-panel-actions">{action}</div> : null}
    </div>
  );
}
