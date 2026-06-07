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
  OperationalRunDetail,
  OperationsOverview,
  OperationsOverviewRequest,
  EvidenceBundleExportRequest,
  EvidenceBundleExportResult,
  EvidenceDetail,
  EvidenceListRequest,
  EvidencePage,
  EvidenceScreenshotPreview,
  IdentityLabDetail,
  IdentityLabOverview,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
  RunState,
  RunValidationIssue,
  ScheduleValidationIssue,
  SettingsValidationIssue,
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
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleUpdate,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
  Subflow,
  SubflowSummary,
  SubflowUsage,
} from "./workflow.js";

export type WorkflowElectronBridge = {
  listProjects(): Promise<Project[]>;
  createProject(input: { name: string; description?: string | null }): Promise<Project>;
  listProjectEnvironments(projectId: string): Promise<ProjectEnvironment[]>;
  createProjectEnvironment(
    projectId: string,
    input: ProjectEnvironmentInput,
  ): Promise<ProjectEnvironment>;
  updateProjectEnvironment(
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
  ): Promise<ProjectEnvironment>;
  resetProjectEnvironmentBrowserIdentity(
    environmentId: string,
  ): Promise<ProjectEnvironment>;
  setWorkflowEnvironment(workflowId: string, environmentId: string): Promise<Workflow>;
  createSubflow(
    projectId: string,
    input: { name: string; description?: string | null },
  ): Promise<Subflow>;
  listSubflows(projectId: string): Promise<SubflowSummary[]>;
  getSubflow(subflowId: string): Promise<Subflow>;
  getSubflowGraph(subflowId: string): Promise<WorkflowGraph>;
  saveSubflowGraph(subflowId: string, graph: WorkflowGraph): Promise<void>;
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
  saveWorkflowGraph(workflowId: string, graph: WorkflowGraph): Promise<void>;
  validateWorkflowGraph(graph: WorkflowGraph): Promise<GraphValidationIssue[]>;
  compileWorkflowGraph(graph: WorkflowGraph): Promise<CompiledWorkflowGraph>;
  runWorkflow(workflowId: string): Promise<WorkflowRunSnapshot>;
  runWorkflowFromNode(workflowId: string, startNodeId: string): Promise<WorkflowRunSnapshot>;
  stopRun(runId?: string | null): Promise<WorkflowRunSnapshot>;
  getRunState(): Promise<RunState>;
  listRunStates(): Promise<WorkflowRunSnapshot[]>;
  getOperationsOverview(
    request: OperationsOverviewRequest,
  ): Promise<OperationsOverview>;
  getOperationalRunDetail(runId: string): Promise<OperationalRunDetail>;
  listEvidenceItems(request?: EvidenceListRequest): Promise<EvidencePage>;
  getEvidenceDetail(evidenceId: string): Promise<EvidenceDetail>;
  getEvidenceScreenshotPreview(
    evidenceId: string,
  ): Promise<EvidenceScreenshotPreview>;
  revealEvidenceArtifact(evidenceId: string): Promise<void>;
  exportEvidenceBundle(
    request: EvidenceBundleExportRequest,
  ): Promise<EvidenceBundleExportResult>;
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
};

declare global {
  interface Window {
    workflowApi?: WorkflowElectronBridge;
  }
}
