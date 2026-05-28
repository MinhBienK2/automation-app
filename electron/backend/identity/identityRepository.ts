import type { DatabaseSync } from "node:sqlite";
import type {
  CloakBrowserDiagnostics,
  IdentityLabDetail,
  IdentityLabOverview,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
  ManagedIdentitySummary,
  RunStatus,
  WorkflowRunSource,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import { browserProfileKey, type RunnerCommandPort } from "../runtime/runManager.js";

type RunRow = {
  id: string;
  workflow_id: string;
  source: WorkflowRunSource;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  settings_snapshot_json: string | null;
  outputs_json: string | null;
  error_json: string | null;
};

export class IdentityRepository {
  constructor(
    private readonly options: {
      database: DatabaseSync;
      workflows: () => WorkflowSummary[];
      settingsForWorkflow: (workflowId: string) => WorkflowSettings;
      diagnostics: () => Promise<CloakBrowserDiagnostics>;
      runner: RunnerCommandPort;
    },
  ) {}

  async getOverview(request: IdentityLabOverviewRequest = {}): Promise<IdentityLabOverview> {
    const diagnostics = await this.options.diagnostics();
    const summaries = this.options.workflows()
      .map((workflow) => this.managedSummary(workflow))
      .filter((summary): summary is ManagedIdentitySummary => Boolean(summary))
      .filter((summary) => matchesSearch(summary, request.search));
    const selectedTarget =
      request.selected_target ??
      (summaries[0]
        ? {
            type: "managed" as const,
            workflow_id: summaries[0].workflow_ref.id,
            identity_id: summaries[0].identity_ref.id,
          }
        : null);
    const selected = selectedTarget
      ? await this.getDetail(selectedTarget, diagnostics)
      : null;
    const limited = summaries.slice(0, limitValue(request.limits?.identities, 100));
    return {
      generated_at: new Date().toISOString(),
      items: limited,
      selected,
      counts: {
        managed_identities: summaries.length,
        active_retained_sessions: summaries.filter((item) => item.retained_session.active).length,
        identities_with_warnings: summaries.filter((item) => item.warning_badges.length > 0).length,
        identities_with_recent_failures: summaries.filter((item) => item.recent_failures_24h > 0).length,
      },
      data_warnings: [],
    };
  }

  async getDetail(
    target: IdentityLabTarget,
    diagnostics?: CloakBrowserDiagnostics,
  ): Promise<IdentityLabDetail> {
    const diagnosticsSnapshot = diagnostics ?? await this.options.diagnostics();
    if (target.type === "historical") {
      const historical = this.historicalRun(target);
      const browserIdentity = parseBrowserIdentityOutput(historical);
      const workflowId = historical?.workflow_id ?? target.workflow_id ?? null;
      return {
        kind: "historical",
        identity_ref: {
          id: target.identity_id,
          display_name: stringValue(browserIdentity?.display_name),
        },
        workflow_ref: workflowId
          ? this.options.workflows().find((workflow) => workflow.id === workflowId) ?? null
          : null,
        run_id: historical?.id ?? null,
        evidence_id: historical ? target.evidence_id ?? null : null,
        observed_fields: safeFields(browserIdentity),
      };
    }
    const workflow = this.options.workflows().find((item) => item.id === target.workflow_id);
    if (!workflow) throw { message: "Workflow not found", field: "workflowId" };
    const settings = this.options.settingsForWorkflow(workflow.id);
    if (settings.browser_launch.identity_id !== target.identity_id) {
      return this.getDetail({
        type: "historical",
        workflow_id: workflow.id,
        identity_id: target.identity_id,
      }, diagnosticsSnapshot);
    }
    const profileName = browserProfileKey(settings);
    const retained = profileName
      ? this.options.runner.getRetainedSessionState?.(workflow.id, profileName)
      : null;
    const matchingRuns = this.matchingRuns(workflow.id, settings.browser_launch.identity_id);
    const lastRun = matchingRuns[0] ? runSummary(matchingRuns[0]) : null;
    const latestObservedRun = matchingRuns.find((run) =>
      parseJsonRecord(run.outputs_json)?.browser_identity,
    );
    const latestObservedOutput = latestObservedRun
      ? parseJsonRecord(parseJsonRecord(latestObservedRun.outputs_json)?.browser_identity)
      : null;
    const profileDiagnostics = diagnosticsSnapshot.profiles.find(
      (profile) => profile.profile_dir === settings.browser_launch.profile_dir,
    );
    const sessionActive = retained?.available === true;
    return {
      kind: "managed",
      workflow_ref: { id: workflow.id, name: workflow.name },
      identity_ref: {
        id: settings.browser_launch.identity_id,
        display_name: settings.browser_launch.display_name,
      },
      session: {
        active: sessionActive,
        profile_name: profileName,
        reset_blocked_reason: sessionActive
          ? "Close the retained browser session before resetting this identity."
          : null,
      },
      configured_posture: configuredPosture(settings),
      latest_observed: latestObservedRun && latestObservedOutput
        ? {
            run_id: latestObservedRun.id,
            observed_at: latestObservedRun.finished_at ?? latestObservedRun.started_at,
            fields: safeFields(latestObservedOutput),
          }
        : null,
      last_run: lastRun,
      recent_failures_24h: recentFailures(matchingRuns),
      evidence_summary: { total: evidenceItemCount(matchingRuns) },
      rotation_history: rotationHistory(settings),
      diagnostics: {
        binary_installed: diagnosticsSnapshot.binary.installed,
        wrapper_version: diagnosticsSnapshot.wrapper_version,
        geoip_available: diagnosticsSnapshot.geoip_available,
        headed_display_available: diagnosticsSnapshot.headed_display.available,
        profile: profileDiagnostics
          ? {
              approximate_size_bytes: profileDiagnostics.approximate_size_bytes,
              active_session: profileDiagnostics.active_session,
            }
          : null,
        font_status: diagnosticsSnapshot.font_checklist.status,
      },
      actions: {
        can_close_retained_session: sessionActive,
        can_reset_identity: !sessionActive,
        reset_disabled_reason: sessionActive ? "Close retained session first." : null,
      },
    };
  }

  private managedSummary(workflow: WorkflowSummary): ManagedIdentitySummary | null {
    const settings = this.options.settingsForWorkflow(workflow.id);
    const identityId = settings.browser_launch.identity_id;
    if (!identityId) return null;
    const profileName = browserProfileKey(settings);
    const retained = profileName
      ? this.options.runner.getRetainedSessionState?.(workflow.id, profileName)
      : null;
    const matchingRuns = this.matchingRuns(workflow.id, identityId);
    return {
      workflow_ref: { id: workflow.id, name: workflow.name },
      identity_ref: { id: identityId, display_name: settings.browser_launch.display_name },
      short_identity_id: identityId.length > 12 ? `${identityId.slice(0, 10)}...` : identityId,
      persona_id: settings.browser_launch.persona_id,
      persona_label: settings.browser_launch.persona?.label ?? null,
      session_mode: settings.browser_launch.session_mode,
      profile_reuse: settings.browser_launch.session_mode === "persistent_profile",
      retained_session: retained?.reason
        ? { active: retained?.available === true, reason: retained.reason }
        : { active: retained?.available === true },
      configured_posture_summary: configuredPosture(settings).map((item) => item.value).slice(0, 4),
      last_run: matchingRuns[0] ? runSummary(matchingRuns[0]) : null,
      recent_failures_24h: recentFailures(matchingRuns),
      warning_badges: [],
    };
  }

  private matchingRuns(workflowId: string, identityId: string) {
    const rows = this.options.database
      .prepare(
        `SELECT id, workflow_id, source, status, started_at, finished_at,
                settings_snapshot_json, outputs_json, error_json
         FROM runs
         WHERE workflow_id = ?
         ORDER BY started_at DESC, id DESC`,
      )
      .all(workflowId) as RunRow[];
    return rows.filter((row) => runIdentityId(row) === identityId);
  }

  private historicalRun(target: Extract<IdentityLabTarget, { type: "historical" }>) {
    if (target.run_id) {
      const row = this.options.database
        .prepare(
          `SELECT id, workflow_id, source, status, started_at, finished_at,
                  settings_snapshot_json, outputs_json, error_json
           FROM runs
           WHERE id = ?
           LIMIT 1`,
        )
        .get(target.run_id) as RunRow | undefined;
      return row && runIdentityId(row) === target.identity_id ? row : null;
    }
    if (!target.workflow_id) return null;
    return this.matchingRuns(target.workflow_id, target.identity_id)[0] ?? null;
  }
}

function runIdentityId(row: RunRow) {
  const settings = parseJsonRecord(row.settings_snapshot_json);
  const launch = parseJsonRecord(settings?.browser_launch);
  const outputs = parseJsonRecord(row.outputs_json);
  const evidence = parseJsonRecord(outputs?.browser_identity);
  return stringValue(launch?.identity_id) ?? stringValue(evidence?.identity_id);
}

function runSummary(row: RunRow) {
  return {
    run_id: row.id,
    status: row.status,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}

function parseBrowserIdentityOutput(row: RunRow | null | undefined) {
  if (!row) return null;
  return parseJsonRecord(parseJsonRecord(row.outputs_json)?.browser_identity);
}

function recentFailures(rows: RunRow[]) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    const time = Date.parse(row.finished_at ?? row.started_at);
    return row.status === "failed" && Number.isFinite(time) && time >= cutoff;
  }).length;
}

function evidenceItemCount(rows: RunRow[]) {
  return rows.reduce((total, row) => {
    const evidence = parseJsonRecord(row.outputs_json)?.__evidence;
    if (!Array.isArray(evidence)) return total;
    return total + evidence.filter((item) => isSafeEvidenceItem(row.id, item)).length;
  }, 0);
}

function isSafeEvidenceItem(runId: string, value: unknown) {
  const record = parseJsonRecord(value);
  const artifactKind = stringValue(record?.artifact_kind) ?? stringValue(record?.kind);
  const relativePath = stringValue(record?.path) ?? stringValue(record?.relative_path);
  return (
    (artifactKind === "screenshot" || artifactKind === "download") &&
    Boolean(relativePath && safeRunScopedEvidencePath(runId, relativePath))
  );
}

function safeRunScopedEvidencePath(runId: string, value: string) {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/.test(value)) {
    return false;
  }
  return value.startsWith(`runs/${runId}/`) && !value.split(/[\\/]+/).includes("..");
}

function configuredPosture(settings: WorkflowSettings) {
  const browser = settings.browser_launch;
  return [
    { label: "Persona", value: browser.persona?.label ?? browser.persona_id ?? "Not configured" },
    {
      label: "Session",
      value: browser.session_mode === "persistent_profile" ? "Reuse profile" : "Temporary",
    },
    { label: "Proxy", value: browser.proxy_enabled ? "Enabled, credentials redacted" : "Off" },
    {
      label: "Timezone",
      value: browser.geoip ? "GeoIP" : [browser.timezone, browser.locale].filter(Boolean).join(" / ") || "Local",
    },
    { label: "WebRTC", value: browser.webrtc_policy },
    { label: "Humanize", value: browser.humanize ? browser.human_preset : "Off" },
  ];
}

function rotationHistory(settings: WorkflowSettings) {
  return (settings.migration_notes ?? [])
    .filter((note) => note.action === "rotated")
    .slice(0, 20)
    .map((note) => {
      const match = /from (\S+) to (\S+)/.exec(note.message);
      return {
        previous_identity_id: match?.[1] ?? null,
        next_identity_id: match?.[2] ?? null,
        message: note.message,
      };
    });
}

function matchesSearch(summary: ManagedIdentitySummary, search: string | null | undefined) {
  const value = search?.trim().toLowerCase();
  if (!value) return true;
  return [
    summary.workflow_ref.name,
    summary.identity_ref.id,
    summary.identity_ref.display_name,
    summary.persona_label,
  ]
    .filter(Boolean)
    .some((item) => String(item).toLowerCase().includes(value));
}

function safeFields(record: Record<string, unknown> | null) {
  if (!record) return [];
  return Object.entries(record)
    .filter(([key, value]) => !/password|secret|token|cookie|credential|authorization/i.test(key) && isScalar(value))
    .map(([key, value]) => ({ key, value: value as string | number | boolean | null }));
}

function isScalar(value: unknown) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function limitValue(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(Math.floor(value as number), 200));
}
