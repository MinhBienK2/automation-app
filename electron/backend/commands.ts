import fs from "node:fs/promises";
import nodeFs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  ActionConfig,
  BatchRunRequest,
  BrowserProfileCleanupResult,
  CloakBrowserDiagnostics,
  CompiledWorkflowGraph,
  GraphValidationIssue,
  RecordingGenerateDraftOptions,
  RecorderStartSessionInput,
  RecordingEvent,
  RecordingSession,
  RecordingWorkflowDraft,
  EvidenceBundleExportRequest,
  EvidenceListRequest,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
  OperationsOverviewRequest,
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
  ProjectPackage,
  ProjectPackagePreview,
  RunValidationIssue,
  SettingsValidationIssue,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowDeleteOptions,
  WorkflowDetail,
  WorkflowCreateOptions,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
  WorkflowRunSnapshot,
  WorkflowRunSource,
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
import { createScheduleCommandHandlers } from "./scheduling/scheduleCommands.js";
import {
  browserProfileKey,
  RunManager,
  type RunnerCommandPort,
} from "./runtime/runManager.js";
import { runBatchWorkflowRows } from "./runtime/batchWorkflowRun.js";
import { sanitizePathSegment } from "./evidence/artifacts.js";
import { EvidenceRepository } from "./evidence/evidenceRepository.js";
import { IdentityRepository } from "./identity/identityRepository.js";
import { createProjectCommandCascades } from "./projects/projectCommandCascades.js";
import { migrateWorkflowGraph } from "./graph/migration.js";
import { ProjectPackageService } from "./services/projectPackageService.js";
import { WorkflowPackageService } from "./services/workflowPackageService.js";
import { WorkflowRepository } from "./persistence/workflowRepository.js";
import { WorkflowScheduleRepository } from "./scheduling/workflowScheduleRepository.js";
import { OperationsRepository } from "./operations/operationsRepository.js";
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
import { createRecordingDraftCommands } from "./recording/recordingDraftCommands.js";
import {
  buildCloakBrowserDiagnostics,
  directoryReadable,
  isOptionalModuleAvailable,
  loadCloakBrowserDiagnosticsModule,
  resolveDefaultFingerprintFontsDir,
} from "./diagnostics/cloakBrowserDiagnostics.js";
import {
  asRecord,
  commandError,
  createDraftGraph,
  isCommandError,
  summaryToWorkflow,
  type CommandError,
} from "./commandHelpers.js";

export { finishRun } from "./runtime/runManager.js";
export { defaultWorkflowSettings, deriveFingerprintSeedFromIdentityId } from "./services/workflowSettingsService.js";

export type { CommandError } from "./commandHelpers.js";

export type WorkflowCommandHandlers = ReturnType<typeof createWorkflowCommandHandlers>;

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
  runner?: RunnerCommandPort;
  recorderDriver?: BrowserDriver;
  recorderUsesDefaultDriver?: boolean;
  saveWorkflowPackageFile?: (packageValue: WorkflowPackage) => Promise<string | null>;
  saveProjectPackageFile?: (packageValue: ProjectPackage) => Promise<string | null>;
  revealEvidenceArtifact?: (absolutePath: string) => void | Promise<void>;
  selectEvidenceBundleDirectory?: () => Promise<string | null>;
  defaultFingerprintFontsDir?: string | null | (() => string | null);
};

export function createWorkflowCommandHandlers(context: CommandContext) {
  const repository = new WorkflowRepository(context.database);
  const scheduleRepository = new WorkflowScheduleRepository(context.database);
  const operationsRepository = new OperationsRepository(context.database);
  const evidenceRepository = new EvidenceRepository({
    database: context.database,
    appPaths: context.appPaths,
    revealEvidenceArtifact: context.revealEvidenceArtifact,
    selectEvidenceBundleDirectory: context.selectEvidenceBundleDirectory,
  });
  const runner = context.runner ?? new BrowserWorkflowRunner({ appPaths: context.appPaths });
  const recorderBrowserSessionManager = new BrowserSessionManager({
    appPaths: context.appPaths,
    driver: context.recorderDriver,
    usesDefaultDriver: context.recorderUsesDefaultDriver,
  });
  const runManager = new RunManager({ database: context.database, runner });
  const identityRepository = new IdentityRepository({
    database: context.database,
    workflows: () => repository.listWorkflows(),
    settingsForWorkflow: (workflowId) => getSettings(workflowId),
    diagnostics: () =>
      buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      }),
    runner,
  });
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
  const projectPackageService = new ProjectPackageService({
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
  const recordingDraftCommands = createRecordingDraftCommands({
    database: context.database,
    recorderSessions: recorderSessionManager,
    createWorkflow,
    saveWorkflowGraph: (workflowId, graph) => repository.saveWorkflowGraph(workflowId, graph),
    saveWorkflowSettings: saveSettings,
    getWorkflowDetail: (workflowId) => repository.getWorkflow(workflowId),
    requireWorkflow,
  });
  const projectCascades = createProjectCommandCascades({
    database: context.database,
    browserProfilesDir: context.appPaths.browserProfilesDir,
    repository,
    projectPackageService,
    requireProject,
    requireProjectEnvironment,
    ensureDefaultProjectEnvironment,
    createWorkflow,
    getSettings,
    saveSettings,
    assertWorkflowDeletionAllowed,
    activeRunConflict,
    retainedSessionActiveFor: (workflowId, profileName) =>
      runManager.retainedSessionActiveFor(workflowId, profileName),
    remapCallSubflowIds,
  });

  ensureProjectModelReady();

  function ensureProjectModelReady() {
    const project = ensureDefaultProject();
    ensureDefaultProjectEnvironment(project);
    for (const workflow of repository.listWorkflows()) {
      const projectId = workflow.project_id ?? project.id;
      if (!workflow.project_id || workflow.environment_id) {
        repository.assignWorkflowProject(workflow.id, projectId);
      }
    }
  }

  function ensureDefaultProject(): Project {
    const existing = repository.listProjects()[0];
    if (existing) return existing;
    return repository.createProject("Main");
  }

  function ensureDefaultProjectEnvironment(project: Project): ProjectEnvironment {
    const existing = repository.getDefaultProjectEnvironment(project.id);
    if (existing) return existing;
    return repository.createProjectEnvironment(project.id, {
      name: "Project saved session",
      description: "Default project-owned fingerprint and persistent browser profile",
      browser_launch: defaultEnvironmentBrowserLaunch("Project saved session"),
      is_default: true,
    });
  }

  function defaultEnvironmentBrowserLaunch(name: string): WorkflowSettings["browser_launch"] {
    const now = new Date().toISOString();
    return settingsService.defaultWorkflowSettings(
      {
        id: `environment-${randomUUID()}`,
        name,
        created_at: now,
        updated_at: now,
      },
      { randomizeIdentity: true },
    ).browser_launch;
  }

  function requireProject(projectId: string): Project {
    const project = repository.getProject(projectId);
    if (!project) throw commandError("Project not found", "projectId");
    return project;
  }

  function requireProjectEnvironment(environmentId: string): ProjectEnvironment {
    const environment = repository.getProjectEnvironment(environmentId);
    if (!environment) {
      throw commandError("Project environment not found", "environmentId");
    }
    return environment;
  }

  function graphContextForWorkflow(workflow: WorkflowSummary) {
    return {
      projectId: workflow.project_id ?? null,
      workflowLabel: workflow.name,
      resolveSubflow(subflowId: string) {
        const subflow = repository.getSubflow(subflowId);
        return subflow
          ? {
              id: subflow.id,
              project_id: subflow.project_id,
              name: subflow.name,
              graph: migrateWorkflowGraph(subflow.graph),
            }
          : null;
      },
    };
  }

  function referencedSubflowsForWorkflowGraph(
    workflow: WorkflowSummary,
    graph: WorkflowGraph,
  ): Subflow[] {
    const projectId = workflow.project_id;
    if (!projectId) return [];
    const referencedIds = callSubflowIds(graph);
    return referencedIds.map((subflowId) => {
      const subflow = repository.getSubflow(subflowId);
      if (!subflow) {
        throw commandError("Workflow references a missing subflow", "workflow.graph");
      }
      if (subflow.project_id !== projectId) {
        throw commandError(
          "Workflow references a subflow outside its project",
          "workflow.graph",
        );
      }
      return subflow;
    });
  }

  function callSubflowIds(graph: WorkflowGraph): string[] {
    return [
      ...new Set(
        graph.nodes
          .filter((node) => node.node_type === "call_subflow")
          .map((node) => (node.config as { subflow_id?: unknown }).subflow_id)
          .filter((subflowId): subflowId is string =>
            typeof subflowId === "string" && subflowId.trim().length > 0
          ),
      ),
    ];
  }

  function remapCallSubflowIds(
    graph: WorkflowGraph,
    subflowIdMap: Map<string, string>,
  ): WorkflowGraph {
    return {
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.node_type !== "call_subflow") return node;
        const config = node.config as { subflow_id?: unknown };
        const nextSubflowId =
          typeof config.subflow_id === "string"
            ? subflowIdMap.get(config.subflow_id) ?? config.subflow_id
            : config.subflow_id;
        return {
          ...node,
          config: {
            ...asRecord(node.config),
            subflow_id: nextSubflowId,
          },
        };
      }),
    };
  }

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
    return persisted
      ? settingsService.normalizeWorkflowSettings(persisted, workflow)
      : settingsService.defaultWorkflowSettings(workflow);
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

  function requireRecordingResult<T>(
    value: T | null,
    field = "sessionId",
    message = "Recording session not found",
  ): T {
    if (value == null) {
      throw commandError(message, field);
    }
    return value;
  }

  function createWorkflow(name: string, options: WorkflowCreateOptions = {}): Workflow {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const project = options.project_id
      ? requireProject(options.project_id)
      : ensureDefaultProject();
    const workflow = repository.createWorkflow(
      normalized,
      createDraftGraph(),
      new Date(),
      { projectId: project.id, environmentId: null },
    );
    const defaultSettings = settingsService.defaultWorkflowSettings(workflow, {
      randomizeIdentity: true,
    });
    repository.saveWorkflowSettings(workflow.id, defaultSettings);
    return {
      ...workflow,
      project_id: project.id,
      environment_id: null,
    };
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
    const workflow = requireWorkflow(workflowId);
    const graph = getWorkflowGraph(workflowId);
    return [
      ...validateGraph(graph, graphContextForWorkflow(workflow)).map((issue) => ({
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
      if (source === "manual") {
        operationsRepository.recordLaunchBlocked({ workflow, issues: runIssues });
      }
      throw commandError(firstError.message, firstError.field ?? firstError.node_id ?? "workflowId");
    }
    const graphContext = graphContextForWorkflow(workflow);
    if (compileGraph(graph, graphContext).steps.length === 0) {
      throw commandError("Workflow graph has no executable steps", "graph");
    }

    const compiledGraph = compileWorkflowRunPlan(graph, settings, graphContext);
    return runManager.startWorkflowRun({
      workflow,
      source,
      settings,
      graphSnapshot: graph,
      compiledGraph,
    });
  }

  return {
    listProjects(): Project[] {
      return repository.listProjects();
    },

    createProject(input: { name: string; description?: string | null }): Project {
      const name = input.name.trim();
      if (!name) throw commandError("Project name is required", "name");
      context.database.exec("BEGIN IMMEDIATE");
      try {
        const project = repository.createProject(name, input.description?.trim() ?? "");
        ensureDefaultProjectEnvironment(project);
        createWorkflow("Main", { project_id: project.id });
        context.database.exec("COMMIT");
        return project;
      } catch (error) {
        context.database.exec("ROLLBACK");
        throw error;
      }
    },

    updateProject(
      projectId: string,
      input: { name?: string; description?: string | null },
    ): Project {
      requireProject(projectId);
      if (input.name != null && !input.name.trim()) {
        throw commandError("Project name is required", "name");
      }
      const updated = repository.updateProject(projectId, {
        name: input.name?.trim(),
        description:
          input.description === undefined ? undefined : input.description?.trim() ?? "",
      });
      if (!updated) throw commandError("Project not found", "projectId");
      return updated;
    },

    duplicateProject(projectId: string): Project {
      return projectCascades.duplicateProjectCascade(projectId);
    },

    exportProjectPackage(projectId: string): ProjectPackage {
      const project = requireProject(projectId);
      const environments = repository.listProjectEnvironments(project.id);
      const subflows = repository
        .listSubflows(project.id)
        .map((subflow) => repository.getSubflow(subflow.id))
        .filter((subflow): subflow is Subflow => Boolean(subflow));
      const workflows = repository
        .listWorkflows()
        .filter((workflow) => workflow.project_id === project.id)
        .map((workflow) => ({
          workflow,
          flow: getWorkflowGraph(workflow.id),
          settings: getSettings(workflow.id),
        }));
      return projectPackageService.exportProjectPackage({
        project,
        environments,
        subflows,
        workflows,
      });
    },

    previewProjectPackage(packageValue: ProjectPackage): ProjectPackagePreview {
      return projectPackageService.previewProjectPackage(packageValue);
    },

    importProjectPackage(packageValue: ProjectPackage): Project {
      return projectCascades.importProjectPackageCascade(packageValue);
    },

    deleteProject(projectId: string) {
      projectCascades.deleteProjectCascade(projectId);
    },

    listProjectEnvironments(projectId: string): ProjectEnvironment[] {
      requireProject(projectId);
      return repository.listProjectEnvironments(projectId);
    },

    createProjectEnvironment(
      projectId: string,
      input: ProjectEnvironmentInput,
    ): ProjectEnvironment {
      requireProject(projectId);
      const name = input.name.trim();
      if (!name) throw commandError("Environment name is required", "name");
      return repository.createProjectEnvironment(projectId, {
        name,
        description: input.description?.trim() ?? "",
        is_default: Boolean(input.is_default),
        browser_launch: input.browser_launch ?? defaultEnvironmentBrowserLaunch(name),
      });
    },

    updateProjectEnvironment(
      environmentId: string,
      input: Partial<ProjectEnvironmentInput>,
    ): ProjectEnvironment {
      const current = requireProjectEnvironment(environmentId);
      if (input.name != null && !input.name.trim()) {
        throw commandError("Environment name is required", "name");
      }
      const updated = repository.updateProjectEnvironment(environmentId, {
        ...input,
        name: input.name?.trim(),
        description: input.description?.trim(),
      });
      if (!updated) throw commandError("Project environment not found", "environmentId");
      if (!repository.getDefaultProjectEnvironment(current.project_id)) {
        repository.updateProjectEnvironment(updated.id, { is_default: true });
        return requireProjectEnvironment(updated.id);
      }
      return updated;
    },

    resetProjectEnvironmentBrowserIdentity(environmentId: string): ProjectEnvironment {
      return projectCascades.rotateProjectEnvironmentBrowserIdentity(environmentId);
    },

    createSubflow(
      projectId: string,
      input: { name: string; description?: string | null },
    ): Subflow {
      requireProject(projectId);
      const name = input.name.trim();
      if (!name) throw commandError("Subflow name is required", "name");
      return repository.createSubflow(
        projectId,
        name,
        input.description?.trim() ?? "",
        createDraftGraph(),
      );
    },

    listSubflows(projectId: string): SubflowSummary[] {
      requireProject(projectId);
      return repository.listSubflows(projectId);
    },

    getSubflow(subflowId: string): Subflow {
      const subflow = repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      return subflow;
    },

    updateSubflow(
      subflowId: string,
      input: { name?: string; description?: string | null },
    ): Subflow {
      const patch: { name?: string; description?: string | null } = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw commandError("Subflow name is required", "name");
        patch.name = name;
      }
      if (input.description !== undefined) {
        patch.description = input.description?.trim() ?? "";
      }
      const updated = repository.updateSubflow(subflowId, patch);
      if (!updated) throw commandError("Subflow not found", "subflowId");
      return updated;
    },

    getSubflowGraph(subflowId: string): WorkflowGraph {
      const graph = repository.getSubflowGraph(subflowId);
      if (!graph) throw commandError("Subflow not found", "subflowId");
      return migrateWorkflowGraph(graph);
    },

    saveSubflowGraph(subflowId: string, graph: WorkflowGraph) {
      const subflow = repository.getSubflow(subflowId);
      if (!subflow) throw commandError("Subflow not found", "subflowId");
      const migrated = migrateWorkflowGraph(graph);
      const nestedCall = migrated.nodes.find((node) => node.node_type === "call_subflow");
      if (nestedCall) {
        throw commandError("Subflows cannot call subflows in the MVP", nestedCall.id);
      }
      assertNoUnsupportedGraphDiscriminants(migrated);
      repository.saveSubflowGraph(subflowId, migrated);
    },

    duplicateSubflow(subflowId: string, name: string): Subflow {
      const normalized = name.trim();
      if (!normalized) throw commandError("Subflow name is required", "name");
      const duplicate = repository.duplicateSubflow(subflowId, normalized);
      if (!duplicate) throw commandError("Subflow not found", "subflowId");
      return duplicate;
    },

    deleteSubflow(subflowId: string) {
      const usage = repository.getSubflowUsage(subflowId);
      if (usage.length > 0) {
        throw commandError(`Subflow is used by ${usage.length} workflow${usage.length === 1 ? "" : "s"}`, "subflowId");
      }
      repository.deleteSubflow(subflowId);
    },

    getSubflowUsage(subflowId: string): SubflowUsage[] {
      if (!repository.getSubflow(subflowId)) {
        throw commandError("Subflow not found", "subflowId");
      }
      return repository.getSubflowUsage(subflowId);
    },

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
      const sourceWorkflow = requireWorkflow(workflowId);
      context.database.exec("BEGIN IMMEDIATE");
      try {
        const created = createWorkflow(name, {
          project_id: sourceWorkflow.project_id,
        });
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
        ...graphContextForWorkflow(workflow),
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

    getOperationsOverview(request: OperationsOverviewRequest) {
      return operationsRepository.getOverview(request, runManager.listRunStates());
    },

    listEvidenceItems(request: EvidenceListRequest = {}) {
      return evidenceRepository.listEvidenceItems(request);
    },

    getEvidenceDetail(evidenceId: string) {
      return evidenceRepository.getEvidenceDetail(evidenceId);
    },

    getEvidenceScreenshotPreview(evidenceId: string) {
      return evidenceRepository.getEvidenceScreenshotPreview(evidenceId);
    },

    revealEvidenceArtifact(evidenceId: string) {
      return evidenceRepository.revealEvidenceArtifact(evidenceId);
    },

    exportEvidenceBundle(request: EvidenceBundleExportRequest) {
      return evidenceRepository.exportEvidenceBundle(request);
    },

    getIdentityLabOverview(request: IdentityLabOverviewRequest = {}) {
      return identityRepository.getOverview(request);
    },

    getIdentityLabDetail(target: IdentityLabTarget) {
      return identityRepository.getDetail(target);
    },

    async closeIdentityRetainedSession(workflowId: string, profileName: string) {
      const settings = getSettings(workflowId);
      const currentProfile = browserProfileKey(settings);
      if (currentProfile !== profileName) {
        throw commandError("Identity profile does not match current workflow settings", "profileName");
      }
      const conflict = activeRunConflict(workflowId, settings);
      if (conflict) {
        throw commandError(conflict.message, conflict.field);
      }
      if (!runner.closeRetainedSession) {
        throw commandError("Retained session close is unavailable", "profileName");
      }
      await runner.closeRetainedSession(workflowId, profileName);
    },

    ...createScheduleCommandHandlers({
      scheduleRepository,
      requireWorkflow,
      validateWorkflowRun,
      schedulerConflictReason,
      startWorkflowRun,
    }),

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
      context.database.exec("BEGIN IMMEDIATE");
      try {
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
        context.database.exec("COMMIT");
        return { workflow, steps: [] };
      } catch (error) {
        context.database.exec("ROLLBACK");
        throw error;
      }
    },

    exportWorkflowPackage(
      workflowId: string,
      options: WorkflowPackageExportOptions,
    ): WorkflowPackage {
      const workflow = requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      const flow = options.include_flow ? getWorkflowGraph(workflowId) : null;
      return packageService.exportWorkflowPackage({
        workflowName: workflow.name,
        flow,
        settings,
        options,
        subflows: flow ? referencedSubflowsForWorkflowGraph(workflow, flow) : [],
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
      const targetProjectId = options.target_project_id?.trim() || ensureDefaultProject().id;
      const importsBrowserLaunch =
        options.settings_sections.includes("browser_launch") &&
        Boolean(packageValue.settings?.browser_launch);

      context.database.exec("BEGIN IMMEDIATE");
      try {
        const workflow = createWorkflow(preparedImport.importedName, {
          project_id: targetProjectId,
        });
        const subflowIdMap = new Map<string, string>();
        for (const subflow of preparedImport.subflows) {
          const createdSubflow = repository.createSubflow(
            workflow.project_id ?? targetProjectId,
            subflow.name,
            subflow.description,
            migrateWorkflowGraph(subflow.graph),
          );
          subflowIdMap.set(subflow.id, createdSubflow.id);
        }
        if (options.include_flow && preparedImport.flow) {
          repository.saveWorkflowGraph(
            workflow.id,
            remapCallSubflowIds(preparedImport.flow, subflowIdMap),
          );
        }

        if (preparedImport.candidateSettings) {
          const baseSettings = getSettings(workflow.id);
          saveSettings(workflow.id, {
            ...baseSettings,
            ...preparedImport.candidateSettings,
            workflow_id: workflow.id,
            browser_launch: importsBrowserLaunch
              ? preparedImport.candidateSettings.browser_launch
              : baseSettings.browser_launch,
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
      const workflow = requireWorkflow(workflowId);
      const graphContext = graphContextForWorkflow(workflow);
      if (compileGraph(graph, graphContext).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings, graphContext);
      return runBatchWorkflowRows({
        workflowId,
        request,
        settings,
        graphSnapshot: graph,
        compiledGraph,
        runner,
        runManager,
      });
    },

    async startRecordingSession(input: RecorderStartSessionInput): Promise<RecordingSession> {
      return runRecorderCommand(() => {
        if (input.mode === "replace_current_graph" && input.workflow_id) {
          const settings = getSettings(input.workflow_id);
          const conflict = activeRunConflict(input.workflow_id, settings);
          if (conflict) throw commandError(conflict.message, conflict.field);
        }
        return recorderSessionManager.startSession(input);
      });
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
      const discarded = requireRecordingResult(await recorderSessionManager.discardSession(sessionId));
      recordingDraftCommands.discardRecordingDraftsForSession(sessionId);
      return discarded;
    },

    generateRecordingDraft(
      sessionId: string,
      options: RecordingGenerateDraftOptions,
    ): RecordingWorkflowDraft {
      return recordingDraftCommands.createRecordingDraft(sessionId, options);
    },

    getRecordingDraft(draftId: string): RecordingWorkflowDraft {
      return recordingDraftCommands.getRecordingDraft(draftId);
    },

    saveRecordingDraft: recordingDraftCommands.saveRecordingDraft,

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

    async saveProjectPackageFile(packageValue: ProjectPackage) {
      if (!context.saveProjectPackageFile) {
        throw commandError("Project package file saving is not available");
      }
      return context.saveProjectPackageFile(packageValue);
    },
  };
}

export function serializeCommandError(error: unknown): CommandError {
  if (error instanceof Error) return { message: error.message };
  if (isCommandError(error)) return error;
  return { message: "Unexpected command error" };
}

function isUnsupportedGraphDiscriminantMessage(message: string) {
  return (
    message.startsWith("Unsupported graph node type: ") ||
    message.startsWith("Unsupported condition kind: ") ||
    message.includes("Unsupported action type: ")
  );
}
