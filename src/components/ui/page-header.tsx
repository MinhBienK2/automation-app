import * as React from "react";
import { Button } from "./button";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  status?: React.ReactNode;
  ariaLabel?: string;
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
  onBack,
  backLabel = "Back",
  status,
  ariaLabel,
}: PageHeaderProps) {
  return (
    <div
      className="flex flex-col gap-3 pb-4 mb-4 border-b border-border bg-base-100"
      aria-label={ariaLabel || `${title} header`}
    >
      {onBack && (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-fg-secondary hover:text-fg-primary -ml-2 h-7 gap-1"
          >
            &larr; {backLabel}
          </Button>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          {eyebrow && (
            <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider block">
              {eyebrow}
            </span>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-fg-primary">
              {title}
            </h1>
            {status && <div className="flex items-center">{status}</div>}
          </div>
          {meta && (
            <div className="flex items-center gap-3 text-xs text-fg-secondary font-mono flex-wrap">
              {Array.isArray(meta)
                ? meta.map((m, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span className="text-border-emphasized">•</span>}
                      <span>{m}</span>
                    </React.Fragment>
                  ))
                : meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
