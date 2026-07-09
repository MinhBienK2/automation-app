import * as React from "react";
import { Play, CheckCircle2, AlertTriangle, XCircle, StopCircle, RefreshCw } from "lucide-react";

export type StatusType = "running" | "success" | "failed" | "stopped" | "idle" | "attention";

interface StatusBadgeProps {
  status: StatusType;
  customText?: string;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  {
    icon: React.ComponentType<{ className?: string; size?: number }>;
    label: string;
    bgClass: string;
    textClass: string;
    animateClass?: string;
  }
> = {
  running: {
    icon: RefreshCw,
    label: "Running",
    bgClass: "bg-primary/10 border-primary/20",
    textClass: "text-primary",
    animateClass: "animate-spin",
  },
  success: {
    icon: CheckCircle2,
    label: "Success",
    bgClass: "bg-success/10 border-success/20",
    textClass: "text-success",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    bgClass: "bg-error/10 border-error/20",
    textClass: "text-error",
  },
  stopped: {
    icon: StopCircle,
    label: "Stopped",
    bgClass: "bg-neutral/10 border-border",
    textClass: "text-fg-secondary",
  },
  idle: {
    icon: Play,
    label: "Idle",
    bgClass: "bg-neutral/10 border-border",
    textClass: "text-fg-secondary",
  },
  attention: {
    icon: AlertTriangle,
    label: "Attention",
    bgClass: "bg-warning/10 border-warning/20",
    textClass: "text-warning",
  },
};

export function StatusBadge({ status, customText, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgClass} ${config.textClass} ${className}`}
    >
      <Icon size={12} className={config.animateClass} aria-hidden="true" />
      <span>{customText || config.label}</span>
    </span>
  );
}
