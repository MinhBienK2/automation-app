import fs from "node:fs/promises";
import nodeFs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import type {
  ActionConfig,
  BatchRunRequest,
  BrowserProfileCleanupResult,
  BrowserProfileDiagnostics,
  CloakBrowserDiagnostics,
  CompiledWorkflowGraph,
  ElementSnapshot,
  GraphEdgeDelay,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordedEvent,
  RunState,
  RunValidationIssue,
  ScheduleValidationIssue,
  SelectorCandidate,
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
  WorkflowPackageSettings,
  WorkflowRunSnapshot,
  WorkflowRunSource,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleUpdate,
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../../src/types/workflow.js";
import type { AppPaths } from "./database.js";
import {
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  compileWorkflowGraph as compileGraph,
  validateActionConfig,
  validateWorkflowGraph as validateGraph,
} from "./graphCompiler.js";
import { BrowserWorkflowRunner } from "./runner.js";
import {
  calculateNextRunAt,
  processDueSchedules,
  validateScheduleInput,
} from "./scheduler.js";
import { sanitizePathSegment } from "./evidenceArtifacts.js";
import { elementTargetFromXpath, migrateWorkflowGraph } from "./workflowGraphMigration.js";
import { WorkflowRepository } from "./workflowRepository.js";
import { WorkflowScheduleRepository } from "./workflowScheduleRepository.js";

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

type RunnerCommandPort = {
  run: BrowserWorkflowRunner["run"];
  closeRetainedContext?: BrowserWorkflowRunner["closeRetainedContext"];
  createIsolatedRunRunner?: () => RunnerCommandPort;
  hasReusableRetainedSession?: BrowserWorkflowRunner["hasReusableRetainedSession"];
  getRetainedSessionState?: BrowserWorkflowRunner["getRetainedSessionState"];
  getRetainedSessionStates?: BrowserWorkflowRunner["getRetainedSessionStates"];
};

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
  runner?: RunnerCommandPort;
  saveWorkflowPackageFile?: (packageValue: WorkflowPackage) => Promise<string | null>;
};

const workflowSettingsSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "graph_defaults",
  "environment",
];

const idleRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  outputs: {},
  retained_session: {
    available: false,
    workflow_id: null,
    profile_name: null,
    reason: "No retained browser session",
  },
  error: null,
};

export function createWorkflowCommandHandlers(context: CommandContext) {
  const repository = new WorkflowRepository(context.database);
  const scheduleRepository = new WorkflowScheduleRepository(context.database);
  const runner = context.runner ?? new BrowserWorkflowRunner({ appPaths: context.appPaths });
  const runEntries = new Map<string, {
    snapshot: WorkflowRunSnapshot;
    abortController: AbortController;
    timeoutHandle: ReturnType<typeof setTimeout> | null;
    compiledGraph: CompiledWorkflowGraph;
    timedOut: boolean;
    profileName: string | null;
  }>();
  const sessionRunSnapshots = new Map<string, WorkflowRunSnapshot>();
  const activeWorkflowRuns = new Map<string, string>();
  const activeProfileRuns = new Map<string, string>();
  let latestRunSnapshot: WorkflowRunSnapshot | null = null;
  let currentBatchRunState: RunState | null = null;
  let currentBatchAbortController: AbortController | null = null;
  let currentBatchRunId: string | null = null;

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
    if (persisted) return normalizeWorkflowSettings(persisted, workflow);
    return defaultWorkflowSettings(workflow);
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

  function retainedProfileNames() {
    const names = new Set<string>();
    for (const state of runner.getRetainedSessionStates?.() ?? []) {
      if (state.available && state.profile_name) names.add(state.profile_name);
    }
    const singleton = runner.getRetainedSessionState?.();
    if (singleton?.available && singleton.profile_name) names.add(singleton.profile_name);
    return names;
  }

  function retainedSessionActiveFor(workflowId: string, profileName: string) {
    if (runner.hasReusableRetainedSession) {
      return runner.hasReusableRetainedSession(workflowId, profileName);
    }
    const states = runner.getRetainedSessionStates?.() ?? [runner.getRetainedSessionState?.()];
    return states.some(
      (state) =>
        state?.available &&
        state.workflow_id === workflowId &&
        state.profile_name === profileName,
    );
  }

  function createRunRunner(): RunnerCommandPort {
    return runner.createIsolatedRunRunner?.() ?? runner;
  }

  function withRunState(snapshot: WorkflowRunSnapshot, state: RunState): WorkflowRunSnapshot {
    return {
      ...state,
      run_id: snapshot.run_id,
      workflow_id: snapshot.workflow_id,
      workflow_name: snapshot.workflow_name,
      source: snapshot.source,
      started_at: snapshot.started_at,
      state,
    };
  }

  function createRunSnapshot(args: {
    runId: string;
    workflow: WorkflowSummary;
    source: WorkflowRunSource;
    startedAt?: string;
    state: RunState;
  }): WorkflowRunSnapshot {
    return withRunState({
      ...args.state,
      run_id: args.runId,
      workflow_id: args.workflow.id,
      workflow_name: args.workflow.name,
      source: args.source,
      started_at: args.startedAt ?? new Date().toISOString(),
      state: args.state,
    }, args.state);
  }

  function rememberSnapshot(snapshot: WorkflowRunSnapshot) {
    sessionRunSnapshots.set(snapshot.run_id, snapshot);
    latestRunSnapshot = snapshot;
  }

  function updateSnapshot(runId: string, state: RunState) {
    const entry = runEntries.get(runId);
    const current = entry?.snapshot ?? sessionRunSnapshots.get(runId);
    if (!current) return null;
    const snapshot = withRunState(current, state);
    if (entry) entry.snapshot = snapshot;
    rememberSnapshot(snapshot);
    return sessionRunSnapshots.get(runId) ?? snapshot;
  }

  function listRunSnapshots() {
    return [...sessionRunSnapshots.values()].sort((left, right) =>
      left.started_at.localeCompare(right.started_at),
    );
  }

  function activeRunConflict(workflowId: string, settings: WorkflowSettings) {
    if (currentBatchAbortController) {
      return {
        reason: "active_batch",
        message: "A batch run is already active",
        field: "run",
      };
    }
    if (activeWorkflowRuns.has(workflowId)) {
      return {
        reason: "active_workflow",
        message: "This workflow is already running",
        field: "workflowId",
      };
    }
    const profileName = browserProfileKey(settings);
    if (profileName && activeProfileRuns.has(profileName)) {
      return {
        reason: "active_profile",
        message: "Browser profile is already in use by another active run",
        field: "browser_launch.profile_name",
      };
    }
    return null;
  }

  function schedulerConflictReason(workflowId: string) {
    const settings = getSettings(workflowId);
    return activeRunConflict(workflowId, settings)?.reason ?? null;
  }

  function releaseRunLocks(workflowId: string, profileName: string | null, runId: string) {
    if (activeWorkflowRuns.get(workflowId) === runId) {
      activeWorkflowRuns.delete(workflowId);
    }
    if (profileName && activeProfileRuns.get(profileName) === runId) {
      activeProfileRuns.delete(profileName);
    }
  }

  function assertCanChangeBrowserIdentityProfile(
    workflowId: string,
    nextSettings: WorkflowSettings,
  ) {
    const currentSettings = getSettings(workflowId);
    const currentProfileKey = browserProfileKey(currentSettings);
    if (!currentProfileKey) return;
    if (!retainedSessionActiveFor(workflowId, currentProfileKey)) return;
    const nextProfileKey = browserProfileKey(nextSettings);
    const changingIdentityProfile =
      nextProfileKey !== currentProfileKey ||
      nextSettings.browser_launch.identity_id !== currentSettings.browser_launch.identity_id ||
      nextSettings.browser_launch.fingerprint_seed !== currentSettings.browser_launch.fingerprint_seed;
    if (!changingIdentityProfile) return;
    throw commandError(
      "Close the retained browser session before changing or deleting its identity profile",
      "browser_launch.profile_dir",
    );
  }

  function assertProfileNotActiveForWorkflow(workflowId: string) {
    const currentProfileKey = browserProfileKey(getSettings(workflowId));
    if (!currentProfileKey) return;
    if (!retainedSessionActiveFor(workflowId, currentProfileKey)) return;
    throw commandError(
      "Close the retained browser session before changing or deleting its identity profile",
      "browser_launch.profile_dir",
    );
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
    const activeSettings = normalizeWorkflowSettings(settings, workflow);
    assertCanChangeBrowserIdentityProfile(workflowId, activeSettings);
    const issues = validateSettings(activeSettings);
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
      browser_launch: normalizeSettingsBrowserLaunch(activeSettings.browser_launch),
      migration_notes: activeSettings.migration_notes,
      updated_at: timestamp,
      created_at: activeSettings.created_at ?? workflow.created_at,
    };
    repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  function createWorkflow(name: string): Workflow {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const workflow = repository.createWorkflow(normalized, createDraftGraph());
    repository.saveWorkflowSettings(
      workflow.id,
      defaultWorkflowSettings(workflow, { randomizeIdentity: true }),
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
      ...validateSettings(getSettings(workflowId)).map((issue) => ({
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
    const abortController = new AbortController();
    const runId = beginRun(context.database, workflowId, settings, graph);
    const profileName = browserProfileKey(settings);
    const runningState: RunState = {
      ...idleRunState,
      status: "running",
      mode: "run_workflow",
      retained_session: runner.getRetainedSessionState?.(workflowId, profileName) ?? idleRunState.retained_session,
    };
    const snapshot = createRunSnapshot({
      runId,
      workflow,
      source,
      state: runningState,
    });
    const entry = {
      snapshot,
      abortController,
      timeoutHandle: null as ReturnType<typeof setTimeout> | null,
      compiledGraph,
      timedOut: false,
      profileName,
    };
    runEntries.set(runId, entry);
    activeWorkflowRuns.set(workflowId, runId);
    if (profileName) activeProfileRuns.set(profileName, runId);
    rememberSnapshot(snapshot);
    const runRunner = createRunRunner();
    const timeoutMs = settings.run_policy.max_workflow_duration_ms;
    entry.timeoutHandle = timeoutMs
      ? setTimeout(() => {
          entry.timedOut = true;
          abortController.abort();
        }, timeoutMs)
      : null;
    void (async () => {
      try {
        let terminalState = await runRunner.run({
          runId,
          graph: compiledGraph,
          settings,
          mode: "run_workflow",
          retainedSessionWorkflowId: workflowId,
          signal: abortController.signal,
          onProgress(progress) {
            const activeEntry = runEntries.get(runId);
            if (!activeEntry) return;
            if (abortController.signal.aborted && activeEntry.snapshot.state.status === "stopped") {
              return;
            }
            updateSnapshot(runId, {
              ...activeEntry.snapshot.state,
              ...progress,
              status: "running",
              mode: "run_workflow",
            });
          },
        });
        const activeEntry = runEntries.get(runId);
        if (activeEntry?.timedOut && terminalState.status === "stopped") {
          terminalState = {
            ...terminalState,
            status: "failed",
            error: {
              step_id: terminalState.error?.step_id ?? null,
              step_number: terminalState.error?.step_number ?? 0,
              step_name: terminalState.error?.step_name ?? null,
              action_type: terminalState.error?.action_type ?? "workflow",
              reason: `Workflow exceeded maximum duration of ${timeoutMs} ms`,
            },
          };
        } else if (
          abortController.signal.aborted &&
          activeEntry?.snapshot.state.status === "stopped"
        ) {
          terminalState = {
            ...terminalState,
            status: "stopped",
            error: null,
          };
        }
        updateSnapshot(runId, terminalState);
        finishRun(context.database, runId, compiledGraph, terminalState);
      } catch (error) {
        const currentState = runEntries.get(runId)?.snapshot.state ?? runningState;
        const failedState: RunState = {
          ...idleRunState,
          status: "failed",
          mode: "run_workflow",
          error: {
            step_id: currentState.current_step_id,
            step_number: currentState.current_step_number ?? 0,
            step_name: null,
            action_type: "workflow",
            reason: error instanceof Error ? error.message : String(error),
          },
        };
        updateSnapshot(runId, failedState);
        finishRun(context.database, runId, compiledGraph, failedState);
      } finally {
        const activeEntry = runEntries.get(runId);
        if (activeEntry?.timeoutHandle) clearTimeout(activeEntry.timeoutHandle);
        releaseRunLocks(workflowId, profileName, runId);
        runEntries.delete(runId);
      }
    })();
    return sessionRunSnapshots.get(runId) ?? snapshot;
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
      return settingsBrowserToConfig(workflowId, getSettings(workflowId).browser_launch);
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
          ...configToSettingsBrowserLaunch(config, {
            id: workflowId,
            name: settings.general.name,
          }),
          ...browserIdentityPreferences(settings.browser_launch),
        },
      });
    },

    getWorkflowSettings(workflowId: string): WorkflowSettings {
      return getSettings(workflowId);
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
      return validateSettings(settings);
    },

    async getCloakBrowserDiagnostics(): Promise<CloakBrowserDiagnostics> {
      return buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        database: context.database,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: retainedProfileNames(),
      });
    },

    async installCloakBrowserBinary(): Promise<CloakBrowserDiagnostics> {
      const cloakbrowser = await loadCloakBrowserDiagnosticsModule();
      await cloakbrowser.ensureBinary();
      return buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        database: context.database,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: retainedProfileNames(),
      });
    },

    async cleanupOrphanedBrowserProfiles(): Promise<BrowserProfileCleanupResult> {
      const diagnostics = await buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        database: context.database,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: retainedProfileNames(),
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
      assertProfileNotActiveForWorkflow(id);
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
          saveSettings(created.id, duplicateWorkflowSettings(settings, created));
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
      repository.saveWorkflowGraph(workflowId, migrateWorkflowGraph(graph));
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
      if (!settings.browser_launch.run_from_selected_enabled) {
        throw commandError(
          "Run from selected must be enabled in Workflow Settings",
          "browser_launch.run_from_selected_enabled",
        );
      }
      if (!runner.hasReusableRetainedSession?.(workflowId, profileKey)) {
        const retained_session = runner.getRetainedSessionState?.(workflowId, profileKey) ?? {
            available: false,
            workflow_id: null,
            profile_name: null,
            reason: "No retained browser session",
          };
        if (latestRunSnapshot) {
          updateSnapshot(latestRunSnapshot.run_id, {
            ...latestRunSnapshot.state,
            retained_session,
          });
        }
        throw commandError(
          "No reusable browser session is available. Run the workflow again to create one.",
          "run",
        );
      }

      const graph = getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId);
      if (compiledGraph.steps.length === 0) {
        throw commandError("Selected graph node has no executable steps", "startNodeId");
      }

      const abortController = new AbortController();
      const runId = beginRun(context.database, workflowId, settings, graph);
      const runningState: RunState = {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
        target_step_id: startNodeId,
        retained_session: runner.getRetainedSessionState?.(workflowId, profileKey) ?? idleRunState.retained_session,
      };
      const snapshot = createRunSnapshot({
        runId,
        workflow,
        source: "manual",
        state: runningState,
      });
      const entry = {
        snapshot,
        abortController,
        timeoutHandle: null as ReturnType<typeof setTimeout> | null,
        compiledGraph,
        timedOut: false,
        profileName: profileKey,
      };
      runEntries.set(runId, entry);
      activeWorkflowRuns.set(workflowId, runId);
      activeProfileRuns.set(profileKey, runId);
      rememberSnapshot(snapshot);
      const runRunner = createRunRunner();
      const timeoutMs = settings.run_policy.max_workflow_duration_ms;
      entry.timeoutHandle = timeoutMs
        ? setTimeout(() => {
            entry.timedOut = true;
            abortController.abort();
          }, timeoutMs)
        : null;
      void (async () => {
        try {
          let terminalState = await runRunner.run({
            runId,
            graph: compiledGraph,
            settings,
            mode: "run_workflow",
            targetStepId: startNodeId,
            reuseRetainedSession: true,
            retainedSessionWorkflowId: workflowId,
            signal: abortController.signal,
            onProgress(progress) {
              const activeEntry = runEntries.get(runId);
              if (!activeEntry) return;
              if (abortController.signal.aborted && activeEntry.snapshot.state.status === "stopped") {
                return;
              }
              updateSnapshot(runId, {
                ...activeEntry.snapshot.state,
                ...progress,
                status: "running",
                mode: "run_workflow",
                target_step_id: startNodeId,
              });
            },
          });
          const activeEntry = runEntries.get(runId);
          if (activeEntry?.timedOut && terminalState.status === "stopped") {
            terminalState = {
              ...terminalState,
              status: "failed",
              error: {
                step_id: terminalState.error?.step_id ?? null,
                step_number: terminalState.error?.step_number ?? 0,
                step_name: terminalState.error?.step_name ?? null,
                action_type: terminalState.error?.action_type ?? "workflow",
                reason: `Workflow exceeded maximum duration of ${timeoutMs} ms`,
              },
            };
          } else if (
            abortController.signal.aborted &&
            activeEntry?.snapshot.state.status === "stopped"
          ) {
            terminalState = {
              ...terminalState,
              status: "stopped",
              error: null,
            };
          }
          updateSnapshot(runId, terminalState);
          finishRun(context.database, runId, compiledGraph, terminalState);
        } catch (error) {
          const currentState = runEntries.get(runId)?.snapshot.state ?? runningState;
          const failedState: RunState = {
            ...idleRunState,
            status: "failed",
            mode: "run_workflow",
            target_step_id: startNodeId,
            retained_session: runner.getRetainedSessionState?.(workflowId, profileKey) ?? null,
            error: {
              step_id: currentState.current_step_id,
              step_number: currentState.current_step_number ?? 0,
              step_name: null,
              action_type: "workflow",
              reason: error instanceof Error ? error.message : String(error),
            },
          };
          updateSnapshot(runId, failedState);
          finishRun(context.database, runId, compiledGraph, failedState);
        } finally {
          const activeEntry = runEntries.get(runId);
          if (activeEntry?.timeoutHandle) clearTimeout(activeEntry.timeoutHandle);
          releaseRunLocks(workflowId, profileKey, runId);
          runEntries.delete(runId);
        }
      })();
      return sessionRunSnapshots.get(runId) ?? snapshot;
    },

    async stopRun(runId?: string | null): Promise<WorkflowRunSnapshot> {
      if (!runId && runEntries.size > 1) {
        throw commandError("Specify a run id to stop when multiple runs are active", "runId");
      }
      const targetRunId = runId ?? [...runEntries.keys()][0] ?? null;
      if (targetRunId) {
        const entry = runEntries.get(targetRunId);
        if (!entry) {
          throw commandError("Run not found", "runId");
        }
        entry.abortController.abort();
        const stoppedState: RunState = {
          ...entry.snapshot.state,
          status: "stopped",
          mode: "run_workflow",
          error: null,
        };
        return updateSnapshot(targetRunId, stoppedState) ?? entry.snapshot;
      }

      if (currentBatchAbortController) {
        currentBatchAbortController.abort();
        currentBatchRunState = {
          ...(currentBatchRunState ?? idleRunState),
          status: "stopped",
          mode: "run_workflow",
          error: null,
        };
        const workflow = repository.listWorkflows()[0] ?? {
          id: "batch",
          name: "Batch run",
          step_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return createRunSnapshot({
          runId: currentBatchRunId ?? "batch",
          workflow,
          source: "manual",
          state: currentBatchRunState,
        });
      }

      await runner.closeRetainedContext?.();
      const workflow = repository.listWorkflows()[0] ?? {
        id: "workflow",
        name: "Workflow",
        step_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return createRunSnapshot({
        runId: latestRunSnapshot?.run_id ?? "stopped",
        workflow,
        source: "manual",
        state: {
          ...idleRunState,
          status: "stopped",
          mode: "run_workflow",
        },
      });
    },

    getRunState() {
      if (currentBatchAbortController && currentBatchRunState) {
        return currentBatchRunState;
      }
      const activeSnapshots = [...runEntries.values()].map((entry) => entry.snapshot);
      if (activeSnapshots.length === 1) {
        return activeSnapshots[0].state;
      }
      if (activeSnapshots.length > 1) {
        return {
          ...idleRunState,
          status: "running",
          mode: "run_workflow",
        };
      }
      if (latestRunSnapshot) {
        return {
          ...latestRunSnapshot.state,
          retained_session: runner.getRetainedSessionState?.(
            latestRunSnapshot.workflow_id,
            runEntries.get(latestRunSnapshot.run_id)?.profileName ?? null,
          ) ?? latestRunSnapshot.state.retained_session,
        };
      }
      if (currentBatchRunState) {
        return currentBatchRunState;
      }
      return {
        ...idleRunState,
        retained_session: runner.getRetainedSessionState?.() ?? idleRunState.retained_session,
      };
    },

    listRunStates(): WorkflowRunSnapshot[] {
      return listRunSnapshots();
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
      const { packageSettings, omittedFields } = buildPackageSettings(
        settings,
        options.settings_sections,
      );

      return {
        kind: "workflow_package",
        version: 2,
        workflow: { name: workflow.name },
        included_sections: [
          ...(options.include_flow ? ["flow"] : []),
          ...options.settings_sections.map((section) => `settings.${section}`),
        ],
        omitted_fields: omittedFields,
        flow: options.include_flow ? getWorkflowGraph(workflowId) : null,
        settings: packageSettings,
      };
    },

    previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
      validateWorkflowPackage(packageValue);
      return {
        workflow_name: packageValue.workflow.name,
        includes_flow: Boolean(packageValue.flow),
        settings_sections: packageSettingsSections(packageValue),
        omitted_fields: packageValue.omitted_fields,
      };
    },

    importWorkflowPackage(
      packageValue: WorkflowPackage,
      options: WorkflowPackageImportOptions,
    ): WorkflowDetail {
      validateWorkflowPackage(packageValue);
      const packageFlow = packageValue.flow ? migrateWorkflowGraph(packageValue.flow) : null;
      if (options.include_flow && packageFlow) {
        const flowError = validateGraph(packageFlow).find(
          (issue) => issue.level === "error" && !isImportableDraftFlowIssue(issue.message),
        );
        if (flowError) {
          throw commandError(flowError.message, "package.flow");
        }
      }

      const importedName = `${packageValue.workflow.name} (imported)`;
      const timestamp = new Date().toISOString();
      const candidateSettings = packageValue.settings && options.settings_sections.length > 0
        ? buildImportedSettingsCandidate(
            importedName,
            timestamp,
            packageValue.settings,
            options.settings_sections,
          )
        : null;
      if (candidateSettings) {
        const settingsError = validateSettings(candidateSettings).find((issue) => issue.level === "error");
        if (settingsError) {
          throw commandError(
            settingsError.message,
            settingsError.field
              ? `${settingsError.section}.${settingsError.field}`
              : settingsError.section,
          );
        }
      }

      context.database.exec("BEGIN IMMEDIATE");
      try {
        const workflow = createWorkflow(importedName);
        if (options.include_flow && packageFlow) {
          repository.saveWorkflowGraph(workflow.id, packageFlow);
        }

        if (candidateSettings) {
          saveSettings(workflow.id, {
            ...candidateSettings,
            workflow_id: workflow.id,
            general: {
              ...candidateSettings.general,
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
      if (currentBatchAbortController || runEntries.size > 0) {
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
      currentBatchAbortController = new AbortController();
      const abortController = currentBatchAbortController;
      currentBatchRunState = {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
        outputs: {
          batch_total: request.rows.length,
          batch_current_row_index: 0,
          batch_succeeded: 0,
          batch_failed: 0,
        },
      };
      try {
        for (const [rowIndex, row] of request.rows.entries()) {
          if (abortController.signal.aborted) break;
          currentBatchRunState = {
            ...(currentBatchRunState ?? idleRunState),
            status: "running",
            outputs: {
              ...(currentBatchRunState?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          };
          const rowGraph = prependBatchRowVariables(compiledGraph, rowIndex, row);
          const runId = beginRun(context.database, workflowId, batchSettings, graph);
          currentBatchRunId = runId;
          let result = await runner.run({
            runId,
            graph: rowGraph,
            settings: batchSettings,
            mode: "run_workflow",
            signal: abortController.signal,
            onProgress(progress) {
              if (abortController.signal.aborted && currentBatchRunState?.status === "stopped") {
                return;
              }
              currentBatchRunState = {
                ...(currentBatchRunState ?? idleRunState),
                ...progress,
                status: "running",
                mode: "run_workflow",
                outputs: {
                  ...(currentBatchRunState?.outputs ?? {}),
                  batch_total: request.rows.length,
                  batch_current_row_index: rowIndex,
                  batch_succeeded: succeeded,
                  batch_failed: failed,
                },
              };
            },
          });
          if (abortController.signal.aborted && currentBatchRunState?.status === "stopped") {
            result = {
              ...result,
              status: "stopped",
              error: null,
            };
          }
          finishRun(context.database, runId, rowGraph, result);
          currentBatchRunId = null;
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
          currentBatchRunState = {
            ...(currentBatchRunState ?? idleRunState),
            status: result.status === "stopped" ? "stopped" : "running",
            current_step_id: null,
            current_step_number: null,
            outputs: {
              ...(currentBatchRunState?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
            error: result.status === "failed" ? result.error : null,
          };
          if (result.status === "stopped") break;
          if (result.status !== "success" && settings.run_policy.batch_stop_on_first_failed_row) {
            break;
          }
        }
        if (currentBatchRunState?.status !== "stopped") {
          currentBatchRunState = {
            ...(currentBatchRunState ?? idleRunState),
            status: failed > 0 ? "failed" : "success",
            current_step_id: null,
            current_step_number: null,
            outputs: {
              ...(currentBatchRunState?.outputs ?? {}),
              batch_total: request.rows.length,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          };
        }
      } catch (error) {
        currentBatchRunState = {
          ...idleRunState,
          status: "failed",
          mode: "run_workflow",
          outputs: {
            batch_total: request.rows.length,
            batch_succeeded: succeeded,
            batch_failed: failed,
          },
          error: {
            step_id: currentBatchRunState?.current_step_id,
            step_number: currentBatchRunState?.current_step_number ?? 0,
            step_name: null,
            action_type: "workflow",
            reason: error instanceof Error ? error.message : String(error),
          },
        };
        throw error;
      } finally {
        if (currentBatchAbortController === abortController) {
          currentBatchAbortController = null;
        }
        currentBatchRunId = null;
      }
      return {
        total: request.rows.length,
        succeeded,
        failed,
        results,
      };
    },

    suggestSelectors(snapshot: ElementSnapshot): SelectorCandidate[] {
      const selector = snapshot.test_id
        ? cssAttributeSelector("data-testid", snapshot.test_id)
        : snapshot.id
          ? cssAttributeSelector("id", snapshot.id)
          : snapshot.tag;
      return [
        {
          selector_type: snapshot.test_id ? "test_id" : snapshot.id ? "id" : "tag",
          selector,
          score: 1,
          reason: "Generated from stable element attributes.",
        },
      ];
    },

    normalizeRecordedEvents(events: RecordedEvent[]): ActionConfig[] {
      return events.map((event) => {
        if (event.type === "click") {
          return {
            type: "click",
            config: {
              target: elementTargetFromXpath(event.xpath),
            },
          };
        }
        if (event.type === "input_text") {
          return {
            type: "input_text",
            config: {
              target: elementTargetFromXpath(event.xpath),
              text: event.text,
              clear_before_input: true,
            },
          };
        }
        throw commandError(
          `Unsupported recorded event type: ${(event as { type?: unknown }).type}`,
          "events.type",
        );
      }) as ActionConfig[];
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

function duplicateWorkflowSettings(
  sourceSettings: WorkflowSettings,
  created: Workflow,
): WorkflowSettings {
  const copied = structuredClone(sourceSettings);
  const freshDefaults = defaultWorkflowSettings(created, { randomizeIdentity: true });
  const sourceBrowser = copied.browser_launch;
  const freshBrowser = freshDefaults.browser_launch;
  const persistent = sourceBrowser.session_mode === "persistent_profile";

  return {
    ...copied,
    workflow_id: created.id,
    general: {
      ...copied.general,
      name: created.name,
      created_at: created.created_at,
      updated_at: created.updated_at,
    },
    browser_launch: {
      ...sourceBrowser,
      identity_id: freshBrowser.identity_id,
      display_name: freshBrowser.display_name,
      profile_dir: freshBrowser.profile_dir,
      profile_name: persistent ? freshBrowser.profile_dir : null,
      fingerprint_seed: freshBrowser.fingerprint_seed,
      run_from_selected_enabled: false,
    },
    created_at: created.created_at,
    updated_at: created.updated_at,
  };
}

export function serializeCommandError(error: unknown): CommandError {
  if (error instanceof Error) return { message: error.message };
  if (isCommandError(error)) return error;
  return { message: "Unexpected command error" };
}

function validateSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
  const issues: SettingsValidationIssue[] = [];
  if (!settings.general.name.trim()) {
    issues.push({
      section: "general",
      field: "name",
      level: "error",
      message: "Workflow name is required",
    });
  }
  if (settings.browser_launch.proxy_enabled && !settings.browser_launch.proxy_server?.trim()) {
    issues.push({
      section: "browser_launch",
      field: "proxy_server",
      level: "error",
      message: "Proxy server is required when proxy is enabled",
    });
  }
  if (settings.browser_launch.proxy_enabled && settings.browser_launch.proxy_server?.trim()) {
    const parsedProxy = parseProxyServer(settings.browser_launch.proxy_server);
    if (!parsedProxy.valid) {
      issues.push({
        section: "browser_launch",
        field: "proxy_server",
        level: "error",
        message: parsedProxy.message,
      });
    } else if (
      parsedProxy.hasCredentials &&
      (settings.browser_launch.proxy_username?.trim() || settings.browser_launch.proxy_password?.trim())
    ) {
      issues.push({
        section: "browser_launch",
        field: "proxy_username",
        level: "error",
        message: "Proxy credentials must be configured either in the proxy URL or the username/password fields, not both",
      });
    }
  }
  if (
    settings.browser_launch.session_mode === "persistent_profile" &&
    !settings.browser_launch.fingerprint_seed?.trim()
  ) {
    issues.push({
      section: "browser_launch",
      field: "fingerprint_seed",
      level: "error",
      message: "Persistent browser identities require a fingerprint seed",
    });
  }
  if (settings.browser_launch.geoip && !isOptionalModuleAvailable("mmdb-lib")) {
    issues.push({
      section: "browser_launch",
      field: "geoip",
      level: "error",
      message: "GeoIP requires mmdb-lib to be installed",
    });
  }
  if (settings.browser_launch.webrtc_policy === "disabled_if_supported") {
    issues.push({
      section: "browser_launch",
      field: "webrtc_policy",
      level: "error",
      message: "Disabled WebRTC policy is not supported by the installed CloakBrowser runtime",
    });
  }
  if (settings.browser_launch.webrtc_policy === "explicit_ip" && !settings.browser_launch.webrtc_ip?.trim()) {
    issues.push({
      section: "browser_launch",
      field: "webrtc_ip",
      level: "error",
      message: "Explicit WebRTC IP policy requires a WebRTC IP",
    });
  }
  if (
    settings.browser_launch.webrtc_policy === "explicit_ip" &&
    settings.browser_launch.webrtc_ip?.trim() &&
    !validIpAddress(settings.browser_launch.webrtc_ip)
  ) {
    issues.push({
      section: "browser_launch",
      field: "webrtc_ip",
      level: "error",
      message: "Explicit WebRTC IP must be a valid IPv4 or IPv6 address",
    });
  }
  if (
    settings.browser_launch.webrtc_policy === "auto_proxy_exit_ip" &&
    (!settings.browser_launch.proxy_enabled || !settings.browser_launch.proxy_server?.trim())
  ) {
    issues.push({
      section: "browser_launch",
      field: "webrtc_policy",
      level: "error",
      message: "Auto WebRTC proxy IP policy requires an enabled proxy",
    });
  }
  if (settings.browser_launch.preflight_enabled) {
    const probeUrl = settings.browser_launch.preflight_probe_url?.trim();
    if (!probeUrl) {
      issues.push({
        section: "browser_launch",
        field: "preflight_probe_url",
        level: "error",
        message: "Fingerprint preflight probe URL is required",
      });
    } else if (
      !settings.browser_launch.preflight_allowed_origins.includes(originForUrl(probeUrl) ?? "")
    ) {
      issues.push({
        section: "browser_launch",
        field: "preflight_probe_url",
        level: "error",
        message: "Fingerprint preflight probe origin must be allowlisted",
      });
    }
    if (settings.browser_launch.headless) {
      issues.push({
        section: "browser_launch",
        field: "headless",
        level: "error",
        message: "Fingerprint preflight requires headed browser mode",
      });
    }
  }
  for (const field of [
    "max_workflow_duration_ms",
    "batch_concurrency_limit",
  ] as const) {
    const value = settings.run_policy[field];
    if (value != null && value <= 0) {
      issues.push({
        section: "run_policy",
        field,
        level: "error",
        message: "Run policy numeric settings must be greater than zero when set",
      });
    }
  }
  const edgeDelayIssue = validateGraphEdgeDelay(settings.graph_defaults?.default_edge_delay);
  if (edgeDelayIssue) {
    issues.push({
      section: "graph_defaults",
      field: "default_edge_delay",
      level: "error",
      message: edgeDelayIssue,
    });
  }
  return issues;
}

function validateGraphEdgeDelay(delay: GraphEdgeDelay | null | undefined) {
  if (!delay) return null;
  if (delay.type === "fixed") {
    return Number.isFinite(delay.duration_ms) && delay.duration_ms > 0
      ? null
      : "New link wait duration must be greater than zero";
  }
  if (delay.type === "random") {
    return Number.isFinite(delay.min_ms) &&
      Number.isFinite(delay.max_ms) &&
      delay.min_ms > 0 &&
      delay.max_ms > 0 &&
      delay.max_ms >= delay.min_ms
      ? null
      : "New link wait range is invalid";
  }
  return "New link wait type is invalid";
}

function isOptionalModuleAvailable(name: string) {
  try {
    nodeRequire.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function cssAttributeSelector(attribute: string, value: string) {
  return `[${attribute}="${cssStringValue(value)}"]`;
}

function cssStringValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\A ");
}

function originForUrl(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseProxyServer(value: string):
  | { valid: true; hasCredentials: boolean }
  | { valid: false; message: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, message: "Proxy server must be a valid URL" };
  }
  if (!["http:", "https:", "socks5:"].includes(url.protocol)) {
    return { valid: false, message: "Proxy server must use http, https, or socks5" };
  }
  if (!url.hostname) {
    return { valid: false, message: "Proxy server must include a hostname" };
  }
  return {
    valid: true,
    hasCredentials: Boolean(url.username || url.password),
  };
}

function validIpAddress(value: string) {
  const candidate = value.trim();
  if (!candidate) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(candidate)) {
    return candidate
      .split(".")
      .every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return /^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":");
}

async function buildCloakBrowserDiagnostics({
  appPaths,
  database,
  workflows,
  settingsForWorkflow,
  lastRunAtForWorkflow,
  retainedProfileNames,
}: {
  appPaths: AppPaths;
  database: DatabaseSync;
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
  }

  return {
    wrapper_version: await cloakWrapperVersion(),
    binary,
    auto_update_enabled: process.env.CLOAKBROWSER_AUTO_UPDATE !== "false",
    checksum_skip_enabled: process.env.CLOAKBROWSER_SKIP_CHECKSUM === "true",
    geoip_available: isOptionalModuleAvailable("mmdb-lib"),
    profile_root: appPaths.browserProfilesDir,
    font_checklist: {
      status: "not_checked",
      reason: "Font coverage detection is not implemented",
    },
    last_smoke_result: {
      status: "not_recorded",
      reason: "Smoke tests are recorded by the npm run test:smoke command output",
    },
    last_preflight_verdict: lastFingerprintPreflightVerdict(database, workflows),
    headed_display: headedDisplayAvailability(),
    profiles: await browserProfileDiagnostics(
      appPaths.browserProfilesDir,
      identityByProfileDir,
      retainedProfileNames,
    ),
  };
}

function lastFingerprintPreflightVerdict(
  database: DatabaseSync,
  workflows: WorkflowSummary[],
): CloakBrowserDiagnostics["last_preflight_verdict"] {
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow.name]));
  const rows = database
    .prepare(
      `SELECT workflow_id, finished_at, started_at, outputs_json
       FROM runs
       WHERE outputs_json IS NOT NULL
       ORDER BY COALESCE(finished_at, started_at) DESC
       LIMIT 50`,
    )
    .all() as Array<{
      workflow_id: string;
      finished_at: string | null;
      started_at: string;
      outputs_json: string | null;
    }>;

  for (const row of rows) {
    try {
      const outputs = JSON.parse(row.outputs_json ?? "{}") as {
        fingerprint_preflight?: Record<string, unknown>;
      };
      const verdict = outputs.fingerprint_preflight;
      if (!verdict) continue;
      if (typeof verdict.passed !== "boolean" || typeof verdict.verdict !== "string") {
        continue;
      }
      return {
        workflow_id: row.workflow_id,
        workflow_name: workflowById.get(row.workflow_id) ?? null,
        run_id: typeof verdict.run_id === "string" ? verdict.run_id : null,
        verdict: verdict.verdict,
        passed: verdict.passed,
        risk_score:
          typeof verdict.risk_score === "number" && Number.isFinite(verdict.risk_score)
            ? verdict.risk_score
            : null,
        finished_at: row.finished_at ?? row.started_at,
      };
    } catch {
      continue;
    }
  }

  return null;
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

async function directorySize(directory: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const childPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(childPath);
    } else if (entry.isFile()) {
      total += (await fs.stat(childPath).catch(() => ({ size: 0 }))).size;
    }
  }
  return total;
}

function buildPackageSettings(
  settings: WorkflowSettings,
  sections: WorkflowSettingsSectionId[],
) {
  const packageSettings: WorkflowPackageSettings = {};
  const omittedFields: string[] = [];

  for (const section of sections) {
    if (section === "browser_launch") {
      packageSettings.browser_launch = sanitizeBrowserLaunchSettings(
        settings.browser_launch,
        omittedFields,
      );
    } else {
      packageSettings[section] = structuredClone(settings[section]) as never;
    }
  }

  return { packageSettings, omittedFields };
}

function sanitizeBrowserLaunchSettings(
  browser: WorkflowSettingsBrowserLaunch,
  omittedFields: string[],
): WorkflowSettingsBrowserLaunch {
  const sanitized = structuredClone(browser);
  if (sanitized.proxy_password) {
    omittedFields.push("settings.browser_launch.proxy_password");
  }
  sanitized.proxy_password = null;
  if (sanitized.proxy_server) {
    const sanitizedProxyServer = sanitizeProxyServerCredentials(sanitized.proxy_server);
    if (sanitizedProxyServer !== sanitized.proxy_server) {
      omittedFields.push("settings.browser_launch.proxy_server.credentials");
      sanitized.proxy_server = sanitizedProxyServer;
    }
  }
  if (sanitized.preflight_probe_url) {
    const sanitizedProbeUrl = sanitizeUrlSearch(sanitized.preflight_probe_url);
    if (sanitizedProbeUrl !== sanitized.preflight_probe_url) {
      omittedFields.push("settings.browser_launch.preflight_probe_url.search");
      sanitized.preflight_probe_url = sanitizedProbeUrl;
    }
  }
  return sanitized;
}

function sanitizeProxyServerCredentials(value: string) {
  try {
    const url = new URL(value);
    if (!url.username && !url.password) return value;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeUrlSearch(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function validateWorkflowPackage(packageValue: WorkflowPackage) {
  if (
    !packageValue ||
    typeof packageValue !== "object" ||
    packageValue.kind !== "workflow_package" ||
    packageValue.version !== 2
  ) {
    throw commandError("Unsupported workflow package", "package");
  }
  if (
    !packageValue.workflow ||
    typeof packageValue.workflow !== "object" ||
    typeof packageValue.workflow.name !== "string" ||
    !packageValue.workflow.name.trim()
  ) {
    throw commandError("Workflow package name is required", "package.workflow.name");
  }
  if (!Array.isArray(packageValue.included_sections)) {
    throw commandError("Workflow package sections are required", "package.included_sections");
  }
}

function packageSettingsSections(
  packageValue: WorkflowPackage,
): WorkflowSettingsSectionId[] {
  return packageValue.included_sections
    .filter((section) => section.startsWith("settings."))
    .map((section) => section.replace("settings.", ""))
    .filter(isWorkflowSettingsSection);
}

function buildImportedSettingsCandidate(
  workflowName: string,
  timestamp: string,
  packageSettings: WorkflowPackageSettings,
  sections: WorkflowSettingsSectionId[],
): WorkflowSettings {
  let nextSettings = defaultWorkflowSettings({
    id: "__import_preview__",
    name: workflowName,
    step_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
  });
  for (const section of sections) {
    const sectionValue = packageSettings[section];
    if (sectionValue) {
      nextSettings = {
        ...nextSettings,
        [section]: structuredClone(sectionValue),
      };
    }
  }
  return {
    ...nextSettings,
    workflow_id: "__import_preview__",
    general: {
      ...nextSettings.general,
      name: workflowName,
    },
  };
}

function isImportableDraftFlowIssue(message: string) {
  return message === "Choose an action type before running this node";
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

function normalizeWorkflowSettings(
  settings: WorkflowSettings,
  workflow: WorkflowSummary,
): WorkflowSettings {
  const base = defaultWorkflowSettings(workflow);
  return {
    workflow_id: settings.workflow_id || workflow.id,
    version: 2,
    general: {
      ...base.general,
      ...objectRecord(settings.general),
      name: String(settings.general?.name ?? workflow.name),
      tags: Array.isArray(settings.general?.tags) ? settings.general.tags : [],
    },
    run_policy: {
      ...base.run_policy,
      ...objectRecord(settings.run_policy),
      browser_retention: settings.run_policy?.browser_retention === "close" ? "close" : "retain",
      batch_headless: Boolean(settings.run_policy?.batch_headless),
      batch_stop_on_first_failed_row: Boolean(settings.run_policy?.batch_stop_on_first_failed_row),
    },
    browser_launch: normalizeSettingsBrowserLaunch({
      ...base.browser_launch,
      ...objectRecord(settings.browser_launch),
    }),
    graph_defaults: {
      default_edge_delay: normalizeGraphEdgeDelay(
        objectRecord(settings.graph_defaults).default_edge_delay,
      ),
    },
    environment: {
      initial_variables: Array.isArray(settings.environment?.initial_variables)
        ? settings.environment.initial_variables
        : [],
    },
    migration_notes: Array.isArray(settings.migration_notes) ? settings.migration_notes : [],
    created_at: settings.created_at ?? base.created_at,
    updated_at: settings.updated_at ?? base.updated_at,
  };
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

function defaultBrowserConfig(workflowId: string): WorkflowBrowserConfig {
  return {
    workflow_id: workflowId,
    profile_name: null,
    proxy_enabled: false,
    proxy_server: null,
    proxy_username: null,
    proxy_password: null,
    headless: false,
  };
}

function configToSettingsBrowserLaunch(
  config: WorkflowBrowserConfig,
  workflow?: Pick<WorkflowSummary, "id" | "name">,
  options: { randomizeIdentity?: boolean } = {},
): WorkflowSettingsBrowserLaunch {
  const identity = createDefaultBrowserIdentity(workflow, options);
  return normalizeSettingsBrowserLaunch({
    session_mode: config.profile_name ? "persistent_profile" : "temporary",
    profile_name: nullableText(config.profile_name),
    ...identity,
    proxy_enabled: config.proxy_enabled,
    proxy_server: nullableText(config.proxy_server),
    proxy_username: nullableText(config.proxy_username),
    proxy_password: nullableText(config.proxy_password),
    headless: config.headless ?? false,
    run_from_selected_enabled: false,
  });
}

function settingsBrowserToConfig(
  workflowId: string,
  browser: WorkflowSettingsBrowserLaunch,
): WorkflowBrowserConfig {
  return {
    workflow_id: workflowId,
    profile_name: browser.profile_name ?? null,
    proxy_enabled: browser.proxy_enabled,
    proxy_server: browser.proxy_server ?? null,
    proxy_username: browser.proxy_username ?? null,
    proxy_password: browser.proxy_password ?? null,
    headless: browser.headless,
  };
}

function normalizeSettingsBrowserLaunch(
  browser: WorkflowSettingsBrowserLaunch,
): WorkflowSettingsBrowserLaunch {
  const profileName = nullableText(browser.profile_name);
  const identityId = nullableText(browser.identity_id) ?? createStableBrowserIdentityId(profileName ?? "workflow");
  const profileDir = nullableText(browser.profile_dir) ?? identityId;
  const fingerprintSeed = nullableText(browser.fingerprint_seed) ?? stableFingerprintSeed(identityId);
  return {
    ...browser,
    identity_id: identityId,
    display_name: nullableText(browser.display_name) ?? `${profileName ?? "Workflow"} identity`,
    profile_dir: profileDir,
    fingerprint_seed: fingerprintSeed,
    viewport_width: 1920,
    viewport_height: 947,
    device_scale_factor: 1,
    mobile: false,
    touch: false,
    timezone: nullableText(browser.timezone),
    locale: nullableText(browser.locale),
    geoip: Boolean(browser.geoip),
    proxy_label: nullableText(browser.proxy_label),
    proxy_region: nullableText(browser.proxy_region),
    proxy_provider: nullableText(browser.proxy_provider),
    proxy_bypass: nullableText(browser.proxy_bypass),
    test_account_binding: nullableText(browser.test_account_binding),
    webrtc_policy: validWebRtcPolicy(browser.webrtc_policy)
      ? browser.webrtc_policy
      : "default",
    webrtc_ip: nullableText(browser.webrtc_ip),
    fingerprint_platform: null,
    hardware_concurrency: null,
    device_memory_gb: null,
    fingerprint_fonts_dir: null,
    storage_quota_mb: null,
    preflight_enabled: Boolean(browser.preflight_enabled),
    preflight_probe_url: nullableText(browser.preflight_probe_url),
    preflight_allowed_origins: Array.isArray(browser.preflight_allowed_origins)
      ? browser.preflight_allowed_origins.filter((origin) => typeof origin === "string" && origin.trim())
      : [],
    humanize: browser.humanize !== false,
    human_preset: validHumanPreset(browser.human_preset) ? browser.human_preset : "default",
    user_agent: nullableText(browser.user_agent),
    session_mode: browser.session_mode === "persistent_profile"
      ? "persistent_profile"
      : "temporary",
    profile_name: browser.session_mode === "persistent_profile" ? (profileName ?? profileDir) : null,
    run_from_selected_enabled:
      browser.session_mode === "persistent_profile" && (profileName ?? profileDir)
        ? Boolean(browser.run_from_selected_enabled)
        : false,
    proxy_server: nullableText(browser.proxy_server),
    proxy_username: nullableText(browser.proxy_username),
    proxy_password: nullableText(browser.proxy_password),
  };
}

function normalizeGraphEdgeDelay(value: unknown): GraphEdgeDelay | null {
  const delay = objectRecord(value);
  if (delay.type === "fixed") {
    const duration = positiveOptionalNumber(delay.duration_ms);
    return duration == null ? null : { type: "fixed", duration_ms: duration };
  }
  if (delay.type === "random") {
    const min = positiveOptionalNumber(delay.min_ms);
    const max = positiveOptionalNumber(delay.max_ms);
    return min == null || max == null || max < min
      ? null
      : { type: "random", min_ms: min, max_ms: max };
  }
  return null;
}

export function defaultWorkflowSettings(
  workflow: Pick<WorkflowSummary, "id" | "name" | "created_at" | "updated_at"> &
    Partial<Pick<WorkflowSummary, "step_count">>,
  options: { randomizeIdentity?: boolean } = {},
): WorkflowSettings {
  const browserLaunch = normalizeSettingsBrowserLaunch({
    ...configToSettingsBrowserLaunch(defaultBrowserConfig(workflow.id), workflow, options),
    session_mode: "persistent_profile",
  });
  return {
    workflow_id: workflow.id,
    version: 2,
    general: {
      name: workflow.name,
      description: "",
      tags: [],
      notes: "",
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: browserLaunch,
    graph_defaults: {
      default_edge_delay: null,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };
}

function createDefaultBrowserIdentity(
  workflow?: Pick<WorkflowSummary, "id" | "name">,
  options: { randomizeIdentity?: boolean } = {},
): Pick<
  WorkflowSettingsBrowserLaunch,
  | "identity_id"
  | "display_name"
  | "profile_dir"
  | "fingerprint_seed"
  | "viewport_width"
  | "viewport_height"
  | "device_scale_factor"
  | "mobile"
  | "touch"
  | "timezone"
  | "locale"
  | "geoip"
  | "proxy_label"
  | "proxy_region"
  | "proxy_provider"
  | "proxy_bypass"
  | "test_account_binding"
  | "webrtc_policy"
  | "webrtc_ip"
  | "fingerprint_platform"
  | "hardware_concurrency"
  | "device_memory_gb"
  | "fingerprint_fonts_dir"
  | "storage_quota_mb"
  | "preflight_enabled"
  | "preflight_probe_url"
  | "preflight_allowed_origins"
  | "humanize"
  | "human_preset"
  | "user_agent"
> {
  const identityId = options.randomizeIdentity
    ? `bi_${randomUUID().replace(/-/g, "").slice(0, 12)}`
    : createStableBrowserIdentityId(workflow?.id ?? "workflow");
  return {
    identity_id: identityId,
    display_name: `${workflow?.name ?? "Workflow"} identity`,
    profile_dir: identityId,
    fingerprint_seed: options.randomizeIdentity
      ? String(10000 + Math.floor(Math.random() * 90000))
      : stableFingerprintSeed(identityId),
    viewport_width: 1920,
    viewport_height: 947,
    device_scale_factor: 1,
    mobile: false,
    touch: false,
    timezone: null,
    locale: null,
    geoip: false,
    proxy_label: null,
    proxy_region: null,
    proxy_provider: null,
    proxy_bypass: null,
    test_account_binding: null,
    webrtc_policy: "default",
    webrtc_ip: null,
    fingerprint_platform: null,
    hardware_concurrency: null,
    device_memory_gb: null,
    fingerprint_fonts_dir: null,
    storage_quota_mb: null,
    preflight_enabled: false,
    preflight_probe_url: null,
    preflight_allowed_origins: [],
    user_agent: null,
    humanize: true,
    human_preset: "default",
  };
}

function createStableBrowserIdentityId(seed: string) {
  return `bi_${sanitizeIdentityText(seed).slice(0, 40) || "default"}`;
}

function sanitizeIdentityText(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableFingerprintSeed(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return String(10000 + hash).padStart(5, "0");
}

function positiveOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function validWebRtcPolicy(value: unknown): value is WorkflowSettingsBrowserLaunch["webrtc_policy"] {
  return (
    value === "default" ||
    value === "auto_proxy_exit_ip" ||
    value === "explicit_ip"
  );
}

function validHumanPreset(value: unknown): value is WorkflowSettingsBrowserLaunch["human_preset"] {
  return value === "default" || value === "careful";
}

function browserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return settings.browser_launch.profile_dir?.trim() || settings.browser_launch.profile_name?.trim() || null;
}

function browserIdentityPreferences(
  browser: WorkflowSettingsBrowserLaunch,
): Pick<
  WorkflowSettingsBrowserLaunch,
  | "identity_id"
  | "display_name"
  | "profile_dir"
  | "fingerprint_seed"
  | "user_agent"
  | "viewport_width"
  | "viewport_height"
  | "device_scale_factor"
  | "mobile"
  | "touch"
  | "timezone"
  | "locale"
  | "geoip"
  | "proxy_label"
  | "proxy_region"
  | "proxy_provider"
  | "proxy_bypass"
  | "test_account_binding"
  | "webrtc_policy"
  | "webrtc_ip"
  | "fingerprint_platform"
  | "hardware_concurrency"
  | "device_memory_gb"
  | "fingerprint_fonts_dir"
  | "storage_quota_mb"
  | "preflight_enabled"
  | "preflight_probe_url"
  | "preflight_allowed_origins"
  | "humanize"
  | "human_preset"
> {
  return {
    identity_id: browser.identity_id,
    display_name: browser.display_name,
    profile_dir: browser.profile_dir,
    fingerprint_seed: browser.fingerprint_seed,
    user_agent: browser.user_agent,
    viewport_width: browser.viewport_width,
    viewport_height: browser.viewport_height,
    device_scale_factor: browser.device_scale_factor,
    mobile: browser.mobile,
    touch: browser.touch,
    timezone: browser.timezone,
    locale: browser.locale,
    geoip: browser.geoip,
    proxy_label: browser.proxy_label,
    proxy_region: browser.proxy_region,
    proxy_provider: browser.proxy_provider,
    proxy_bypass: browser.proxy_bypass,
    test_account_binding: browser.test_account_binding,
    webrtc_policy: browser.webrtc_policy,
    webrtc_ip: browser.webrtc_ip,
    fingerprint_platform: browser.fingerprint_platform,
    hardware_concurrency: browser.hardware_concurrency,
    device_memory_gb: browser.device_memory_gb,
    fingerprint_fonts_dir: browser.fingerprint_fonts_dir,
    storage_quota_mb: browser.storage_quota_mb,
    preflight_enabled: browser.preflight_enabled,
    preflight_probe_url: browser.preflight_probe_url,
    preflight_allowed_origins: browser.preflight_allowed_origins,
    humanize: browser.humanize,
    human_preset: browser.human_preset,
  };
}

function beginRun(
  database: DatabaseSync,
  workflowId: string,
  settings: WorkflowSettings,
  graph: WorkflowGraph,
) {
  const runId = randomUUID();
  database
    .prepare(
      `INSERT INTO runs (
        id,
        workflow_id,
        status,
        started_at,
        settings_snapshot_json,
        graph_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      runId,
      workflowId,
      "running",
      new Date().toISOString(),
      JSON.stringify(settings),
      JSON.stringify(graph),
    );
  return runId;
}

export function finishRun(
  database: DatabaseSync,
  runId: string | null,
  graph: CompiledWorkflowGraph,
  state: RunState,
) {
  if (!runId) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `UPDATE runs
         SET status = ?,
             finished_at = ?,
             outputs_json = ?,
             error_json = ?
         WHERE id = ?`,
      )
      .run(
        state.status,
        new Date().toISOString(),
        JSON.stringify(state.outputs ?? {}),
        state.error ? JSON.stringify(state.error) : null,
        runId,
      );

    const traces = Array.isArray(state.outputs?.__action_traces)
      ? (state.outputs.__action_traces as Array<Record<string, unknown>>)
      : [];
    const insertStep = database.prepare(
      `INSERT INTO run_steps (
        id,
        run_id,
        node_id,
        step_number,
        action_type,
        status,
        finished_at,
        trace_json,
        error_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [index, step] of graph.steps.entries()) {
      const trace = traces.find((candidate) => candidate.node_id === step.node_id);
      const failed = state.error?.step_id === step.node_id;
      const completed = state.completed_step_ids.includes(step.node_id);
      insertStep.run(
        randomUUID(),
        runId,
        step.node_id,
        index + 1,
        step.config.type,
        failed ? "failed" : completed ? "success" : "skipped",
        trace || failed ? new Date().toISOString() : null,
        trace ? JSON.stringify(trace) : null,
        failed && state.error ? JSON.stringify(state.error) : null,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
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

function isWorkflowSettingsSection(
  value: string,
): value is WorkflowSettingsSectionId {
  return workflowSettingsSections.includes(value as WorkflowSettingsSectionId);
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
