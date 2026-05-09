/// <reference types="vite/client" />

import type {
  CompiledWorkflowGraph,
  ElectronRunEvent,
  Environment,
  EnvironmentInput,
  GraphValidationIssue,
  IdentityProfile,
  IdentityProfileAvailability,
  IdentityProfileInput,
  IdentityProfileValidationIssue,
  RunEvidenceArtifact,
  RunEvidenceEvent,
  RunEvidenceExport,
  RunHistoryRecord,
  RunProfile,
  RunProfileInput,
  RunValidationIssue,
  RunState,
  SettingsValidationIssue,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
  WorkspacePolicy,
} from "./types/workflow";

type ElectronCloakBrowserApi = {
  workflows?: {
    list?: () => Promise<WorkflowSummary[]>;
    get?: (input: { id: string }) => Promise<WorkflowDetail | null>;
    create?: (input: { name: string }) => Promise<Workflow>;
    rename?: (input: { id: string; name: string }) => Promise<void>;
    delete?: (input: { id: string }) => Promise<void>;
    duplicate?: (input: { workflowId: string; name: string }) => Promise<WorkflowDetail>;
  };
  settings?: {
    get?: (input: { workflowId: string }) => Promise<WorkflowSettings>;
    save?: (input: {
      workflowId: string;
      settings: WorkflowSettings;
    }) => Promise<WorkflowSettings>;
    saveSection?: <Section extends WorkflowSettingsSectionId>(input: {
      workflowId: string;
      section: Section;
      sectionValue: WorkflowSettings[Section];
    }) => Promise<WorkflowSettings>;
    validate?: (input: { settings: WorkflowSettings }) => Promise<SettingsValidationIssue[]>;
    validateRun?: (input: { workflowId: string }) => Promise<RunValidationIssue[]>;
    getBrowserConfig?: (input: { workflowId: string }) => Promise<WorkflowBrowserConfig>;
    saveBrowserConfig?: (input: {
      workflowId: string;
      config: WorkflowBrowserConfig;
    }) => Promise<WorkflowSettings>;
  };
  graphs?: {
    loadActive?: (input: { workflowId: string }) => Promise<WorkflowGraph>;
    save?: (input: { workflowId: string; graph: WorkflowGraph }) => Promise<void>;
    validate?: (input: { graph: WorkflowGraph }) => Promise<GraphValidationIssue[]>;
    compile?: (input: { graph: WorkflowGraph }) => Promise<CompiledWorkflowGraph>;
  };
  runs?: {
    list?: (input?: { workflowId?: string; limit?: number }) => Promise<RunHistoryRecord[]>;
    start?: (input: { workflowId: string }) => Promise<RunState>;
    stop?: () => Promise<RunState>;
    getState?: () => Promise<RunState>;
    onEvent?: (handler: (event: ElectronRunEvent) => void) => () => void;
  };
  profiles?: {
    list?: () => Promise<IdentityProfile[]>;
    get?: (input: { id: string }) => Promise<IdentityProfile>;
    create?: (input: IdentityProfileInput) => Promise<IdentityProfile>;
    update?: (input: {
      id: string;
      profile: Partial<IdentityProfileInput>;
    }) => Promise<IdentityProfile>;
    delete?: (input: { id: string }) => Promise<void>;
    validate?: (input: {
      profile: IdentityProfile | IdentityProfileInput;
    }) => Promise<IdentityProfileValidationIssue[]>;
    checkAvailability?: (input: { id: string }) => Promise<IdentityProfileAvailability>;
  };
  evidence?: {
    listEvents?: (input: { runId: string }) => Promise<RunEvidenceEvent[]>;
    listArtifacts?: (input: { runId: string }) => Promise<RunEvidenceArtifact[]>;
    exportRun?: (input: { runId: string }) => Promise<RunEvidenceExport>;
    sanitize?: (input: {
      payload: Record<string, unknown>;
    }) => Promise<Record<string, unknown>>;
  };
  policy?: {
    get?: () => Promise<WorkspacePolicy>;
    save?: (policy: WorkspacePolicy) => Promise<WorkspacePolicy>;
  };
  runProfiles?: {
    list?: (input?: { workflowId?: string | null }) => Promise<RunProfile[]>;
    get?: (input: { id: string }) => Promise<RunProfile>;
    create?: (profile: RunProfileInput) => Promise<RunProfile>;
    update?: (input: { id: string; profile: Partial<RunProfileInput> }) => Promise<RunProfile>;
    delete?: (input: { id: string }) => Promise<void>;
  };
  environments?: {
    list?: () => Promise<Environment[]>;
    get?: (input: { id: string }) => Promise<Environment>;
    create?: (environment: EnvironmentInput) => Promise<Environment>;
    update?: (input: {
      id: string;
      environment: Partial<EnvironmentInput>;
    }) => Promise<Environment>;
    delete?: (input: { id: string }) => Promise<void>;
  };
};

declare global {
  interface Window {
    cloakBrowser?: ElectronCloakBrowserApi;
  }
}
