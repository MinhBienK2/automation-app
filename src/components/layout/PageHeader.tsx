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
  projectName?: string | null;
};

function Breadcrumbs({ projectName, baseLabel, displayLabel, title, onBack }: {
  projectName: string | null;
  baseLabel: string;
  displayLabel: string | null;
  title: string;
  onBack?: () => void;
}) {
  return (
    <nav aria-label="Workflow breadcrumb" className="breadcrumbs text-sm page-breadcrumb">
      <ul>
        {projectName ? (
          <>
            <li>
              <Button
                className="page-breadcrumb-link p-0 h-auto min-h-0 bg-transparent hover:bg-transparent hover:underline"
                variant="ghost"
                type="button"
                onClick={onBack}
              >
                {projectName}
              </Button>
            </li>
            <li>
              <span className="text-secondary">{baseLabel}</span>
            </li>
          </>
        ) : (
          <li>
            <Button
              className="page-breadcrumb-link p-0 h-auto min-h-0 bg-transparent hover:bg-transparent hover:underline"
              variant="ghost"
              type="button"
              onClick={onBack}
            >
              {baseLabel}
            </Button>
          </li>
        )}
        {displayLabel ? (
          <li>
            <Button
              className="page-breadcrumb-link p-0 h-auto min-h-0 bg-transparent hover:bg-transparent hover:underline"
              variant="ghost"
              type="button"
              onClick={onBack}
            >
              {displayLabel}
            </Button>
          </li>
        ) : null}
        <li>
          <span aria-current="page" className="page-breadcrumb-current font-medium text-primary">
            {title}
          </span>
        </li>
      </ul>
    </nav>
  );
}

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
  projectName = null,
}: PageHeaderProps) {
  const isSubflow = eyebrow === "Subflow";
  const baseLabel = isSubflow ? "Subflows" : "Workflows";
  const displayLabel = breadcrumbLabel !== baseLabel ? breadcrumbLabel : null;

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
          <Breadcrumbs
            projectName={projectName}
            baseLabel={baseLabel}
            displayLabel={displayLabel}
            title={title}
            onBack={onBack}
          />
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
