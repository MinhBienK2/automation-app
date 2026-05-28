import type { ReactNode } from "react";

type CommandRegionProps = {
  ariaLabel: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  utilityActions?: ReactNode;
  searchSlot?: ReactNode;
  headingLevel?: 1 | 2 | 3;
};

export function CommandRegion({
  ariaLabel,
  title,
  eyebrow,
  description,
  status,
  primaryAction,
  secondaryActions,
  utilityActions,
  searchSlot,
  headingLevel = 1,
}: CommandRegionProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <header aria-label={ariaLabel} className="command-region" role="region">
      <div className="command-region-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading>{title}</Heading>
        {description ? <p className="muted command-region-description">{description}</p> : null}
        {status ? <div className="command-region-status">{status}</div> : null}
      </div>
      <div className="command-region-side">
        {searchSlot ? <div className="command-region-search">{searchSlot}</div> : null}
        {primaryAction || secondaryActions ? (
          <div className="command-region-actions">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
        {utilityActions ? (
          <div className="command-region-utilities">{utilityActions}</div>
        ) : null}
      </div>
    </header>
  );
}
