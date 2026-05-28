import type {
  BrowserProfileCleanupResult,
  CloakBrowserDiagnostics,
} from "../../../types/workflow";

export type ReadinessTone = "ready" | "attention" | "neutral";

export type DiagnosticsReadinessCard = {
  label: string;
  value: string;
  tone: ReadinessTone;
  details: string[];
};

export function formatDiagnosticsReadiness(
  diagnostics: CloakBrowserDiagnostics,
): DiagnosticsReadinessCard[] {
  return [
    cloakBrowserCard(diagnostics),
    geoIpCard(diagnostics),
    headedDisplayCard(diagnostics),
    fingerprintFontsCard(diagnostics),
    profilesCard(diagnostics),
    smokeCheckCard(diagnostics),
  ];
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function formatCleanupResult(result: BrowserProfileCleanupResult) {
  const deletedCount = result.deleted_profiles.length;
  const skippedCount = result.skipped_profiles.length;
  const lines = [
    deletedCount === 0
      ? "No orphaned profiles were deleted."
      : `Deleted ${deletedCount} orphaned ${plural(deletedCount, "profile")}.`,
    `Skipped ${skippedCount} managed or active ${plural(skippedCount, "profile")}.`,
    `Reclaimed about ${formatBytes(result.reclaimed_bytes)}.`,
  ];
  if (skippedCount > 0) {
    lines.push("Managed and active profiles were preserved.");
  }
  return lines;
}

export function redactLocalPaths(message: string) {
  return message
    .replace(/https?:\/\/[^\s]+/g, "configured download source")
    .replace(/[A-Za-z]:\\[^\s]+/g, "local runtime path")
    .replace(/\/[^\s]+/g, "local runtime path");
}

function cloakBrowserCard(diagnostics: CloakBrowserDiagnostics): DiagnosticsReadinessCard {
  const details: string[] = [];
  if (diagnostics.wrapper_version) {
    details.push(`Wrapper ${diagnostics.wrapper_version}`);
  }
  if (diagnostics.binary.platform) {
    details.push(`Platform ${diagnostics.binary.platform}`);
  }
  if (!diagnostics.auto_update_enabled) {
    details.push("Auto-update off");
  }
  if (diagnostics.checksum_skip_enabled) {
    details.push("Checksum skip enabled");
  }
  return {
    label: "CloakBrowser",
    value: diagnostics.binary.installed
      ? `Installed${diagnostics.binary.version ? ` ${diagnostics.binary.version}` : ""}`
      : "Not installed",
    tone: diagnostics.binary.installed ? "ready" : "attention",
    details,
  };
}

function geoIpCard(diagnostics: CloakBrowserDiagnostics): DiagnosticsReadinessCard {
  return {
    label: "GeoIP",
    value: diagnostics.geoip_available ? "GeoIP available" : "GeoIP unavailable",
    tone: diagnostics.geoip_available ? "ready" : "attention",
    details: diagnostics.geoip_available
      ? []
      : ["GeoIP-based timezone and locale may need explicit Workflow Settings."],
  };
}

function headedDisplayCard(diagnostics: CloakBrowserDiagnostics): DiagnosticsReadinessCard {
  return {
    label: "Headed display",
    value: diagnostics.headed_display.available ? "Available" : "Unavailable",
    tone: diagnostics.headed_display.available ? "ready" : "attention",
    details: diagnostics.headed_display.reason
      ? [redactLocalPaths(diagnostics.headed_display.reason)]
      : [],
  };
}

function fingerprintFontsCard(diagnostics: CloakBrowserDiagnostics): DiagnosticsReadinessCard {
  const directories = diagnostics.font_checklist.directories;
  const fileCount = directories.reduce((sum, directory) => sum + directory.file_count, 0);
  const missingFamilies = [
    ...new Set(directories.flatMap((directory) => directory.missing_expected_families)),
  ];
  const shared = directories.some((directory) => directory.workflow_names.length > 1);
  const hash = directories.find((directory) => directory.normalized_hash)?.normalized_hash;
  const details = [
    directories.length > 0
      ? `${directories.length} configured ${plural(directories.length, "directory")}`
      : "",
    fileCount > 0 ? `${fileCount} font ${plural(fileCount, "file")}` : "",
    missingFamilies.length > 0 ? `Missing: ${missingFamilies.join(", ")}` : "",
    shared ? "Shared by multiple workflow identities" : "",
    hash ? `font set hash ${hash.slice(0, 12)}` : "",
  ].filter(Boolean);
  const status = diagnostics.font_checklist.status;
  return {
    label: "Fingerprint fonts",
    value: statusLabel(status),
    tone: status === "warning" || status === "error" ? "attention" : "neutral",
    details,
  };
}

function profilesCard(diagnostics: CloakBrowserDiagnostics): DiagnosticsReadinessCard {
  const activeCount = diagnostics.profiles.filter((profile) => profile.active_session).length;
  const orphanCount = diagnostics.profiles.filter(
    (profile) => !profile.workflow_id && !profile.active_session,
  ).length;
  const totalBytes = diagnostics.profiles.reduce(
    (sum, profile) => sum + profile.approximate_size_bytes,
    0,
  );
  return {
    label: "Profiles",
    value: `${diagnostics.profiles.length} managed ${plural(diagnostics.profiles.length, "profile")}`,
    tone: orphanCount > 0 ? "neutral" : "ready",
    details: [
      `${activeCount} retained ${activeCount === 1 ? "session" : "sessions"} active`,
      `${orphanCount} orphaned ${plural(orphanCount, "profile")} can be cleaned`,
      `${formatBytes(totalBytes)} approximate local storage`,
    ],
  };
}

function smokeCheckCard(diagnostics: CloakBrowserDiagnostics): DiagnosticsReadinessCard {
  return {
    label: "Smoke check",
    value: statusLabel(diagnostics.last_smoke_result.status),
    tone: "neutral",
    details: ["Smoke tests are recorded by npm run test:smoke command output."],
  };
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    not_configured: "Not configured",
    not_recorded: "Not recorded",
    ok: "Ok",
    warning: "Warning",
    error: "Error",
  };
  if (labels[value]) return labels[value];
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function plural(count: number, noun: string) {
  return `${noun}${count === 1 ? "" : "s"}`;
}
