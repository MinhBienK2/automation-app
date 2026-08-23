import type { DbAdapter } from "../db/dbAdapter.js";
import type { AppPaths } from "../db/database.js";
import type { BrowserDriver } from "../browser/sessionManager.js";
import type { RunnerCommandPort } from "../runtime/runManager.js";
import type {
  WorkflowPackage,
  ProjectPackage,
  SubflowExport,
} from "../../../src/types/workflow.js";
import { WorkflowRepository } from "./workflows/workflowRepository.js";
import { OperationsRepository } from "./operations/operationsRepository.js";
import { RunManager } from "../runtime/runManager.js";
import { IdentityRepository } from "./identities/identityRepository.js";
import { WorkflowSettingsService } from "./workflows/workflowSettingsService.js";
import { WorkflowPackageService } from "./workflows/workflowPackageService.js";
import { ProjectPackageService } from "./projects/projectPackageService.js";
import { RecorderSessionManager } from "./recording/recorderSessionManager.js";
import { createRecordingDraftCommands } from "./recording/recordingDraftCommands.js";
import { createProjectCommandCascades } from "./projects/projectCommandCascades.js";

export type CommandContext = {
  appPaths: AppPaths;
  database: DbAdapter;
  runner?: RunnerCommandPort;
  recorderDriver?: BrowserDriver;
  recorderUsesDefaultDriver?: boolean;
  saveWorkflowPackageFile?: (packageValue: WorkflowPackage) => Promise<string | null>;
  saveProjectPackageFile?: (packageValue: ProjectPackage) => Promise<string | null>;
  saveSubflowPackageFile?: (packageValue: SubflowExport) => Promise<string | null>;
  openPath?: (path: string) => Promise<void>;
  defaultFingerprintFontsDir?: string | null | (() => string | null);
};

import type { ProjectBootstrapHelpers } from "./projectBootstrapHelpers.js";
import type { SettingsLifecycleHelpers } from "./settingsLifecycleHelpers.js";
import type { IdentityRotationHelpers } from "./identityRotationHelpers.js";
import type { GraphHelpers } from "./graphHelpers.js";
import type { RunGuardsHelpers } from "./runGuardsHelpers.js";


export type WorkflowCommandsDeps = { context: CommandContext } & {
  repository: WorkflowRepository;
  settingsService: WorkflowSettingsService;
  runManager: RunManager;
  runner: RunnerCommandPort;
  operationsRepository: OperationsRepository;
} & Pick<SettingsLifecycleHelpers, "requireWorkflow" | "getSettings" | "saveSettings"> &
  Pick<ProjectBootstrapHelpers, "createWorkflow"> &
  Pick<GraphHelpers, "getWorkflowGraph" | "graphContextForWorkflow"> &
  Pick<RunGuardsHelpers, "activeRunConflict" | "assertWorkflowDeletionAllowed">;

export type ProjectCommandsDeps = { context: CommandContext } & {
  repository: WorkflowRepository;
  settingsService: WorkflowSettingsService;
  projectCascades: ReturnType<typeof createProjectCommandCascades>;
} & Pick<ProjectBootstrapHelpers, "requireProject" | "requireBrowserProfile"> &
  Pick<SettingsLifecycleHelpers, "requireWorkflow">;

export type SubflowCommandsDeps = { context: CommandContext } & {
  repository: WorkflowRepository;
} & Pick<ProjectBootstrapHelpers, "requireProject">;

export type PackageCommandsDeps = { context: CommandContext } & {
  repository: WorkflowRepository;
  packageService: WorkflowPackageService;
  projectPackageService: ProjectPackageService;
  projectCascades: ReturnType<typeof createProjectCommandCascades>;
} & Pick<ProjectBootstrapHelpers, "requireProject" | "ensureDefaultProject" | "createWorkflow"> &
  Pick<SettingsLifecycleHelpers, "requireWorkflow" | "getSettings" | "saveSettings"> &
  Pick<GraphHelpers, "getWorkflowGraph" | "referencedSubflowsForWorkflowGraph" | "remapCallSubflowIds"> &
  Pick<IdentityRotationHelpers, "duplicateBrowserProfileLaunch">;

export type RecordingCommandsDeps = Pick<SettingsLifecycleHelpers, "getSettings"> &
  Pick<RunGuardsHelpers, "activeRunConflict"> & {
    recorderSessionManager: RecorderSessionManager;
    recordingDraftCommands: ReturnType<typeof createRecordingDraftCommands>;
  };

export type SettingsCommandsDeps = { context: CommandContext } & {
  repository: WorkflowRepository;
  settingsService: WorkflowSettingsService;
  runManager: RunManager;
} & Pick<SettingsLifecycleHelpers, "requireWorkflow" | "getSettings" | "saveSettings"> &
  Pick<IdentityRotationHelpers, "rotateBrowserIdentity">;

export type BackupCommandsDeps = { context: CommandContext };

export type OperationsCommandsDeps = {
  operationsRepository: OperationsRepository;
  runManager: RunManager;
};

export type IdentityCommandsDeps = Pick<SettingsLifecycleHelpers, "getSettings"> &
  Pick<RunGuardsHelpers, "activeRunConflict"> & {
    identityRepository: IdentityRepository;
    runner: RunnerCommandPort;
  };
