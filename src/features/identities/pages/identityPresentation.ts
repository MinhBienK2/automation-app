import type {
  IdentityLabManagedDetail,
  WorkflowBrowserSessionMode,
} from "../../../types/workflow";

type IdentityField = { key: string; value: string | number | boolean | null };

const sensitiveIdentityFieldPattern =
  /(password|secret|token|cookie|session_storage|sessionstorage|local_storage|localstorage|profile_dir|profile_path|fingerprint_fonts_dir|font.*(path|dir)|binary_path|cache_path|raw_)/i;

export function retainedSessionLabel(session: { active: boolean }): string {
  return session.active ? "Live retained session" : "No retained session";
}

export function sessionModeLabel(
  sessionMode: WorkflowBrowserSessionMode,
  profileReuse: boolean,
): string {
  if (sessionMode === "persistent_profile" && profileReuse) return "Persistent profile";
  if (sessionMode === "persistent_profile") return "Persistent profile configured";
  return "Temporary session";
}

export function identityEvidenceCountLabel(count: number): string {
  if (count === 0) return "No recent evidence for this identity yet.";
  return `${count} matching evidence item${count === 1 ? "" : "s"}.`;
}

export function buildSafeIdentityFields<T extends IdentityField>(fields: T[]): T[] {
  return fields.filter((field) => !sensitiveIdentityFieldPattern.test(field.key));
}

export function formatIdentityBytes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Unknown size";
  if (value < 1024) return `${value} B`;
  const kilobytes = value / 1024;
  if (kilobytes < 1024) return `${formatNumber(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  if (megabytes < 1024) return `${formatNumber(megabytes)} MB`;
  return `${formatNumber(megabytes / 1024)} GB`;
}

export function formatIdentityDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function identityTitle(detail: IdentityLabManagedDetail): string {
  return detail.identity_ref.display_name ?? detail.identity_ref.id;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
