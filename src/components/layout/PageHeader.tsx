import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

type PageHeaderProps = {
  ariaLabel: string;
  eyebrow: string;
  title: string;
  breadcrumbLabel?: string;
  backLabel?: string;
  meta?: string[];
  status?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
};

export function PageHeader({
  ariaLabel,
  eyebrow,
  title,
  breadcrumbLabel = "Workflows",
  backLabel,
  meta = [],
  status,
  actions,
  onBack,
}: PageHeaderProps) {
  return (
    <header aria-label={ariaLabel} className="page-detail-header" role="region">
      <div aria-label="Workflow title row" className="page-detail-title-row" role="group">
        <div className="page-detail-title-main">
          {backLabel && onBack ? (
            <Button
              className="page-back-button"
              variant="ghost"
              type="button"
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" />
              {backLabel}
            </Button>
          ) : null}
          <nav aria-label="Workflow breadcrumb" className="page-breadcrumb">
            <Button
              className="page-breadcrumb-link"
              variant="ghost"
              type="button"
              onClick={onBack}
            >
              {breadcrumbLabel}
            </Button>
            <span aria-hidden="true" className="page-breadcrumb-separator">
              /
            </span>
            <span aria-current="page" className="page-breadcrumb-current">
              {title}
            </span>
          </nav>
        </div>
        <p className="eyebrow page-kind-badge">{eyebrow}</p>
      </div>

      <div aria-label="Workflow controls row" className="page-detail-controls-row" role="group">
        {status ? <div className="page-header-status">{status}</div> : null}
        {meta.length > 0 ? (
          <div className="page-header-meta" aria-label={`${title} metadata`}>
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
