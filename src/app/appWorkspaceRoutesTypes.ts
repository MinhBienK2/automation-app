import type { ReactNode } from "react";
import type {
  BrowserProfile,
  DesktopTarget,
  GraphValidationIssue,
  IdentityLabOverview,
  IdentityLabTarget,
  OperationsNavigationTarget,
  Project,
  ProjectCollection,
  ProjectPackage,
  ProjectPackagePreview,
  ProjectStats,
  RunState,
  Schedule,
  ScheduleEvent,
  VariableAssignment,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowPackagePreview,
  WorkflowPackageSection,
  WorkflowRunFromSelectedMode,
  WorkflowRunSnapshot,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../types/workflow";
import type { AppScreen } from "../shared/types/workspaceContracts";
import type { ThemePreferences } from "./useThemePreferences";
import { OperationsOverviewPage } from "../features/overview/pages/OperationsOverviewPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { SettingsHelpPage } from "../features/settings/pages/SettingsHelpPage";
import { SchedulesPage } from "../features/schedules/pages/SchedulesPage";
import { AdminPanel } from "../features/auth/pages/AdminPanel";
import { AdminBackupsPanel } from "../features/auth/pages/AdminBackupsPanel";
import { SubflowDetailPage } from "../features/workflows/pages/SubflowDetailPage";
import { ProjectsWorkspaceContainer } from "../features/projects/containers/ProjectsWorkspaceContainer";
import { WorkflowDetailWorkspaceContainer } from "../features/workflows/containers/WorkflowDetailWorkspaceContainer";
import { WorkflowSettingsDialog } from "../features/workflows/components/dialogs/WorkflowSettingsDialog";
import { UnsavedChangesDialog } from "../components/ui/unsaved-changes-dialog";
import { isRouteAllowed } from "./routePermissions";
import { createSubflow, getSubflowGraph, saveSubflowGraph, setWorkflowDesktopTarget } from "../lib/api/workflowApi";
import { commandMessage } from "../lib/workflowUi";
import { cloneWorkflowSettings, graphSaveStatusLabel } from "../lib/appState";

export type AppWorkspaceRoutesProps = {
  nav: unknown;
  auth: unknown;
  appError: string;
  setAppError: (error: string) => void;
  showToast: (message: string) => void;
  operationsOverview: unknown;
  operationsOverviewLoading: boolean;
  loadOperationsOverview: () => Promise<void>;
  navigateFromOverview: (target: OperationsNavigationTarget) => void;
  graphAutosaveEnabled: boolean;
  graphAutosaveDelayMs: number;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
  onGraphAutosaveDelayMsChange: (delay: number) => void;
  setGraphSaveStatus: (status: unknown) => void;
  settingsDiagnostics: unknown;
  settingsDiagnosticsLoading: boolean;
  settingsDiagnosticsError: string;
  settingsMaintenanceMessage: string;
  loadSettingsDiagnostics: () => Promise<void>;
  installSettingsBrowserBinary: () => Promise<void>;
  cleanupSettingsBrowserProfiles: () => Promise<void>;
  themePreferences: ThemePreferences;
  schedules: Schedule[];
  schedulesLoading: boolean;
  focusedScheduleId: string | null;
  scheduleEvents: ScheduleEvent[];
  createScheduleItem: unknown;
  updateScheduleItem: unknown;
  removeSchedule: unknown;
  toggleSchedule: unknown;
  loadScheduleHistory: unknown;
  projectsWorkspace: unknown;
  selectedProject: Project | null;
  projectStats: ProjectStats | null;
  importProjectPackageFile: unknown;
  exportProjectPackageFile: unknown;
  subflowsWorkspace: unknown;
  selectedBrowserProfiles: BrowserProfile[];
  selectedProjectWorkflows: Workflow[];
  identityLabOverview: IdentityLabOverview | null;
  identityLabLoading: boolean;
  identityLabTarget: IdentityLabTarget;
  loadIdentityLabOverview: unknown;
  selectIdentity: unknown;
  openIdentityWorkflowSettings: unknown;
  closeIdentitySession: unknown;
  resetIdentityFromLab: unknown;
  openIdentityTarget: unknown;
  createBrowserProfile: unknown;
  updateBrowserProfile: unknown;
  deleteBrowserProfile: unknown;
  selectedDesktopTargets: DesktopTarget[];
  workflowsWorkspace: unknown;
  settingsWorkspace: unknown;
  runSnapshots: unknown;
  runWorkspace: unknown;
  openExportPackageDialog: unknown;
  importWorkflowPackageFile: unknown;
  recordingWorkspace: unknown;
  packageDialogs: unknown;
  selectedSubflowProjectName: string;
  canSaveSubflowGraph: boolean;
  detailProjectName: string;
  isRunning: boolean;
  canSaveWorkflowGraph: boolean;
  detailRunState: RunState;
  workflowGraph: WorkflowGraph | null;
  graphIssues: GraphValidationIssue[];
  graphIssuesNeedRecheck: boolean;
  profileVariables: VariableAssignment[];
  openDetailWorkflowSettings: unknown;
  detailRunSnapshot: WorkflowRunSnapshot | null;
  graphState: unknown;
  runFromSelectedAvailability: unknown;
  graphSaveStatus: unknown;
  workflowSettings: WorkflowSettings | null;
  workflowSettingsDialogOpen: boolean;
  workflowSettingsActiveSection: WorkflowSettingsSectionId;
  workflowProfileDraftId: string | null;
  workflowSettingsSaveStatuses: Record<string, string>;
  setWorkflowSettingsDialogOpen: unknown;
  setWorkflowProfileDraftId: unknown;
  setWorkflowSettingsSavedSnapshot: unknown;
  setWorkflowSettingsSaveStatuses: unknown;
  graphExitDialogOpen: boolean;
  clearGraphExitNavigation: unknown;
  discardGraphExitChangesAndNavigate: unknown;
  saveGraphExitChangesAndNavigate: unknown;
};

