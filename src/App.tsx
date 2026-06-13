import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { SettingsHelpPage } from "./features/settings/pages/SettingsHelpPage";
import { useSettingsDiagnostics } from "./features/settings/useSettingsDiagnostics";
import { ProjectProfilesPanel } from "./features/projects/components/ProjectProfilesPanel";
import { OperationsOverviewPage } from "./features/overview/pages/OperationsOverviewPage";
import { useOperationsOverviewWorkspace } from "./features/overview/useOperationsOverviewWorkspace";
import { ProjectEnvironmentSettings } from "./features/projects/components/ProjectEnvironmentSettings";
import { useProjectEnvironmentActions } from "./features/projects/useProjectEnvironmentActions";
import { useIdentityLabWorkspace } from "./features/identities/useIdentityLabWorkspace";
import { ProjectsPage } from "./features/projects/pages/ProjectsPage";
import { SchedulesPage } from "./features/schedules/pages/SchedulesPage";
import { useSchedulesWorkspace } from "./features/schedules/useSchedulesWorkspace";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { SubflowListPage } from "./features/workflows/pages/SubflowListPage";
import { SubflowDetailPage } from "./features/workflows/pages/SubflowDetailPage";
import { AppShell } from "./layouts/AppShell";
import {
  listProjects,
  listProjectEnvironments,
  listSubflows,
  getSubflowGraph,
  saveWorkflowGraph,
  createSubflow,
  saveSubflowGraph,
} from "./lib/workflowApi";
import {
  commandMessage,
  initialRunState,
} from "./lib/workflowUi";
import {
  graphSaveStatusLabel,
  idleRunStateWithRetainedSession,
  latestRunForWorkflow,
  settingsSaveStatuses,
  readGraphAutosaveEnabled,
  writeGraphAutosaveEnabled,
  cloneWorkflowSettings,
  operationsTargetToMissionTarget,
  type GraphSaveStatus,
  type WorkflowSettingsSaveStatus,
} from "./lib/appState";
import { RecordingReviewDialog } from "./features/workflows/components/RecordingReviewDialog";
import { WorkflowSettingsDialog } from "./features/workflows/components/WorkflowSettingsDialog";
import { UnsavedChangesDialog } from "./components/ui/unsaved-changes-dialog";
import { AppPackageDialogs } from "./AppPackageDialogs";
import {
  useAppPackageDialogs,
  workflowPackageSections,
} from "./lib/useAppPackageDialogs";
import type {
  IdentityLabTarget,
  OperationsNavigationTarget,
  RunState,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  GraphValidationIssue,
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
import { useGraphExitNavigation } from "./lib/useGraphExitNavigation";


function App() {
  // --- States ---
  const [appError, setAppError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2200);
  }, []);

  // Shared state references
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings | null>(null);
  const [workflowSettingsSavedSnapshot, setWorkflowSettingsSavedSnapshot] = useState<WorkflowSettings | null>(null);
  const [workflowProfileDraftId, setWorkflowProfileDraftId] = useState<string | null>(null);
  const [workflowProfileSavedId, setWorkflowProfileSavedId] = useState<string | null>(null);
  const [workflowSettingsDialogOpen, setWorkflowSettingsDialogOpen] = useState(false);
  const [workflowSettingsActiveSection, setWorkflowSettingsActiveSection] = useState<WorkflowSettingsSectionId>("general");
  const [workflowSettingsSaveStatuses, setWorkflowSettingsSaveStatuses] = useState<Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>>(settingsSaveStatuses("saved"));
  const [graphAutosaveEnabled, setGraphAutosaveEnabled] = useState(readGraphAutosaveEnabled);
  const [graphSaveStatus, setGraphSaveStatus] = useState<GraphSaveStatus>(graphAutosaveEnabled ? "saved" : "off");
  const [graphRevision, setGraphRevision] = useState(0);
  const [savedGraphRevision, setSavedGraphRevision] = useState(0);
  const [graphIssues, setGraphIssues] = useState<GraphValidationIssue[]>([]);
  const [graphIssuesNeedRecheck, setGraphIssuesNeedRecheck] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
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

  // --- Domain hooks ---
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
    projectEnvironments: projectsWorkspace.projectEnvironments,
    setProjectEnvironments: (envs) => projectsWorkspace.setProjectEnvironments(envs),
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


  const graphState = useWorkflowGraphState({
    detail: workflowsWorkspace.detail,
    workflowGraph,
    setWorkflowGraph,
    graphAutosaveEnabled,
    setGraphAutosaveEnabled,
    graphSaveStatus,
    setGraphSaveStatus,
    graphRevision,
    setGraphRevision,
    savedGraphRevision,
    setSavedGraphRevision,
    graphIssues,
    setGraphIssues,
    selectedGraphNodeId,
    setSelectedGraphNodeId,
    setAppError,
    loadWorkflows: () => workflowsWorkspace.loadWorkflows(),
    graphIssuesNeedRecheck,
    setGraphIssuesNeedRecheck,
  });

  const settingsWorkspace = useWorkflowSettingsState({
    detail: workflowsWorkspace.detail,
    setDetail: workflowsWorkspace.setDetail,
    workflows: workflowsWorkspace.workflows,
    setWorkflows: workflowsWorkspace.setWorkflows,
    projectEnvironments: projectsWorkspace.projectEnvironments,
    setProjectEnvironments: projectsWorkspace.setProjectEnvironments,
    setSelectedProjectId: projectsWorkspace.setSelectedProjectId,
    loadWorkflows: workflowsWorkspace.loadWorkflows,
    setAppError,
    showToast,
    resolveWorkflowProfileId: (environmentId, environments) => {
      if (environmentId && environments.some((environment) => environment.id === environmentId)) {
        return environmentId;
      }
      return environments[0]?.id ?? null;
    },
    workflowSettings,
    setWorkflowSettings,
    workflowSettingsSavedSnapshot,
    setWorkflowSettingsSavedSnapshot,
    workflowSettingsDialogOpen,
    setWorkflowSettingsDialogOpen,
    workflowSettingsActiveSection,
    setWorkflowSettingsActiveSection,
    workflowSettingsSaveStatuses,
    setWorkflowSettingsSaveStatuses,
    workflowProfileDraftId,
    setWorkflowProfileDraftId,
    workflowProfileSavedId,
    setWorkflowProfileSavedId,
  });

  const runWorkspace = useWorkflowRunState({
    detail: workflowsWorkspace.detail,
    workflowGraph,
    selectedGraphNodeId: graphState.selectedGraphNodeId,
    selectedWorkflowId: workflowsWorkspace.selectedWorkflowId,
    activeRunWorkflowName,
    setAppError,
    loadOperationsOverview,
    persistCurrentGraph: () => graphState.persistCurrentGraph(),
    persistDirtyWorkflowSettings: () => settingsWorkspace.saveWorkflowSettingsAndClose().then(() => true).catch(() => false),
    setGraphIssues: graphState.setGraphIssues,
    setGraphIssuesNeedRecheck,
    runState,
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
    createProjectEnvironment,
    updateProjectEnvironment,
    deleteProjectEnvironment,
  } = useProjectEnvironmentActions({
    setAppError,
    setProjectEnvironments: projectsWorkspace.setProjectEnvironments,
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
  } = useAppPackageDialogs({
    currentProjectId: () => projectsWorkspace.currentProjectId(),
    setAppError,
    setToastMessage,
    async onProjectImported(project) {
      projectsWorkspace.setSelectedProjectId(project.id);
      projectsWorkspace.setProjectCollection("workflows");
      projectsWorkspace.setProjects(await listProjects());
      projectsWorkspace.setProjectEnvironments(await listProjectEnvironments(project.id));
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
      graphRevision === savedGraphRevision
    ) {
      return;
    }

    const workflowId = workflowsWorkspace.detail.workflow.id;
    const graphToSave = workflowGraph;
    const revisionToSave = graphRevision;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setGraphSaveStatus("saving");
        try {
          await saveWorkflowGraph(workflowId, graphToSave);
          setSavedGraphRevision((current) => Math.max(current, revisionToSave));
          if (graphRevisionRef.current === revisionToSave) {
            setGraphSaveStatus("saved");
            setAppError("");
          }
        } catch (error) {
          if (graphRevisionRef.current === revisionToSave) {
            setGraphSaveStatus("failed");
          }
          setAppError(commandMessage(error));
        }
      })();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    workflowsWorkspace.detail,
    graphAutosaveEnabled,
    graphRevision,
    savedGraphRevision,
    workflowGraph,
  ]);

  // --- Initial Data Load ---
  useEffect(() => {
    void projectsWorkspace.loadProjectModel();
    void workflowsWorkspace.loadWorkflows();
    void loadSchedules();
    void runWorkspace.refreshRunStates();
    void loadOperationsOverview();
    void loadSettingsDiagnostics();
  }, []);

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
    if (!enabled) {
      setGraphSaveStatus("off");
      return;
    }

    setGraphSaveStatus(
      graphRevisionRef.current === savedGraphRevisionRef.current ? "saved" : "unsaved",
    );
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

  const selectedProjectEnvironments = selectedProject
    ? projectsWorkspace.projectEnvironments.filter(
        (environment) => environment.project_id === selectedProject.id,
      )
    : projectsWorkspace.projectEnvironments;

  return (
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
                : "projects"
      }
      sidebarCollapsed={nav.sidebarCollapsed}
      onOpenOverview={() => nav.openOverview()}
      onOpenProjects={() => nav.openProjects(projectsWorkspace.projectCollection)}
      onOpenSchedules={nav.openSchedules}
      onOpenSettings={nav.openSettings}
      onOpenSettingsHelp={nav.openSettingsHelp}
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
          maintenanceMessage={settingsMaintenanceMessage}
          onGraphAutosaveEnabledChange={updateGraphAutosaveEnabled}
          onInstallBinary={installSettingsBrowserBinary}
          onCleanupProfiles={cleanupSettingsBrowserProfiles}
        />
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
          error={selectedProject ? "" : appError}
          onSelectProject={(projectId) => {
            void projectsWorkspace.selectProject(projectId);
          }}
          onCreateProject={(input) => projectsWorkspace.createProject(input)}
          onImportProjectPackageFile={importProjectPackageFile}
          onCollectionChange={(coll) => projectsWorkspace.setProjectCollection(coll)}
        >
          {projectsWorkspace.projectCollection === "subflows" ? (
            <SubflowListPage
              subflows={subflowsWorkspace.subflows}
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
            />
          ) : projectsWorkspace.projectCollection === "profiles" ? (
            <ProjectProfilesPanel
              project={selectedProject}
              projectEnvironments={selectedProjectEnvironments}
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
              onCreateProjectEnvironment={createProjectEnvironment}
              onUpdateProjectEnvironment={updateProjectEnvironment}
              onDeleteProjectEnvironment={async (environmentId) => {
                await deleteProjectEnvironment(environmentId, selectedProject?.id);
              }}
            />
          ) : projectsWorkspace.projectCollection === "settings" ? (
            <ProjectEnvironmentSettings
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
              appError={appError}
              runState={runState}
              runSnapshots={runSnapshots}
              activeRunWorkflowName={activeRunWorkflowName}
              onWorkflowNameDraftChange={workflowsWorkspace.setWorkflowNameDraft}
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
            />
          )}
        </ProjectsPage>
      ) : nav.screen === "subflow-detail" && subflowsWorkspace.selectedSubflow ? (
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
        />
      ) : nav.screen === "detail" && workflowsWorkspace.detail ? (
        <>
          <WorkflowDetailPage
            detail={workflowsWorkspace.detail}
            projectName={detailProjectName}
            isRunning={isRunning}
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
            onRunGraphFromSelected={runWorkspace.runGraphFromSelectedNode}
            onSelectedGraphNodeChange={graphState.setSelectedGraphNodeId}
            showRunGraphFromSelected={runFromSelectedAvailability.visible ?? true}
            canRunGraphFromSelected={runFromSelectedAvailability.enabled}
            runGraphFromSelectedReason={runFromSelectedAvailability.reason}
            onSaveGraph={graphState.saveGraph}
            onValidateGraph={graphState.validateGraph}
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
        browserProfiles={selectedProjectEnvironments}
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
          setWorkflowSettings((current) => {
            const selectedProfile = selectedProjectEnvironments.find(
              (environment) => environment.id === profileId,
            );
            return current && selectedProfile
              ? { ...current, browser_launch: selectedProfile.browser_launch }
              : current;
          });
          setWorkflowSettingsSaveStatuses((current) => ({
            ...current,
            browser_launch: "unsaved",
          }));
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
      />
      <UnsavedChangesDialog
        open={graphExitDialogOpen}
        onKeepEditing={clearGraphExitNavigation}
        onDiscardChanges={discardGraphExitChangesAndNavigate}
        onSaveAndClose={saveGraphExitChangesAndNavigate}
      />
      {toastMessage ? (
        <div className="toast-alert app-toast" role="status">
          {toastMessage}
        </div>
      ) : null}
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
        deleteBrowserProfileData={workflowsWorkspace.deleteBrowserProfileData}
        onDeleteBrowserProfileDataChange={workflowsWorkspace.setDeleteBrowserProfileData}
        onConfirmDeleteWorkflow={() => {
          void workflowsWorkspace.confirmDeleteWorkflow();
        }}
        onCancelDeleteWorkflow={workflowsWorkspace.cancelDeleteWorkflow}
      />
    </AppShell>
  );
}

export default App;
