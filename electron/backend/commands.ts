import fs from "node:fs/promises";
import nodeFs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import type {
  ActionConfig,
  BatchRunRequest,
  BrowserProfileCleanupResult,
  BrowserProfileDiagnostics,
  CloakBrowserDiagnostics,
  CompiledWorkflowGraph,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordingGenerateDraftOptions,
  RecorderStartSessionInput,
  RecordingEvent,
  RecordingSession,
  RecordingWorkflowDraft,
  RunValidationIssue,
  ScheduleValidationIssue,
  SettingsValidationIssue,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowDeleteOptions,
  WorkflowDetail,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
  WorkflowRunSnapshot,
  WorkflowRunSource,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleUpdate,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../../src/types/workflow.js";
import type { AppPaths } from "./persistence/database.js";
import {
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  compileWorkflowGraph as compileGraph,
  validateActionConfig,
  validateWorkflowGraph as validateGraph,
} from "./graph/compiler.js";
import { BrowserWorkflowRunner } from "./runtime/runner.js";
import {
  calculateNextRunAt,
  processDueSchedules,
  validateScheduleInput,
} from "./scheduling/scheduler.js";
import {
  browserProfileKey,
  idleRunState,
  RunManager,
  type RunnerCommandPort,
} from "./runtime/runManager.js";
import { sanitizePathSegment } from "./evidence/artifacts.js";
import { migrateWorkflowGraph } from "./graph/migration.js";
import { WorkflowPackageService } from "./services/workflowPackageService.js";
import { WorkflowRepository } from "./persistence/workflowRepository.js";
import { WorkflowScheduleRepository } from "./scheduling/workflowScheduleRepository.js";
import {
  createHighEntropyBrowserIdentityId,
  deriveFingerprintSeedFromIdentityId,
  WorkflowSettingsService,
} from "./services/workflowSettingsService.js";
import {
  BrowserSessionManager,
  type BrowserDriver,
} from "./browser/sessionManager.js";
import {
  RecorderSessionInputError,
  RecorderSessionManager,
} from "./recording/recorderSessionManager.js";
import { generateRecordingGraph } from "./recording/graphGenerator.js";
import { normalizeRecordingEvents } from "./recording/timelineNormalizer.js";

export { finishRun } from "./runtime/runManager.js";
export { defaultWorkflowSettings, deriveFingerprintSeedFromIdentityId } from "./services/workflowSettingsService.js";

const nodeRequire = createRequire(import.meta.url);

type CloakBrowserDiagnosticsModule = {
  binaryInfo: () => {
    version?: string;
    platform?: string;
    binaryPath?: string;
    installed?: boolean;
    cacheDir?: string;
    downloadUrl?: string;
  };
  ensureBinary: () => Promise<string>;
};

export type CommandError = {
  message: string;
  field?: string | null;
};

export type WorkflowCommandHandlers = ReturnType<typeof createWorkflowCommandHandlers>;

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
  runner?: RunnerCommandPort;
  recorderDriver?: BrowserDriver;
  recorderUsesDefaultDriver?: boolean;
  saveWorkflowPackageFile?: (packageValue: WorkflowPackage) => Promise<string | null>;
  defaultFingerprintFontsDir?: string | null | (() => string | null);
};

export function createWorkflowCommandHandlers(context: CommandContext) {
  const repository = new WorkflowRepository(context.database);
  const scheduleRepository = new WorkflowScheduleRepository(context.database);
  const runner = context.runner ?? new BrowserWorkflowRunner({ appPaths: context.appPaths });
  const recorderBrowserSessionManager = new BrowserSessionManager({
    appPaths: context.appPaths,
    driver: context.recorderDriver,
    usesDefaultDriver: context.recorderUsesDefaultDriver,
  });
  const runManager = new RunManager({ database: context.database, runner });
  const settingsService = new WorkflowSettingsService({
    directoryReadable,
    isOptionalModuleAvailable,
    defaultFingerprintFontsDir: () => resolveDefaultFingerprintFontsDir(context.defaultFingerprintFontsDir),
  });
  const packageService = new WorkflowPackageService({
    migrateGraph: migrateWorkflowGraph,
    validateGraph,
    validateSettings: (settings) => settingsService.validateSettings(settings),
    defaultSettings: settingsService.defaultWorkflowSettings,
  });
  const recorderSessionManager = new RecorderSessionManager({
    getWorkflow: (workflowId) => repository.getWorkflowSummary(workflowId),
    getWorkflowSettings: (workflowId) => getSettings(workflowId),
    createNewWorkflowSettingsDraft({ name, draftWorkflowId, now }) {
      return settingsService.defaultWorkflowSettings(
        {
          id: draftWorkflowId,
          name,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        { randomizeIdentity: true },
      );
    },
    launchBrowser({ settings, workflowId }) {
      return recorderBrowserSessionManager.launchFreshSession({
        settings,
        retainedSessionWorkflowId: workflowId,
      });
    },
  });
  const recordingDrafts = new Map<string, RecordingWorkflowDraft>();

  function requireWorkflow(workflowId: string): WorkflowSummary {
    const workflow = repository.getWorkflowSummary(workflowId);
    if (!workflow) {
      throw commandError("Workflow not found", "workflowId");
    }
    return workflow;
  }

  function getSettings(workflowId: string): WorkflowSettings {
    const persisted = repository.getWorkflowSettings(workflowId);
    const workflow = requireWorkflow(workflowId);
    if (persisted) return settingsService.normalizeWorkflowSettings(persisted, workflow);
    return settingsService.defaultWorkflowSettings(workflow);
  }

  function lastRunAtForWorkflow(workflowId: string): string | null {
    const row = context.database
      .prepare(
        `SELECT COALESCE(finished_at, started_at) AS last_run_at
         FROM runs
         WHERE workflow_id = ?
         ORDER BY started_at DESC
         LIMIT 1`,
      )
      .get(workflowId) as { last_run_at?: string | null } | undefined;
    return row?.last_run_at ?? null;
  }

  function activeRunConflict(workflowId: string, settings: WorkflowSettings) {
    return runManager.activeRunConflict(workflowId, settings);
  }

  function schedulerConflictReason(workflowId: string) {
    const settings = getSettings(workflowId);
    return activeRunConflict(workflowId, settings)?.reason ?? null;
  }

  function assertCanChangeBrowserIdentityProfile(
    workflowId: string,
    nextSettings: WorkflowSettings,
  ) {
    const currentSettings = getSettings(workflowId);
    runManager.assertCanChangeBrowserIdentityProfile(workflowId, currentSettings, nextSettings);
  }

  function assertWorkflowDeletionAllowed(workflowId: string, settings: WorkflowSettings) {
    runManager.assertWorkflowDeletionAllowed(workflowId, settings);
  }

  function assertCanResetBrowserIdentity(workflowId: string, settings: WorkflowSettings) {
    runManager.assertCanResetBrowserIdentity(workflowId, settings);
  }

  function usedFingerprintSeeds(exceptWorkflowId?: string) {
    return new Set(
      repository
        .listWorkflows()
        .filter((workflow) => workflow.id !== exceptWorkflowId)
        .map((workflow) => getSettings(workflow.id).browser_launch.fingerprint_seed)
        .filter((seed): seed is string => Boolean(seed)),
    );
  }

  function rotateBrowserIdentity(workflowId: string): WorkflowSettings {
    const settings = getSettings(workflowId);
    assertCanResetBrowserIdentity(workflowId, settings);
    const identityId = createHighEntropyBrowserIdentityId();
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      usedFingerprintSeeds(workflowId),
    );
    const timestamp = new Date().toISOString();
    return saveSettings(workflowId, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        run_from_selected_enabled: false,
      },
      browser_launch: {
        ...settings.browser_launch,
        identity_id: identityId,
        profile_dir: identityId,
        profile_name:
          settings.browser_launch.session_mode === "persistent_profile"
            ? identityId
            : null,
        fingerprint_seed: fingerprintSeed,
      },
      migration_notes: [
        ...settings.migration_notes,
        {
          path: "browser_launch.identity_id",
          action: "rotated",
          message: `Browser identity rotated from ${settings.browser_launch.identity_id} to ${identityId} at ${timestamp}`,
        },
      ],
    });
  }

  function assertNoUnsupportedGraphDiscriminants(graph: WorkflowGraph) {
    const issue = validateGraph(graph).find(
      (candidate) =>
        candidate.level === "error" &&
        isUnsupportedGraphDiscriminantMessage(candidate.message),
    );
    if (!issue) return;
    throw commandError(issue.message, "workflow.graph");
  }

  function deleteBrowserProfileDirectoryIfPrivate(
    workflowId: string,
    settings: WorkflowSettings,
  ) {
    const profileDir = browserProfileKey(settings);
    if (!profileDir || isProfileReferencedByAnotherWorkflow(workflowId, profileDir)) {
      return;
    }
    nodeFs.rmSync(path.join(context.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)), {
      recursive: true,
      force: true,
    });
  }

  function isProfileReferencedByAnotherWorkflow(workflowId: string, profileDir: string) {
    return repository
      .listWorkflows()
      .some((workflow) => {
        if (workflow.id === workflowId) return false;
        return browserProfileKey(getSettings(workflow.id)) === profileDir;
      });
  }

  function saveSettings(workflowId: string, settings: WorkflowSettings) {
    const workflow = requireWorkflow(workflowId);
    const activeSettings = settingsService.normalizeWorkflowSettings(settings, workflow);
    assertCanChangeBrowserIdentityProfile(workflowId, activeSettings);
    const issues = settingsService.validateSettings(activeSettings);
    const firstError = issues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(
        firstError.message,
        firstError.field
          ? `${firstError.section}.${firstError.field}`
          : firstError.section,
      );
    }

    const timestamp = new Date().toISOString();
    const normalized: WorkflowSettings = {
      ...activeSettings,
      workflow_id: workflowId,
      version: 2,
      general: {
        ...activeSettings.general,
        name: activeSettings.general.name.trim(),
        updated_at: timestamp,
        created_at: activeSettings.general.created_at ?? workflow.created_at,
      },
      browser_launch: activeSettings.browser_launch,
      migration_notes: activeSettings.migration_notes,
      updated_at: timestamp,
      created_at: activeSettings.created_at ?? workflow.created_at,
    };
    repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  async function runRecorderCommand<T>(operation: () => T | Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RecorderSessionInputError) {
        throw commandError(error.message, error.field ?? undefined);
      }
      throw error;
    }
  }

  function requireRecordingResult<T>(value: T | null, field = "sessionId"): T {
    if (value == null) {
      throw commandError("Recording session not found", field);
    }
    return value;
  }

  function createRecordingDraft(
    sessionId: string,
    options: RecordingGenerateDraftOptions,
  ): RecordingWorkflowDraft {
    const session = requireRecordingResult(recorderSessionManager.getSession(sessionId));
    if (session.status !== "stopped") {
      throw commandError("Stop recording before generating a draft", "sessionId");
    }
    const includeEventIds = new Set(options.include_event_ids ?? []);
    const events = requireRecordingResult(recorderSessionManager.listEvents(sessionId))
      .filter((event) => !includeEventIds.size || includeEventIds.has(event.id));
    const steps = normalizeRecordingEvents(events);
    if (!steps.some((step) => step.included)) {
      throw commandError("No meaningful actions recorded", "events");
    }
    const graph = generateRecordingGraph(steps, {
      addTerminalSuccess: options.add_terminal_success,
    });
    const validationIssues = validateGraph(graph);
    const draft: RecordingWorkflowDraft = {
      id: `draft_${randomUUID().replace(/-/g, "")}`,
      session_id: session.id,
      workflow_id: session.workflow_id,
      mode: session.mode,
      status: "draft",
      generated_at: new Date().toISOString(),
      workflow_settings_snapshot: session.workflow_settings_snapshot,
      steps,
      graph,
      validation_issues: validationIssues,
      warnings: [
        ...session.warnings,
        ...steps.flatMap((step) => step.warnings),
      ],
    };
    recordingDrafts.set(draft.id, draft);
    return draft;
  }

  function createWorkflow(name: string): Workflow {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const workflow = repository.createWorkflow(normalized, createDraftGraph());
    repository.saveWorkflowSettings(
      workflow.id,
      settingsService.defaultWorkflowSettings(workflow, { randomizeIdentity: true }),
    );
    return workflow;
  }

  function getWorkflowGraph(workflowId: string): WorkflowGraph {
    const graph = repository.getWorkflowGraph(workflowId);
    if (!graph) {
      requireWorkflow(workflowId);
      return createDraftGraph();
    }
    const migrated = migrateWorkflowGraph(graph);
    if (JSON.stringify(migrated) !== JSON.stringify(graph)) {
      repository.saveWorkflowGraph(workflowId, migrated);
    }
    return migrated;
  }

  function validateWorkflowRun(workflowId: string): RunValidationIssue[] {
    const graph = getWorkflowGraph(workflowId);
    return [
      ...validateGraph(graph).map((issue) => ({
        source: "graph" as const,
        field: null,
        node_id: issue.node_id ?? null,
        edge_id: issue.edge_id ?? null,
        message: issue.message,
        level: issue.level,
      })),
      ...settingsService.validateSettings(getSettings(workflowId)).map((issue) => ({
        source: "settings" as const,
        field: issue.field ?? null,
        node_id: null,
        edge_id: null,
        message: issue.message,
        level: issue.level,
      })),
    ];
  }

  async function startWorkflowRun(
    workflowId: string,
    source: WorkflowRunSource = "manual",
  ): Promise<WorkflowRunSnapshot> {
    const workflow = requireWorkflow(workflowId);
    const settings = getSettings(workflowId);
    const conflict = activeRunConflict(workflowId, settings);
    if (conflict) {
      throw commandError(conflict.message, conflict.field);
    }
    const graph = getWorkflowGraph(workflowId);
    const runIssues = validateWorkflowRun(workflowId);
    const firstError = runIssues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(firstError.message, firstError.field ?? firstError.node_id ?? "workflowId");
    }
    if (compileGraph(graph).steps.length === 0) {
      throw commandError("Workflow graph has no executable steps", "graph");
    }

    const compiledGraph = compileWorkflowRunPlan(graph, settings);
    return runManager.startWorkflowRun({
      workflow,
      source,
      settings,
      graphSnapshot: graph,
      compiledGraph,
    });
  }

  function scheduleInputWithNextRun(input: WorkflowScheduleInput): WorkflowScheduleInput & {
    next_run_at: string | null;
  } {
    const issues = validateScheduleInput(input);
    const firstError = issues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(firstError.message, firstError.field);
    }
    if (input.enabled) {
      const workflowIssues = validateWorkflowRun(input.workflow_id);
      const firstWorkflowError = workflowIssues.find((issue) => issue.level === "error");
      if (firstWorkflowError) {
        throw commandError(
          firstWorkflowError.message,
          firstWorkflowError.field ?? firstWorkflowError.node_id ?? "workflow_id",
        );
      }
    } else {
      requireWorkflow(input.workflow_id);
    }
    return {
      ...input,
      name: input.name.trim(),
      next_run_at: input.enabled ? calculateNextRunAt(input.kind, new Date()) : null,
    };
  }

  return {
    listWorkflows() {
      return repository.listWorkflows();
    },

    getWorkflow(id: string): WorkflowDetail | null {
      return repository.getWorkflow(id);
    },

    getWorkflowBrowserConfig(workflowId: string): WorkflowBrowserConfig {
      return settingsService.settingsBrowserToConfig(workflowId, getSettings(workflowId).browser_launch);
    },

    saveWorkflowBrowserConfig(
      workflowId: string,
      config: WorkflowBrowserConfig,
    ) {
      const settings = getSettings(workflowId);
      saveSettings(workflowId, {
        ...settings,
        browser_launch: {
          ...settings.browser_launch,
          ...settingsService.configToSettingsBrowserLaunch(config, {
            id: workflowId,
            name: settings.general.name,
          }),
          ...settingsService.browserIdentityPreferences(settings.browser_launch),
        },
      });
    },

    getWorkflowSettings(workflowId: string): WorkflowSettings {
      return getSettings(workflowId);
    },

    resetWorkflowBrowserIdentity(workflowId: string): WorkflowSettings {
      requireWorkflow(workflowId);
      return rotateBrowserIdentity(workflowId);
    },

    saveWorkflowSettings: saveSettings,

    saveWorkflowSettingsSection<Section extends WorkflowSettingsSectionId>(
      workflowId: string,
      section: Section,
      sectionValue: WorkflowSettings[Section],
    ): WorkflowSettings {
      return saveSettings(workflowId, {
        ...getSettings(workflowId),
        [section]: sectionValue,
      });
    },

    validateWorkflowSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
      return settingsService.validateSettings(settings);
    },

    async getCloakBrowserDiagnostics(): Promise<CloakBrowserDiagnostics> {
      return buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
    },

    async installCloakBrowserBinary(): Promise<CloakBrowserDiagnostics> {
      const cloakbrowser = await loadCloakBrowserDiagnosticsModule();
      await cloakbrowser.ensureBinary();
      return buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
    },

    async cleanupOrphanedBrowserProfiles(): Promise<BrowserProfileCleanupResult> {
      const diagnostics = await buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
      const result: BrowserProfileCleanupResult = {
        deleted_profiles: [],
        skipped_profiles: [],
        reclaimed_bytes: 0,
      };
      for (const profile of diagnostics.profiles) {
        if (profile.workflow_id || profile.active_session) {
          result.skipped_profiles.push(profile);
          continue;
        }
        await fs.rm(path.join(context.appPaths.browserProfilesDir, profile.profile_dir), {
          recursive: true,
          force: true,
        });
        result.deleted_profiles.push(profile.profile_dir);
        result.reclaimed_bytes += profile.approximate_size_bytes;
      }
      result.deleted_profiles.sort((left, right) => left.localeCompare(right));
      return result;
    },

    validateWorkflowRun(workflowId: string): RunValidationIssue[] {
      return validateWorkflowRun(workflowId);
    },

    createWorkflow,

    renameWorkflow(id: string, name: string) {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      requireWorkflow(id);
      repository.renameWorkflow(id, normalized);
    },

    deleteWorkflow(id: string, options: WorkflowDeleteOptions = {}) {
      const settings = getSettings(id);
      assertWorkflowDeletionAllowed(id, settings);
      if (options.deleteBrowserProfile) {
        deleteBrowserProfileDirectoryIfPrivate(id, settings);
      }
      repository.deleteWorkflow(id);
    },

    duplicateWorkflow(workflowId: string, name: string): WorkflowDetail {
      requireWorkflow(workflowId);
      context.database.exec("BEGIN IMMEDIATE");
      try {
        const created = createWorkflow(name);
        const graph = repository.getWorkflowGraph(workflowId);
        if (graph) repository.saveWorkflowGraph(created.id, graph);
        const settings = repository.getWorkflowSettings(workflowId);
        if (settings) {
          saveSettings(created.id, settingsService.duplicateWorkflowSettings(settings, created));
        }
        context.database.exec("COMMIT");
        return { workflow: created, steps: [] };
      } catch (error) {
        context.database.exec("ROLLBACK");
        throw error;
      }
    },

    getWorkflowGraph(workflowId: string): WorkflowGraph {
      return getWorkflowGraph(workflowId);
    },

    saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
      requireWorkflow(workflowId);
      const migrated = migrateWorkflowGraph(graph);
      assertNoUnsupportedGraphDiscriminants(migrated);
      repository.saveWorkflowGraph(workflowId, migrated);
    },

    validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
      return validateGraph(migrateWorkflowGraph(graph));
    },

    compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
      return compileGraph(migrateWorkflowGraph(graph));
    },

    async runWorkflow(workflowId: string): Promise<WorkflowRunSnapshot> {
      return startWorkflowRun(workflowId, "manual");
    },

    async runWorkflowFromNode(workflowId: string, startNodeId: string): Promise<WorkflowRunSnapshot> {
      const workflow = requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      const conflict = activeRunConflict(workflowId, settings);
      if (conflict) {
        throw commandError(conflict.message, conflict.field);
      }
      const profileKey = browserProfileKey(settings);
      if (settings.browser_launch.session_mode !== "persistent_profile" || !profileKey) {
        throw commandError(
          "Run from selected requires Reuse login session to be enabled",
          "browser_launch.session_mode",
        );
      }
      if (settings.run_policy.browser_retention !== "retain") {
        throw commandError(
          "Run from selected requires browser retention to be set to retain",
          "run_policy.browser_retention",
        );
      }
      if (!settings.run_policy.run_from_selected_enabled) {
        throw commandError(
          "Run from selected must be enabled in Workflow Settings",
          "run_policy.run_from_selected_enabled",
        );
      }
      if (!runner.hasReusableRetainedSession?.(workflowId, profileKey)) {
        const retained_session = runner.getRetainedSessionState?.(workflowId, profileKey) ?? {
            available: false,
            workflow_id: null,
            profile_name: null,
            reason: "No retained browser session",
          };
        runManager.updateLatestRetainedSession(retained_session);
        throw commandError(
          "No reusable browser session is available. Run the workflow again to create one.",
          "run",
        );
      }

      const graph = getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId, {
        mode: settings.run_policy.run_from_selected_mode,
      });
      if (compiledGraph.steps.length === 0) {
        throw commandError("Selected graph node has no executable steps", "startNodeId");
      }

      return runManager.startWorkflowRun({
        workflow,
        source: "manual",
        settings,
        graphSnapshot: graph,
        compiledGraph,
        targetStepId: startNodeId,
        reuseRetainedSession: true,
        retainedSessionWorkflowId: workflowId,
      });
    },

    async stopRun(runId?: string | null): Promise<WorkflowRunSnapshot> {
      return runManager.stopRun({ runId, fallbackWorkflow: repository.listWorkflows()[0] ?? null });
    },

    getRunState() {
      return runManager.getRunState();
    },

    listRunStates(): WorkflowRunSnapshot[] {
      return runManager.listRunStates();
    },

    listSchedules(): WorkflowSchedule[] {
      return scheduleRepository.listSchedules();
    },

    getSchedule(scheduleId: string): WorkflowSchedule {
      const schedule = scheduleRepository.getSchedule(scheduleId);
      if (!schedule) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return schedule;
    },

    createSchedule(input: WorkflowScheduleInput): WorkflowSchedule {
      return scheduleRepository.createSchedule(scheduleInputWithNextRun(input));
    },

    updateSchedule(
      scheduleId: string,
      patch: WorkflowScheduleUpdate,
    ): WorkflowSchedule {
      const current = scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return scheduleRepository.updateSchedule(
        scheduleId,
        scheduleInputWithNextRun({
          workflow_id: patch.workflow_id ?? current.workflow_id,
          name: patch.name ?? current.name,
          enabled: patch.enabled ?? current.enabled,
          kind: patch.kind ?? current.kind,
        }),
      );
    },

    deleteSchedule(scheduleId: string) {
      if (!scheduleRepository.getSchedule(scheduleId)) {
        throw commandError("Schedule not found", "scheduleId");
      }
      scheduleRepository.deleteSchedule(scheduleId);
    },

    enableSchedule(scheduleId: string): WorkflowSchedule {
      const current = scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return scheduleRepository.updateSchedule(
        scheduleId,
        scheduleInputWithNextRun({
          workflow_id: current.workflow_id,
          name: current.name,
          enabled: true,
          kind: current.kind,
        }),
      );
    },

    disableSchedule(scheduleId: string): WorkflowSchedule {
      const current = scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return scheduleRepository.updateSchedule(scheduleId, {
        workflow_id: current.workflow_id,
        name: current.name,
        enabled: false,
        kind: current.kind,
        next_run_at: null,
      });
    },

    listScheduleEvents(filter: WorkflowScheduleEventFilter = {}): WorkflowScheduleEvent[] {
      return scheduleRepository.listEvents(filter);
    },

    validateSchedule(schedule: OrchestrationSchedule): ScheduleValidationIssue[] {
      return validateScheduleInput(schedule);
    },

    async runSchedulerTick(now = new Date()) {
      await processDueSchedules({
        now,
        repository: scheduleRepository,
        getRunConflict: schedulerConflictReason,
        validateWorkflow: validateWorkflowRun,
        startWorkflow: async (workflowId) => {
          const result = await startWorkflowRun(workflowId, "schedule");
          return { runId: result.run_id };
        },
      });
    },

    exportWorkflow(workflowId: string): WorkflowExport {
      const workflow = requireWorkflow(workflowId);
      return {
        version: 1,
        workflow: summaryToWorkflow(workflow),
        steps: [],
        settings: repository.getWorkflowSettings(workflowId),
      };
    },

    importWorkflow(exported: WorkflowExport): WorkflowDetail {
      const workflow = createWorkflow(exported.workflow.name);
      if (exported.settings) {
        saveSettings(workflow.id, {
          ...exported.settings,
          workflow_id: workflow.id,
          general: {
            ...exported.settings.general,
            name: workflow.name,
          },
        });
      }
      return { workflow, steps: [] };
    },

    exportWorkflowPackage(
      workflowId: string,
      options: WorkflowPackageExportOptions,
    ): WorkflowPackage {
      const workflow = requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      return packageService.exportWorkflowPackage({
        workflowName: workflow.name,
        flow: options.include_flow ? getWorkflowGraph(workflowId) : null,
        settings,
        options,
      });
    },

    previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
      return packageService.previewWorkflowPackage(packageValue);
    },

    importWorkflowPackage(
      packageValue: WorkflowPackage,
      options: WorkflowPackageImportOptions,
    ): WorkflowDetail {
      const preparedImport = packageService.prepareImport({ packageValue, options });

      context.database.exec("BEGIN IMMEDIATE");
      try {
        const workflow = createWorkflow(preparedImport.importedName);
        if (options.include_flow && preparedImport.flow) {
          repository.saveWorkflowGraph(workflow.id, preparedImport.flow);
        }

        if (preparedImport.candidateSettings) {
          saveSettings(workflow.id, {
            ...preparedImport.candidateSettings,
            workflow_id: workflow.id,
            general: {
              ...preparedImport.candidateSettings.general,
              name: workflow.name,
            },
          });
        }
        context.database.exec("COMMIT");
        return { workflow, steps: [] };
      } catch (error) {
        context.database.exec("ROLLBACK");
        throw error;
      }
    },

    async runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      requireWorkflow(workflowId);
      if (runManager.hasActiveBatchRun() || runManager.hasActiveWorkflowRuns()) {
        throw commandError("A workflow run is already active", "run");
      }
      const settings = getSettings(workflowId);
      const concurrencyLimit =
        request.concurrency_limit ?? settings.run_policy.batch_concurrency_limit ?? 1;
      if (concurrencyLimit > 1) {
        throw commandError(
          "Batch concurrency above 1 is not supported until row isolation is implemented",
          "concurrency_limit",
        );
      }
      const graph = getWorkflowGraph(workflowId);
      if (compileGraph(graph).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings);
      const batchSettings: WorkflowSettings = {
        ...settings,
        run_policy: {
          ...settings.run_policy,
          browser_retention: "close",
        },
        browser_launch: {
          ...settings.browser_launch,
          headless: request.headless ?? settings.run_policy.batch_headless,
        },
      };
      const results = [];
      let succeeded = 0;
      let failed = 0;
      const abortController = runManager.beginBatchRun(request.rows.length);
      try {
        for (const [rowIndex, row] of request.rows.entries()) {
          if (abortController.signal.aborted) break;
          runManager.setBatchRunState({
            ...(runManager.getBatchRunState() ?? idleRunState),
            status: "running",
            outputs: {
              ...(runManager.getBatchRunState()?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          });
          const rowGraph = prependBatchRowVariables(compiledGraph, rowIndex, row);
          const runId = runManager.beginRunRecord(workflowId, batchSettings, graph);
          runManager.setCurrentBatchRunId(runId);
          let result = await runner.run({
            runId,
            graph: rowGraph,
            settings: batchSettings,
            mode: "run_workflow",
            signal: abortController.signal,
            onProgress(progress) {
              if (abortController.signal.aborted && runManager.getBatchRunState()?.status === "stopped") {
                return;
              }
              runManager.setBatchRunState({
                ...(runManager.getBatchRunState() ?? idleRunState),
                ...progress,
                status: "running",
                mode: "run_workflow",
                outputs: {
                  ...(runManager.getBatchRunState()?.outputs ?? {}),
                  batch_total: request.rows.length,
                  batch_current_row_index: rowIndex,
                  batch_succeeded: succeeded,
                  batch_failed: failed,
                },
              });
            },
          });
          if (abortController.signal.aborted && runManager.getBatchRunState()?.status === "stopped") {
            result = {
              ...result,
              status: "stopped",
              error: null,
            };
          }
          runManager.finishRun(runId, rowGraph, result);
          runManager.setCurrentBatchRunId(null);
          if (result.status === "success") {
            succeeded += 1;
          } else if (result.status === "failed") {
            failed += 1;
          }
          results.push({
            row_index: rowIndex,
            status: result.status,
            error: result.error?.reason ?? null,
          });
          runManager.setBatchRunState({
            ...(runManager.getBatchRunState() ?? idleRunState),
            status: result.status === "stopped" ? "stopped" : "running",
            current_step_id: null,
            current_step_number: null,
            outputs: {
              ...(runManager.getBatchRunState()?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
            error: result.status === "failed" ? result.error : null,
          });
          if (result.status === "stopped") break;
          if (result.status !== "success" && settings.run_policy.batch_stop_on_first_failed_row) {
            break;
          }
        }
        if (runManager.getBatchRunState()?.status !== "stopped") {
          runManager.setBatchRunState({
            ...(runManager.getBatchRunState() ?? idleRunState),
            status: failed > 0 ? "failed" : "success",
            current_step_id: null,
            current_step_number: null,
            outputs: {
              ...(runManager.getBatchRunState()?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          });
        }
      } catch (error) {
        const batchState = runManager.getBatchRunState();
        runManager.setBatchRunState({
          ...idleRunState,
          status: "failed",
          mode: "run_workflow",
          outputs: {
            batch_total: request.rows.length,
            batch_succeeded: succeeded,
            batch_failed: failed,
          },
          error: {
            step_id: batchState?.current_step_id,
            step_number: batchState?.current_step_number ?? 0,
            step_name: null,
            action_type: "workflow",
            reason: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      } finally {
        runManager.clearBatchRun(abortController);
      }
      return {
        total: request.rows.length,
        succeeded,
        failed,
        results,
      };
    },

    async startRecordingSession(input: RecorderStartSessionInput): Promise<RecordingSession> {
      return runRecorderCommand(() => recorderSessionManager.startSession(input));
    },

    getRecordingSession(sessionId: string): RecordingSession {
      return requireRecordingResult(recorderSessionManager.getSession(sessionId));
    },

    async stopRecordingSession(sessionId: string): Promise<RecordingSession> {
      return requireRecordingResult(await recorderSessionManager.stopSession(sessionId));
    },

    listRecordingEvents(sessionId: string): RecordingEvent[] {
      return requireRecordingResult(recorderSessionManager.listEvents(sessionId));
    },

    async discardRecordingSession(sessionId: string): Promise<RecordingSession> {
      return requireRecordingResult(await recorderSessionManager.discardSession(sessionId));
    },

    generateRecordingDraft(
      sessionId: string,
      options: RecordingGenerateDraftOptions,
    ): RecordingWorkflowDraft {
      return createRecordingDraft(sessionId, options);
    },

    getRecordingDraft(draftId: string): RecordingWorkflowDraft {
      return requireRecordingResult(recordingDrafts.get(draftId) ?? null, "draftId");
    },

    dryRunValidateConfig(config: ActionConfig) {
      const validation = validateActionConfig(config);
      if (validation) throw commandError(validation.message, validation.field);
    },

    async saveWorkflowPackageFile(packageValue: WorkflowPackage) {
      if (!context.saveWorkflowPackageFile) {
        throw commandError("Workflow package file saving is not available");
      }
      return context.saveWorkflowPackageFile(packageValue);
    },
  };
}

export function serializeCommandError(error: unknown): CommandError {
  if (error instanceof Error) return { message: error.message };
  if (isCommandError(error)) return error;
  return { message: "Unexpected command error" };
}

function isOptionalModuleAvailable(name: string) {
  try {
    nodeRequire.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function directoryReadable(value: string) {
  try {
    const stat = nodeFs.statSync(value);
    if (!stat.isDirectory()) return false;
    nodeFs.accessSync(value, nodeFs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDefaultFingerprintFontsDir(
  override: CommandContext["defaultFingerprintFontsDir"],
) {
  if (typeof override === "function") return override();
  if (override !== undefined) return override;
  const candidate = path.join(process.cwd(), ".local", "cloakbrowser-fonts", "linux");
  return directoryReadable(candidate) ? candidate : null;
}

async function buildCloakBrowserDiagnostics({
  appPaths,
  workflows,
  settingsForWorkflow,
  lastRunAtForWorkflow,
  retainedProfileNames,
}: {
  appPaths: AppPaths;
  workflows: WorkflowSummary[];
  settingsForWorkflow: (workflowId: string) => WorkflowSettings;
  lastRunAtForWorkflow: (workflowId: string) => string | null;
  retainedProfileNames: Set<string>;
}): Promise<CloakBrowserDiagnostics> {
  const binary = await cloakBinaryInfo();
  const identityByProfileDir = new Map<
    string,
    Pick<
      BrowserProfileDiagnostics,
      "identity_id" | "display_name" | "workflow_id" | "workflow_name" | "last_run_at"
    >
  >();
  const fontDirectoryWorkflows = new Map<
    string,
    Array<{ workflow_id: string; workflow_name: string; identity_id: string }>
  >();
  for (const workflow of workflows) {
    const settings = settingsForWorkflow(workflow.id);
    const profileDir = settings.browser_launch.profile_dir?.trim();
    if (!profileDir) continue;
    identityByProfileDir.set(profileDir, {
      identity_id: settings.browser_launch.identity_id,
      display_name: settings.browser_launch.display_name,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      last_run_at: lastRunAtForWorkflow(workflow.id),
    });
    const fontsDir = settings.browser_launch.fingerprint_fonts_dir?.trim();
    if (fontsDir) {
      const existing = fontDirectoryWorkflows.get(fontsDir) ?? [];
      existing.push({
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        identity_id: settings.browser_launch.identity_id,
      });
      fontDirectoryWorkflows.set(fontsDir, existing);
    }
  }

  return {
    wrapper_version: await cloakWrapperVersion(),
    binary,
    auto_update_enabled: process.env.CLOAKBROWSER_AUTO_UPDATE !== "false",
    checksum_skip_enabled: process.env.CLOAKBROWSER_SKIP_CHECKSUM === "true",
    geoip_available: isOptionalModuleAvailable("mmdb-lib"),
    profile_root: appPaths.browserProfilesDir,
    font_checklist: fingerprintFontChecklist(fontDirectoryWorkflows),
    last_smoke_result: {
      status: "not_recorded",
      reason: "Smoke tests are recorded by the npm run test:smoke command output",
    },
    headed_display: headedDisplayAvailability(),
    profiles: await browserProfileDiagnostics(
      appPaths.browserProfilesDir,
      identityByProfileDir,
      retainedProfileNames,
    ),
  };
}

const expectedFontFamilies = [
  { id: "arial", label: "arial" },
  { id: "courier", label: "courier" },
  { id: "notosans", label: "noto" },
];

function fingerprintFontChecklist(
  fontDirectoryWorkflows: Map<
    string,
    Array<{ workflow_id: string; workflow_name: string; identity_id: string }>
  >,
): CloakBrowserDiagnostics["font_checklist"] {
  if (fontDirectoryWorkflows.size === 0) {
    return {
      status: "not_configured",
      reason: "No workflow has a fingerprint fonts directory configured",
      directories: [],
    };
  }
  const directories = [...fontDirectoryWorkflows.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fontPath, workflows]) => inspectFingerprintFontDirectory(fontPath, workflows));
  const status = directories.some((directory) => directory.status === "missing")
    ? "error"
    : directories.some((directory) => directory.status === "warning")
      ? "warning"
      : "ok";
  const reason = status === "ok"
    ? null
    : directories
        .filter((directory) => directory.reason)
        .map((directory) => `${directory.path}: ${directory.reason}`)
        .join("; ");
  return { status, reason, directories };
}

function inspectFingerprintFontDirectory(
  fontPath: string,
  workflows: Array<{ workflow_id: string; workflow_name: string; identity_id: string }>,
): CloakBrowserDiagnostics["font_checklist"]["directories"][number] {
  const base = {
    path: fontPath,
    file_count: 0,
    total_size_bytes: 0,
    normalized_hash: null,
    expected_families_present: [] as string[],
    missing_expected_families: expectedFontFamilies.map((family) => family.label),
    workflow_ids: workflows.map((workflow) => workflow.workflow_id).sort(),
    workflow_names: workflows.map((workflow) => workflow.workflow_name).sort(),
  };
  if (!directoryReadable(fontPath)) {
    return {
      ...base,
      status: "missing",
      reason: "Font directory is missing or not readable",
    };
  }

  const files = listFingerprintFontFiles(fontPath);
  const normalizedHash = createHash("sha256");
  let totalSize = 0;
  const normalizedNames = files.map((file) => normalizeFontFileName(file.relativePath));
  for (const file of files) {
    totalSize += file.size;
    normalizedHash.update(file.relativePath.toLowerCase());
    normalizedHash.update("\0");
    normalizedHash.update(file.contentHash);
    normalizedHash.update("\0");
  }
  const present = expectedFontFamilies
    .filter((family) => normalizedNames.some((name) => name.includes(family.id)))
    .map((family) => family.label);
  const missing = expectedFontFamilies
    .filter((family) => !present.includes(family.label))
    .map((family) => family.label);
  const reasons = [
    workflows.length > 1 ? "Font directory is shared by multiple workflow identities" : null,
    files.length === 0 ? "No font files were found" : null,
    missing.length > 0 ? `Missing expected font families: ${missing.join(", ")}` : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    ...base,
    status: reasons.length > 0 ? "warning" : "ok",
    reason: reasons.join("; ") || null,
    file_count: files.length,
    total_size_bytes: totalSize,
    normalized_hash: normalizedHash.digest("hex"),
    expected_families_present: present,
    missing_expected_families: missing,
  };
}

function listFingerprintFontFiles(rootDir: string) {
  const files: Array<{ relativePath: string; size: number; contentHash: string }> = [];
  const visit = (currentDir: string) => {
    for (const entry of nodeFs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !isFontFile(entry.name)) continue;
      const stat = nodeFs.statSync(absolutePath);
      const content = nodeFs.readFileSync(absolutePath);
      files.push({
        relativePath: path.relative(rootDir, absolutePath).split(path.sep).join("/"),
        size: stat.size,
        contentHash: createHash("sha256").update(content).digest("hex"),
      });
    }
  };
  visit(rootDir);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isFontFile(name: string) {
  return /\.(ttf|otf|woff|woff2)$/i.test(name);
}

function normalizeFontFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function cloakBinaryInfo(): Promise<CloakBrowserDiagnostics["binary"]> {
  try {
    const cloakbrowser = await loadCloakBrowserDiagnosticsModule();
    const info = cloakbrowser.binaryInfo();
    return {
      version: info.version ?? null,
      platform: info.platform ?? null,
      installed: Boolean(info.installed),
      binary_path: info.binaryPath ?? null,
      cache_dir: info.cacheDir ?? null,
      download_url: info.downloadUrl ?? null,
    };
  } catch {
    return {
      version: null,
      platform: process.platform,
      installed: false,
      binary_path: process.env.CLOAKBROWSER_BINARY_PATH ?? null,
      cache_dir: process.env.CLOAKBROWSER_CACHE_DIR ?? null,
      download_url: process.env.CLOAKBROWSER_DOWNLOAD_URL ?? null,
    };
  }
}

async function loadCloakBrowserDiagnosticsModule(): Promise<CloakBrowserDiagnosticsModule> {
  return (await import("cloakbrowser")) as unknown as CloakBrowserDiagnosticsModule;
}

async function cloakWrapperVersion() {
  try {
    const packageJson = await fs.readFile(
      path.join(process.cwd(), "node_modules", "cloakbrowser", "package.json"),
      "utf8",
    );
    const parsed = JSON.parse(packageJson) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

function headedDisplayAvailability(): CloakBrowserDiagnostics["headed_display"] {
  if (process.platform !== "linux") {
    return { available: true, reason: null };
  }
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    return { available: true, reason: null };
  }
  return {
    available: false,
    reason: "No DISPLAY or WAYLAND_DISPLAY is configured for headed Linux runs",
  };
}

async function browserProfileDiagnostics(
  profileRoot: string,
  identityByProfileDir: Map<
    string,
    Pick<
      BrowserProfileDiagnostics,
      "identity_id" | "display_name" | "workflow_id" | "workflow_name" | "last_run_at"
    >
  >,
  retainedProfileNames: Set<string>,
): Promise<BrowserProfileDiagnostics[]> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(profileRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const profiles: BrowserProfileDiagnostics[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profileDir = entry.name;
    const fullPath = path.join(profileRoot, profileDir);
    const stat = await fs.stat(fullPath).catch(() => null);
    const identity = identityByProfileDir.get(profileDir);
    profiles.push({
      profile_dir: profileDir,
      identity_id: identity?.identity_id ?? null,
      display_name: identity?.display_name ?? null,
      workflow_id: identity?.workflow_id ?? null,
      workflow_name: identity?.workflow_name ?? null,
      approximate_size_bytes: await directorySize(fullPath),
      last_modified_at: stat?.mtime ? stat.mtime.toISOString() : null,
      last_run_at: identity?.last_run_at ?? null,
      active_session: retainedProfileNames.has(profileDir),
    });
  }
  return profiles.sort((left, right) => left.profile_dir.localeCompare(right.profile_dir));
}

type DirectorySizeLimits = {
  maxEntries: number;
  maxDepth: number;
  maxMillis: number;
};

function profileDiagnosticsSizeLimits(): DirectorySizeLimits {
  return {
    maxEntries: positiveEnvInteger("WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES", 5000),
    maxDepth: positiveEnvInteger("WAM_PROFILE_DIAGNOSTICS_MAX_DEPTH", 8),
    maxMillis: positiveEnvInteger("WAM_PROFILE_DIAGNOSTICS_MAX_MS", 100),
  };
}

function positiveEnvInteger(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function directorySize(directory: string): Promise<number> {
  const limits = profileDiagnosticsSizeLimits();
  const startedAt = Date.now();
  let total = 0;
  let visitedEntries = 0;

  const timedOut = () => Date.now() - startedAt >= limits.maxMillis;
  const visit = async (currentDirectory: string, depth: number): Promise<void> => {
    if (depth > limits.maxDepth || visitedEntries >= limits.maxEntries || timedOut()) return;
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (visitedEntries >= limits.maxEntries || timedOut()) break;
      visitedEntries += 1;
      const childPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(childPath, depth + 1);
      } else if (entry.isFile()) {
        total += (await fs.stat(childPath).catch(() => ({ size: 0 }))).size;
      }
    }
  };

  await visit(directory, 0);
  return total;
}

function isUnsupportedGraphDiscriminantMessage(message: string) {
  return (
    message.startsWith("Unsupported graph node type: ") ||
    message.startsWith("Unsupported condition kind: ") ||
    message.includes("Unsupported action type: ")
  );
}

function commandError(message: string, field?: string): CommandError {
  return { message, field };
}

function isCommandError(error: unknown): error is CommandError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string",
  );
}

function summaryToWorkflow(summary: WorkflowSummary): Workflow {
  return {
    id: summary.id,
    name: summary.name,
    created_at: summary.created_at,
    updated_at: summary.updated_at,
  };
}

function createDraftGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
      {
        id: "new-node",
        node_type: "action",
        label: "New node",
        position: { x: 240, y: 0 },
        config: null,
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "start-to-new-node",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "new-node",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function prependBatchRowVariables(
  graph: CompiledWorkflowGraph,
  rowIndex: number,
  row: Record<string, string>,
): CompiledWorkflowGraph {
  return {
    steps: [
      {
        node_id: `batch-row-${rowIndex}`,
        label: `Batch row ${rowIndex + 1}`,
        config: {
          type: "set_variable",
          config: {
            variables: Object.entries(row).map(([name, value]) => ({
              name,
              value_type: "text",
              value,
            })),
          },
        },
      },
      ...graph.steps,
    ],
  };
}
