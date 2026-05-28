import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type StatePanelProps = {
  tone?: "neutral" | "warning" | "danger" | "success";
  title: string;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  detailsSummary?: string;
  details?: ReactNode;
  icon?: ReactNode;
};

export function StatePanel({
  tone = "neutral",
  title,
  description,
  primaryAction,
  secondaryAction,
  detailsSummary,
  details,
  icon,
}: StatePanelProps) {
  return (
    <section
      className="state-panel"
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
      aria-label={title}
    >
      <div className="state-panel-header">
        <span className="state-panel-icon" aria-hidden="true">
          {icon ?? defaultIcon(tone)}
        </span>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {details ? (
        <details>
          <summary>{detailsSummary ?? "Details"}</summary>
          <div>{details}</div>
        </details>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="state-panel-actions">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </section>
  );
}

function defaultIcon(tone: NonNullable<StatePanelProps["tone"]>) {
  switch (tone) {
    case "warning":
      return <AlertTriangle />;
    case "danger":
      return <XCircle />;
    case "success":
      return <CheckCircle2 />;
    case "neutral":
      return <Info />;
  }
}
