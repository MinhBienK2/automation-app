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
  IdentityLabTarget,
  OperationsNavigationTarget,
} from "../../../types/workflow";
import {
  buildEvidenceFilterSummary,
  buildEvidenceWarningText,
  evidenceSelectionLabel,
  fileStateLabel,
  formatEvidenceBytes,
  formatEvidenceDateTime,
  isSafeEvidenceFieldKey,
  labelForEvidenceKind,
  runSourceLabel,
  shouldShowEvidenceEmptyAsFiltered,
} from "./evidencePresentation";

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
  onOpenIdentity: (target: IdentityLabTarget) => void;
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
  onOpenIdentity,
}: EvidenceExplorerPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState(query.search ?? "");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    setSearchValue(query.search ?? "");
  }, [query.search]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => page?.items.some((item) => item.evidence_id === id)),
    );
  }, [page]);

  const activeItem = detail?.item ?? page?.items.find((item) => item.evidence_id === selectedEvidenceId) ?? null;
  const activeFilters = buildEvidenceFilterSummary(query);
  const pageWarning = buildEvidenceWarningText(page?.warnings);
  const exportLabel = evidenceSelectionLabel(selectedIds.length);

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
              ? `Last refreshed ${formatEvidenceDateTime(page.generated_at)}.`
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
            {exportLabel}
          </Button>
        </div>
      </header>

      <section className="panel evidence-toolbar" aria-label="Evidence filters">
        <label className="field">
          <span>Search</span>
          <input
            aria-label="Search evidence"
            type="search"
            value={searchValue}
            onChange={(event) => {
              const nextSearch = event.target.value;
              setSearchValue(nextSearch);
              onQueryChange({ ...query, search: nextSearch, cursor: null });
            }}
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
              <option value={type} key={type}>{labelForEvidenceKind(type)}</option>
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
            List view
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <Grid2X2 aria-hidden="true" />
            Grid view
          </button>
        </div>
        {activeFilters.length ? (
          <div className="evidence-filter-summary" aria-label="Active evidence filters">
            {activeFilters.map((filter) => (
              <span className="evidence-filter-chip" key={filter}>
                {filter}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <div className="panel overview-error" role="alert">{error}</div> : null}
      {pageWarning ? <p className="field-warning">{pageWarning}</p> : null}
      {exportResult ? (
        <p className="status-message evidence-export-status">
          {exportStatusText(exportResult)}
        </p>
      ) : null}

      <div className="evidence-workspace">
        <section className="panel evidence-results" aria-label="Evidence results">
          {loading ? <EmptyEvidence title="Loading evidence" /> : null}
          {page?.items.length ? (
            <div
              className={viewMode === "grid" ? "evidence-grid" : "evidence-list"}
              role="list"
              aria-label={viewMode === "grid" ? "Evidence result grid" : "Evidence result list"}
            >
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
            <EmptyEvidence title={emptyEvidenceTitle(query)} />
          )}
          {page?.has_more ? (
            <p className="evidence-status-note">
              More evidence is available. Refine filters or load the next page when pagination is enabled.
            </p>
          ) : null}
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
              onOpenIdentity={onOpenIdentity}
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
  const className = [
    "evidence-result",
    selected ? "evidence-result-active" : "",
    checked ? "evidence-result-selected" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={className} role="listitem">
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
        <span className="evidence-result-metadata">
          <span>{labelForEvidenceKind(item.kind)}</span>
          <span>{runSourceLabel(item.run.source)}</span>
          <span>{item.run.status}</span>
          <span>{fileStateLabel(item.file_state ?? "unchecked")}</span>
        </span>
        <small>
          {item.workflow?.name ?? "Workflow unavailable"} /{" "}
          {item.identity?.display_name ?? item.identity?.id ?? "Identity unavailable"} /{" "}
          {formatEvidenceDateTime(item.created_at)}
        </small>
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
  onOpenIdentity,
}: {
  detail: EvidenceDetail;
  preview: EvidenceScreenshotPreview | null;
  onPreviewScreenshot: (evidenceId: string) => void;
  onRevealArtifact: (evidenceId: string) => void;
  onNavigate: (target: OperationsNavigationTarget) => void;
  onOpenIdentity: (target: IdentityLabTarget) => void;
}) {
  const item = detail.item;
  const detailFileState =
    "file_state" in detail.payload ? detail.payload.file_state : item.file_state ?? "unchecked";
  return (
    <div className="evidence-detail-body">
      <header>
        <Files aria-hidden="true" />
        <div>
          <h2>{item.label}</h2>
          <p className="muted evidence-detail-kicker">
            <span>{labelForEvidenceKind(item.kind)}</span>
            <span>{formatEvidenceDateTime(item.created_at)}</span>
          </p>
        </div>
      </header>
      <dl className="evidence-metadata">
        <div><dt>Run</dt><dd>{item.run.id}</dd></div>
        <div><dt>Source</dt><dd>{runSourceLabel(item.run.source)}</dd></div>
        <div><dt>Status</dt><dd>{item.run.status}</dd></div>
        <div><dt>Workflow</dt><dd>{item.workflow?.name ?? "Unavailable"}</dd></div>
        <div><dt>Identity</dt><dd>{item.identity?.display_name ?? item.identity?.id ?? "Unavailable"}</dd></div>
        {item.node_id ? <div><dt>Node</dt><dd>{item.node_id}</dd></div> : null}
        {item.step_number ? <div><dt>Step</dt><dd>{item.step_number}</dd></div> : null}
        <div><dt>File state</dt><dd>{fileStateLabel(detailFileState)}</dd></div>
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
        {item.identity?.id ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onOpenIdentity({
                type: "historical",
                identity_id: item.identity?.id ?? "",
                workflow_id: item.workflow?.id ?? null,
                run_id: item.run.id,
                evidence_id: item.evidence_id,
              })
            }
          >
            Open Identity
          </Button>
        ) : null}
        {(detail.payload.kind === "screenshot" || detail.payload.kind === "download") ? (
          <Button type="button" variant="secondary" onClick={() => onRevealArtifact(item.evidence_id)}>
            Reveal in Folder
          </Button>
        ) : null}
        {detail.payload.kind === "screenshot" ? (
          <Button type="button" variant="secondary" onClick={() => onPreviewScreenshot(item.evidence_id)}>
            <Eye aria-hidden="true" />
            Preview screenshot
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
    const fields = payload.fields.filter((field) => isSafeEvidenceFieldKey(field.key));
    return (
      <table className="evidence-table">
        <tbody>
          {fields.map((field) => (
            <tr key={field.key}><th>{field.key}</th><td>{String(field.value)}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (payload.kind === "action_trace") {
    return (
      <>
        <div className="evidence-timeline">
          {payload.entries.map((entry, index) => (
            <article key={`${String(entry.node_id ?? "trace")}-${index}`}>
              <strong>{String(entry.label ?? entry.node_id ?? `Trace ${index + 1}`)}</strong>
              <span>{`${String(entry.action_type ?? "action")} / ${String(entry.status ?? "unknown")}`}</span>
              {entry.failure_reason ? <small>{String(entry.failure_reason)}</small> : null}
            </article>
          ))}
        </div>
        {payload.has_more ? (
          <p className="evidence-status-note">Showing first trace entries only.</p>
        ) : null}
      </>
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
  if (payload.kind === "download") {
    return (
      <dl className="evidence-payload-summary">
        <div><dt>Size</dt><dd>{formatEvidenceBytes(payload.size_bytes)}</dd></div>
        <div><dt>Path</dt><dd>{payload.relative_path}</dd></div>
      </dl>
    );
  }
  return (
    <dl className="evidence-payload-summary">
      <div><dt>Path</dt><dd>{payload.relative_path}</dd></div>
    </dl>
  );
}

function EmptyEvidence({ title }: { title: string }) {
  return (
    <div className="empty-state empty-state-compact">
      <h3>{title}</h3>
    </div>
  );
}

function emptyEvidenceTitle(query: EvidenceListRequest) {
  if (query.focus_evidence_id) return "Focused evidence unavailable";
  if (shouldShowEvidenceEmptyAsFiltered(query)) return "No evidence matches these filters";
  return "No evidence recorded yet";
}

function exportStatusText(exportResult: NonNullable<EvidenceBundleExportResult>) {
  const exported = `${exportResult.exported_count} item${exportResult.exported_count === 1 ? "" : "s"}`;
  const omitted = `${exportResult.omitted_file_count} omitted file${
    exportResult.omitted_file_count === 1 ? "" : "s"
  }`;
  return `Evidence bundle exported: ${exported}, ${omitted}.`;
}
