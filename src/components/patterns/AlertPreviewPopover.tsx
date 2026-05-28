import { Button } from "../ui/button";
import { StatusBadge } from "../ui/badge";

export type AlertPreviewItem = {
  id: string;
  severity: "warning" | "failure";
  title: string;
  summary: string;
  workflowName?: string | null;
  occurredAt?: string | null;
};

type AlertPreviewPopoverProps = {
  items: AlertPreviewItem[];
  loading?: boolean;
  onOpenAttentionQueue: () => void;
  onClose: () => void;
};

export function AlertPreviewPopover({
  items,
  loading = false,
  onOpenAttentionQueue,
  onClose,
}: AlertPreviewPopoverProps) {
  return (
    <div
      className="alert-preview-popover"
      data-popover="true"
      role="dialog"
      aria-label="Alerts preview"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">Alerts</p>
          <h2>Attention Preview</h2>
        </div>
        <Button type="button" variant="quiet" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="alert-preview-list">
        {loading ? <p className="muted">Loading attention queue...</p> : null}
        {!loading && items.length === 0 ? (
          <p className="muted">No attention items right now.</p>
        ) : null}
        {items.slice(0, 5).map((item) => (
          <article key={item.id} className="alert-preview-item">
            <StatusBadge tone={item.severity === "failure" ? "danger" : "warning"} size="sm">
              {item.severity}
            </StatusBadge>
            <div>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              {item.workflowName || item.occurredAt ? (
                <small>
                  {[item.workflowName, item.occurredAt ? formatAlertTime(item.occurredAt) : null]
                    .filter(Boolean)
                    .join(" / ")}
                </small>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <footer>
        <Button type="button" onClick={onOpenAttentionQueue}>
          Open Attention Queue
        </Button>
      </footer>
    </div>
  );
}

function formatAlertTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
