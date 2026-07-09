import * as React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";

export interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  caption?: string;
  emptyState?: React.ReactNode;
  rowClassName?: string | ((item: T) => string);
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  caption,
  emptyState,
  rowClassName = "",
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <Table>
      {caption && <caption className="sr-only">{caption}</caption>}
      <TableHeader>
        <TableRow>
          {columns.map((col, idx) => (
            <TableHead
              key={idx}
              className={`${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.className || ""}`}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => {
          const rClass = typeof rowClassName === "function" ? rowClassName(item) : rowClassName;
          return (
            <TableRow
              key={keyExtractor(item)}
              className={`${onRowClick ? "cursor-pointer" : ""} ${rClass}`}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col, idx) => (
                <TableCell
                  key={idx}
                  className={`${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.className || ""}`}
                >
                  {col.accessor(item)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
