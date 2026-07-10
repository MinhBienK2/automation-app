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
    bgClass: "bg-[var(--accent-bg)] border-[rgba(50,211,230,0.18)]",
    textClass: "text-[var(--accent)]",
    animateClass: "animate-spin",
  },
  success: {
    icon: CheckCircle2,
    label: "Success",
    bgClass: "bg-[var(--success-bg)] border-[rgba(57,217,138,0.18)]",
    textClass: "text-[var(--success)]",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    bgClass: "bg-[var(--failure-bg)] border-[rgba(240,100,103,0.18)]",
    textClass: "text-[var(--failure)]",
  },
  stopped: {
    icon: StopCircle,
    label: "Stopped",
    bgClass: "bg-[var(--surface-elevated)] border-[var(--border)]",
    textClass: "text-[var(--fg-secondary)]",
  },
  idle: {
    icon: Play,
    label: "Idle",
    bgClass: "bg-[var(--surface-elevated)] border-[var(--border)]",
    textClass: "text-[var(--fg-secondary)]",
  },
  attention: {
    icon: AlertTriangle,
    label: "Attention",
    bgClass: "bg-[var(--attention-bg)] border-[rgba(244,183,64,0.18)]",
    textClass: "text-[var(--attention)]",
  },
};

export function StatusBadge({ status, customText, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${config.bgClass} ${config.textClass} ${className}`}
    >
      <Icon size={11} className={config.animateClass} aria-hidden="true" />
      <span>{customText || config.label}</span>
    </span>
  );
}
