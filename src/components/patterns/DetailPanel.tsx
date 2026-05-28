import type { ReactNode } from "react";

type DetailPanelProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function DetailPanel({
  title,
  subtitle,
  status,
  actions,
  children,
}: DetailPanelProps) {
  return (
    <aside className="detail-panel" aria-label={String(title)}>
      <header className="detail-panel-header">
        <div className="detail-panel-title">
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {status}
      </header>
      {actions ? <div className="detail-panel-actions">{actions}</div> : null}
      {children}
    </aside>
  );
}
