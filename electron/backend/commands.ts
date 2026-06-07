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
  RecordingSaveDraftInput,
  RecorderStartSessionInput,
  RecordingEvent,
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
  EvidenceBundleExportRequest,
  EvidenceListRequest,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
  OperationsOverviewRequest,
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
  RunValidationIssue,
  ScheduleValidationIssue,
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
import { EvidenceRepository } from "./evidence/evidenceRepository.js";
import { IdentityRepository } from "./identity/identityRepository.js";
import { migrateWorkflowGraph } from "./graph/migration.js";
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

  ensureProjectModelReady();

  function ensureProjectModelReady() {
    const project = ensureDefaultProject();
    ensureDefaultProjectEnvironment(project);
    for (const workflow of repository.listWorkflows()) {
      const projectId = workflow.project_id ?? project.id;
      const existingEnvironment = workflow.environment_id
        ? repository.getProjectEnvironment(workflow.environment_id)
        : null;
      if (existingEnvironment && existingEnvironment.project_id === projectId) {
        if (!workflow.project_id) {
          repository.assignWorkflowProjectEnvironment(workflow.id, projectId, existingEnvironment.id);
        }
        continue;
      }
      const settings = getSettings(workflow.id);
      const environment = repository.createProjectEnvironment(projectId, {
        name: `${workflow.name} environment`,
        description: "Migrated workflow browser launch settings",
        browser_launch: settings.browser_launch,
        is_default: false,
      });
      repository.assignWorkflowProjectEnvironment(workflow.id, projectId, environment.id);
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

  function selectedProjectEnvironment(workflowId: string): ProjectEnvironment | null {
    const workflow = requireWorkflow(workflowId);
    return workflow.environment_id
      ? repository.getProjectEnvironment(workflow.environment_id)
      : null;
  }

  function settingsWithSelectedEnvironment(
    workflowId: string,
    settings: WorkflowSettings,
  ): WorkflowSettings {
    const environment = selectedProjectEnvironment(workflowId);
    return environment
      ? { ...settings, browser_launch: environment.browser_launch }
      : settings;
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
    const normalized = persisted
      ? settingsService.normalizeWorkflowSettings(persisted, workflow)
      : settingsService.defaultWorkflowSettings(workflow);
    return settingsWithSelectedEnvironment(workflowId, normalized);
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

  function usedProjectEnvironmentFingerprintSeeds() {
    const seeds = usedFingerprintSeeds();
    for (const project of repository.listProjects()) {
      for (const environment of repository.listProjectEnvironments(project.id)) {
        const seed = environment.browser_launch?.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  function projectEnvironmentProfileKey(environment: ProjectEnvironment) {
    if (environment.browser_launch.session_mode !== "persistent_profile") return null;
    return (
      environment.browser_launch.profile_dir?.trim() ||
      environment.browser_launch.profile_name?.trim() ||
      null
    );
  }

  function duplicateProjectBrowserLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
  ): WorkflowSettings["browser_launch"] {
    const identityId = createHighEntropyBrowserIdentityId();
    return {
      ...browserLaunch,
      identity_id: identityId,
      profile_dir: identityId,
      profile_name:
        browserLaunch.session_mode === "persistent_profile" ? identityId : null,
      fingerprint_seed: deriveFingerprintSeedFromIdentityId(
        identityId,
        usedProjectEnvironmentFingerprintSeeds(),
      ),
    };
  }

  function assertCanResetProjectEnvironmentBrowserIdentity(
    environment: ProjectEnvironment,
  ) {
    for (const workflow of repository.listWorkflows()) {
      if (workflow.environment_id !== environment.id) continue;
      const settings = {
        ...getSettings(workflow.id),
        browser_launch: environment.browser_launch,
      };
      const conflict = activeRunConflict(workflow.id, settings);
      if (conflict) throw commandError(conflict.message, conflict.field);
      const profileName = browserProfileKey(settings);
      if (profileName && runManager.retainedSessionActiveFor(workflow.id, profileName)) {
        throw commandError(
          "Close the retained browser session before resetting this project identity",
          "browser_launch.profile_dir",
        );
      }
    }
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

  function rotateProjectEnvironmentBrowserIdentity(
    environmentId: string,
  ): ProjectEnvironment {
    const environment = requireProjectEnvironment(environmentId);
    assertCanResetProjectEnvironmentBrowserIdentity(environment);
    const oldProfileDir = projectEnvironmentProfileKey(environment);
    const identityId = createHighEntropyBrowserIdentityId();
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      usedProjectEnvironmentFingerprintSeeds(),
    );
    const updated = repository.updateProjectEnvironment(environment.id, {
      browser_launch: {
        ...environment.browser_launch,
        identity_id: identityId,
        profile_dir: identityId,
        profile_name:
          environment.browser_launch.session_mode === "persistent_profile"
            ? identityId
            : null,
        fingerprint_seed: fingerprintSeed,
      },
    });
    if (!updated) throw commandError("Project environment not found", "environmentId");
    deleteProjectEnvironmentProfileDirectoryIfPrivate(
      environment.id,
      oldProfileDir,
      projectEnvironmentProfileKey(updated),
    );
    return updated;
  }

  function duplicateProjectWorkflowSettings(
    sourceSettings: WorkflowSettings,
    created: Workflow,
    browserLaunch: WorkflowSettings["browser_launch"],
  ): WorkflowSettings {
    const copied = structuredClone(sourceSettings);
    return {
      ...copied,
      workflow_id: created.id,
      general: {
        ...copied.general,
        name: created.name,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
      run_policy: {
        ...copied.run_policy,
        run_from_selected_enabled: false,
      },
      browser_launch: browserLaunch,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }

  function duplicateProjectCascade(projectId: string): Project {
    const sourceProject = requireProject(projectId);
    const sourceEnvironments = repository.listProjectEnvironments(sourceProject.id);
    const sourceSubflows = repository
      .listSubflows(sourceProject.id)
      .map((subflow) => repository.getSubflow(subflow.id))
      .filter((subflow): subflow is Subflow => Boolean(subflow));
    const sourceWorkflows = repository
      .listWorkflows()
      .filter((workflow) => workflow.project_id === sourceProject.id);

    context.database.exec("BEGIN IMMEDIATE");
    try {
      const createdProject = repository.createProject(
        `Copy of ${sourceProject.name}`,
        sourceProject.description,
      );
      const environmentIdMap = new Map<string, string>();
      for (const environment of sourceEnvironments) {
        const copiedEnvironment = repository.createProjectEnvironment(createdProject.id, {
          name: environment.name,
          description: environment.description,
          is_default: environment.is_default,
          browser_launch: duplicateProjectBrowserLaunch(environment.browser_launch),
        });
        environmentIdMap.set(environment.id, copiedEnvironment.id);
      }
      const defaultEnvironment =
        repository.getDefaultProjectEnvironment(createdProject.id) ??
        ensureDefaultProjectEnvironment(createdProject);

      const subflowIdMap = new Map<string, string>();
      for (const subflow of sourceSubflows) {
        const copiedSubflow = repository.createSubflow(
          createdProject.id,
          subflow.name,
          subflow.description,
          subflow.graph,
        );
        subflowIdMap.set(subflow.id, copiedSubflow.id);
      }

      for (const workflow of sourceWorkflows) {
        const copiedEnvironmentId = workflow.environment_id
          ? environmentIdMap.get(workflow.environment_id) ?? defaultEnvironment.id
          : defaultEnvironment.id;
        const copiedWorkflow = createWorkflow(workflow.name, {
          project_id: createdProject.id,
          environment: { mode: "existing", environment_id: copiedEnvironmentId },
        });
        const graph = repository.getWorkflowGraph(workflow.id);
        if (graph) {
          repository.saveWorkflowGraph(
            copiedWorkflow.id,
            remapCallSubflowIds(graph, subflowIdMap),
          );
        }
        const settings = repository.getWorkflowSettings(workflow.id);
        if (settings) {
          const copiedEnvironment = requireProjectEnvironment(copiedEnvironmentId);
          saveSettings(
            copiedWorkflow.id,
            duplicateProjectWorkflowSettings(
              settings,
              copiedWorkflow,
              copiedEnvironment.browser_launch,
            ),
          );
        }
      }

      context.database.exec("COMMIT");
      return createdProject;
    } catch (error) {
      context.database.exec("ROLLBACK");
      throw error;
    }
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

  function deleteProjectEnvironmentProfileDirectoryIfPrivate(
    environmentId: string,
    profileDir: string | null,
    nextProfileDir: string | null,
  ) {
    if (
      !profileDir ||
      profileDir === nextProfileDir ||
      isProfileReferencedOutsideProjectEnvironment(environmentId, profileDir)
    ) {
      return;
    }
    nodeFs.rmSync(path.join(context.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)), {
      recursive: true,
      force: true,
    });
  }

  function isProfileReferencedOutsideProjectEnvironment(
    environmentId: string,
    profileDir: string,
  ) {
    for (const project of repository.listProjects()) {
      for (const environment of repository.listProjectEnvironments(project.id)) {
        if (environment.id === environmentId) continue;
        if (projectEnvironmentProfileKey(environment) === profileDir) return true;
      }
    }
    return repository
      .listWorkflows()
      .some((workflow) => {
        if (workflow.environment_id === environmentId) return false;
        return browserProfileKey(getSettings(workflow.id)) === profileDir;
      });
  }

  function isProfileReferencedOutsideProject(
    projectId: string,
    workflowIds: Set<string>,
    profileDir: string,
  ) {
    for (const project of repository.listProjects()) {
      if (project.id === projectId) continue;
      for (const environment of repository.listProjectEnvironments(project.id)) {
        if (projectEnvironmentProfileKey(environment) === profileDir) return true;
      }
    }
    return repository
      .listWorkflows()
      .some((workflow) => {
        if (workflowIds.has(workflow.id)) return false;
        return browserProfileKey(getSettings(workflow.id)) === profileDir;
      });
  }

  function deleteProjectCascade(projectId: string) {
    const project = requireProject(projectId);
    const workflows = repository
      .listWorkflows()
      .filter((workflow) => workflow.project_id === project.id);
    const workflowIds = new Set(workflows.map((workflow) => workflow.id));
    for (const workflow of workflows) {
      assertWorkflowDeletionAllowed(workflow.id, getSettings(workflow.id));
    }

    const profileDirs = new Set<string>();
    for (const environment of repository.listProjectEnvironments(project.id)) {
      const profileDir = projectEnvironmentProfileKey(environment);
      if (profileDir) profileDirs.add(profileDir);
    }
    for (const workflow of workflows) {
      const profileDir = browserProfileKey(getSettings(workflow.id));
      if (profileDir) profileDirs.add(profileDir);
    }
    const deletableProfileDirs = [...profileDirs].filter(
      (profileDir) => !isProfileReferencedOutsideProject(project.id, workflowIds, profileDir),
    );

    context.database.exec("BEGIN IMMEDIATE");
    try {
      repository.deleteProject(project.id);
      context.database.exec("COMMIT");
    } catch (error) {
      context.database.exec("ROLLBACK");
      throw error;
    }

    for (const profileDir of deletableProfileDirs) {
      nodeFs.rmSync(path.join(context.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)), {
        recursive: true,
        force: true,
      });
    }
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
    const selectedEnvironment = selectedProjectEnvironment(workflowId);
    if (selectedEnvironment) {
      repository.updateProjectEnvironment(selectedEnvironment.id, {
        browser_launch: normalized.browser_launch,
      });
    }
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

  function reconcileReviewedRecordingSteps(
    draftSteps: ReviewedRecordingStep[],
    reviewedInput: unknown,
  ): ReviewedRecordingStep[] {
    const reviewedById = new Map(
      reviewedStepRecords(reviewedInput).map((step) => [step.id, step]),
    );
    return draftSteps.map((draftStep) => {
      const reviewed = reviewedById.get(draftStep.id);
      if (!reviewed) return draftStep;
      return {
        ...draftStep,
        label: typeof reviewed.label === "string" ? reviewed.label : draftStep.label,
        included:
          typeof reviewed.included === "boolean"
            ? reviewed.included
            : draftStep.included,
        action: mergeReviewedRecordingAction(draftStep.action, reviewed.action),
      };
    });
  }

  function mergeReviewedRecordingAction(
    draftAction: ActionConfig,
    reviewedActionInput: unknown,
  ): ActionConfig {
    const reviewedAction = actionConfigOrNull(reviewedActionInput);
    if (!reviewedAction) return draftAction;
    if (draftAction.type !== reviewedAction.type) return draftAction;
    switch (draftAction.type) {
      case "navigate":
        if (reviewedAction.type !== "navigate") return draftAction;
        return {
          type: "navigate",
          config: {
            ...draftAction.config,
            url: stringReviewValue(reviewedAction.config.url, draftAction.config.url),
          },
        };
      case "input_text":
        if (reviewedAction.type !== "input_text") return draftAction;
        return {
          type: "input_text",
          config: {
            ...draftAction.config,
            text: stringReviewValue(reviewedAction.config.text, draftAction.config.text),
          },
        };
      case "select_option":
        if (reviewedAction.type !== "select_option") return draftAction;
        return {
          type: "select_option",
          config: {
            ...draftAction.config,
            value: stringReviewValue(reviewedAction.config.value, draftAction.config.value),
          },
        };
      case "scroll":
        if (reviewedAction.type !== "scroll") return draftAction;
        return {
          type: "scroll",
          config: {
            ...draftAction.config,
            pixels: finiteReviewNumber(reviewedAction.config.pixels, draftAction.config.pixels),
          },
        };
      case "upload_file":
        if (reviewedAction.type !== "upload_file") return draftAction;
        return {
          type: "upload_file",
          config: {
            ...draftAction.config,
            files: stringArrayReviewValue(reviewedAction.config.files),
          },
        };
      case "set_clipboard":
        if (reviewedAction.type !== "set_clipboard") return draftAction;
        return {
          type: "set_clipboard",
          config: {
            ...draftAction.config,
            text: stringReviewValue(reviewedAction.config.text, draftAction.config.text),
          },
        };
      default:
        return draftAction;
    }
  }

  function stringReviewValue(value: unknown, fallback: string) {
    return typeof value === "string" ? value : fallback;
  }

  function finiteReviewNumber(value: unknown, fallback: number | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function stringArrayReviewValue(value: unknown) {
    return Array.isArray(value)
      ? value.filter((entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
        )
      : [];
  }

  function reviewedStepRecords(value: unknown): ReviewedRecordingStep[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is ReviewedRecordingStep =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          typeof (entry as { id?: unknown }).id === "string",
      )
    );
  }

  function actionConfigOrNull(value: unknown): ActionConfig | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as { type?: unknown; config?: unknown };
    return typeof candidate.type === "string" && "config" in candidate
      ? value as ActionConfig
      : null;
  }

  function saveRecordingDraft(
    draftId: string,
    input: RecordingSaveDraftInput,
  ): WorkflowDetail {
    const draft = requireRecordingResult(
      recordingDrafts.get(draftId) ?? null,
      "draftId",
      "Recording draft not found",
    );
    if (draft.status !== "draft") {
      throw commandError("Recording draft has already been saved", "draftId");
    }
    const reviewedSteps = reconcileReviewedRecordingSteps(draft.steps, input.reviewed_steps ?? []);
    if (!reviewedSteps.some((step) => step.included)) {
      throw commandError("At least one recorded step must be included", "reviewed_steps");
    }
    const graph = generateRecordingGraph(reviewedSteps, {
      addTerminalSuccess: input.add_terminal_success,
    });
    const validationIssues = validateGraph(graph);
    const firstError = validationIssues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(firstError.message, firstError.node_id ?? firstError.edge_id ?? "reviewed_steps");
    }

    const normalizedName = input.workflow_name.trim();
    if (input.save_mode === "create_new" && !normalizedName) {
      throw commandError("Workflow name is required", "workflow_name");
    }
    if (input.save_mode === "replace_graph" && !draft.workflow_id) {
      throw commandError("Recording draft is not linked to a workflow", "draftId");
    }

    context.database.exec("BEGIN IMMEDIATE");
    try {
      const detail =
        input.save_mode === "create_new"
          ? saveRecordingAsNewWorkflow(draft, graph, normalizedName)
          : replaceRecordingWorkflowGraph(draft, graph);
      context.database.exec("COMMIT");
      recordingDrafts.delete(draft.id);
      recorderSessionManager.deleteSession(draft.session_id);
      return detail;
    } catch (error) {
      context.database.exec("ROLLBACK");
      throw error;
    }
  }

  function saveRecordingAsNewWorkflow(
    draft: RecordingWorkflowDraft,
    graph: WorkflowGraph,
    workflowName: string,
  ): WorkflowDetail {
    const workflow = createWorkflow(workflowName);
    repository.saveWorkflowGraph(workflow.id, graph);
    const settingsSnapshot =
      recorderSessionManager.getInternalSettingsSnapshot(draft.session_id) ??
      draft.workflow_settings_snapshot;
    saveSettings(workflow.id, {
      ...settingsSnapshot,
      workflow_id: workflow.id,
      general: {
        ...settingsSnapshot.general,
        name: workflowName,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
      },
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    });
    return repository.getWorkflow(workflow.id) ?? { workflow, steps: [] };
  }

  function replaceRecordingWorkflowGraph(
    draft: RecordingWorkflowDraft,
    graph: WorkflowGraph,
  ): WorkflowDetail {
    const workflowId = draft.workflow_id;
    if (!workflowId) {
      throw commandError("Recording draft is not linked to a workflow", "draftId");
    }
    requireWorkflow(workflowId);
    repository.saveWorkflowGraph(workflowId, graph);
    const detail = repository.getWorkflow(workflowId);
    if (!detail) throw commandError("Workflow not found", "workflowId");
    return detail;
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
    const environment = resolveWorkflowCreationEnvironment({
      project,
      workflowName: normalized,
      selection: options.environment ?? { mode: "project_default" },
      defaultBrowserLaunch: defaultSettings.browser_launch,
    });
    repository.assignWorkflowProjectEnvironment(workflow.id, project.id, environment.id);
    repository.saveWorkflowSettings(workflow.id, {
      ...defaultSettings,
      browser_launch: environment.browser_launch,
    });
    return {
      ...workflow,
      project_id: project.id,
      environment_id: environment.id,
    };
  }

  function resolveWorkflowCreationEnvironment({
    project,
    workflowName,
    selection,
    defaultBrowserLaunch,
  }: {
    project: Project;
    workflowName: string;
    selection: NonNullable<WorkflowCreateOptions["environment"]>;
    defaultBrowserLaunch: WorkflowSettings["browser_launch"];
  }): ProjectEnvironment {
    if (selection.mode === "existing") {
      const environment = requireProjectEnvironment(selection.environment_id);
      if (environment.project_id !== project.id) {
        throw commandError(
          "Workflow environment must belong to the selected project",
          "environment_id",
        );
      }
      return environment;
    }
    if (selection.mode === "isolated") {
      const environmentName = selection.name?.trim() || `${workflowName} isolated environment`;
      return repository.createProjectEnvironment(project.id, {
        name: environmentName,
        description: "Isolated workflow browser identity and launch posture",
        browser_launch: defaultBrowserLaunch,
        is_default: false,
      });
    }
    return ensureDefaultProjectEnvironment(project);
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
    listProjects(): Project[] {
      return repository.listProjects();
    },

    createProject(input: { name: string; description?: string | null }): Project {
      const name = input.name.trim();
      if (!name) throw commandError("Project name is required", "name");
      const project = repository.createProject(name, input.description?.trim() ?? "");
      ensureDefaultProjectEnvironment(project);
      return project;
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
      return duplicateProjectCascade(projectId);
    },

    deleteProject(projectId: string) {
      deleteProjectCascade(projectId);
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
      return rotateProjectEnvironmentBrowserIdentity(environmentId);
    },

    setWorkflowEnvironment(workflowId: string, environmentId: string): Workflow {
      const workflow = requireWorkflow(workflowId);
      const environment = requireProjectEnvironment(environmentId);
      if (workflow.project_id !== environment.project_id) {
        throw commandError(
          "Workflow environment must belong to the same project",
          "environmentId",
        );
      }
      repository.setWorkflowEnvironment(workflowId, environmentId);
      const settings = getSettings(workflowId);
      repository.saveWorkflowSettings(workflowId, settings);
      return {
        ...summaryToWorkflow(requireWorkflow(workflowId)),
        project_id: environment.project_id,
        environment_id: environment.id,
      };
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
          environment: { mode: "isolated" },
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

      context.database.exec("BEGIN IMMEDIATE");
      try {
        const workflow = createWorkflow(preparedImport.importedName);
        const subflowIdMap = new Map<string, string>();
        for (const subflow of preparedImport.subflows) {
          const createdSubflow = repository.createSubflow(
            workflow.project_id ?? ensureDefaultProject().id,
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
      const workflow = requireWorkflow(workflowId);
      const graphContext = graphContextForWorkflow(workflow);
      if (compileGraph(graph, graphContext).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings, graphContext);
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
      for (const [draftId, draft] of recordingDrafts) {
        if (draft.session_id === sessionId) {
          recordingDrafts.delete(draftId);
        }
      }
      return discarded;
    },

    generateRecordingDraft(
      sessionId: string,
      options: RecordingGenerateDraftOptions,
    ): RecordingWorkflowDraft {
      return createRecordingDraft(sessionId, options);
    },

    getRecordingDraft(draftId: string): RecordingWorkflowDraft {
      return requireRecordingResult(
        recordingDrafts.get(draftId) ?? null,
        "draftId",
        "Recording draft not found",
      );
    },

    saveRecordingDraft,

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
  let currentDir = process.cwd();
  while (true) {
    try {
      const packageJson = await fs.readFile(
        path.join(currentDir, "node_modules", "cloakbrowser", "package.json"),
        "utf8",
      );
      const parsed = JSON.parse(packageJson) as { version?: unknown };
      return typeof parsed.version === "string" ? parsed.version : null;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) return null;
      currentDir = parentDir;
    }
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
