import type {
  Project,
  ProjectEnvironment,
  WorkflowSummary,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
  GraphValidationIssue,
  SubflowSummary,
  Subflow,
  SubflowUsage,
  RunState,
  WorkflowRunSnapshot,
} from "../../types/workflow";
import type {
  GraphSaveStatus,
  WorkflowSettingsSaveStatus,
} from "../../lib/appState";

export type AppScreen = "overview" | "projects" | "detail" | "subflow-detail" | "settings" | "schedules" | "evidence" | "identities";
export type OverviewFocus = "attention" | "recent_evidence" | "live_runs" | null;
export type WorkflowDialogMode = "create" | "edit" | null;
export type SubflowBackTarget =
  | { type: "subflows" }
  | { type: "workflow-detail"; workflowId: string; workflowName: string };

export interface AppNavigationAPI {
  screen: AppScreen;
  sidebarCollapsed: boolean;
  overviewFocus: OverviewFocus;
  setScreen: (screen: AppScreen) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setOverviewFocus: (focus: OverviewFocus) => void;
  openProjects: (collection?: "workflows" | "subflows" | "settings") => void;
  openOverview: (focus?: OverviewFocus) => void;
  openSettings: () => void;
  openSchedules: () => void;
  openEvidence: (nextQuery?: any) => void;
  openIdentities: (target?: any) => void;
  navigateToMissionControlTarget: (target: any) => void;
  backToList: () => void;
  backFromSubflowDetail: () => void;
}

export interface ProjectWorkspaceAPI {
  projects: Project[];
  selectedProjectId: string | null;
  projectCollection: "workflows" | "subflows" | "settings";
  projectEnvironments: ProjectEnvironment[];
  
  setSelectedProjectId: (id: string | null) => void;
  setProjectCollection: (collection: "workflows" | "subflows" | "settings") => void;
  setProjectEnvironments: (environments: ProjectEnvironment[]) => void;
  setProjects: (projects: Project[]) => void;

  loadProjectModel: () => Promise<{ projects: Project[]; environments: ProjectEnvironment[] }>;
  currentProjectId: () => string | null;
  ensureProjectId: () => Promise<string>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (input: { name: string; description?: string | null }) => Promise<void>;
  updateProject: (projectId: string, input: { name?: string; description?: string | null }) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export interface WorkflowWorkspaceAPI {
  workflows: WorkflowSummary[];
  selectedWorkflowId: string | null;
  detail: WorkflowDetail | null;
  workflowDialogMode: WorkflowDialogMode;
  editingWorkflowId: string | null;
  workflowNameDraft: string;
  deleteWorkflowCandidate: WorkflowSummary | null;
  deleteBrowserProfileData: boolean;

  setWorkflows: React.Dispatch<React.SetStateAction<WorkflowSummary[]>>;
  setSelectedWorkflowId: (id: string | null) => void;
  setDetail: React.Dispatch<React.SetStateAction<WorkflowDetail | null>>;
  setWorkflowNameDraft: (name: string) => void;
  setDeleteBrowserProfileData: (deleteData: boolean) => void;
  setDeleteWorkflowCandidate: (candidate: WorkflowSummary | null) => void;

  loadWorkflows: () => Promise<void>;
  openWorkflow: (id: string) => Promise<void>;
  performOpenWorkflow: (id: string) => Promise<void>;
  openCreateWorkflowDialog: () => void;
  openEditWorkflowDialog: (workflow: WorkflowSummary) => void;
  closeWorkflowDialog: () => void;
  submitWorkflowDialog: (event: React.FormEvent) => Promise<void>;
  deleteWorkflow: (id: string) => void;
  confirmDeleteWorkflow: () => Promise<void>;
  cancelDeleteWorkflow: () => void;
  duplicateWorkflow: (workflow: WorkflowSummary) => Promise<void>;
}

export interface WorkflowGraphStateAPI {
  workflowGraph: WorkflowGraph | null;
  graphAutosaveEnabled: boolean;
  graphSaveStatus: GraphSaveStatus;
  graphRevision: number;
  savedGraphRevision: number;
  graphIssues: GraphValidationIssue[];
  selectedGraphNodeId: string | null;

  setWorkflowGraph: (graph: WorkflowGraph | null) => void;
  setGraphAutosaveEnabled: (enabled: boolean) => void;
  setGraphSaveStatus: (status: GraphSaveStatus) => void;
  setGraphRevision: (revision: number | ((curr: number) => number)) => void;
  setSavedGraphRevision: (revision: number | ((curr: number) => number)) => void;
  setGraphIssues: (issues: GraphValidationIssue[]) => void;
  setSelectedGraphNodeId: (nodeId: string | null) => void;

  changeWorkflowGraph: (graph: WorkflowGraph) => void;
  persistCurrentGraph: () => Promise<boolean>;
  validateGraph: () => Promise<void>;
  saveGraph: () => Promise<void>;
}

export interface WorkflowSettingsStateAPI {
  workflowSettings: WorkflowSettings | null;
  workflowSettingsSavedSnapshot: WorkflowSettings | null;
  workflowSettingsDialogOpen: boolean;
  workflowSettingsActiveSection: WorkflowSettingsSectionId;
  workflowSettingsSaveStatuses: Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>;
  workflowProfileDraftId: string | null;
  workflowProfileSavedId: string | null;

  setWorkflowSettings: (settings: WorkflowSettings | null) => void;
  setWorkflowSettingsSavedSnapshot: (settings: WorkflowSettings | null) => void;
  setWorkflowSettingsDialogOpen: (open: boolean) => void;
  setWorkflowSettingsActiveSection: (section: WorkflowSettingsSectionId) => void;
  setWorkflowSettingsSaveStatuses: (statuses: Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>) => void;
  setWorkflowProfileDraftId: (id: string | null) => void;
  setWorkflowProfileSavedId: (id: string | null) => void;

  persistWorkflowSettingsSection: (sectionId: WorkflowSettingsSectionId, settings: WorkflowSettings) => Promise<boolean>;
  changeWorkflowSettings: (settings: WorkflowSettings) => void;
  openWorkflowSettings: (workflow: WorkflowSummary, sectionId?: WorkflowSettingsSectionId) => Promise<void>;
  discardWorkflowSettingsChanges: () => void;
  closeWorkflowSettingsDialog: () => void;
  saveWorkflowSettingsAndClose: () => Promise<void>;
}

export interface WorkflowRunStateAPI {
  runState: RunState;
  runSnapshots: WorkflowRunSnapshot[];
  activeRunWorkflowName: string | null;

  setRunState: (state: RunState | ((curr: RunState) => RunState)) => void;
  setRunSnapshots: (snapshots: WorkflowRunSnapshot[] | ((curr: WorkflowRunSnapshot[]) => WorkflowRunSnapshot[])) => void;
  setActiveRunWorkflowName: (name: string | null) => void;

  refreshRunStates: () => Promise<void>;
  upsertRunSnapshot: (snapshot: WorkflowRunSnapshot | RunState, context?: { workflowId: string; workflowName: string }) => WorkflowRunSnapshot;
  runGraph: () => Promise<void>;
  runSavedWorkflow: (workflow: WorkflowSummary) => Promise<void>;
  runGraphFromSelectedNode: () => Promise<void>;
  stopRun: (runId: string) => Promise<void>;
}

export interface RecordingWorkspaceAPI {
  recordingSession: RecordingSession | null;
  recordingDraft: RecordingWorkflowDraft | null;
  recordingWorkflowName: string;
  recordingBusy: boolean;

  setRecordingSession: (session: RecordingSession | null) => void;
  setRecordingDraft: (draft: RecordingWorkflowDraft | null) => void;
  setRecordingWorkflowName: (name: string) => void;
  setRecordingBusy: (busy: boolean) => void;

  startWorkflowRecording: () => Promise<void>;
  stopWorkflowRecording: () => Promise<void>;
  discardWorkflowRecording: () => Promise<void>;
  updateRecordingStep: (step: ReviewedRecordingStep) => void;
  saveReviewedRecording: (input: { workflow_name: string; add_terminal_success: boolean; save_mode: "create_new" | "replace_graph" }) => Promise<void>;
}

export interface SubflowWorkspaceAPI {
  subflows: SubflowSummary[];
  subflowsLoading: boolean;
  selectedSubflow: Subflow | null;
  selectedSubflowGraph: WorkflowGraph | null;
  selectedSubflowUsage: SubflowUsage[];
  subflowBackTarget: SubflowBackTarget;
  subflowGraphSaveStatus: GraphSaveStatus;

  setSubflows: (subflows: SubflowSummary[]) => void;
  setSubflowsLoading: (loading: boolean) => void;
  setSelectedSubflow: (subflow: Subflow | null) => void;
  setSelectedSubflowGraph: (graph: WorkflowGraph | null) => void;
  setSelectedSubflowUsage: (usage: SubflowUsage[]) => void;
  setSubflowBackTarget: (target: SubflowBackTarget) => void;
  setSubflowGraphSaveStatus: (status: GraphSaveStatus) => void;

  loadSubflowsForProject: (projectId?: string | null) => Promise<SubflowSummary[]>;
  openSubflowDetail: (subflowId: string, backTarget: SubflowBackTarget) => Promise<void>;
  createProjectSubflow: (input: { name: string; description?: string | null }) => Promise<void>;
  updateProjectSubflow: (subflow: SubflowSummary | Subflow, input: { name: string; description?: string | null }) => Promise<void>;
  duplicateProjectSubflow: (subflow: SubflowSummary | Subflow) => Promise<void>;
  deleteProjectSubflow: (subflowId: string) => Promise<void>;
  changeSubflowGraph: (graph: WorkflowGraph) => void;
  saveCurrentSubflowGraph: () => Promise<boolean>;
}
