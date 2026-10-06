import { useState } from "react";
import { useSettingsDiagnostics } from "../features/settings/useSettingsDiagnostics";
import { useOperationsOverviewWorkspace } from "../features/overview/useOperationsOverviewWorkspace";
import { useSchedulesWorkspace } from "../features/schedules/useSchedulesWorkspace";
import { useWorkflowGraphState } from "../features/workflows/state/useWorkflowGraphState";
import { useWorkflowSettingsState } from "../features/workflows/state/useWorkflowSettingsState";
import { useSubflowWorkspace } from "../features/subflows/state/useSubflowWorkspace";
import { useProjectWorkspace } from "../features/projects/state/useProjectWorkspace";
import { useWorkflowWorkspace } from "../features/workflows/state/useWorkflowWorkspace";
import { useWorkflowRunState } from "../features/workflows/state/useWorkflowRunState";
import { useRecordingWorkspace } from "../features/workflows/state/useRecordingWorkspace";
import type { RunState, WorkflowRunSnapshot } from "../types/workflow";
import { initialRunState } from "../lib/workflowUi";

export type UseAppWorkspacesProps = {
  graphAutosaveEnabled: boolean;
  setGraphAutosaveEnabled: (enabled: boolean) => void;
  setAppError: (error: string) => void;
  showToast: (message: string) => void;
  requestGraphExitNavigation: (navigate: () => void | Promise<void>) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setScreen: (screen: string) => void;
  runSnapshots: WorkflowRunSnapshot[];
  setRunSnapshots: React.Dispatch<React.SetStateAction<WorkflowRunSnapshot[]>>;
};

export function useAppWorkspaces(props: UseAppWorkspacesProps) {
  const {
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    setAppError,
    showToast,
    requestGraphExitNavigation,
    setSidebarCollapsed,
    setScreen,
    runSnapshots,
    setRunSnapshots,
  } = props;

  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [activeRunWorkflowName, setActiveRunWorkflowName] = useState<string | null>(null);

  const {
    overview: operationsOverview,
    loading: operationsOverviewLoading,
    loadOperationsOverview,
  } = useOperationsOverviewWorkspace({ setAppError });

  const {
    schedules,
    scheduleEvents,
    focusedScheduleId,
    loading: schedulesLoading,
    setFocusedScheduleId,
    loadSchedules,
    submitCreateSchedule,
    submitUpdateSchedule,
    removeSchedule,
    toggleSchedule,
    loadScheduleHistory,
  } = useSchedulesWorkspace({ setAppError });

  const {
    diagnostics: settingsDiagnostics,
    diagnosticsLoading: settingsDiagnosticsLoading,
    diagnosticsError: settingsDiagnosticsError,
    maintenanceMessage: settingsMaintenanceMessage,
    loadSettingsDiagnostics,
    installSettingsBrowserBinary,
    cleanupSettingsBrowserProfiles,
  } = useSettingsDiagnostics();

  const graphState = useWorkflowGraphState({
    getDetail: () => workflowsWorkspace.detail,
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    setAppError,
    loadWorkflows: () => workflowsWorkspace.loadWorkflows(),
  });

  const settingsWorkspace = useWorkflowSettingsState({
    getDetail: () => workflowsWorkspace.detail,
    setDetail: (detailValue) => workflowsWorkspace.setDetail(detailValue),
    setWorkflows: (workflowList) => workflowsWorkspace.setWorkflows(workflowList),
    getBrowserProfiles: () => projectsWorkspace.browserProfiles,
    setBrowserProfiles: (profiles) => projectsWorkspace.setBrowserProfiles(profiles),
    setSelectedProjectId: (id) => projectsWorkspace.setSelectedProjectId(id),
    loadWorkflows: () => workflowsWorkspace.loadWorkflows(),
    setAppError,
    showToast,
    resolveWorkflowProfileId: (profileId, profiles) => {
      if (profileId && profiles.some((profile) => profile.id === profileId)) {
        return profileId;
      }
      return profiles[0]?.id ?? null;
    },
  });

  const subflowsWorkspace = useSubflowWorkspace({
    setAppError,
    ensureProjectId: () => projectsWorkspace.ensureProjectId(),
    detail: null,
    requestGraphExitNavigation,
    setSidebarCollapsed,
    setScreen: setScreen as never,
    setProjectCollection: (collection) => projectsWorkspace.setProjectCollection(collection),
    openWorkflow: (id) => workflowsWorkspace.openWorkflow(id),
  });

  const projectsWorkspace = useProjectWorkspace({
    setAppError,
    showToast,
    loadWorkflows: () => workflowsWorkspace.loadWorkflows(),
    setSubflows: subflowsWorkspace.setSubflows,
    setSubflowsLoading: subflowsWorkspace.setSubflowsLoading,
  });

  const workflowsWorkspace = useWorkflowWorkspace({
    setAppError,
    showToast,
    requestGraphExitNavigation,
    setSelectedProjectId: (id) => projectsWorkspace.setSelectedProjectId(id),
    currentProjectId: () => projectsWorkspace.currentProjectId(),
    browserProfiles: projectsWorkspace.browserProfiles,
    desktopTargets: projectsWorkspace.desktopTargets,
    setBrowserProfiles: (envs) => projectsWorkspace.setBrowserProfiles(envs),
    loadSubflowsForProject: (id) => subflowsWorkspace.loadSubflowsForProject(id),
    graphAutosaveEnabled,
    setWorkflowGraph: graphState.setWorkflowGraph,
    setWorkflowSettings: settingsWorkspace.setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot: settingsWorkspace.setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsSaveStatuses: settingsWorkspace.setWorkflowSettingsSaveStatuses,
    setWorkflowProfileDraftId: settingsWorkspace.setWorkflowProfileDraftId,
    setWorkflowProfileSavedId: settingsWorkspace.setWorkflowProfileSavedId,
    setSavedGraphRevision: graphState.setSavedGraphRevision,
    setGraphRevision: graphState.setGraphRevision,
    setGraphSaveStatus: graphState.setGraphSaveStatus,
    setGraphIssues: graphState.setGraphIssues,
    setGraphIssuesNeedRecheck: graphState.setGraphIssuesNeedRecheck,
    runSnapshots,
    setRunState,
    setSelectedGraphNodeId: graphState.setSelectedGraphNodeId,
    setSidebarCollapsed,
    setScreen: setScreen as never,
    setProjectCollection: (coll) => projectsWorkspace.setProjectCollection(coll),
    ensureProjectId: () => projectsWorkspace.ensureProjectId(),
  });

  const runWorkspace = useWorkflowRunState({
    detail: workflowsWorkspace.detail,
    workflowGraph: graphState.workflowGraph,
    selectedGraphNodeId: graphState.selectedGraphNodeId,
    selectedWorkflowId: workflowsWorkspace.selectedWorkflowId,
    setAppError,
    loadOperationsOverview,
    persistCurrentGraph: () => graphState.persistCurrentGraph(),
    persistDirtyWorkflowSettings: () =>
      settingsWorkspace
        .saveWorkflowSettingsAndClose()
        .then(() => true)
        .catch(() => false),
    setGraphIssues: graphState.setGraphIssues,
    setGraphIssuesNeedRecheck: graphState.setGraphIssuesNeedRecheck,
    runState,
    activeRunWorkflowName,
    setRunState,
    runSnapshots,
    setRunSnapshots,
    setActiveRunWorkflowName,
  });

  const recordingWorkspace = useRecordingWorkspace({
    setAppError,
    loadWorkflows: workflowsWorkspace.loadWorkflows,
    openWorkflow: workflowsWorkspace.openWorkflow,
  });

  return {
    runState,
    setRunState,
    activeRunWorkflowName,
    operationsOverview,
    operationsOverviewLoading,
    loadOperationsOverview,
    schedules,
    scheduleEvents,
    focusedScheduleId,
    schedulesLoading,
    setFocusedScheduleId,
    loadSchedules,
    submitCreateSchedule,
    submitUpdateSchedule,
    removeSchedule,
    toggleSchedule,
    loadScheduleHistory,
    settingsDiagnostics,
    settingsDiagnosticsLoading,
    settingsDiagnosticsError,
    settingsMaintenanceMessage,
    loadSettingsDiagnostics,
    installSettingsBrowserBinary,
    cleanupSettingsBrowserProfiles,
    graphState,
    settingsWorkspace,
    subflowsWorkspace,
    projectsWorkspace,
    workflowsWorkspace,
    runWorkspace,
    recordingWorkspace,
  };
}
