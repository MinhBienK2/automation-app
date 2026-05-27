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
  RunState,
  RunValidationIssue,
  ScheduleValidationIssue,
  SettingsValidationIssue,
  BrowserProfileCleanupResult,
  CloakBrowserDiagnostics,
  Workflow,
  WorkflowBrowserConfig,
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
} from "./workflow.js";

export type WorkflowElectronBridge = {
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
  createWorkflow(name: string): Promise<Workflow>;
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
