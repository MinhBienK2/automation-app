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

import type { CommandContext, CommandDeps } from "./types.js";
import { createFeatureHelpers } from "./featureHelpers.js";

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

  // Khởi tạo các helper thông qua Builder
  const helpers = createFeatureHelpers(context, {
    repository,
    runManager,
    settingsService,
  });

  const identityRepository = new IdentityRepository({
    database: context.database,
    workflows: async () => await repository.listWorkflows(),
    settingsForWorkflow: async (workflowId) => await helpers.getSettings(workflowId),
    diagnostics: async () => {
      const list = await repository.listWorkflows();
      return await buildCloakBrowserDiagnostics({
        appPaths: context.appPaths,
        workflows: list,
        settingsForWorkflow: helpers.getSettings,
        lastRunAtForWorkflow: helpers.lastRunAtForWorkflow,
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
    getWorkflowSettings: async (workflowId) => await helpers.getSettings(workflowId),
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
    createWorkflow: helpers.createWorkflow,
    saveWorkflowGraph: async (workflowId, graph) => await repository.saveWorkflowGraph(workflowId, graph),
    saveWorkflowSettings: helpers.saveSettings,
    getWorkflowDetail: async (workflowId) => await repository.getWorkflow(workflowId),
    requireWorkflow: helpers.requireWorkflow,
  });

  const projectCascades = createProjectCommandCascades({
    database: context.database,
    browserProfilesDir: context.appPaths.browserProfilesDir,
    repository,
    projectPackageService,
    requireProject: helpers.requireProject,
    requireBrowserProfile: helpers.requireBrowserProfile,
    ensureDefaultBrowserProfile: helpers.ensureDefaultBrowserProfile,
    createWorkflow: helpers.createWorkflow,
    getSettings: helpers.getSettings,
    saveSettings: helpers.saveSettings,
    assertWorkflowDeletionAllowed: helpers.assertWorkflowDeletionAllowed,
    activeRunConflict: helpers.activeRunConflict,
    retainedSessionActiveFor: (workflowId, profileName) =>
      runManager.retainedSessionActiveFor(workflowId, profileName),
    remapCallSubflowIds: helpers.remapCallSubflowIds,
  });

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
    ...helpers,
  };

  const workflowCommands = createWorkflowCommands(deps);
  const projectCommands = createProjectCommands(deps);
  const subflowCommands = createSubflowCommands(deps);
  const packageCommands = createPackageCommands(deps);
  const recordingCommands = createRecordingCommands(deps);
  const settingsCommands = createSettingsCommands(deps);
  const authCommands = createAuthCommands(context.database);
  const backupCommands = createBackupCommands(deps);
  const operationsCommands = createOperationsCommands(deps);
  const identityCommands = createIdentityCommands(deps);

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
    ensureProjectModelReady: helpers.ensureProjectModelReady,
    getAppConfig() {
      return loadAppConfig(context.appPaths.rootDir);
    },
    saveAppConfig(config: any) {
      saveAppConfig(context.appPaths.rootDir, config);
      return { ok: true };
    },
    ...createScheduleCommandHandlers({
      scheduleRepository,
      requireWorkflow: helpers.requireWorkflow,
      validateWorkflowRun: workflowCommands._validateWorkflowRun,
      schedulerConflictReason: helpers.schedulerConflictReason,
      startWorkflowRun: workflowCommands._startWorkflowRun,
    }),
  };
}
