import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className = "", ...props }, ref) => (
    <table ref={ref} className={`table table-sm w-full border-collapse text-left ${className}`} {...props} />
  )
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", ...props }, ref) => (
    <thead ref={ref} className={`border-b-2 border-border/70 text-[11px] font-semibold text-secondary uppercase tracking-wider ${className}`} {...props} />
  )
);
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", ...props }, ref) => (
    <tbody ref={ref} className={`${className}`} {...props} />
  )
);
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className = "", ...props }, ref) => (
    <tr ref={ref} className={`hover:bg-surface-elevated/35 transition-colors duration-150 ${className}`} {...props} />
  )
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = "", ...props }, ref) => (
    <th ref={ref} className={`px-4 py-3 font-semibold text-secondary tracking-wider uppercase ${className}`} {...props} />
  )
);
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = "", ...props }, ref) => (
    <td ref={ref} className={`px-4 py-3.5 align-middle text-sm text-fg-primary ${className}`} {...props} />
  )
);
TableCell.displayName = "TableCell";

export type SortDirection = "asc" | "desc";

type SortableTableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  label: string;
  sortKey: string;
  activeKey: string | null;
  direction: SortDirection;
  onSort: (key: string) => void;
};

export function SortableTableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = "",
  ...props
}: SortableTableHeadProps) {
  const isActive = activeKey === sortKey;
  return (
    <th
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 font-semibold text-secondary tracking-wider uppercase cursor-pointer select-none hover:text-base-content transition-colors ${className}`}
      role="button"
      tabIndex={0}
      onClick={() => onSort(sortKey)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSort(sortKey);
        }
      }}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp aria-hidden="true" size={12} className="text-primary" />
          ) : (
            <ArrowDown aria-hidden="true" size={12} className="text-primary" />
          )
        ) : (
          <ChevronsUpDown aria-hidden="true" size={12} className="opacity-40" />
        )}
      </span>
    </th>
  );
}
SortableTableHead.displayName = "SortableTableHead";
