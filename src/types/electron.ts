import type {
  ActionConfig,
  BatchRunRequest,
  BatchRunSummary,
  CompiledWorkflowGraph,
  ElementSnapshot,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordedEvent,
  RunState,
  RunValidationIssue,
  SelectorCandidate,
  SettingsValidationIssue,
  BrowserProfileCleanupResult,
  CloakBrowserDiagnostics,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowDetail,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
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
  deleteWorkflow(id: string): Promise<void>;
  duplicateWorkflow(workflowId: string, name: string): Promise<WorkflowDetail>;
  getWorkflowGraph(workflowId: string): Promise<WorkflowGraph>;
  saveWorkflowGraph(workflowId: string, graph: WorkflowGraph): Promise<void>;
  validateWorkflowGraph(graph: WorkflowGraph): Promise<GraphValidationIssue[]>;
  compileWorkflowGraph(graph: WorkflowGraph): Promise<CompiledWorkflowGraph>;
  runWorkflow(workflowId: string): Promise<RunState>;
  runWorkflowFromNode(workflowId: string, startNodeId: string): Promise<RunState>;
  stopRun(): Promise<RunState>;
  getRunState(): Promise<RunState>;
  validateSchedule(
    schedule: OrchestrationSchedule,
  ): Promise<OrchestrationSchedule>;
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
  suggestSelectors(snapshot: ElementSnapshot): Promise<SelectorCandidate[]>;
  normalizeRecordedEvents(events: RecordedEvent[]): Promise<ActionConfig[]>;
  dryRunValidateConfig(config: ActionConfig): Promise<void>;
  saveWorkflowPackageFile(packageValue: WorkflowPackage): Promise<string | null>;
};

declare global {
  interface Window {
    workflowApi?: WorkflowElectronBridge;
  }
}
