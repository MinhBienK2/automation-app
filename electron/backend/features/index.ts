import { migrateWorkflowGraph } from "../graph/migration.js";
import { validateWorkflowGraph as validateGraph } from "../graph/compiler.js";
import { BrowserWorkflowRunner } from "../runtime/runner.js";
import { createScheduleCommandHandlers } from "./scheduling/scheduleCommands.js";
import { RunManager } from "../runtime/runManager.js";
import { IdentityRepository } from "./identities/identityRepository.js";
import { createProjectCommandCascades } from "./projects/projectCommandCascades.js";
import { ProjectPackageService } from "./projects/projectPackageService.js";
import { WorkflowPackageService } from "./workflows/workflowPackageService.js";
import { WorkflowRepository } from "./workflows/workflowRepository.js";
import { WorkflowScheduleRepository } from "./scheduling/workflowScheduleRepository.js";
import { OperationsRepository } from "./operations/operationsRepository.js";
import { WorkflowSettingsService } from "./workflows/workflowSettingsService.js";
import { BrowserSessionManager } from "../browser/sessionManager.js";
import { RecorderSessionManager } from "./recording/recorderSessionManager.js";
import { createRecordingDraftCommands } from "./recording/recordingDraftCommands.js";
import {
  buildCloakBrowserDiagnostics,
  directoryReadable,
  isOptionalModuleAvailable,
  resolveDefaultFingerprintFontsDir,
} from "../diagnostics/cloakBrowserDiagnostics.js";

import type { CommandContext } from "./types.js";
import { createProjectBootstrapHelpers } from "./projectBootstrapHelpers.js";
import { createSettingsLifecycleHelpers } from "./settingsLifecycleHelpers.js";
import { createIdentityRotationHelpers } from "./identityRotationHelpers.js";
import { createGraphHelpers } from "./graphHelpers.js";
import { createRunGuardsHelpers } from "./runGuardsHelpers.js";

import { createWorkflowCommands } from "./workflows/workflowCommands.js";
import { createProjectCommands } from "./projects/projectCommands.js";
import { createSubflowCommands } from "./workflows/subflowCommands.js";
import { createPackageCommands } from "./workflows/packageCommands.js";
import { createRecordingCommands } from "./recording/recordingCommands.js";
import { createSettingsCommands } from "./settings/settingsCommands.js";
import { createAuthCommands } from "./auth/authCommands.js";
import { createBackupCommands } from "./settings/backupCommands.js";
import { createOperationsCommands } from "./operations/operationsCommands.js";
import { createIdentityCommands } from "./identities/identityCommands.js";
import { loadAppConfig, saveAppConfig } from "../config/appConfig.js";

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

  const settingsService = new WorkflowSettingsService({
    directoryReadable,
    isOptionalModuleAvailable,
    defaultFingerprintFontsDir: () => resolveDefaultFingerprintFontsDir(context.defaultFingerprintFontsDir),
  });

  // Domain-scoped helper factories
  const projectBootstrap = createProjectBootstrapHelpers(context, {
    repository,
    runManager,
    settingsService,
  });
  const settingsLifecycle = createSettingsLifecycleHelpers({
    repository,
    runManager,
    settingsService,
  });
  const identityRotation = createIdentityRotationHelpers({
    repository,
    runManager,
    getSettings: settingsLifecycle.getSettings,
    saveSettings: settingsLifecycle.saveSettings,
  });
  const graphHelpers = createGraphHelpers({
    repository,
    requireWorkflow: settingsLifecycle.requireWorkflow,
  });
  const runGuards = createRunGuardsHelpers({
    database: context.database,
    runManager,
    getSettings: settingsLifecycle.getSettings,
  });

  const identityRepository = new IdentityRepository({
    database: context.database,
    workflows: async () => await repository.listWorkflows(),
    settingsForWorkflow: async (workflowId) => await settingsLifecycle.getSettings(workflowId),
    diagnostics: async () => {
      const list = await repository.listWorkflows();
      return await buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: list,
        settingsForWorkflow: settingsLifecycle.getSettings,
        lastRunAtForWorkflow: runGuards.lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
    },
    runner,
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
    getWorkflowSettings: async (workflowId) => await settingsLifecycle.getSettings(workflowId),
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
    createWorkflow: projectBootstrap.createWorkflow,
    saveWorkflowGraph: async (workflowId, graph) => await repository.saveWorkflowGraph(workflowId, graph),
    saveWorkflowSettings: settingsLifecycle.saveSettings,
    getWorkflowDetail: async (workflowId) => await repository.getWorkflow(workflowId),
    requireWorkflow: settingsLifecycle.requireWorkflow,
  });

  const projectCascades = createProjectCommandCascades({
    database: context.database,
    browserProfilesDir: context.appPaths.browserProfilesDir,
    repository,
    projectPackageService,
    requireProject: projectBootstrap.requireProject,
    requireBrowserProfile: projectBootstrap.requireBrowserProfile,
    ensureDefaultBrowserProfile: projectBootstrap.ensureDefaultBrowserProfile,
    createWorkflow: projectBootstrap.createWorkflow,
    getSettings: settingsLifecycle.getSettings,
    saveSettings: settingsLifecycle.saveSettings,
    assertWorkflowDeletionAllowed: runGuards.assertWorkflowDeletionAllowed,
    activeRunConflict: runGuards.activeRunConflict,
    retainedSessionActiveFor: (workflowId, profileName) =>
      runManager.retainedSessionActiveFor(workflowId, profileName),
    remapCallSubflowIds: graphHelpers.remapCallSubflowIds,
  });

  const workflowCommands = createWorkflowCommands({
    context,
    repository,
    settingsService,
    runManager,
    runner,
    operationsRepository,
    requireWorkflow: settingsLifecycle.requireWorkflow,
    getSettings: settingsLifecycle.getSettings,
    saveSettings: settingsLifecycle.saveSettings,
    createWorkflow: projectBootstrap.createWorkflow,
    getWorkflowGraph: graphHelpers.getWorkflowGraph,
    activeRunConflict: runGuards.activeRunConflict,
    assertWorkflowDeletionAllowed: runGuards.assertWorkflowDeletionAllowed,
    graphContextForWorkflow: graphHelpers.graphContextForWorkflow,
  });

  const projectCommands = createProjectCommands({
    context,
    repository,
    settingsService,
    projectCascades,
    requireProject: projectBootstrap.requireProject,
    requireBrowserProfile: projectBootstrap.requireBrowserProfile,
    requireWorkflow: settingsLifecycle.requireWorkflow,
  });

  const subflowCommands = createSubflowCommands({
    context,
    repository,
    requireProject: projectBootstrap.requireProject,
  });

  const packageCommands = createPackageCommands({
    context,
    repository,
    packageService,
    projectPackageService,
    projectCascades,
    requireProject: projectBootstrap.requireProject,
    ensureDefaultProject: projectBootstrap.ensureDefaultProject,
    createWorkflow: projectBootstrap.createWorkflow,
    requireWorkflow: settingsLifecycle.requireWorkflow,
    getSettings: settingsLifecycle.getSettings,
    saveSettings: settingsLifecycle.saveSettings,
    getWorkflowGraph: graphHelpers.getWorkflowGraph,
    referencedSubflowsForWorkflowGraph: graphHelpers.referencedSubflowsForWorkflowGraph,
    remapCallSubflowIds: graphHelpers.remapCallSubflowIds,
    duplicateBrowserProfileLaunch: identityRotation.duplicateBrowserProfileLaunch,
  });

  const recordingCommands = createRecordingCommands({
    recorderSessionManager,
    recordingDraftCommands,
    activeRunConflict: runGuards.activeRunConflict,
    getSettings: settingsLifecycle.getSettings,
  });

  const settingsCommands = createSettingsCommands({
    context,
    repository,
    settingsService,
    runManager,
    requireWorkflow: settingsLifecycle.requireWorkflow,
    getSettings: settingsLifecycle.getSettings,
    saveSettings: settingsLifecycle.saveSettings,
    rotateBrowserIdentity: identityRotation.rotateBrowserIdentity,
  });

  const authCommands = createAuthCommands(context.database);

  const backupCommands = createBackupCommands({ context });

  const operationsCommands = createOperationsCommands({ operationsRepository, runManager });

  const identityCommands = createIdentityCommands({
    identityRepository,
    runner,
    getSettings: settingsLifecycle.getSettings,
    activeRunConflict: runGuards.activeRunConflict,
  });

  // Expose internal run entry points under non-underscore names for the scheduler wiring.
  const {
    _startWorkflowRun: startWorkflowRun,
    _validateWorkflowRun: validateWorkflowRun,
  } = workflowCommands;

  return {
    ...projectCommands,
    ...subflowCommands,
    ...workflowCommands,
    ...settingsCommands,
    ...packageCommands,
    ...recordingCommands,
    ...authCommands,
    ...backupCommands,
    ...operationsCommands,
    ...identityCommands,
    ensureProjectModelReady: projectBootstrap.ensureProjectModelReady,
    getAppConfig() {
      return loadAppConfig(context.appPaths.rootDir);
    },
    saveAppConfig(config: any) {
      saveAppConfig(context.appPaths.rootDir, config);
      return { ok: true };
    },
    ...createScheduleCommandHandlers({
      scheduleRepository,
      requireWorkflow: settingsLifecycle.requireWorkflow,
      validateWorkflowRun,
      schedulerConflictReason: runGuards.schedulerConflictReason,
      startWorkflowRun,
    }),
  };
}
