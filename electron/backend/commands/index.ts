import { randomUUID } from "node:crypto";
import { migrateWorkflowGraph } from "../graph/migration.js";
import { validateWorkflowGraph as validateGraph } from "../graph/compiler.js";
import { BrowserWorkflowRunner } from "../runtime/runner.js";
import { createScheduleCommandHandlers } from "../scheduling/scheduleCommands.js";
import { RunManager } from "../runtime/runManager.js";
import { EvidenceRepository } from "../evidence/evidenceRepository.js";
import { IdentityRepository } from "../identity/identityRepository.js";
import { createProjectCommandCascades } from "../projects/projectCommandCascades.js";
import { ProjectPackageService } from "../services/projectPackageService.js";
import { WorkflowPackageService } from "../services/workflowPackageService.js";
import { WorkflowRepository } from "../persistence/workflowRepository.js";
import { WorkflowScheduleRepository } from "../scheduling/workflowScheduleRepository.js";
import { OperationsRepository } from "../operations/operationsRepository.js";
import {
  createHighEntropyBrowserIdentityId,
  deriveFingerprintSeedFromIdentityId,
  WorkflowSettingsService,
} from "../services/workflowSettingsService.js";
import { BrowserSessionManager } from "../browser/sessionManager.js";
import { RecorderSessionManager } from "../recording/recorderSessionManager.js";
import { createRecordingDraftCommands } from "../recording/recordingDraftCommands.js";
import {
  buildCloakBrowserDiagnostics,
  directoryReadable,
  isOptionalModuleAvailable,
  resolveDefaultFingerprintFontsDir,
} from "../diagnostics/cloakBrowserDiagnostics.js";
import { commandError, createDraftGraph } from "../commandHelpers.js";

import type { CommandContext, CommandDeps } from "./types.js";
import type {
  Project,
  ProjectEnvironment,
  Workflow,
  WorkflowCreateOptions,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

import { createWorkflowCommands } from "./workflowCommands.js";
import { createProjectCommands } from "./projectCommands.js";
import { createSubflowCommands } from "./subflowCommands.js";
import { createPackageCommands } from "./packageCommands.js";
import { createRecordingCommands } from "./recordingCommands.js";
import { createSettingsCommands } from "./settingsCommands.js";

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
      if (!workflow.project_id) {
        repository.assignWorkflowProject(workflow.id, projectId);
      }
      const current = repository.getWorkflowSummary(workflow.id);
      if (!current?.environment_id) {
        const ownerProject = repository.getProject(projectId) ?? project;
        const persistedSettings = repository.getWorkflowSettings(workflow.id);
        const environment = persistedSettings
          ? repository.createProjectEnvironment(ownerProject.id, {
              name: `${workflow.name} browser profile`,
              description: "Migrated workflow browser profile",
              browser_launch: settingsService.normalizeWorkflowSettings(
                persistedSettings,
                workflow,
              ).browser_launch,
              is_default: false,
            })
          : ensureDefaultProjectEnvironment(ownerProject);
        repository.assignWorkflowProjectEnvironment(workflow.id, environment.id);
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
      name: "Project browser profile",
      description: "Project-owned browser profile with persistent storage and fingerprint identity",
      browser_launch: defaultEnvironmentBrowserLaunch("Project browser profile"),
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
  ): any[] {
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

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
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
    if (!workflow.environment_id) return normalized;
    const environment = repository.getProjectEnvironment(workflow.environment_id);
    if (!environment || environment.project_id !== workflow.project_id) return normalized;
    return settingsService.normalizeWorkflowSettings(
      {
        ...normalized,
        browser_launch: environment.browser_launch,
      },
      workflow,
    );
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

  function saveSelectedProfileBrowserLaunch(
    workflow: WorkflowSummary,
    browserLaunch: WorkflowSettings["browser_launch"],
  ) {
    if (!workflow.environment_id) return browserLaunch;
    const environment = repository.getProjectEnvironment(workflow.environment_id);
    if (!environment || environment.project_id !== workflow.project_id) {
      return browserLaunch;
    }
    return repository.updateProjectEnvironment(environment.id, {
      browser_launch: browserLaunch,
    })?.browser_launch ?? browserLaunch;
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

  function usedBrowserProfileFingerprintSeeds(exceptWorkflowId?: string) {
    const seeds = usedFingerprintSeeds(exceptWorkflowId);
    for (const project of repository.listProjects()) {
      for (const environment of repository.listProjectEnvironments(project.id)) {
        const seed = environment.browser_launch.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  function duplicateBrowserProfileLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
    exceptWorkflowId?: string,
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
        usedBrowserProfileFingerprintSeeds(exceptWorkflowId),
      ),
    };
  }

  function rotateBrowserIdentity(workflowId: string): WorkflowSettings {
    const settings = getSettings(workflowId);
    assertCanResetBrowserIdentity(workflowId, settings);
    const identityId = createHighEntropyBrowserIdentityId();
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      usedBrowserProfileFingerprintSeeds(workflowId),
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

    const browserLaunch = saveSelectedProfileBrowserLaunch(
      workflow,
      activeSettings.browser_launch,
    );
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
      browser_launch: browserLaunch,
      migration_notes: activeSettings.migration_notes,
      updated_at: timestamp,
      created_at: activeSettings.created_at ?? workflow.created_at,
    };
    repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  function createWorkflow(name: string, options: WorkflowCreateOptions = {}): Workflow {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const project = options.project_id
      ? requireProject(options.project_id)
      : ensureDefaultProject();
    const environment = ensureDefaultProjectEnvironment(project);
    const workflow = repository.createWorkflow(
      normalized,
      createDraftGraph(),
      new Date(),
      { projectId: project.id, environmentId: environment.id },
    );
    const defaultSettings = settingsService.defaultWorkflowSettings(workflow, {
      randomizeIdentity: true,
    });
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

  const deps: CommandDeps = {
    context,
    repository,
    scheduleRepository,
    operationsRepository,
    evidenceRepository,
    runner,
    runManager,
    identityRepository,
    settingsService,
    packageService,
    projectPackageService,
    recorderSessionManager,
    recordingDraftCommands,
    projectCascades,

    requireProject,
    ensureDefaultProject,
    requireProjectEnvironment,
    ensureDefaultProjectEnvironment,
    requireWorkflow,
    getSettings,
    saveSettings,
    createWorkflow,
    getWorkflowGraph,
    activeRunConflict,
    schedulerConflictReason,
    assertWorkflowDeletionAllowed,
    rotateBrowserIdentity,
    duplicateBrowserProfileLaunch,
    remapCallSubflowIds,
    referencedSubflowsForWorkflowGraph,
    graphContextForWorkflow,
  };

  const workflowCommands = createWorkflowCommands(deps);
  const projectCommands = createProjectCommands(deps);
  const subflowCommands = createSubflowCommands(deps);
  const packageCommands = createPackageCommands(deps);
  const recordingCommands = createRecordingCommands(deps);
  const settingsCommands = createSettingsCommands(deps);

  return {
    ...projectCommands,
    ...subflowCommands,
    ...workflowCommands,
    ...settingsCommands,
    ...packageCommands,
    ...recordingCommands,
    ...createScheduleCommandHandlers({
      scheduleRepository,
      requireWorkflow,
      validateWorkflowRun: workflowCommands._validateWorkflowRun,
      schedulerConflictReason,
      startWorkflowRun: workflowCommands._startWorkflowRun,
    }),
  };
}
