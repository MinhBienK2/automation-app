import type {
  EvidenceFileState,
  EvidenceKind,
  EvidenceListRequest,
  EvidencePage,
  WorkflowRunSource,
} from "../../../types/workflow";

const sensitiveFieldPattern =
  /(password|secret|token|cookie|session|local_storage|localstorage|session_storage|sessionstorage|profile_dir|fingerprint_fonts_dir|font.*(path|dir)|binary_path|executable_path|raw_)/i;

export function labelForEvidenceKind(kind: EvidenceKind): string {
  switch (kind) {
    case "screenshot":
      return "Screenshot";
    case "download":
      return "Download";
    case "browser_identity":
      return "Browser Identity";
    case "action_trace":
      return "Action Trace";
    case "evidence_manifest":
      return "Evidence Manifest";
  }
}

export function fileStateLabel(state: EvidenceFileState): string {
  switch (state) {
    case "unchecked":
      return "Not checked";
    case "available":
      return "Available";
    case "unavailable":
      return "Unavailable";
  }
}

export function runSourceLabel(source: WorkflowRunSource): string {
  switch (source) {
    case "manual":
      return "Manual";
    case "schedule":
      return "Schedule";
  }
}

export function evidenceSelectionLabel(count: number): string {
  if (count === 0) return "Export Selection";
  return `Export ${count} item${count === 1 ? "" : "s"}`;
}

export function buildEvidenceFilterSummary(query: EvidenceListRequest): string[] {
  const filters: string[] = [];
  const search = query.search?.trim();
  if (search) filters.push(`Search: ${search}`);
  if (query.types?.length) {
    filters.push(`Type: ${query.types.map(labelForEvidenceKind).join(", ")}`);
  }
  if (query.run_statuses?.length) filters.push(`Status: ${query.run_statuses.join(", ")}`);
  if (query.sources?.length) {
    filters.push(`Source: ${query.sources.map(runSourceLabel).join(", ")}`);
  }
  if (query.run_id) filters.push(`Run: ${query.run_id}`);
  if (query.workflow_id) filters.push(`Workflow: ${query.workflow_id}`);
  if (query.identity_id) filters.push(`Identity: ${query.identity_id}`);
  if (query.time_start_utc) filters.push(`From: ${formatEvidenceDateTime(query.time_start_utc)}`);
  if (query.time_end_utc) filters.push(`Until: ${formatEvidenceDateTime(query.time_end_utc)}`);
  if (query.focus_evidence_id) filters.push(`Focused evidence: ${query.focus_evidence_id}`);
  return filters;
}

export function buildEvidenceWarningText(warnings: EvidencePage["warnings"] | null | undefined): string {
  if (!warnings) return "";
  const parts = [
    warningPart(warnings.skipped_artifacts, "artifact"),
    warningPart(warnings.skipped_reports, "report"),
    warningPart(warnings.skipped_traces, "trace"),
    warningPart(warnings.skipped_manifests, "manifest"),
  ].filter(Boolean);
  if (!parts.length) return "";
  return `Skipped malformed evidence: ${parts.join(", ")}.`;
}

export function shouldShowEvidenceEmptyAsFiltered(query: EvidenceListRequest): boolean {
  return Boolean(
    query.search?.trim() ||
      query.types?.length ||
      query.run_statuses?.length ||
      query.sources?.length ||
      query.workflow_id ||
      query.run_id ||
      query.identity_id ||
      query.time_start_utc ||
      query.time_end_utc,
  );
}

export function formatEvidenceDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatEvidenceBytes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Unknown size";
  if (value < 1024) return `${value} B`;
  const kilobytes = value / 1024;
  if (kilobytes < 1024) return `${formatNumber(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${formatNumber(megabytes)} MB`;
  return `${formatNumber(megabytes / 1024)} GB`;
}

export function isSafeEvidenceFieldKey(key: string): boolean {
  return !sensitiveFieldPattern.test(key);
}

function warningPart(count: number, noun: string): string {
  if (!count) return "";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
