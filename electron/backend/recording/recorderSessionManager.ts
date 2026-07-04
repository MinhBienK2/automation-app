import { createHash, randomUUID } from "node:crypto";
import type {
  RecorderStartSessionInput,
  RecordingEvent,
  RecordingBrowserIdentitySnapshot,
  RecordingSession,
  RecordingWarning,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverContext,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import { RecordingEventCollector } from "./eventCollector.js";

type RecorderSessionManagerDependencies = {
  getWorkflow(workflowId: string): Promise<WorkflowSummary | null> | WorkflowSummary | null;
  getWorkflowSettings(workflowId: string): Promise<WorkflowSettings> | WorkflowSettings;
  createNewWorkflowSettingsDraft(
    input: { name: string; draftWorkflowId: string; now: Date },
  ): WorkflowSettings;
  launchBrowser?: (input: {
    settings: WorkflowSettings;
    workflowId: string | null;
  }) => Promise<{
    context: BrowserDriverContext;
    page: BrowserDriverPage;
    temporary: boolean;
  }>;
  now?: () => Date;
};

type RecordingSessionRecord = {
  publicSession: RecordingSession;
  settingsSnapshot: WorkflowSettings;
  collector: RecordingEventCollector | null;
  browserContext: BrowserDriverContext | null;
};

export class RecorderSessionManager {
  private readonly sessions = new Map<string, RecordingSessionRecord>();

  constructor(private readonly dependencies: RecorderSessionManagerDependencies) {}

  async startSession(input: RecorderStartSessionInput): Promise<RecordingSession> {
    const now = this.currentDate();
    const id = `rec_${randomUUID().replace(/-/g, "")}`;
    const warnings: RecordingWarning[] = [];
    let settings =
      input.mode === "replace_current_graph"
        ? await this.savedWorkflowSettings(input.workflow_id)
        : this.newWorkflowSettingsDraft(input, id, now);

    settings = applyRecorderBrowserLaunchOverrides(
      settings,
      input.browser_launch_overrides,
      warnings,
    );

    const workflowId = input.mode === "replace_current_graph" ? input.workflow_id ?? null : null;
    const collector = new RecordingEventCollector(id);
    let launched: Awaited<ReturnType<NonNullable<RecorderSessionManagerDependencies["launchBrowser"]>>> | null = null;
    try {
      launched = this.dependencies.launchBrowser
        ? await this.dependencies.launchBrowser({ settings, workflowId })
        : null;
      if (launched) {
        await collector.attachContext(launched.context);
        await collector.attachPage(launched.page);
      }
      if (launched && normalizedOptionalText(input.initial_url)) {
        await launched.page.goto(normalizedOptionalText(input.initial_url) as string);
        await collector.installPageCapture(launched.page);
      }
    } catch (error) {
      collector.dispose();
      await launched?.context.close().catch(() => undefined);
      throw error;
    }

    const publicSession: RecordingSession = {
      id,
      workflow_id: workflowId,
      mode: input.mode,
      status: "recording",
      started_at: now.toISOString(),
      stopped_at: null,
      browser_identity: browserIdentitySnapshot(settings),
      workflow_settings_snapshot: sanitizeWorkflowSettingsSnapshot(settings),
      page_url: normalizedOptionalText(input.initial_url),
      event_count: launched ? collector.listEvents().length : 0,
      warnings,
    };

    this.sessions.set(id, {
      publicSession,
      settingsSnapshot: settings,
      collector: launched ? collector : null,
      browserContext: launched?.context ?? null,
    });

    return clone(publicSession);
  }

  getSession(sessionId: string): RecordingSession | null {
    const record = this.sessions.get(sessionId);
    return record ? this.publicSession(record) : null;
  }

  listEvents(sessionId: string): RecordingEvent[] | null {
    const record = this.sessions.get(sessionId);
    return record ? record.collector?.listEvents() ?? [] : null;
  }

  async stopSession(sessionId: string): Promise<RecordingSession | null> {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    if (record.publicSession.status === "discarded") return this.publicSession(record);
    if (record.publicSession.status !== "stopped") {
      record.publicSession = {
        ...record.publicSession,
        status: "stopped",
        stopped_at: this.currentDate().toISOString(),
      };
      await record.collector?.flushBufferedEvents();
      record.collector?.dispose();
      await record.browserContext?.close();
      record.browserContext = null;
    }
    return this.publicSession(record);
  }

  async discardSession(sessionId: string): Promise<RecordingSession | null> {
    const record = this.sessions.get(sessionId);
    if (!record) return null;
    record.publicSession = {
      ...record.publicSession,
      status: "discarded",
      stopped_at: record.publicSession.stopped_at ?? this.currentDate().toISOString(),
    };
    await record.browserContext?.close();
    record.browserContext = null;
    record.collector?.dispose();
    record.collector = null;
    const publicSession = this.publicSession(record);
    this.sessions.delete(sessionId);
    return publicSession;
  }

  getInternalSettingsSnapshot(sessionId: string): WorkflowSettings | null {
    const record = this.sessions.get(sessionId);
    return record ? clone(record.settingsSnapshot) : null;
  }

  deleteSession(sessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    record.collector?.dispose();
    void record.browserContext?.close().catch(() => undefined);
    this.sessions.delete(sessionId);
  }

  private async savedWorkflowSettings(workflowId: string | null | undefined): Promise<WorkflowSettings> {
    if (!workflowId) {
      throw new RecorderSessionInputError(
        "Workflow id is required when recording into an existing workflow",
        "workflow_id",
      );
    }
    const workflow = await this.dependencies.getWorkflow(workflowId);
    if (!workflow) {
      throw new RecorderSessionInputError("Workflow not found", "workflow_id");
    }
    return await this.dependencies.getWorkflowSettings(workflowId);
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

  private publicSession(record: RecordingSessionRecord): RecordingSession {
    return clone({
      ...record.publicSession,
      event_count: record.collector?.listEvents().length ?? 0,
    });
  }
}

export class RecorderSessionInputError extends Error {
  constructor(
    readonly message: string,
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

function applyRecorderBrowserLaunchOverrides(
  settings: WorkflowSettings,
  overrides: Record<string, unknown> | null | undefined,
  warnings: RecordingWarning[],
): WorkflowSettings {
  if (!overrides || Object.keys(overrides).length === 0) return settings;
  let nextSettings = settings;
  if (typeof overrides.headless === "boolean") {
    nextSettings = {
      ...nextSettings,
      browser_launch: {
        ...nextSettings.browser_launch,
        headless: overrides.headless,
      },
    };
  } else if ("headless" in overrides) {
    warnings.push({
      code: "invalid_browser_launch_override",
      message: "Recorder browser launch override headless must be a boolean.",
      severity: "warning",
    });
  }

  const unsupported = Object.keys(overrides).filter((key) => key !== "headless");
  if (unsupported.length > 0) {
    warnings.push({
      code: "unsupported_browser_launch_overrides",
      message: `Recorder browser launch overrides are not supported for: ${unsupported.join(", ")}.`,
      severity: "warning",
    });
  }
  return nextSettings;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
