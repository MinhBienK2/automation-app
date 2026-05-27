import { Download, Eye, Files, Grid2X2, List, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import type {
  EvidenceBundleExportResult,
  EvidenceDetail,
  EvidenceKind,
  EvidenceListItem,
  EvidenceListRequest,
  EvidencePage,
  EvidenceScreenshotPreview,
  OperationsNavigationTarget,
} from "../../../types/workflow";

type EvidenceExplorerPageProps = {
  page: EvidencePage | null;
  detail: EvidenceDetail | null;
  preview: EvidenceScreenshotPreview | null;
  loading: boolean;
  detailLoading: boolean;
  error: string;
  detailError: string;
  query: EvidenceListRequest;
  selectedEvidenceId: string | null;
  exportResult: EvidenceBundleExportResult;
  onQueryChange: (query: EvidenceListRequest) => void;
  onRefresh: () => void;
  onSelectEvidence: (evidenceId: string) => void;
  onPreviewScreenshot: (evidenceId: string) => void;
  onRevealArtifact: (evidenceId: string) => void;
  onExportSelection: (evidenceIds: string[]) => void;
  onNavigate: (target: OperationsNavigationTarget) => void;
};

const evidenceTypes: EvidenceKind[] = [
  "screenshot",
  "download",
  "browser_identity",
  "action_trace",
  "evidence_manifest",
];

export function EvidenceExplorerPage({
  page,
  detail,
  preview,
  loading,
  detailLoading,
  error,
  detailError,
  query,
  selectedEvidenceId,
  exportResult,
  onQueryChange,
  onRefresh,
  onSelectEvidence,
  onPreviewScreenshot,
  onRevealArtifact,
  onExportSelection,
  onNavigate,
}: EvidenceExplorerPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => page?.items.some((item) => item.evidence_id === id)),
    );
  }, [page]);

  const activeItem = detail?.item ?? page?.items.find((item) => item.evidence_id === selectedEvidenceId) ?? null;

  function toggleSelected(evidenceId: string) {
    setSelectedIds((current) =>
      current.includes(evidenceId)
        ? current.filter((id) => id !== evidenceId)
        : [...current, evidenceId],
    );
  }

  return (
    <section className="app-screen evidence-screen" aria-label="Evidence Explorer">
      <header className="app-header evidence-header">
        <div>
          <p className="eyebrow">Evidence Workspace</p>
          <h1>Evidence Explorer</h1>
          <p className="muted">
            {page
              ? `Last refreshed ${formatDateTime(page.generated_at)}.`
              : "Loading persisted run evidence."}
          </p>
        </div>
        <div className="page-header-actions">
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => onExportSelection(selectedIds)}
          >
            <Download aria-hidden="true" />
            Export Selection
          </Button>
        </div>
      </header>

      <section className="panel evidence-toolbar" aria-label="Evidence filters">
        <label className="field">
          <span>Search</span>
          <input
            aria-label="Search evidence"
            type="search"
            value={query.search ?? ""}
            onChange={(event) =>
              onQueryChange({ ...query, search: event.target.value, cursor: null })
            }
          />
        </label>
        <label className="field">
          <span>Type</span>
          <select
            aria-label="Evidence type"
            value={query.types?.[0] ?? ""}
            onChange={(event) =>
              onQueryChange({
                ...query,
                types: event.target.value ? [event.target.value as EvidenceKind] : null,
                cursor: null,
              })
            }
          >
            <option value="">All types</option>
            {evidenceTypes.map((type) => (
              <option value={type} key={type}>{labelForKind(type)}</option>
            ))}
          </select>
        </label>
        <div className="segmented-control evidence-view-toggle" role="group" aria-label="Evidence view">
          <button
            type="button"
            className={viewMode === "list" ? "is-active" : ""}
            onClick={() => setViewMode("list")}
          >
            <List aria-hidden="true" />
            List
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <Grid2X2 aria-hidden="true" />
            Grid
          </button>
        </div>
      </section>

      {error ? <div className="panel overview-error" role="alert">{error}</div> : null}
      {warningText(page) ? <p className="field-warning">{warningText(page)}</p> : null}
      {exportResult?.bundle_dir ? (
        <p className="status-message">Evidence bundle exported to {exportResult.bundle_dir}</p>
      ) : null}

      <div className="evidence-workspace">
        <section className="panel evidence-results" aria-label="Evidence results">
          {loading ? <EmptyEvidence title="Loading evidence" /> : null}
          {page?.items.length ? (
            <div className={viewMode === "grid" ? "evidence-grid" : "evidence-list"}>
              {page.items.map((item) => (
                <EvidenceResult
                  key={item.evidence_id}
                  item={item}
                  selected={item.evidence_id === selectedEvidenceId}
                  checked={selectedIds.includes(item.evidence_id)}
                  onSelect={() => onSelectEvidence(item.evidence_id)}
                  onToggle={() => toggleSelected(item.evidence_id)}
                />
              ))}
            </div>
          ) : loading ? null : (
            <EmptyEvidence title="No evidence found" />
          )}
        </section>

        <section className="panel evidence-detail" aria-label="Evidence detail">
          {detailLoading ? <EmptyEvidence title="Loading detail" /> : null}
          {detailError ? <p className="field-warning">{detailError}</p> : null}
          {activeItem && detail ? (
            <EvidenceDetailView
              detail={detail}
              preview={preview}
              onPreviewScreenshot={onPreviewScreenshot}
              onRevealArtifact={onRevealArtifact}
              onNavigate={onNavigate}
            />
          ) : detailLoading ? null : (
            <EmptyEvidence title="Select evidence" />
          )}
        </section>
      </div>
    </section>
  );
}

function EvidenceResult({
  item,
  selected,
  checked,
  onSelect,
  onToggle,
}: {
  item: EvidenceListItem;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article className={selected ? "evidence-result evidence-result-active" : "evidence-result"}>
      <label className="evidence-select">
        <input
          aria-label={`Select ${item.label}`}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
        />
      </label>
      <button type="button" onClick={onSelect}>
        <strong>{item.label}</strong>
        <span>{labelForKind(item.kind)} / {item.run.source} / {item.run.status}</span>
        <small>{item.workflow?.name ?? "Workflow unavailable"} / {item.identity?.display_name ?? item.identity?.id ?? "Identity unavailable"}</small>
      </button>
    </article>
  );
}

function EvidenceDetailView({
  detail,
  preview,
  onPreviewScreenshot,
  onRevealArtifact,
  onNavigate,
}: {
  detail: EvidenceDetail;
  preview: EvidenceScreenshotPreview | null;
  onPreviewScreenshot: (evidenceId: string) => void;
  onRevealArtifact: (evidenceId: string) => void;
  onNavigate: (target: OperationsNavigationTarget) => void;
}) {
  const item = detail.item;
  return (
    <div className="evidence-detail-body">
      <header>
        <Files aria-hidden="true" />
        <div>
          <h2>{item.label}</h2>
          <p className="muted">{labelForKind(item.kind)} / {formatDateTime(item.created_at)}</p>
        </div>
      </header>
      <dl className="evidence-metadata">
        <div><dt>Run</dt><dd>{item.run.id}</dd></div>
        <div><dt>Workflow</dt><dd>{item.workflow?.name ?? "Unavailable"}</dd></div>
        <div><dt>Identity</dt><dd>{item.identity?.display_name ?? item.identity?.id ?? "Unavailable"}</dd></div>
        {item.node_id ? <div><dt>Node</dt><dd>{item.node_id}</dd></div> : null}
        {item.relative_path ? <div><dt>Path</dt><dd>{item.relative_path}</dd></div> : null}
      </dl>
      <div className="evidence-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onNavigate({ type: "run", run_id: item.run.id })}
        >
          Open Run
        </Button>
        {item.workflow ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onNavigate({ type: "workflow", workflow_id: item.workflow?.id ?? "" })}
          >
            Open Workflow
          </Button>
        ) : null}
        {(item.kind === "screenshot" || item.kind === "download") ? (
          <Button type="button" variant="secondary" onClick={() => onRevealArtifact(item.evidence_id)}>
            Reveal in Folder
          </Button>
        ) : null}
        {item.kind === "screenshot" ? (
          <Button type="button" variant="secondary" onClick={() => onPreviewScreenshot(item.evidence_id)}>
            <Eye aria-hidden="true" />
            Preview
          </Button>
        ) : null}
      </div>
      {preview && preview.evidence_id === item.evidence_id ? (
        <img
          className="evidence-preview"
          alt={item.label}
          src={`data:${preview.mime_type};base64,${preview.base64_data}`}
        />
      ) : null}
      <EvidencePayload payload={detail.payload} />
    </div>
  );
}

function EvidencePayload({ payload }: { payload: EvidenceDetail["payload"] }) {
  if (payload.kind === "browser_identity") {
    return (
      <table className="evidence-table">
        <tbody>
          {payload.fields.map((field) => (
            <tr key={field.key}><th>{field.key}</th><td>{String(field.value)}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (payload.kind === "action_trace") {
    return (
      <div className="evidence-timeline">
        {payload.entries.map((entry, index) => (
          <article key={`${entry.node_id}-${index}`}>
            <strong>{String(entry.label ?? entry.node_id ?? `Trace ${index + 1}`)}</strong>
            <span>{String(entry.action_type ?? "action")} / {String(entry.status ?? "unknown")}</span>
          </article>
        ))}
      </div>
    );
  }
  if (payload.kind === "evidence_manifest") {
    return (
      <table className="evidence-table">
        <thead><tr><th>Output</th><th>Category</th><th>State</th></tr></thead>
        <tbody>
          {payload.rows.map((row) => (
            <tr key={row.key}>
              <td>{row.key}</td>
              <td>{row.category}</td>
              <td>{row.redacted ? "redacted" : row.truncated ? "truncated" : "available"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <p className="evidence-path-state">
      {payload.relative_path} / {payload.file_state}
    </p>
  );
}

function EmptyEvidence({ title }: { title: string }) {
  return (
    <div className="empty-state empty-state-compact">
      <h3>{title}</h3>
    </div>
  );
}

function warningText(page: EvidencePage | null) {
  const skipped = page?.warnings.skipped_artifacts ?? 0;
  if (!skipped) return "";
  return `${skipped} malformed evidence item${skipped === 1 ? "" : "s"} skipped.`;
}

function labelForKind(kind: EvidenceKind) {
  return kind
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
