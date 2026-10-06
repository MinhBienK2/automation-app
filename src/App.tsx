import { useCallback, useMemo, useRef, useState } from "react";
import { ToastProvider, useToast } from "./components/ui/toast";
import { AppShell } from "./layouts/AppShell";
import { useThemePreferences } from "./app/useThemePreferences";
import {
  listProjects,
  listBrowserProfiles,
  listSubflows,
  getSubflowGraph,
  createSubflow,
  saveSubflowGraph,
  setWorkflowDesktopTarget,
} from "./lib/api/workflowApi";
import {
  commandMessage,
  initialRunState,
} from "./lib/workflowUi";
import {
  graphSaveStatusLabel,
  idleRunStateWithRetainedSession,
  latestRunForWorkflow,
  readGraphAutosaveEnabled,
  writeGraphAutosaveEnabled,
  readGraphAutosaveDelayMs,
  writeGraphAutosaveDelayMs,
  cloneWorkflowSettings,
  operationsTargetToMissionTarget,
  type GraphSaveStatus,
} from "./lib/appState";
import { WorkflowSurfaceProvider } from "./features/workflows/state/WorkflowSurfaceContext";
import {
  useAppPackageDialogs,
  workflowPackageSections,
} from "./app/useAppPackageDialogs";
import type {
  IdentityLabTarget,
  OperationsNavigationTarget,
  RunState,
  WorkflowSettingsSectionId,
  WorkflowRunSnapshot,
} from "./types/workflow";
import "./App.css";

// Import domain state hooks and types
import { useAppNavigation } from "./app/useAppNavigation";
import { useBrowserProfileActions } from "./features/projects/useBrowserProfileActions";
import { useIdentityLabWorkspace } from "./features/identities/useIdentityLabWorkspace";
import { useGraphExitNavigation } from "./app/useGraphExitNavigation";
import { useAuthState } from "./features/auth/state/useAuthState";
import { LoginScreen } from "./features/auth/pages/LoginScreen";
import { useWorkflowAutosave } from "./features/workflows/hooks/useWorkflowAutosave";
import { useAppLifecycleEffects } from "./app/useAppLifecycleEffects";
import { useAppDerivedState } from "./app/useAppDerivedState";
import { useAppWorkspaces } from "./app/useAppWorkspaces";
import { AppWorkspaceRoutes } from "./app/AppWorkspaceRoutes";
import { getActiveSidebarItem, isRouteAllowed } from "./app/routePermissions";

export { isRouteAllowed };

function AppInner() {
  const auth = useAuthState();
  const themePreferences = useThemePreferences();
  const [appError, setAppError] = useState("");
  const toastApi = useToast();
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      toastApi[type](message);
    },
    [toastApi],
  );

  const [graphAutosaveEnabled, setGraphAutosaveEnabled] = useState(readGraphAutosaveEnabled);
  const [graphAutosaveDelayMs, setGraphAutosaveDelayMs] = useState(readGraphAutosaveDelayMs);
  const [runSnapshots, setRunSnapshots] = useState<WorkflowRunSnapshot[]>([]);

  const setToastMessage = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast],
  );

  const workspaces = useAppWorkspaces({
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    setAppError,
    showToast,
    requestGraphExitNavigation: (navigate) => requestGraphExitNavigation(navigate),
    setSidebarCollapsed: (collapsed) => nav.setSidebarCollapsed(collapsed),
    setScreen: (screen) => nav.setScreen(screen as never),
    runSnapshots,
    setRunSnapshots,
  });

  const {
    runState,
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
  } = workspaces;

  const {
    workflowGraph,
    graphSaveStatus,
    graphRevision,
    savedGraphRevision,
    graphIssues,
    setWorkflowGraph,
    setGraphSaveStatus,
    setSavedGraphRevision,
    setGraphIssues,
    graphIssuesNeedRecheck,
    setGraphIssuesNeedRecheck,
    setSelectedGraphNodeId,
  } = graphState;

  const {
    workflowSettings,
    workflowSettingsDialogOpen,
    workflowSettingsActiveSection,
    workflowSettingsSaveStatuses,
    workflowProfileDraftId,
    setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsDialogOpen,
    setWorkflowSettingsSaveStatuses,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
  } = settingsWorkspace;

  const {
    overview: identityLabOverview,
    target: identityLabTarget,
    loading: identityLabLoading,
    setTarget: setIdentityLabTarget,
    loadIdentityLabOverview,
    closeIdentitySession,
    resetIdentityFromLab,
  } = useIdentityLabWorkspace({
    setAppError,
    setToastMessage,
    onIdentityReset: workflowsWorkspace.loadWorkflows,
  });

  const nav = useAppNavigation({
    requestGraphExitNavigation: (navigate) => requestGraphExitNavigation(navigate),
    loadProjectModel: () => projectsWorkspace.loadProjectModel(),
    selectedProjectId: projectsWorkspace.selectedProjectId,
    setSelectedProjectId: projectsWorkspace.setSelectedProjectId,
    currentProjectId: () => projectsWorkspace.currentProjectId(),
    loadSubflowsForProject: (id) => subflowsWorkspace.loadSubflowsForProject(id),
    loadWorkflows: () => workflowsWorkspace.loadWorkflows(),
    loadOperationsOverview,
    loadSettingsDiagnostics,
    setFocusedScheduleId,
    loadSchedules,
    loadScheduleHistory,
    setSelectedSubflow: subflowsWorkspace.setSelectedSubflow,
    setSelectedSubflowGraph: subflowsWorkspace.setSelectedSubflowGraph,
    setSelectedSubflowUsage: subflowsWorkspace.setSelectedSubflowUsage,
    setSubflowBackTarget: subflowsWorkspace.setSubflowBackTarget,
    subflowBackTarget: subflowsWorkspace.subflowBackTarget,
    detail: workflowsWorkspace.detail,
    openWorkflow: workflowsWorkspace.openWorkflow,
    performOpenWorkflow: workflowsWorkspace.performOpenWorkflow,
    setIdentityLabTarget,
    loadIdentityLabOverview,
    workflows: workflowsWorkspace.workflows,
    setWorkflows: workflowsWorkspace.setWorkflows,
    openWorkflowSettings: settingsWorkspace.openWorkflowSettings,
    setProjectCollection: projectsWorkspace.setProjectCollection,
    setSelectedGraphNodeId: graphState.setSelectedGraphNodeId,
    setAppError,
  });

  const {
    createBrowserProfile,
    updateBrowserProfile,
    deleteBrowserProfile,
  } = useBrowserProfileActions({
    setAppError,
    setBrowserProfiles: projectsWorkspace.setBrowserProfiles,
    showToast,
  });

  const {
    exportPackageWorkflow,
    exportPackageIncludeFlow,
    exportPackageSections,
    setExportPackageIncludeFlow,
    setExportPackageSections,
    importPackagePreview,
    importPackageIncludeFlow,
    importPackageSections,
    setImportPackageIncludeFlow,
    setImportPackageSections,
    importProjectPackagePreview,
    isImportProjectPackageOpen,
    openExportPackageDialog,
    closeExportPackageDialog,
    submitExportPackage,
    importWorkflowPackageFile,
    closeImportPackageDialog,
    submitImportPackage,
    exportProjectPackageFile,
    importProjectPackageFile,
    closeImportProjectPackageDialog,
    submitImportProjectPackage,
    isPackageActionBusy,
  } = useAppPackageDialogs({
    currentProjectId: () => projectsWorkspace.currentProjectId(),
    setAppError,
    setToastMessage,
    async onProjectImported(project) {
      projectsWorkspace.setSelectedProjectId(project.id);
      projectsWorkspace.setProjectCollection("workflows");
      projectsWorkspace.setProjects(await listProjects());
      projectsWorkspace.setBrowserProfiles(await listBrowserProfiles(project.id));
      subflowsWorkspace.setSubflows(await listSubflows(project.id));
      await workflowsWorkspace.loadWorkflows();
    },
    async onWorkflowImported(workflowId) {
      await workflowsWorkspace.loadWorkflows();
      await workflowsWorkspace.openWorkflow(workflowId);
    },
  });

  const savedGraphRevisionRef = useRef(savedGraphRevision);
  const graphRevisionRef = useRef(graphRevision);
  graphRevisionRef.current = graphRevision;
  savedGraphRevisionRef.current = savedGraphRevision;

  const {
    graphExitDialogOpen,
    requestGraphExitNavigation,
    clearGraphExitNavigation,
    discardGraphExitChangesAndNavigate,
    saveGraphExitChangesAndNavigate,
  } = useGraphExitNavigation({
    workflow: {
      active: nav.screen === "detail" && Boolean(workflowsWorkspace.detail && workflowGraph),
      graphAutosaveEnabled,
      graphSaveStatus,
      graphRevision,
      savedGraphRevision,
      persistCurrentGraph: () => graphState.persistCurrentGraph(),
      discardWorkflowGraph({ savedGraphRevision: discardRev, graphSaveStatus: discardStatus }: { savedGraphRevision: number; graphSaveStatus: GraphSaveStatus }) {
        savedGraphRevisionRef.current = discardRev;
        setSavedGraphRevision(discardRev);
        setGraphSaveStatus(discardStatus);
      },
    },
    subflow: {
      active: nav.screen === "subflow-detail" && Boolean(subflowsWorkspace.selectedSubflow && subflowsWorkspace.selectedSubflowGraph),
      graphSaveStatus: subflowsWorkspace.subflowGraphSaveStatus,
      saveCurrentSubflowGraph: () => subflowsWorkspace.saveCurrentSubflowGraph(),
      discardSubflowGraph() {
        subflowsWorkspace.setSubflowGraphSaveStatus("saved");
      },
    },
  });

  useWorkflowAutosave({
    workflowId: workflowsWorkspace.detail?.workflow.id,
    workflowGraph,
    graphAutosaveEnabled,
    graphAutosaveDelayMs,
    graphRevision,
    savedGraphRevision,
    graphExitDialogOpen,
    setSavedGraphRevision,
    setGraphSaveStatus,
    setAppError,
  });

  useAppLifecycleEffects({
    auth,
    nav,
    setGraphAutosaveEnabled,
    setGraphSaveStatus,
    setGraphAutosaveDelayMs,
    projectsWorkspace,
    workflowsWorkspace,
    loadSchedules,
    runWorkspace,
    loadOperationsOverview,
    loadSettingsDiagnostics,
    loadIdentityLabOverview,
    identityLabTarget,
    runSnapshots,
    setRunSnapshots: (updater) => setRunSnapshots((prev) => updater(prev as never) as never),
    setWorkflowGraph,
    setWorkflowSettings,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    setSelectedGraphNodeId,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    graphAutosaveEnabled,
  });

  const openIdentityTarget = useCallback((target: IdentityLabTarget) => {
    setIdentityLabTarget(target);
    void loadIdentityLabOverview(target, projectsWorkspace.selectedProjectId);
  }, [setIdentityLabTarget, loadIdentityLabOverview, projectsWorkspace.selectedProjectId]);

  const selectIdentity = useCallback((workflowId: string, identityId: string) => {
    const target = { type: "managed" as const, workflow_id: workflowId, identity_id: identityId };
    setIdentityLabTarget(target);
    void loadIdentityLabOverview(target, projectsWorkspace.selectedProjectId);
  }, [setIdentityLabTarget, loadIdentityLabOverview, projectsWorkspace.selectedProjectId]);

  const openIdentityWorkflowSettings = useCallback((workflowId: string) => {
    nav.navigateToMissionControlTarget({ type: "workflow", mode: "settings", workflow_id: workflowId });
  }, [nav]);

  const updateGraphAutosaveEnabled = useCallback((enabled: boolean) => {
    setGraphAutosaveEnabled(enabled);
    writeGraphAutosaveEnabled(enabled);
    if (window.workflowApi?.saveAppSettings) {
      void window.workflowApi.saveAppSettings({ graphAutosaveEnabled: enabled });
    }
    if (!enabled) {
      setGraphSaveStatus("off");
      return;
    }
    setGraphSaveStatus(
      graphRevisionRef.current === savedGraphRevisionRef.current ? "saved" : "unsaved",
    );
  }, []);

  const updateGraphAutosaveDelayMs = useCallback((delayMs: number) => {
    setGraphAutosaveDelayMs(delayMs);
    writeGraphAutosaveDelayMs(delayMs);
    if (window.workflowApi?.saveAppSettings) {
      void window.workflowApi.saveAppSettings({ graphAutosaveDelayMs: delayMs });
    }
  }, []);

  const openDetailWorkflowSettings = useCallback((section: WorkflowSettingsSectionId) => {
    if (workflowsWorkspace.detail) {
      void settingsWorkspace.openWorkflowSettings(workflowsWorkspace.detail.workflow as never, section);
    }
  }, [workflowsWorkspace.detail, settingsWorkspace]);

  const navigateFromOverview = useCallback((target: OperationsNavigationTarget) => {
    void nav.navigateToMissionControlTarget(operationsTargetToMissionTarget(target));
  }, [nav]);

  const openWorkflowSurface = useCallback(
    async (workflowId: string) => {
      const targetWorkflow = workflowsWorkspace.workflows.find((item) => item.id === workflowId);
      if (!targetWorkflow) return;
      await nav.navigateToMissionControlTarget({ type: "workflow", workflow_id: workflowId });
    },
    [workflowsWorkspace.workflows, nav],
  );

  const {
    detailRunSnapshot,
    isRunning,
    detailRunState,
    selectedProject,
    selectedBrowserProfiles,
    selectedDesktopTargets,
    selectedProjectWorkflows,
    profileVariables,
    detailProjectName,
    selectedSubflowProjectName,
    canSaveWorkflowGraph,
    canSaveSubflowGraph,
    projectStats,
    runFromSelectedAvailability,
  } = useAppDerivedState({
    workflowsWorkspace,
    projectsWorkspace,
    subflowsWorkspace: subflowsWorkspace as never,
    runSnapshots,
    runState,
    workflowGraph,
    workflowSettings,
    graphRevision,
    savedGraphRevision,
    graphSaveStatus,
    workflowProfileDraftId,
    selectedGraphNodeId: graphState.selectedGraphNodeId,
  });

  if (auth.mode === "pending" || (auth.mode === "team" && !auth.currentUser)) {
    return (
      <LoginScreen
        onLogin={auth.login}
        authError={auth.authError}
        isLoading={auth.isLoggingIn}
      />
    );
  }

  const packageDialogs = {
    workflowPackageSections, exportPackageWorkflow, exportPackageIncludeFlow, exportPackageSections,
    closeExportPackageDialog, submitExportPackage, setExportPackageIncludeFlow, setExportPackageSections,
    importPackagePreview, importPackageIncludeFlow, importPackageSections, closeImportPackageDialog,
    submitImportPackage, setImportPackageIncludeFlow, setImportPackageSections, isImportProjectPackageOpen,
    importProjectPackagePreview, closeImportProjectPackageDialog, submitImportProjectPackage, isPackageActionBusy,
  };

  return (
    <>
      <AppShell
        activeItem={getActiveSidebarItem(nav.screen)}
        sidebarCollapsed={nav.sidebarCollapsed}
        onOpenOverview={() => nav.openOverview()}
        onOpenProjects={() => nav.openProjects(projectsWorkspace.projectCollection)}
        onOpenSchedules={nav.openSchedules}
        onOpenSettings={nav.openSettings}
        onOpenSettingsHelp={nav.openSettingsHelp}
        onOpenAdminUsers={() => nav.setScreen("admin-users")}
        onOpenAdminBackups={() => nav.setScreen("admin-backups")}
        onLogout={() => {
          void auth.logout();
          nav.setScreen("overview");
        }}
        currentUser={auth.currentUser}
        onToggleSidebar={() => nav.setSidebarCollapsed(!nav.sidebarCollapsed)}
        screen={nav.screen}
      >
        <WorkflowSurfaceProvider value={openWorkflowSurface}>
          <AppWorkspaceRoutes
            {...{
              nav, auth, appError, setAppError, showToast, operationsOverview, operationsOverviewLoading,
              loadOperationsOverview, navigateFromOverview, graphAutosaveEnabled, graphAutosaveDelayMs,
              onGraphAutosaveEnabledChange: updateGraphAutosaveEnabled, onGraphAutosaveDelayMsChange: updateGraphAutosaveDelayMs,
              setGraphSaveStatus, settingsDiagnostics, settingsDiagnosticsLoading, settingsDiagnosticsError,
              settingsMaintenanceMessage, loadSettingsDiagnostics, installSettingsBrowserBinary, cleanupSettingsBrowserProfiles,
              themePreferences, schedules, schedulesLoading, focusedScheduleId, scheduleEvents, createScheduleItem: submitCreateSchedule,
              updateScheduleItem: submitUpdateSchedule, removeSchedule, toggleSchedule, loadScheduleHistory, projectsWorkspace,
              selectedProject, projectStats, importProjectPackageFile, exportProjectPackageFile, subflowsWorkspace,
              selectedBrowserProfiles, selectedProjectWorkflows, identityLabOverview, identityLabLoading, identityLabTarget,
              loadIdentityLabOverview, selectIdentity, openIdentityWorkflowSettings, closeIdentitySession, resetIdentityFromLab,
              openIdentityTarget, createBrowserProfile, updateBrowserProfile, deleteBrowserProfile, selectedDesktopTargets,
              workflowsWorkspace, settingsWorkspace, runSnapshots, runWorkspace, openExportPackageDialog, importWorkflowPackageFile,
              recordingWorkspace, packageDialogs, selectedSubflowProjectName, canSaveSubflowGraph, detailProjectName,
              isRunning, canSaveWorkflowGraph, detailRunState, workflowGraph, graphIssues, graphIssuesNeedRecheck,
              profileVariables, openDetailWorkflowSettings, detailRunSnapshot, graphState, runFromSelectedAvailability,
              graphSaveStatus, workflowSettings, workflowSettingsDialogOpen, workflowSettingsActiveSection,
              workflowProfileDraftId, workflowSettingsSaveStatuses, setWorkflowSettingsDialogOpen, setWorkflowProfileDraftId,
              setWorkflowSettingsSavedSnapshot, setWorkflowSettingsSaveStatuses, graphExitDialogOpen, clearGraphExitNavigation,
              discardGraphExitChangesAndNavigate, saveGraphExitChangesAndNavigate,
            }}
          />
        </WorkflowSurfaceProvider>
      </AppShell>
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

export default App;
