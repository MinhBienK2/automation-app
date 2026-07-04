import { randomUUID } from "node:crypto";
import { migrateWorkflowGraph } from "../graph/migration.js";
import { validateWorkflowGraph as validateGraph } from "../graph/compiler.js";
import { BrowserWorkflowRunner } from "../runtime/runner.js";
import { createScheduleCommandHandlers } from "../scheduling/scheduleCommands.js";
import { RunManager } from "../runtime/runManager.js";
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
  BrowserProfile,
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
import { createAuthCommands } from "./authCommands.js";
import { loadAppConfig, saveAppConfig } from "../persistence/appConfig.js";

export function createWorkflowCommandHandlers(context: CommandContext) {
  const repository = new WorkflowRepository(context.database);
  const scheduleRepository = new WorkflowScheduleRepository(context.database);
  const operationsRepository = new OperationsRepository(context.database);
  const runner = context.runner ?? new BrowserWorkflowRunner({ appPaths: context.appPaths });
  const recorderBrowserSessionManager = new BrowserSessionManager({
    appPaths: context.appPaths,
    driver: context.recorderDriver,
    usesDefaultDriver: context.recorderUsesDefaultDriver,
  });
  const runManager = new RunManager({ database: context.database, runner });
  const identityRepository = new IdentityRepository({
    database: context.database,
    workflows: async () => await repository.listWorkflows(),
    settingsForWorkflow: async (workflowId) => await getSettings(workflowId),
    diagnostics: async () => {
      const list = await repository.listWorkflows();
      return await buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: list,
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
    },
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
    getWorkflow: async (workflowId) => await repository.getWorkflowSummary(workflowId),
    getWorkflowSettings: async (workflowId) => await getSettings(workflowId),
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
    saveWorkflowGraph: async (workflowId, graph) => await repository.saveWorkflowGraph(workflowId, graph),
    saveWorkflowSettings: saveSettings,
    getWorkflowDetail: async (workflowId) => await repository.getWorkflow(workflowId),
    requireWorkflow,
  });
  const projectCascades = createProjectCommandCascades({
    database: context.database,
    browserProfilesDir: context.appPaths.browserProfilesDir,
    repository,
    projectPackageService,
    requireProject,
    requireBrowserProfile,
    ensureDefaultBrowserProfile,
    createWorkflow,
    getSettings,
    saveSettings,
    assertWorkflowDeletionAllowed,
    activeRunConflict,
    retainedSessionActiveFor: (workflowId, profileName) =>
      runManager.retainedSessionActiveFor(workflowId, profileName),
    remapCallSubflowIds,
  });

  async function ensureProjectModelReady() {
    if (!context.database.ownerId) return;
    await runManager.recoverInterruptedRuns();
    const list = await repository.listProjects();
    const project = list[0];
    if (project) {
      await ensureDefaultBrowserProfile(project);
      const workflows = await repository.listWorkflows();
      for (const workflow of workflows) {
        const projectId = workflow.project_id ?? project.id;
        if (!workflow.project_id) {
          await repository.assignWorkflowProject(workflow.id, projectId);
        }
        const current = await repository.getWorkflowSummary(workflow.id);
        if (!current?.browser_profile_id) {
          const ownerProject = (await repository.getProject(projectId)) ?? project;
          const browserProfile = await ensureDefaultBrowserProfile(ownerProject);
          await repository.assignWorkflowBrowserProfile(workflow.id, browserProfile.id);
        }
      }
    }
  }

  async function ensureDefaultProject(): Promise<Project> {
    const list = await repository.listProjects();
    const existing = list[0];
    if (existing) return existing;
    throw commandError("No projects available. Please create a project first.", "projectId");
  }

  async function ensureDefaultBrowserProfile(project: Project): Promise<BrowserProfile> {
    const existing = await repository.getDefaultBrowserProfile(project.id);
    if (existing) return existing;
    const launchConfig = await defaultProfileBrowserLaunch("Project browser profile");
    return await repository.createBrowserProfile(project.id, {
      name: "Project browser profile",
      description: "Project-owned browser profile with persistent storage and fingerprint identity",
      browser_launch: launchConfig,
      is_default: true,
    });
  }

  async function defaultProfileBrowserLaunch(name: string): Promise<WorkflowSettings["browser_launch"]> {
    const now = new Date().toISOString();
    const defaultSettings = await settingsService.defaultWorkflowSettings(
      {
        id: `profile-${randomUUID()}`,
        name,
        created_at: now,
        updated_at: now,
      },
      { randomizeIdentity: true },
    );
    return defaultSettings.browser_launch;
  }

  async function requireProject(projectId: string): Promise<Project> {
    const project = await repository.getProject(projectId);
    if (!project) throw commandError("Project not found", "projectId");
    return project;
  }

  async function requireBrowserProfile(browserProfileId: string): Promise<BrowserProfile> {
    const browserProfile = await repository.getBrowserProfile(browserProfileId);
    if (!browserProfile) {
      throw commandError("Browser profile not found", "browserProfileId");
    }
    return browserProfile;
  }

  async function graphContextForWorkflow(workflow: WorkflowSummary, graph?: WorkflowGraph) {
    const subflowMap = new Map<string, any>();
    if (graph) {
      const subflowIds = callSubflowIds(graph);
      await Promise.all(
        subflowIds.map(async (subflowId) => {
          const subflow = await repository.getSubflow(subflowId);
          if (subflow) {
            subflowMap.set(subflowId, {
              id: subflow.id,
              project_id: subflow.project_id,
              name: subflow.name,
              graph: migrateWorkflowGraph(subflow.graph),
            });
          }
        })
      );
    }

    return {
      projectId: workflow.project_id ?? null,
      workflowLabel: workflow.name,
      resolveSubflow(subflowId: string) {
        return subflowMap.get(subflowId) ?? null;
      },
    };
  }

  async function referencedSubflowsForWorkflowGraph(
    workflow: WorkflowSummary,
    graph: WorkflowGraph,
  ): Promise<any[]> {
    const projectId = workflow.project_id;
    if (!projectId) return [];
    const referencedIds = callSubflowIds(graph);
    const subflows = [];
    for (const subflowId of referencedIds) {
      const subflow = await repository.getSubflow(subflowId);
      if (!subflow) {
        throw commandError("Workflow references a missing subflow", "workflow.graph");
      }
      if (subflow.project_id !== projectId) {
        throw commandError(
          "Workflow references a subflow outside its project",
          "workflow.graph",
        );
      }
      subflows.push(subflow);
    }
    return subflows;
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

  async function requireWorkflow(workflowId: string): Promise<WorkflowSummary> {
    const workflow = await repository.getWorkflowSummary(workflowId);
    if (!workflow) {
      throw commandError("Workflow not found", "workflowId");
    }
    return workflow;
  }

  async function getSettings(workflowId: string): Promise<WorkflowSettings> {
    const persisted = await repository.getWorkflowSettings(workflowId);
    const workflow = await requireWorkflow(workflowId);
    const normalized = persisted
      ? settingsService.normalizeWorkflowSettings(persisted, workflow)
      : settingsService.defaultWorkflowSettings(workflow);
    const profileId = workflow.browser_profile_id;
    if (!profileId) return normalized;
    const browserProfile = await repository.getBrowserProfile(profileId);
    if (!browserProfile || browserProfile.project_id !== workflow.project_id) return normalized;
    return settingsService.normalizeWorkflowSettings(
      {
        ...normalized,
        browser_launch: browserProfile.browser_launch,
      },
      workflow,
    );
  }

  async function lastRunAtForWorkflow(workflowId: string): Promise<string | null> {
    const row = await context.database.queryOne(
      `SELECT COALESCE(finished_at, started_at) AS last_run_at
       FROM runs
       WHERE workflow_id = $1 AND owner_id = $2
       ORDER BY started_at DESC
       LIMIT 1`,
      [workflowId, context.database.ownerId],
    ) as { last_run_at?: string | null } | null;
    return row?.last_run_at ?? null;
  }

  function activeRunConflict(workflowId: string, settings: WorkflowSettings) {
    return runManager.activeRunConflict(workflowId, settings);
  }

  async function schedulerConflictReason(workflowId: string) {
    const settings = await getSettings(workflowId);
    return activeRunConflict(workflowId, settings)?.reason ?? null;
  }

  async function assertCanChangeBrowserIdentityProfile(
    workflowId: string,
    nextSettings: WorkflowSettings,
  ) {
    const currentSettings = await getSettings(workflowId);
    runManager.assertCanChangeBrowserIdentityProfile(workflowId, currentSettings, nextSettings);
  }

  async function assertWorkflowDeletionAllowed(workflowId: string, settings: WorkflowSettings) {
    runManager.assertWorkflowDeletionAllowed(workflowId, settings);
  }

  async function saveSelectedProfileBrowserLaunch(
    workflow: WorkflowSummary,
    browserLaunch: WorkflowSettings["browser_launch"],
  ) {
    const profileId = workflow.browser_profile_id;
    if (!profileId) return browserLaunch;
    const browserProfile = await repository.getBrowserProfile(profileId);
    if (!browserProfile || browserProfile.project_id !== workflow.project_id) {
      return browserLaunch;
    }
    const updated = await repository.updateBrowserProfile(browserProfile.id, {
      browser_launch: browserLaunch,
    });
    return updated?.browser_launch ?? browserLaunch;
  }

  function assertCanResetBrowserIdentity(workflowId: string, settings: WorkflowSettings) {
    runManager.assertCanResetBrowserIdentity(workflowId, settings);
  }

  async function usedFingerprintSeeds(exceptWorkflowId?: string) {
    const list = await repository.listWorkflows();
    const filtered = list.filter((workflow) => workflow.id !== exceptWorkflowId);
    const seeds = new Set<string>();
    for (const w of filtered) {
      const s = await getSettings(w.id);
      if (s.browser_launch.fingerprint_seed) {
        seeds.add(s.browser_launch.fingerprint_seed);
      }
    }
    return seeds;
  }

  async function usedBrowserProfileFingerprintSeeds(exceptWorkflowId?: string) {
    const seeds = await usedFingerprintSeeds(exceptWorkflowId);
    const projects = await repository.listProjects();
    for (const project of projects) {
      const profiles = await repository.listBrowserProfiles(project.id);
      for (const profile of profiles) {
        const seed = profile.browser_launch.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  async function duplicateBrowserProfileLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
    exceptWorkflowId?: string,
  ): Promise<WorkflowSettings["browser_launch"]> {
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds(exceptWorkflowId);
    return {
      ...browserLaunch,
      identity_id: identityId,
      profile_dir: identityId,
      profile_name:
        browserLaunch.session_mode === "persistent_profile" ? identityId : null,
      fingerprint_seed: deriveFingerprintSeedFromIdentityId(
        identityId,
        seeds,
      ),
    };
  }

  async function rotateBrowserIdentity(workflowId: string): Promise<WorkflowSettings> {
    const settings = await getSettings(workflowId);
    assertCanResetBrowserIdentity(workflowId, settings);
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds(workflowId);
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      seeds,
    );
    const timestamp = new Date().toISOString();
    return await saveSettings(workflowId, {
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

  async function saveSettings(workflowId: string, settings: WorkflowSettings) {
    const workflow = await requireWorkflow(workflowId);
    const activeSettings = settingsService.normalizeWorkflowSettings(settings, workflow);
    await assertCanChangeBrowserIdentityProfile(workflowId, activeSettings);
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

    const browserLaunch = await saveSelectedProfileBrowserLaunch(
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
    await repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  async function createWorkflow(name: string, options: WorkflowCreateOptions = {}): Promise<Workflow> {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const project = options.project_id
      ? await requireProject(options.project_id)
      : await ensureDefaultProject();
    const browserProfile = options.browser_profile_id
      ? await requireBrowserProfile(options.browser_profile_id)
      : await ensureDefaultBrowserProfile(project);
    const workflow = await repository.createWorkflow(
      normalized,
      createDraftGraph(),
      new Date(),
      { projectId: project.id, browserProfileId: browserProfile.id },
    );
    const defaultSettings = settingsService.defaultWorkflowSettings(workflow, {
      randomizeIdentity: true,
    });
    await repository.saveWorkflowSettings(workflow.id, {
      ...defaultSettings,
      browser_launch: browserProfile.browser_launch,
    });
    return {
      ...workflow,
      project_id: project.id,
      browser_profile_id: browserProfile.id,
    };
  }

  async function getWorkflowGraph(workflowId: string): Promise<WorkflowGraph> {
    const graph = await repository.getWorkflowGraph(workflowId);
    if (!graph) {
      await requireWorkflow(workflowId);
      return createDraftGraph();
    }
    const migrated = migrateWorkflowGraph(graph);
    if (JSON.stringify(migrated) !== JSON.stringify(graph)) {
      await repository.saveWorkflowGraph(workflowId, migrated);
    }
    return migrated;
  }

  const deps: CommandDeps = {
    context,
    repository,
    scheduleRepository,
    operationsRepository,
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
    requireBrowserProfile,
    ensureDefaultBrowserProfile,
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
  const authCommands = createAuthCommands(context.database);

  return {
    ...projectCommands,
    ...subflowCommands,
    ...workflowCommands,
    ...settingsCommands,
    ...packageCommands,
    ...recordingCommands,
    ...authCommands,
    ensureProjectModelReady,
    getAppConfig() {
      return loadAppConfig(context.appPaths.rootDir);
    },
    saveAppConfig(config: any) {
      saveAppConfig(context.appPaths.rootDir, config);
      return { ok: true };
    },
    ...createScheduleCommandHandlers({
      scheduleRepository,
      requireWorkflow,
      validateWorkflowRun: workflowCommands._validateWorkflowRun,
      schedulerConflictReason,
      startWorkflowRun: workflowCommands._startWorkflowRun,
    }),
  };
}
