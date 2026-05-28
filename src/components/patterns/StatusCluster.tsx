import type { ReactNode } from "react";
import { StatusBadge } from "../ui/badge";

type StatusClusterItem = {
  label: ReactNode;
  tone?: "neutral" | "muted" | "active" | "success" | "warning" | "danger";
};

type StatusClusterProps = {
  items: StatusClusterItem[];
  ariaLabel?: string;
};

export function StatusCluster({ items, ariaLabel = "Status" }: StatusClusterProps) {
  if (items.length === 0) return null;

  return (
    <div className="status-cluster" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <StatusBadge key={index} tone={item.tone ?? "neutral"} size="sm">
          {item.label}
        </StatusBadge>
      ))}
    </div>
  );
}
