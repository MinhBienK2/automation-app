import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastProvider, useToast } from "./components/ui/toast";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { SettingsHelpPage } from "./features/settings/pages/SettingsHelpPage";
import { useSettingsDiagnostics } from "./features/settings/useSettingsDiagnostics";
import { ProjectProfilesPanel } from "./features/projects/components/ProjectProfilesPanel";
import { OperationsOverviewPage } from "./features/overview/pages/OperationsOverviewPage";
import { useOperationsOverviewWorkspace } from "./features/overview/useOperationsOverviewWorkspace";
import { ProjectSettings } from "./features/projects/components/ProjectSettings";
import { useBrowserProfileActions } from "./features/projects/useBrowserProfileActions";
import { useIdentityLabWorkspace } from "./features/identities/useIdentityLabWorkspace";
import { ProjectsPage } from "./features/projects/pages/ProjectsPage";
import { SchedulesPage } from "./features/schedules/pages/SchedulesPage";
import { useSchedulesWorkspace } from "./features/schedules/useSchedulesWorkspace";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { SubflowListPage } from "./features/workflows/pages/SubflowListPage";
import { SubflowDetailPage } from "./features/workflows/pages/SubflowDetailPage";
import { AppShell } from "./layouts/AppShell";
import { useThemePreferences } from "./app/useThemePreferences";
import {
  listProjects,
  listBrowserProfiles,
  listSubflows,
  getSubflowGraph,
  saveWorkflowGraph,
  createSubflow,
  saveSubflowGraph,
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
import { RecordingReviewDialog } from "./features/workflows/components/dialogs/RecordingReviewDialog";
import { WorkflowSettingsDialog } from "./features/workflows/components/dialogs/WorkflowSettingsDialog";
import { UnsavedChangesDialog } from "./components/ui/unsaved-changes-dialog";
import { AppPackageDialogs } from "./app/AppPackageDialogs";
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

// Import new domain state hooks and types
import { useAppNavigation } from "./app/useAppNavigation";
import { useProjectWorkspace } from "./features/projects/state/useProjectWorkspace";
import { useWorkflowWorkspace } from "./features/workflows/state/useWorkflowWorkspace";
import { useWorkflowGraphState } from "./features/workflows/state/useWorkflowGraphState";
import { useWorkflowSettingsState } from "./features/workflows/state/useWorkflowSettingsState";
import { useWorkflowRunState } from "./features/workflows/state/useWorkflowRunState";
import { useRecordingWorkspace } from "./features/workflows/state/useRecordingWorkspace";
import { useSubflowWorkspace } from "./features/subflows/state/useSubflowWorkspace";
import { runFromSelectedState } from "./features/workflows/lib/runFromSelected";
import { useGraphExitNavigation } from "./app/useGraphExitNavigation";
import { useAuthState } from "./features/auth/state/useAuthState";
import { LoginScreen } from "./features/auth/pages/LoginScreen";
import { AdminPanel } from "./features/auth/pages/AdminPanel";
import { AdminBackupsPanel } from "./features/auth/pages/AdminBackupsPanel";
import type { AppScreen } from "./shared/types/workspaceContracts";

const ROUTE_CONFIGS: Record<AppScreen, { allowedRoles?: ("admin" | "user")[] }> = {
  overview: { allowedRoles: ["admin", "user"] },
  projects: { allowedRoles: ["admin", "user"] },
  detail: { allowedRoles: ["admin", "user"] },
  "subflow-detail": { allowedRoles: ["admin", "user"] },
  settings: { allowedRoles: ["admin", "user"] },
  schedules: { allowedRoles: ["admin", "user"] },
  "settings-help": { allowedRoles: ["admin", "user"] },
  "admin-users": { allowedRoles: ["admin"] },
  "admin-backups": { allowedRoles: ["admin"] },
};

export function isRouteAllowed(
  screen: AppScreen,
  mode: "pending" | "team",
  role?: "admin" | "user",
): boolean {
  const config = ROUTE_CONFIGS[screen];
  if (!config) return true;
  if (mode === "team") {
    if (!role) return false;
    return config.allowedRoles?.includes(role) ?? true;
  }
  return false;
}

function AppInner() {
  // --- Auth State ---
  const auth = useAuthState();

  // --- Appearance preferences (theme / accent / density) ---
  const themePreferences = useThemePreferences();

  // --- States ---
  const [appError, setAppError] = useState("");

  const toastApi = useToast();
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      toastApi[type](message);
    },
    [toastApi],
  );

  const setToastMessage = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast],
  );

  // Shared state references
  const [graphAutosaveEnabled, setGraphAutosaveEnabled] = useState(readGraphAutosaveEnabled);
  const [graphAutosaveDelayMs, setGraphAutosaveDelayMs] = useState(readGraphAutosaveDelayMs);
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [runSnapshots, setRunSnapshots] = useState<WorkflowRunSnapshot[]>([]);
  const [activeRunWorkflowName, setActiveRunWorkflowName] = useState<string | null>(null);

  // --- Sub-hooks ---

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

  // --- Graph session state lives inside the workflows feature ---
  const graphState = useWorkflowGraphState({
    getDetail: () => workflowsWorkspace.detail,
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    setAppError,
    loadWorkflows: () => workflowsWorkspace.loadWorkflows(),
  });
  const {
    workflowGraph,
    graphSaveStatus,
    graphRevision,
    savedGraphRevision,
    graphIssues,
    setWorkflowGraph,
    setGraphSaveStatus,
    setGraphRevision,
    setSavedGraphRevision,
    setGraphIssues,
    graphIssuesNeedRecheck,
    setGraphIssuesNeedRecheck,
    setSelectedGraphNodeId,
  } = graphState;

  // --- Domain hooks ---
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

  const subflowsWorkspace = useSubflowWorkspace({
    setAppError,
    ensureProjectId: () => projectsWorkspace.ensureProjectId(),
    detail: null, // assigned down
    requestGraphExitNavigation: (navigate) => requestGraphExitNavigation(navigate),
    setSidebarCollapsed: (collapsed) => nav.setSidebarCollapsed(collapsed),
    setScreen: (screen) => nav.setScreen(screen),
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
    requestGraphExitNavigation: (navigate) => requestGraphExitNavigation(navigate),
    setSelectedProjectId: (id) => projectsWorkspace.setSelectedProjectId(id),
    currentProjectId: () => projectsWorkspace.currentProjectId(),
    browserProfiles: projectsWorkspace.browserProfiles,
    setBrowserProfiles: (envs) => projectsWorkspace.setBrowserProfiles(envs),
    loadSubflowsForProject: (id) => subflowsWorkspace.loadSubflowsForProject(id),
    graphAutosaveEnabled,
    setWorkflowGraph,
    setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsSaveStatuses,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    setSavedGraphRevision,
    setGraphRevision,
    setGraphSaveStatus,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    runSnapshots,
    setRunState,
    setSelectedGraphNodeId,
    setSidebarCollapsed: (collapsed) => nav.setSidebarCollapsed(collapsed),
    setScreen: (screen) => nav.setScreen(screen),
    setProjectCollection: (coll) => projectsWorkspace.setProjectCollection(coll),
    ensureProjectId: () => projectsWorkspace.ensureProjectId(),
  });




  const runWorkspace = useWorkflowRunState({
    detail: workflowsWorkspace.detail,
    workflowGraph,
    selectedGraphNodeId: graphState.selectedGraphNodeId,
    selectedWorkflowId: workflowsWorkspace.selectedWorkflowId,
    setAppError,
    loadOperationsOverview,
    persistCurrentGraph: () => graphState.persistCurrentGraph(),
    persistDirtyWorkflowSettings: () => settingsWorkspace.saveWorkflowSettingsAndClose().then(() => true).catch(() => false),
    setGraphIssues: graphState.setGraphIssues,
    setGraphIssuesNeedRecheck,
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

  // App routing hook
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

  const graphRevisionRef = useRef(graphRevision);
  const savedGraphRevisionRef = useRef(savedGraphRevision);

  useEffect(() => {
    graphRevisionRef.current = graphRevision;
  }, [graphRevision]);

  useEffect(() => {
    savedGraphRevisionRef.current = savedGraphRevision;
  }, [savedGraphRevision]);

  const isSavingRef = useRef(false);
  const savePendingRef = useRef(false);
  const workflowGraphRef = useRef(workflowGraph);

  useEffect(() => {
    workflowGraphRef.current = workflowGraph;
  }, [workflowGraph]);

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
      discardWorkflowGraph({ savedGraphRevision, graphSaveStatus }: { savedGraphRevision: number; graphSaveStatus: GraphSaveStatus }) {
        savedGraphRevisionRef.current = savedGraphRevision;
        setSavedGraphRevision(savedGraphRevision);
        setGraphSaveStatus(graphSaveStatus);
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

  // --- Autosave Effect ---
  useEffect(() => {
    if (
      !graphAutosaveEnabled ||
      !workflowsWorkspace.detail ||
      !workflowGraph ||
      graphRevision === savedGraphRevision ||
      graphExitDialogOpen
    ) {
      return;
    }

    const workflowId = workflowsWorkspace.detail.workflow.id;

    const timeoutId = window.setTimeout(() => {
      const executeSave = async () => {
        if (isSavingRef.current) {
          savePendingRef.current = true;
          return;
        }

        isSavingRef.current = true;
        savePendingRef.current = false;
        setGraphSaveStatus("saving");

        const revisionBeingSaved = graphRevisionRef.current;
        try {
          const currentGraph = workflowGraphRef.current;
          if (currentGraph) {
            await saveWorkflowGraph(workflowId, currentGraph, { skipRevision: true });
          }
          setSavedGraphRevision((current) => Math.max(current, revisionBeingSaved));
          if (graphRevisionRef.current === revisionBeingSaved) {
            setGraphSaveStatus("saved");
            setAppError("");
          } else {
            setGraphSaveStatus("unsaved");
          }
        } catch (error) {
          if (graphRevisionRef.current === revisionBeingSaved) {
            setGraphSaveStatus("failed");
          }
          setAppError(commandMessage(error));
        } finally {
          isSavingRef.current = false;
          if (savePendingRef.current) {
            void executeSave();
          }
        }
      };

      void executeSave();
    }, graphAutosaveDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    workflowsWorkspace.detail,
    graphAutosaveEnabled,
    graphRevision,
    savedGraphRevision,
    workflowGraph,
    graphAutosaveDelayMs,
    graphExitDialogOpen,
  ]);

  // --- Load App Settings ---
  useEffect(() => {
    if (window.workflowApi?.getAppSettings) {
      window.workflowApi.getAppSettings().then((settings) => {
        if (settings) {
          if (typeof settings.graphAutosaveEnabled === "boolean") {
            setGraphAutosaveEnabled(settings.graphAutosaveEnabled);
            setGraphSaveStatus(settings.graphAutosaveEnabled ? "saved" : "off");
          }
          if (typeof settings.graphAutosaveDelayMs === "number") {
            setGraphAutosaveDelayMs(settings.graphAutosaveDelayMs);
          }
        }
      }).catch((err) => {
        console.error("Failed to load app settings from backend:", err);
      });
    }
  }, []);

  // --- Initial Data Load ---
  useEffect(() => {
    if (auth.mode === "pending") return;
    if (auth.mode === "team" && !auth.currentUser) return;

    void projectsWorkspace.loadProjectModel();
    void workflowsWorkspace.loadWorkflows();
    void loadSchedules();
    void runWorkspace.refreshRunStates();
    void loadOperationsOverview();
    void loadSettingsDiagnostics();
  }, [auth.mode, auth.currentUser]);

  // --- Load Identity Lab Overview on project or tab change ---
  useEffect(() => {
    if (projectsWorkspace.projectCollection === "profiles") {
      void loadIdentityLabOverview(identityLabTarget, projectsWorkspace.selectedProjectId);
    }
  }, [projectsWorkspace.selectedProjectId, projectsWorkspace.projectCollection]);

  // --- Run polling ---
  useEffect(() => {
    if (!runSnapshots.some((snapshot) => snapshot.state.status === "running")) return;

    const intervalId = window.setInterval(() => {
      void runWorkspace.refreshRunStates();
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [runSnapshots]);

  // --- Reset finished run state when exiting the workflow details page ---
  const prevScreenRef = useRef<string | null>(null);
  useEffect(() => {
    const prevScreen = prevScreenRef.current;
    prevScreenRef.current = nav.screen;

    const wasEditing = prevScreen === "detail" || prevScreen === "subflow-detail";
    const isEditing = nav.screen === "detail" || nav.screen === "subflow-detail";

    if (wasEditing && !isEditing) {
      setRunSnapshots((current) =>
        current.filter(
          (snapshot) =>
            snapshot.state.status === "running" ||
            snapshot.state.retained_session?.available === true,
        ),
      );
      workflowsWorkspace.setSelectedWorkflowId(null);
      workflowsWorkspace.setDetail(null);
      setWorkflowGraph(null);
      setWorkflowSettings(null);
      setWorkflowProfileDraftId(null);
      setWorkflowProfileSavedId(null);
      setSelectedGraphNodeId(null);
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
    }
  }, [
    nav.screen,
    workflowsWorkspace,
    setWorkflowGraph,
    setWorkflowSettings,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    setSelectedGraphNodeId,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    setGraphSaveStatus,
    graphAutosaveEnabled,
  ]);

  // --- Enforce route authorization ---
  useEffect(() => {
    if (auth.mode !== "pending" && !isRouteAllowed(nav.screen, auth.mode, auth.currentUser?.role)) {
      nav.setScreen("overview");
    }
  }, [auth.mode, auth.currentUser?.role, nav.screen, nav.setScreen]);

  // --- Navigation Helpers ---
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
      void settingsWorkspace.openWorkflowSettings(workflowsWorkspace.detail.workflow as any, section);
    }
  }, [workflowsWorkspace.detail, settingsWorkspace]);

  const navigateFromOverview = useCallback((target: OperationsNavigationTarget) => {
    void nav.navigateToMissionControlTarget(operationsTargetToMissionTarget(target));
  }, [nav]);



  // --- Derived state values ---
  const detailRunSnapshot = workflowsWorkspace.detail
    ? latestRunForWorkflow(runSnapshots, workflowsWorkspace.detail.workflow.id)
    : null;
  const detailRunState = workflowsWorkspace.detail
    ? (detailRunSnapshot?.state ?? idleRunStateWithRetainedSession(runState))
    : runState;
  const isRunning = detailRunState.status === "running";
  const runFromSelectedAvailability = workflowGraph
    ? runFromSelectedState({
        graph: workflowGraph,
        selectedNodeId: graphState.selectedGraphNodeId,
        settings: workflowSettings,
        runState: detailRunState,
        isRunning,
      })
    : { enabled: false, reason: "No workflow graph is loaded.", visible: false };



  const canSaveWorkflowGraph =
    Boolean(workflowsWorkspace.detail && workflowGraph) &&
    graphSaveStatus !== "saving" &&
    (graphRevision !== savedGraphRevision || graphSaveStatus === "failed");

  const canSaveSubflowGraph =
    Boolean(subflowsWorkspace.selectedSubflow && subflowsWorkspace.selectedSubflowGraph) &&
    subflowsWorkspace.subflowGraphSaveStatus !== "saved" &&
    subflowsWorkspace.subflowGraphSaveStatus !== "saving";

  const selectedProject =
    projectsWorkspace.projects.find((project) => project.id === projectsWorkspace.selectedProjectId) ??
    projectsWorkspace.projects[0] ??
    null;

  const projectNameForId = (projectId?: string | null) =>
    projectId ? projectsWorkspace.projects.find((project) => project.id === projectId)?.name ?? null : null;

  const detailProjectName = workflowsWorkspace.detail
    ? projectNameForId(workflowsWorkspace.detail.workflow.project_id) ?? selectedProject?.name ?? null
    : null;

  const selectedSubflowProjectName = subflowsWorkspace.selectedSubflow
    ? projectNameForId(subflowsWorkspace.selectedSubflow.project_id) ?? selectedProject?.name ?? null
    : null;

  const selectedProjectWorkflows = selectedProject
    ? workflowsWorkspace.workflows.filter(
        (workflow) =>
          !workflow.project_id || workflow.project_id === selectedProject.id,
      )
    : workflowsWorkspace.workflows;

  const selectedBrowserProfiles = selectedProject
    ? projectsWorkspace.browserProfiles.filter(
        (profile) => profile.project_id === selectedProject.id,
      )
    : projectsWorkspace.browserProfiles;

  const projectStats = useMemo(() => {
    const stats: Record<string, { workflows: number; subflows: number; profiles: number }> = {};
    for (const project of projectsWorkspace.projects) {
      stats[project.id] = {
        workflows: workflowsWorkspace.workflows.filter(
          (workflow) =>
            !workflow.project_id || workflow.project_id === project.id,
        ).length,
        subflows: subflowsWorkspace.subflows.filter(
          (subflow) => subflow.project_id === project.id,
        ).length,
        profiles: projectsWorkspace.browserProfiles.filter(
          (profile) => profile.project_id === project.id,
        ).length,
      };
    }
    return stats;
  }, [
    projectsWorkspace.projects,
    workflowsWorkspace.workflows,
    subflowsWorkspace.subflows,
    projectsWorkspace.browserProfiles,
  ]);

  const activeProfileId = workflowsWorkspace.detail?.workflow.browser_profile_id;
  const activeProfile = selectedBrowserProfiles.find((profile) => profile.id === activeProfileId);
  const profileVariables = activeProfile?.environment?.variables ?? null;

  if (auth.isLoading) {
    return (
      <div className="login-screen-container">
        <div className="loading-wrapper">
          <div className="loading-logo">A</div>
          <div className="loading-spinner-container">
            <div className="loading-spinner"></div>
            <div className="loading-spinner-inner"></div>
          </div>
          <p className="loading-text">Đang khởi tạo...</p>
          <p className="loading-subtext">Đang kết nối hệ thống và tải cấu hình.</p>
        </div>
      </div>
    );
  }

  if (auth.mode === "pending" || (auth.mode === "team" && !auth.currentUser)) {
    return (
      <LoginScreen
        onLogin={auth.login}
        authError={auth.authError}
        isLoading={auth.isLoggingIn}
      />
    );
  }

  return (
    <>
    <AppShell
      activeItem={
        nav.screen === "settings" || nav.screen === "settings-help"
          ? "settings"
          : nav.screen === "schedules"
            ? "schedules"
          : nav.screen === "projects" || nav.screen === "detail" || nav.screen === "subflow-detail"
              ? "projects"
              : nav.screen === "overview"
                ? "overview"
                : nav.screen === "admin-users"
                  ? "admin-users"
                  : nav.screen === "admin-backups"
                    ? "admin-backups"
                    : "projects"
      }
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
      {nav.screen === "overview" ? (
        <OperationsOverviewPage
          overview={operationsOverview}
          loading={operationsOverviewLoading}
          error={appError}
          focus={nav.overviewFocus}
          onRefresh={loadOperationsOverview}
          onOpenWorkflows={() => nav.openProjects("workflows")}
          onNavigate={navigateFromOverview}
          diagnostics={settingsDiagnostics}
          diagnosticsLoading={settingsDiagnosticsLoading}
          diagnosticsError={settingsDiagnosticsError}
          onRefreshDiagnostics={loadSettingsDiagnostics}
        />
      ) : nav.screen === "settings" ? (
        <SettingsPage
          graphAutosaveEnabled={graphAutosaveEnabled}
          graphAutosaveDelayMs={graphAutosaveDelayMs}
          maintenanceMessage={settingsMaintenanceMessage}
          onGraphAutosaveEnabledChange={updateGraphAutosaveEnabled}
          onGraphAutosaveDelayMsChange={updateGraphAutosaveDelayMs}
          onInstallBinary={installSettingsBrowserBinary}
          onCleanupProfiles={cleanupSettingsBrowserProfiles}
          theme={themePreferences.theme}
          accent={themePreferences.accent}
          density={themePreferences.density}
          onThemeChange={themePreferences.setTheme}
          onAccentChange={themePreferences.setAccent}
          onDensityChange={themePreferences.setDensity}
        />
      ) : nav.screen === "admin-users" && isRouteAllowed("admin-users", auth.mode, auth.currentUser?.role) ? (
 
        <AdminPanel currentUser={auth.currentUser} />
      ) : nav.screen === "admin-backups" && isRouteAllowed("admin-backups", auth.mode, auth.currentUser?.role) ? (
        <AdminBackupsPanel showToast={showToast} />
      ) : nav.screen === "settings-help" ? (
        <SettingsHelpPage />
      ) : nav.screen === "schedules" ? (
        <SchedulesPage
          schedules={schedules}
          workflows={workflowsWorkspace.workflows}
          events={scheduleEvents}
          focusedScheduleId={focusedScheduleId}
          loading={schedulesLoading}
          error={appError}
          onCreateSchedule={submitCreateSchedule}
          onUpdateSchedule={submitUpdateSchedule}
          onDeleteSchedule={removeSchedule}
          onToggleSchedule={toggleSchedule}
          onLoadEvents={loadScheduleHistory}
          onOpenWorkflow={(workflowId) => {
            void nav.navigateToMissionControlTarget({ type: "workflow", workflow_id: workflowId });
          }}
        />
      ) : nav.screen === "projects" ? (
        <ProjectsPage
          projects={projectsWorkspace.projects}
          selectedProject={selectedProject}
          activeCollection={projectsWorkspace.projectCollection}
          browseMode={nav.projectsBrowseMode}
          error={selectedProject ? "" : appError}
          projectStats={projectStats}
          onSelectProject={(projectId) => {
            void projectsWorkspace.selectProject(projectId);
            nav.setProjectsBrowseMode("detail");
          }}
          onCreateProject={async (input) => {
            await projectsWorkspace.createProject(input);
            nav.setProjectsBrowseMode("detail");
          }}
          onImportProjectPackageFile={importProjectPackageFile}
          onCollectionChange={(coll) => projectsWorkspace.setProjectCollection(coll)}
          onDuplicateProject={async (projectId) => {
            await projectsWorkspace.duplicateProject(projectId);
            nav.setProjectsBrowseMode("detail");
          }}
          onExportProject={(projectId) => {
            void exportProjectPackageFile(projectId);
          }}
          onDeleteProject={(projectId) => {
            void projectsWorkspace.deleteProject(projectId);
          }}
        >
          {projectsWorkspace.projectCollection === "subflows" ? (
            <SubflowListPage
              subflows={subflowsWorkspace.subflows}
              subflowUsagesBySubflow={subflowsWorkspace.subflowUsagesBySubflow}
              loading={subflowsWorkspace.subflowsLoading}
              error={appError}
              onCreateSubflow={(input) => subflowsWorkspace.createProjectSubflow(input)}
              onUpdateSubflow={subflowsWorkspace.updateProjectSubflow}
              onDuplicateSubflow={subflowsWorkspace.duplicateProjectSubflow}
              onDeleteSubflow={(subflow) => subflowsWorkspace.deleteProjectSubflow(subflow.id)}
              onOpenSubflow={(subflowId) => {
                void subflowsWorkspace.openSubflowDetail(subflowId, { type: "subflows" });
              }}
              onRefresh={() => {
                void subflowsWorkspace.loadSubflowsForProject();
              }}
              onExportSubflow={subflowsWorkspace.exportProjectSubflow}
              onImportSubflowFile={subflowsWorkspace.importProjectSubflowFile}
            />
          ) : projectsWorkspace.projectCollection === "profiles" ? (
            <ProjectProfilesPanel
              project={selectedProject}
              browserProfiles={selectedBrowserProfiles}
              workflows={selectedProjectWorkflows}
              overview={identityLabOverview}
              loading={identityLabLoading}
              error={appError}
              onRefresh={() => loadIdentityLabOverview(identityLabTarget, selectedProject?.id)}
              onSelectIdentity={selectIdentity}
              onOpenWorkflow={(workflowId) => {
                void workflowsWorkspace.openWorkflow(workflowId);
              }}
              onOpenWorkflowSettings={(workflowId) => {
                void openIdentityWorkflowSettings(workflowId);
              }}
              onCloseRetainedSession={(workflowId, profileName) => {
                void closeIdentitySession(workflowId, profileName, selectedProject?.id);
              }}
              onResetIdentity={(workflowId) => resetIdentityFromLab(workflowId, selectedProject?.id)}
              onOpenIdentityTarget={openIdentityTarget}
              onCreateBrowserProfile={createBrowserProfile}
              onUpdateBrowserProfile={updateBrowserProfile}
              onDeleteBrowserProfile={async (profileId) => {
                await deleteBrowserProfile(profileId, selectedProject?.id);
              }}
            />
          ) : projectsWorkspace.projectCollection === "settings" ? (
            <ProjectSettings
              project={selectedProject}
              error={appError}
              onUpdateProject={(id, input) => projectsWorkspace.updateProject(id, input)}
              onDuplicateProject={(id) => projectsWorkspace.duplicateProject(id)}
              onExportProjectPackage={exportProjectPackageFile}
              onDeleteProject={(id) => projectsWorkspace.deleteProject(id)}
            />
          ) : (
            <WorkflowListPage
              workflows={selectedProjectWorkflows}
              workflowDialogMode={workflowsWorkspace.workflowDialogMode}
              workflowNameDraft={workflowsWorkspace.workflowNameDraft}
              browserProfiles={selectedBrowserProfiles}
              selectedProfileIdDraft={workflowsWorkspace.selectedProfileIdDraft}
              appError={appError}
              runSnapshots={runSnapshots}
              startingWorkflowId={runWorkspace.startingWorkflowId}
              onWorkflowNameDraftChange={workflowsWorkspace.setWorkflowNameDraft}
              onSelectedProfileIdDraftChange={workflowsWorkspace.setSelectedProfileIdDraft}
              onSubmitWorkflowDialog={workflowsWorkspace.submitWorkflowDialog}
              onOpenCreateWorkflow={workflowsWorkspace.openCreateWorkflowDialog}
              onOpenEditWorkflow={(workflow) => {
                void settingsWorkspace.openWorkflowSettings(workflow, "general");
              }}
              onDuplicateWorkflow={workflowsWorkspace.duplicateWorkflow}
              onRunWorkflow={runWorkspace.runSavedWorkflow}
              onStopRun={(id) => runWorkspace.stopRun(id)}
              onOpenExportWorkflow={openExportPackageDialog}
              onImportWorkflowPackageFile={importWorkflowPackageFile}
              onRecordWorkflow={recordingWorkspace.startWorkflowRecording}
              onCloseWorkflowDialog={workflowsWorkspace.closeWorkflowDialog}
              onOpenWorkflow={(id) => {
                void workflowsWorkspace.openWorkflow(id);
              }}
              onDeleteWorkflow={workflowsWorkspace.deleteWorkflow}
              workflowDialogBusy={workflowsWorkspace.workflowDialogBusy}
            />
          )}
        </ProjectsPage>
      ) : nav.screen === "subflow-detail" ? (
        <SubflowDetailPage
          subflow={subflowsWorkspace.selectedSubflow}
          projectName={selectedSubflowProjectName}
          usage={subflowsWorkspace.selectedSubflowUsage}
          graph={subflowsWorkspace.selectedSubflowGraph}
          graphSaveStatus={graphSaveStatusLabel(subflowsWorkspace.subflowGraphSaveStatus)}
          canSaveGraph={canSaveSubflowGraph}
          appError={appError}
          backLabel={
            subflowsWorkspace.subflowBackTarget.type === "workflow-detail"
              ? "Back to Workflow"
              : "Back to Subflows"
          }
          breadcrumbLabel={
            subflowsWorkspace.subflowBackTarget.type === "workflow-detail"
              ? subflowsWorkspace.subflowBackTarget.workflowName
              : "Subflows"
          }
          onBack={nav.backFromSubflowDetail}
          onGraphChange={subflowsWorkspace.changeSubflowGraph}
          onSaveGraph={() => {
            void subflowsWorkspace.saveCurrentSubflowGraph();
          }}
          onUpdateSubflow={async (input) => {
            if (subflowsWorkspace.selectedSubflow) {
              await subflowsWorkspace.updateProjectSubflow(subflowsWorkspace.selectedSubflow, input);
            }
          }}
          isSavingGraph={subflowsWorkspace.subflowGraphSaveStatus === "saving"}
        />
      ) : nav.screen === "detail" && workflowsWorkspace.detail ? (
        <>
          <WorkflowDetailPage
            detail={workflowsWorkspace.detail}
            projectName={detailProjectName}
            isRunning={isRunning}
            isStartingRun={runWorkspace.isStartingRun}
            appError={appError}
            graphSaveStatus={graphSaveStatusLabel(graphSaveStatus)}
            canSaveGraph={canSaveWorkflowGraph}
            runState={detailRunState}
            workflowGraph={workflowGraph}
            graphIssues={graphIssues}
            subflowOptions={subflowsWorkspace.subflows}
            graphIssuesNeedRecheck={graphIssuesNeedRecheck}
            defaultEdgeDelay={workflowSettings?.graph_defaults?.default_edge_delay ?? null}
            liveRunEnabled={workflowSettings?.graph_defaults?.live_run_enabled ?? true}
            liveRunFollowCurrent={workflowSettings?.graph_defaults?.live_run_follow_current ?? false}
            initialVariables={workflowSettings?.environment?.initial_variables}
            profileVariables={profileVariables}
            onBack={nav.backToList}
            onOpenWorkflowSettings={() => openDetailWorkflowSettings("browser_launch")}
            onStopRun={() => runWorkspace.stopRun(detailRunSnapshot?.run_id ?? "")}
            onCreateSubflowFromSelection={async (input) => {
              setAppError("");
              const projectId = workflowsWorkspace.detail?.workflow.project_id ?? (await projectsWorkspace.ensureProjectId());
              try {
                const createdSubflow = await createSubflow(projectId, {
                  name: input.name,
                  description: null,
                });
                await saveSubflowGraph(createdSubflow.id, input.graph);
                await subflowsWorkspace.loadSubflowsForProject(projectId);
                return createdSubflow;
              } catch (error) {
                const message = commandMessage(error);
                setAppError(message);
                throw new Error(message);
              }
            }}
            onLoadSubflowGraph={getSubflowGraph}
            onOpenSubflowDetail={(subflowId) => {
              void subflowsWorkspace.openSubflowDetail(subflowId, {
                type: "workflow-detail",
                workflowId: workflowsWorkspace.detail!.workflow.id,
                workflowName: workflowsWorkspace.detail!.workflow.name,
              });
            }}
            onGraphChange={graphState.changeWorkflowGraph} // const changeWorkflowGraph = useCallback
            onRunGraph={runWorkspace.runGraph}
            onRunGraphFromSelected={async (mode) => {
              if (workflowSettings) {
                setWorkflowSettings({
                  ...workflowSettings,
                  run_policy: {
                    ...workflowSettings.run_policy,
                    run_from_selected_mode: mode,
                  },
                });
              }
              await runWorkspace.runGraphFromSelectedNode(mode);
            }}
            onSelectedGraphNodeChange={graphState.setSelectedGraphNodeId}
            showRunGraphFromSelected={runFromSelectedAvailability.visible ?? true}
            canRunGraphFromSelected={runFromSelectedAvailability.enabled}
            runGraphFromSelectedReason={runFromSelectedAvailability.reason}
            onSaveGraph={graphState.saveGraph}
            onValidateGraph={graphState.validateGraph}
            onRestoreRevision={async (restoredGraph) => {
              graphState.changeWorkflowGraph(restoredGraph);
              await subflowsWorkspace.loadSubflowsForProject(workflowsWorkspace.detail?.workflow.project_id);
            }}
            isSavingGraph={graphSaveStatus === "saving"}
          />
        </>
      ) : null}
      <RecordingReviewDialog
        open={Boolean(recordingWorkspace.recordingSession)}
        session={recordingWorkspace.recordingSession}
        draft={recordingWorkspace.recordingDraft}
        workflowName={recordingWorkspace.recordingWorkflowName}
        busy={recordingWorkspace.recordingBusy}
        error={appError}
        onWorkflowNameChange={recordingWorkspace.setRecordingWorkflowName}
        onStopRecording={recordingWorkspace.stopWorkflowRecording}
        onDiscard={() => {
          void recordingWorkspace.discardWorkflowRecording();
        }}
        onSave={() => {
          void recordingWorkspace.saveReviewedRecording({
            workflow_name: recordingWorkspace.recordingWorkflowName,
            add_terminal_success: true,
            save_mode: recordingWorkspace.recordingDraft?.mode === "replace_current_graph" ? "replace_graph" : "create_new",
          });
        }}
        onStepChange={recordingWorkspace.updateRecordingStep}
        onOpenChange={(open) => {
          if (!open) {
            void recordingWorkspace.discardWorkflowRecording();
          }
        }}
      />
      <WorkflowSettingsDialog
        open={workflowSettingsDialogOpen}
        settings={workflowSettings}
        activeSection={workflowSettingsActiveSection}
        browserProfiles={selectedBrowserProfiles}
        selectedBrowserProfileId={workflowProfileDraftId}
        error={appError}
        hasUnsavedChanges={Object.values(workflowSettingsSaveStatuses).some(
          (status) => status === "unsaved",
        )}
        onOpenChange={(open) => {
          if (open) {
            setWorkflowSettingsDialogOpen(true);
            return;
          }
          settingsWorkspace.closeWorkflowSettingsDialog();
        }}
        onActiveSectionChange={settingsWorkspace.setWorkflowSettingsActiveSection}
        onBrowserProfileChange={(profileId) => {
          setWorkflowProfileDraftId(profileId);
          const current = workflowSettings;
          const selectedProfile = selectedBrowserProfiles.find(
            (profile) => profile.id === profileId,
          );
          if (current && selectedProfile) {
            settingsWorkspace.changeWorkflowSettings({
              ...current,
              browser_launch: selectedProfile.browser_launch,
            });
          }
          setWorkflowSettingsSaveStatuses({
            ...workflowSettingsSaveStatuses,
            browser_launch: "unsaved",
          });
        }}
        onSettingsChange={settingsWorkspace.changeWorkflowSettings}
        onSaveSettings={async () => {
          await settingsWorkspace.saveWorkflowSettingsAndClose();
          if (workflowSettings) {
            setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(workflowSettings));
          }
          showToast("Workflow settings saved.");
        }}
        onDiscardChanges={settingsWorkspace.discardWorkflowSettingsChanges}
        saveStatuses={workflowSettingsSaveStatuses}
      />
      <UnsavedChangesDialog
        open={graphExitDialogOpen}
        onKeepEditing={clearGraphExitNavigation}
        onDiscardChanges={discardGraphExitChangesAndNavigate}
        onSaveAndClose={saveGraphExitChangesAndNavigate}
      />
      <AppPackageDialogs
        appError={appError}
        workflowPackageSections={workflowPackageSections}
        exportPackageWorkflow={exportPackageWorkflow}
        exportPackageIncludeFlow={exportPackageIncludeFlow}
        exportPackageSections={exportPackageSections}
        onCloseExportPackageDialog={closeExportPackageDialog}
        onSubmitExportPackage={submitExportPackage}
        onExportPackageIncludeFlowChange={setExportPackageIncludeFlow}
        onExportPackageSectionsChange={setExportPackageSections}
        importPackagePreview={importPackagePreview}
        importPackageIncludeFlow={importPackageIncludeFlow}
        importPackageSections={importPackageSections}
        onCloseImportPackageDialog={closeImportPackageDialog}
        onSubmitImportPackage={submitImportPackage}
        onImportPackageIncludeFlowChange={setImportPackageIncludeFlow}
        onImportPackageSectionsChange={setImportPackageSections}
        isImportProjectPackageOpen={isImportProjectPackageOpen}
        importProjectPackagePreview={importProjectPackagePreview}
        onCloseImportProjectPackageDialog={closeImportProjectPackageDialog}
        onSubmitImportProjectPackage={submitImportProjectPackage}
        deleteWorkflowCandidate={workflowsWorkspace.deleteWorkflowCandidate}
        onConfirmDeleteWorkflow={() => {
          void workflowsWorkspace.confirmDeleteWorkflow();
        }}
        onCancelDeleteWorkflow={workflowsWorkspace.cancelDeleteWorkflow}
        isPackageActionBusy={isPackageActionBusy}
        workflowDialogBusy={workflowsWorkspace.workflowDialogBusy}
      />
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
