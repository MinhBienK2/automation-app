import { createHash, randomUUID } from "node:crypto";
import type {
  RecorderStartSessionInput,
  RecordingBrowserIdentitySnapshot,
  RecordingEvent,
  RecordingSession,
  RecordingWarning,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

type RecorderSessionManagerDependencies = {
  getWorkflow(workflowId: string): WorkflowSummary | null;
  getWorkflowSettings(workflowId: string): WorkflowSettings;
  createNewWorkflowSettingsDraft(
    input: { name: string; draftWorkflowId: string; now: Date },
  ): WorkflowSettings;
  now?: () => Date;
};

type RecordingSessionRecord = {
  publicSession: RecordingSession;
  settingsSnapshot: WorkflowSettings;
  events: RecordingEvent[];
};

export class RecorderSessionManager {
  private readonly sessions = new Map<string, RecordingSessionRecord>();

  constructor(private readonly dependencies: RecorderSessionManagerDependencies) {}

  startSession(input: RecorderStartSessionInput): RecordingSession {
    const now = this.currentDate();
    const id = `rec_${randomUUID().replace(/-/g, "")}`;
    const warnings: RecordingWarning[] = [];
    const settings =
      input.mode === "replace_current_graph"
        ? this.savedWorkflowSettings(input.workflow_id)
        : this.newWorkflowSettingsDraft(input, id, now);

    if (input.browser_launch_overrides && Object.keys(input.browser_launch_overrides).length > 0) {
      warnings.push({
        code: "browser_launch_overrides_ignored",
        message: "Recorder browser launch overrides are not supported in this phase.",
        severity: "warning",
      });
    }

    const publicSession: RecordingSession = {
      id,
      workflow_id: input.mode === "replace_current_graph" ? input.workflow_id ?? null : null,
      mode: input.mode,
      status: "recording",
      started_at: now.toISOString(),
      stopped_at: null,
      browser_identity: browserIdentitySnapshot(settings),
      workflow_settings_snapshot: sanitizeWorkflowSettingsSnapshot(settings),
      page_url: normalizedOptionalText(input.initial_url),
      event_count: 0,
      warnings,
    };

    this.sessions.set(id, {
      publicSession,
      settingsSnapshot: settings,
      events: [],
    });

    return clone(publicSession);
  }

  getSession(sessionId: string): RecordingSession | null {
    const record = this.sessions.get(sessionId);
    return record ? clone(record.publicSession) : null;
  }

  listEvents(sessionId: string): RecordingEvent[] | null {
    const record = this.sessions.get(sessionId);
    return record ? clone(record.events) : null;
  }

  stopSession(sessionId: string): RecordingSession | null {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    if (record.publicSession.status === "discarded") return clone(record.publicSession);
    if (record.publicSession.status !== "stopped") {
      record.publicSession = {
        ...record.publicSession,
        status: "stopped",
        stopped_at: this.currentDate().toISOString(),
      };
    }
    return clone(record.publicSession);
  }

  discardSession(sessionId: string): RecordingSession | null {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    record.publicSession = {
      ...record.publicSession,
      status: "discarded",
      stopped_at: record.publicSession.stopped_at ?? this.currentDate().toISOString(),
    };
    record.events = [];
    return clone(record.publicSession);
  }

  getInternalSettingsSnapshot(sessionId: string): WorkflowSettings | null {
    const record = this.sessions.get(sessionId);
    return record ? clone(record.settingsSnapshot) : null;
  }

  private savedWorkflowSettings(workflowId: string | null | undefined) {
    if (!workflowId) {
      throw new RecorderSessionInputError(
        "Workflow id is required when recording into an existing workflow",
        "workflow_id",
      );
    }
    if (!this.dependencies.getWorkflow(workflowId)) {
      throw new RecorderSessionInputError("Workflow not found", "workflow_id");
    }
    return this.dependencies.getWorkflowSettings(workflowId);
  }

  private newWorkflowSettingsDraft(
    input: RecorderStartSessionInput,
    sessionId: string,
    now: Date,
  ) {
    const workflowName = normalizedOptionalText(input.workflow_name) ?? "Recorded workflow";
    return this.dependencies.createNewWorkflowSettingsDraft({
      name: workflowName,
      draftWorkflowId: `recording_${sessionId}`,
      now,
    });
  }

  private currentDate() {
    return this.dependencies.now?.() ?? new Date();
  }
}

export class RecorderSessionInputError extends Error {
  constructor(
    message: string,
    readonly field?: string | null,
  ) {
    super(message);
  }
}

export function sanitizeWorkflowSettingsSnapshot(settings: WorkflowSettings): WorkflowSettings {
  const sanitized = clone(settings);
  sanitized.browser_launch = {
    ...sanitized.browser_launch,
    proxy_password: null,
    proxy_server: sanitizeProxyServer(sanitized.browser_launch.proxy_server),
  };
  return sanitized;
}

function browserIdentitySnapshot(settings: WorkflowSettings): RecordingBrowserIdentitySnapshot {
  const browser = settings.browser_launch;
  return {
    identity_id: browser.identity_id,
    display_name: browser.display_name,
    profile_dir: browser.profile_dir,
    profile_name: browser.profile_name ?? null,
    fingerprint_seed_hash: createHash("sha256")
      .update(browser.fingerprint_seed)
      .digest("hex"),
    persona_id: browser.persona_id,
    persona_label: browser.persona?.label ?? null,
    humanize: browser.humanize,
    human_preset: browser.human_preset,
    headless: browser.headless,
  };
}

function sanitizeProxyServer(value: string | null | undefined) {
  if (!value) return value ?? null;
  try {
    const parsed = new URL(value);
    if (!parsed.username && !parsed.password) return value;
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

function normalizedOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
