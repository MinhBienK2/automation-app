import type { DatabaseSync } from "node:sqlite";
import type { AppPaths } from "../persistence/database.js";
import type { BrowserDriver } from "../browser/sessionManager.js";
import type { RunnerCommandPort } from "../runtime/runManager.js";
import type {
  WorkflowPackage,
  ProjectPackage,
  WorkflowSummary,
  Project,
  WorkflowSettings,
  WorkflowGraph,
  Workflow,
  WorkflowCreateOptions,
  ProjectEnvironment,
  Subflow,
} from "../../../src/types/workflow.js";
import { WorkflowRepository } from "../persistence/workflowRepository.js";
import { WorkflowScheduleRepository } from "../scheduling/workflowScheduleRepository.js";
import { OperationsRepository } from "../operations/operationsRepository.js";
import { EvidenceRepository } from "../evidence/evidenceRepository.js";
import { RunManager } from "../runtime/runManager.js";
import { IdentityRepository } from "../identity/identityRepository.js";
import { WorkflowSettingsService } from "../services/workflowSettingsService.js";
import { WorkflowPackageService } from "../services/workflowPackageService.js";
import { ProjectPackageService } from "../services/projectPackageService.js";
import { RecorderSessionManager } from "../recording/recorderSessionManager.js";
import { createRecordingDraftCommands } from "../recording/recordingDraftCommands.js";
import { createProjectCommandCascades } from "../projects/projectCommandCascades.js";

export type CommandContext = {
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

export type CommandDeps = {
  context: CommandContext;
  repository: WorkflowRepository;
  scheduleRepository: WorkflowScheduleRepository;
  operationsRepository: OperationsRepository;
  evidenceRepository: EvidenceRepository;
  runner: RunnerCommandPort;
  runManager: RunManager;
  identityRepository: IdentityRepository;
  settingsService: WorkflowSettingsService;
  packageService: WorkflowPackageService;
  projectPackageService: ProjectPackageService;
  recorderSessionManager: RecorderSessionManager;
  recordingDraftCommands: ReturnType<typeof createRecordingDraftCommands>;
  projectCascades: ReturnType<typeof createProjectCommandCascades>;

  // Common helper functions shared from orchestrator
  requireProject: (projectId: string) => Project;
  ensureDefaultProject: () => Project;
  requireProjectEnvironment: (environmentId: string) => ProjectEnvironment;
  ensureDefaultProjectEnvironment: (project: Project) => ProjectEnvironment;
  requireWorkflow: (workflowId: string) => WorkflowSummary;
  getSettings: (workflowId: string) => WorkflowSettings;
  saveSettings: (workflowId: string, settings: WorkflowSettings) => WorkflowSettings;
  createWorkflow: (name: string, options?: WorkflowCreateOptions) => Workflow;
  getWorkflowGraph: (workflowId: string) => WorkflowGraph;
  activeRunConflict: (workflowId: string, settings: WorkflowSettings) => { message: string; field: string } | null;
  schedulerConflictReason: (workflowId: string) => string | null;
  assertWorkflowDeletionAllowed: (workflowId: string, settings: WorkflowSettings) => void;
  rotateBrowserIdentity: (workflowId: string) => WorkflowSettings;
  duplicateBrowserProfileLaunch: (
    browserLaunch: WorkflowSettings["browser_launch"],
    exceptWorkflowId?: string,
  ) => WorkflowSettings["browser_launch"];
  remapCallSubflowIds: (graph: WorkflowGraph, subflowIdMap: Map<string, string>) => WorkflowGraph;
  referencedSubflowsForWorkflowGraph: (workflow: WorkflowSummary, graph: WorkflowGraph) => Subflow[];
  graphContextForWorkflow: (workflow: WorkflowSummary) => {
    projectId: string | null;
    workflowLabel: string;
    resolveSubflow(subflowId: string): { id: string; project_id: string; name: string; graph: WorkflowGraph } | null;
  };
};
