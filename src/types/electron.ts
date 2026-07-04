import type {
  ActionConfig,
  BatchRunRequest,
  BatchRunSummary,
  CompiledWorkflowGraph,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordingGenerateDraftOptions,
  RecordingSaveDraftInput,
  RecorderStartSessionInput,
  RecordingEvent,
  RecordingSession,
  RecordingWorkflowDraft,
  OperationsOverview,
  OperationsOverviewRequest,

  IdentityLabDetail,
  IdentityLabOverview,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
  RunState,
  RunValidationIssue,
  ScheduleValidationIssue,
  SettingsValidationIssue,
  BrowserProfile,
  BrowserProfileInput,
  BrowserProfileCleanupResult,
  CloakBrowserDiagnostics,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowCreateOptions,
  WorkflowDeleteOptions,
  WorkflowDetail,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
  ProjectPackage,
  ProjectPackagePreview,
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleUpdate,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  RevisionSummary,
  RevisionDetail,
  RestoreResult,
  WorkflowSummary,
  Project,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  SubflowExport,
} from "./workflow.js";

export type WorkflowElectronBridge = {
  listProjects(): Promise<Project[]>;
  createProject(input: { name: string; description?: string | null }): Promise<Project>;
  updateProject(
    projectId: string,
    input: { name?: string; description?: string | null },
  ): Promise<Project>;
  duplicateProject(projectId: string): Promise<Project>;
  exportProjectPackage(projectId: string): Promise<ProjectPackage>;
  previewProjectPackage(
    packageValue: ProjectPackage,
  ): Promise<ProjectPackagePreview>;
  importProjectPackage(packageValue: ProjectPackage): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  listBrowserProfiles(projectId: string): Promise<BrowserProfile[]>;
  createBrowserProfile(
    projectId: string,
    input: BrowserProfileInput,
  ): Promise<BrowserProfile>;
  updateBrowserProfile(
    profileId: string,
    input: Partial<BrowserProfileInput>,
  ): Promise<BrowserProfile>;
  deleteBrowserProfile(profileId: string): Promise<void>;
  setWorkflowBrowserProfile(
    workflowId: string,
    profileId: string,
  ): Promise<Workflow>;
  resetBrowserProfileIdentity(
    profileId: string,
  ): Promise<BrowserProfile>;
  createSubflow(
    projectId: string,
    input: { name: string; description?: string | null },
  ): Promise<Subflow>;
  listSubflows(projectId: string): Promise<SubflowSummary[]>;
  getSubflow(subflowId: string): Promise<Subflow>;
  updateSubflow(
    subflowId: string,
    input: { name?: string; description?: string | null },
  ): Promise<Subflow>;
  getSubflowGraph(subflowId: string): Promise<WorkflowGraph>;
  saveSubflowGraph(subflowId: string, graph: WorkflowGraph, options?: { comment?: string; tag?: string }): Promise<void>;
  duplicateSubflow(subflowId: string, name: string): Promise<Subflow>;
  deleteSubflow(subflowId: string): Promise<void>;
  getSubflowUsage(subflowId: string): Promise<SubflowUsage[]>;
  listWorkflows(): Promise<WorkflowSummary[]>;
  getWorkflow(id: string): Promise<WorkflowDetail | null>;
  getWorkflowBrowserConfig(workflowId: string): Promise<WorkflowBrowserConfig>;
  saveWorkflowBrowserConfig(
    workflowId: string,
    config: WorkflowBrowserConfig,
  ): Promise<void>;
  getWorkflowSettings(workflowId: string): Promise<WorkflowSettings>;
  resetWorkflowBrowserIdentity(workflowId: string): Promise<WorkflowSettings>;
  saveWorkflowSettings(
    workflowId: string,
    settings: WorkflowSettings,
  ): Promise<WorkflowSettings>;
  saveWorkflowSettingsSection<Section extends WorkflowSettingsSectionId>(
    workflowId: string,
    section: Section,
    sectionValue: WorkflowSettings[Section],
  ): Promise<WorkflowSettings>;
  validateWorkflowSettings(
    settings: WorkflowSettings,
  ): Promise<SettingsValidationIssue[]>;
  getCloakBrowserDiagnostics(): Promise<CloakBrowserDiagnostics>;
  installCloakBrowserBinary(): Promise<CloakBrowserDiagnostics>;
  cleanupOrphanedBrowserProfiles(): Promise<BrowserProfileCleanupResult>;
  validateWorkflowRun(workflowId: string): Promise<RunValidationIssue[]>;
  createWorkflow(name: string, options?: WorkflowCreateOptions): Promise<Workflow>;
  renameWorkflow(id: string, name: string): Promise<void>;
  deleteWorkflow(id: string, options?: WorkflowDeleteOptions): Promise<void>;
  duplicateWorkflow(workflowId: string, name: string): Promise<WorkflowDetail>;
  getWorkflowGraph(workflowId: string): Promise<WorkflowGraph>;
  saveWorkflowGraph(workflowId: string, graph: WorkflowGraph, options?: { comment?: string; tag?: string }): Promise<void>;
  validateWorkflowGraph(graph: WorkflowGraph): Promise<GraphValidationIssue[]>;
  compileWorkflowGraph(graph: WorkflowGraph): Promise<CompiledWorkflowGraph>;
  runWorkflow(workflowId: string): Promise<WorkflowRunSnapshot>;
  runWorkflowFromNode(
    workflowId: string,
    startNodeId: string,
    mode?: "selected_only" | "from_selected",
  ): Promise<WorkflowRunSnapshot>;
  stopRun(runId?: string | null): Promise<WorkflowRunSnapshot>;
  getRunState(): Promise<RunState>;
  listRunStates(): Promise<WorkflowRunSnapshot[]>;
  getOperationsOverview(
    request: OperationsOverviewRequest,
  ): Promise<OperationsOverview>;

  getIdentityLabOverview(
    request?: IdentityLabOverviewRequest,
  ): Promise<IdentityLabOverview>;
  getIdentityLabDetail(target: IdentityLabTarget): Promise<IdentityLabDetail>;
  closeIdentityRetainedSession(
    workflowId: string,
    profileName: string,
  ): Promise<void>;
  listSchedules(): Promise<WorkflowSchedule[]>;
  getSchedule(scheduleId: string): Promise<WorkflowSchedule>;
  createSchedule(input: WorkflowScheduleInput): Promise<WorkflowSchedule>;
  updateSchedule(
    scheduleId: string,
    patch: WorkflowScheduleUpdate,
  ): Promise<WorkflowSchedule>;
  deleteSchedule(scheduleId: string): Promise<void>;
  enableSchedule(scheduleId: string): Promise<WorkflowSchedule>;
  disableSchedule(scheduleId: string): Promise<WorkflowSchedule>;
  listScheduleEvents(
    filter?: WorkflowScheduleEventFilter,
  ): Promise<WorkflowScheduleEvent[]>;
  validateSchedule(
    schedule: OrchestrationSchedule,
  ): Promise<ScheduleValidationIssue[]>;
  exportWorkflow(workflowId: string): Promise<WorkflowExport>;
  importWorkflow(exported: WorkflowExport): Promise<WorkflowDetail>;
  exportWorkflowPackage(
    workflowId: string,
    options: WorkflowPackageExportOptions,
  ): Promise<WorkflowPackage>;
  previewWorkflowPackage(
    packageValue: WorkflowPackage,
  ): Promise<WorkflowPackagePreview>;
  importWorkflowPackage(
    packageValue: WorkflowPackage,
    options: WorkflowPackageImportOptions,
  ): Promise<WorkflowDetail>;
  runBatchWorkflow(
    workflowId: string,
    request: BatchRunRequest,
  ): Promise<BatchRunSummary>;
  startRecordingSession(input: RecorderStartSessionInput): Promise<RecordingSession>;
  getRecordingSession(sessionId: string): Promise<RecordingSession>;
  stopRecordingSession(sessionId: string): Promise<RecordingSession>;
  listRecordingEvents(sessionId: string): Promise<RecordingEvent[]>;
  discardRecordingSession(sessionId: string): Promise<RecordingSession>;
  generateRecordingDraft(
    sessionId: string,
    options: RecordingGenerateDraftOptions,
  ): Promise<RecordingWorkflowDraft>;
  getRecordingDraft(draftId: string): Promise<RecordingWorkflowDraft>;
  saveRecordingDraft(
    draftId: string,
    input: RecordingSaveDraftInput,
  ): Promise<WorkflowDetail>;
  dryRunValidateConfig(config: ActionConfig): Promise<void>;
  saveWorkflowPackageFile(packageValue: WorkflowPackage): Promise<string | null>;
  saveProjectPackageFile(packageValue: ProjectPackage): Promise<string | null>;
  exportSubflow(subflowId: string): Promise<SubflowExport>;
  importSubflow(projectId: string, exported: SubflowExport): Promise<Subflow>;
  saveSubflowPackageFile(packageValue: SubflowExport): Promise<string | null>;

  listWorkflowRevisions(
    workflowId: string,
    options?: { limit?: number; offset?: number; onlyBackups?: boolean },
  ): Promise<RevisionSummary[]>;
  getWorkflowRevision(revisionId: string): Promise<RevisionDetail | null>;
  restoreWorkflowRevision(
    workflowId: string,
    revisionId: string,
    options?: { comment?: string },
  ): Promise<RestoreResult>;
  tagWorkflowRevision(revisionId: string, tag: string): Promise<void>;
  untagWorkflowRevision(revisionId: string): Promise<void>;
  deleteWorkflowRevision(revisionId: string): Promise<void>;
  listSubflowRevisions(
    subflowId: string,
    options?: { limit?: number; offset?: number; onlyBackups?: boolean },
  ): Promise<RevisionSummary[]>;
  getSubflowRevision(revisionId: string): Promise<RevisionDetail | null>;
  restoreSubflowRevision(
    subflowId: string,
    revisionId: string,
    options?: { comment?: string },
  ): Promise<RestoreResult>;
  tagSubflowRevision(revisionId: string, tag: string): Promise<void>;
  untagSubflowRevision(revisionId: string): Promise<void>;
  deleteSubflowRevision(revisionId: string): Promise<void>;

  // Auth & Mode Config
  login(input: { email: string; password: string }): Promise<{ token: string; user: { id: string; email: string; role: "admin" | "user"; created_at: string } }>;
  logout(): Promise<{ ok: boolean }>;
  me(input: { token: string }): Promise<{ id: string; email: string; role: "admin" | "user"; created_at: string } | null>;
  listUsers(): Promise<Array<{ id: string; email: string; role: "admin" | "user"; created_at: string }>>;
  createUser(input: { email: string; password: string; role: "admin" | "user" }): Promise<{ id: string; email: string; role: "admin" | "user"; created_at: string }>;
  deleteUser(input: { id: string }): Promise<{ ok: boolean }>;
  getAppConfig(): Promise<{ mode: "public"; publicDatabaseUrl?: string }>;
  saveAppConfig(config: { mode: "public"; publicDatabaseUrl?: string }): Promise<{ ok: boolean }>;
};

declare global {
  interface Window {
    workflowApi?: WorkflowElectronBridge;
  }
}
