import type { ReactNode } from "react";
import { Input } from "../ui/input";

type DataToolbarProps = {
  searchLabel?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
  resultSummary?: ReactNode;
};

export function DataToolbar({
  searchLabel,
  searchValue,
  onSearchChange,
  filters,
  actions,
  resultSummary,
}: DataToolbarProps) {
  return (
    <div className="data-toolbar">
      {searchLabel ? (
        <Input
          className="data-toolbar-search"
          aria-label={searchLabel}
          type="search"
          value={searchValue ?? ""}
          onChange={(event) => onSearchChange?.(event.currentTarget.value)}
        />
      ) : null}
      {filters ? <div className="data-toolbar-filters">{filters}</div> : null}
      {resultSummary ? <small>{resultSummary}</small> : null}
      {actions ? <div className="data-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
