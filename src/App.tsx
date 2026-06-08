import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { useSettingsDiagnostics } from "./features/settings/useSettingsDiagnostics";
import { EvidenceExplorerPage } from "./features/evidence/pages/EvidenceExplorerPage";
import { IdentityLabPage } from "./features/identities/pages/IdentityLabPage";
import { OperationsOverviewPage } from "./features/overview/pages/OperationsOverviewPage";
import { useOperationsOverviewWorkspace } from "./features/overview/useOperationsOverviewWorkspace";
import { ProjectEnvironmentSettings } from "./features/projects/components/ProjectEnvironmentSettings";
import { useProjectEnvironmentActions } from "./features/projects/useProjectEnvironmentActions";
import { useIdentityLabWorkspace } from "./features/identities/useIdentityLabWorkspace";
import {
  ProjectsPage,
  type ProjectCollection,
} from "./features/projects/pages/ProjectsPage";
import { SchedulesPage } from "./features/schedules/pages/SchedulesPage";
import { useSchedulesWorkspace } from "./features/schedules/useSchedulesWorkspace";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { SubflowListPage } from "./features/workflows/pages/SubflowListPage";
import { SubflowDetailPage } from "./features/workflows/pages/SubflowDetailPage";
import { AppShell } from "./layouts/AppShell";
import {
  createProject as createProjectCommand,
  createSubflow as createSubflowCommand,
  createWorkflow as createWorkflowCommand,
  deleteSubflow as deleteSubflowCommand,
  deleteProject as deleteProjectCommand,
  deleteWorkflow as deleteWorkflowCommand,
  discardRecordingSession,
  duplicateSubflow as duplicateSubflowCommand,
  duplicateProject as duplicateProjectCommand,
  duplicateWorkflow as duplicateWorkflowCommand,
  generateRecordingDraft,
  getSubflow,
  getSubflowGraph,
  getSubflowUsage,
  getWorkflowGraph,
  getRunState,
  getWorkflow,
  getWorkflowSettings,
  listProjectEnvironments,
  listProjects,
  listRunStates,
  listSubflows,
  listWorkflows,
  resetWorkflowBrowserIdentity as resetWorkflowBrowserIdentityCommand,
  renameWorkflow as renameWorkflowCommand,
  runWorkflow as runWorkflowCommand,
  runWorkflowFromNode as runWorkflowFromNodeCommand,
  saveRecordingDraft,
  saveSubflowGraph,
  saveWorkflowGraph,
  saveWorkflowSettingsSection,
  startRecordingSession,
  stopRecordingSession,
  stopRun as stopRunCommand,
  updateProject as updateProjectCommand,
  validateWorkflowGraph,
} from "./lib/workflowApi";
import { linearGraphFromSteps } from "./features/workflows/lib/workflowGraph";
import { runFromSelectedState } from "./features/workflows/lib/runFromSelected";
import {
  commandMessage,
  initialRunState,
  normalizeRunSnapshot,
  normalizeRunState,
} from "./lib/workflowUi";
import {
  defaultWorkflowSettings,
  withWorkflowSettingsDefaults,
} from "./features/workflows/lib/workflowSettings";
import {
  cloneWorkflowSettings,
  graphEditableContentKey,
  graphSaveStatusLabel,
  idleRunStateWithRetainedSession,
  isWorkflowSettings,
  latestRunForWorkflow,
  latestRunSnapshot,
  legacyRunId,
  operationsTargetToMissionTarget,
  readGraphAutosaveEnabled,
  settingsSaveStatuses,
  writeGraphAutosaveEnabled,
  type GraphSaveStatus,
  type WorkflowSettingsSaveStatus,
} from "./lib/appState";
import { useGraphExitNavigation } from "./lib/useGraphExitNavigation";
import { RecordingReviewDialog } from "./features/workflows/components/RecordingReviewDialog";
import { WorkflowSettingsDialog } from "./features/workflows/components/WorkflowSettingsDialog";
import { UnsavedChangesDialog } from "./components/ui/unsaved-changes-dialog";
import { AppPackageDialogs } from "./AppPackageDialogs";
import { useEvidenceWorkspace } from "./features/evidence/useEvidenceWorkspace";
import {
  useAppPackageDialogs,
  workflowPackageSections,
} from "./lib/useAppPackageDialogs";
import type {
  GraphValidationIssue,
  Project,
  ProjectEnvironment,
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
  EvidenceListRequest,
  IdentityLabTarget,
  MissionControlTarget,
  OperationsNavigationTarget,
  RunState,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  WorkflowCreateOptions,
  WorkflowGraph,
  WorkflowDetail,
  WorkflowRunSnapshot,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "./types/workflow";
import "./App.css";

type AppScreen = "overview" | "projects" | "detail" | "subflow-detail" | "settings" | "schedules" | "evidence" | "identities";
type SubflowBackTarget =
  | { type: "subflows" }
  | { type: "workflow-detail"; workflowId: string; workflowName: string };
type WorkflowDialogMode = "create" | "edit" | null;
type OverviewFocus = NonNullable<Extract<MissionControlTarget, { type: "overview" }>["focus"]>;

function App() {
  const [screen, setScreen] = useState<AppScreen>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectCollection, setProjectCollection] =
    useState<ProjectCollection>("workflows");
  const [projectEnvironments, setProjectEnvironments] = useState<ProjectEnvironment[]>([]);
  const [subflows, setSubflows] = useState<SubflowSummary[]>([]);
  const [subflowsLoading, setSubflowsLoading] = useState(false);
  const [selectedSubflow, setSelectedSubflow] = useState<Subflow | null>(null);
  const [selectedSubflowGraph, setSelectedSubflowGraph] =
    useState<WorkflowGraph | null>(null);
  const [selectedSubflowUsage, setSelectedSubflowUsage] = useState<SubflowUsage[]>([]);
  const [subflowBackTarget, setSubflowBackTarget] = useState<SubflowBackTarget>({
    type: "subflows",
  });
  const [subflowGraphSaveStatus, setSubflowGraphSaveStatus] =
    useState<GraphSaveStatus>("saved");
  const [overviewFocus, setOverviewFocus] = useState<OverviewFocus | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [workflowSettings, setWorkflowSettings] =
    useState<WorkflowSettings | null>(null);
  const [workflowSettingsSavedSnapshot, setWorkflowSettingsSavedSnapshot] =
    useState<WorkflowSettings | null>(null);
  const [workflowSettingsDialogOpen, setWorkflowSettingsDialogOpen] =
    useState(false);
  const [workflowSettingsActiveSection, setWorkflowSettingsActiveSection] =
    useState<WorkflowSettingsSectionId>("general");
  const [workflowSettingsSaveStatuses, setWorkflowSettingsSaveStatuses] =
    useState<Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>>(
      settingsSaveStatuses("saved"),
    );
  const [graphAutosaveEnabled, setGraphAutosaveEnabled] = useState(
    readGraphAutosaveEnabled,
  );
  const [graphSaveStatus, setGraphSaveStatus] = useState<GraphSaveStatus>(
    graphAutosaveEnabled ? "saved" : "off",
  );
  const [graphRevision, setGraphRevision] = useState(0);
  const [savedGraphRevision, setSavedGraphRevision] = useState(0);
  const [graphIssues, setGraphIssues] = useState<GraphValidationIssue[]>([]);
  const [graphIssuesNeedRecheck, setGraphIssuesNeedRecheck] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [runSnapshots, setRunSnapshots] = useState<WorkflowRunSnapshot[]>([]);
  const [activeRunWorkflowName, setActiveRunWorkflowName] =
    useState<string | null>(null);
  const [workflowDialogMode, setWorkflowDialogMode] =
    useState<WorkflowDialogMode>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
  const [workflowEnvironmentDraft, setWorkflowEnvironmentDraft] =
    useState("project_default");
  const [recordingSession, setRecordingSession] =
    useState<RecordingSession | null>(null);
  const [recordingDraft, setRecordingDraft] =
    useState<RecordingWorkflowDraft | null>(null);
  const [recordingWorkflowName, setRecordingWorkflowName] =
    useState("Recorded workflow");
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [deleteWorkflowCandidate, setDeleteWorkflowCandidate] =
    useState<WorkflowSummary | null>(null);
  const [deleteBrowserProfileData, setDeleteBrowserProfileData] = useState(false);
  const [appError, setAppError] = useState("");
  const {
    page: evidencePage,
    query: evidenceQuery,
    loading: evidenceLoading,
    selectedEvidenceId,
    detail: evidenceDetail,
    detailLoading: evidenceDetailLoading,
    detailError: evidenceDetailError,
    preview: evidencePreview,
    exportResult: evidenceExportResult,
    loadEvidencePage,
    updateEvidenceQuery,
    selectEvidence,
    previewEvidenceScreenshot,
    revealEvidence,
    exportSelectedEvidence,
    setDetailError: setEvidenceDetailError,
  } = useEvidenceWorkspace({ setAppError });
  const {
    overview: operationsOverview,
    loading: operationsOverviewLoading,
    loadOperationsOverview,
  } = useOperationsOverviewWorkspace({ setAppError });
  const [toastMessage, setToastMessage] = useState("");
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2200);
  }, []);
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
  const {
    updateProjectEnvironment,
    resetProjectEnvironmentBrowserIdentity,
  } = useProjectEnvironmentActions({
    setAppError,
    setProjectEnvironments,
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
    currentProjectId,
    setAppError,
    setToastMessage,
    async onProjectImported(project) {
      setSelectedProjectId(project.id);
      setProjectCollection("workflows");
      setProjects(await listProjects());
      setProjectEnvironments(await listProjectEnvironments(project.id));
      setSubflows(await listSubflows(project.id));
      await loadWorkflows();
    },
    async onWorkflowImported(workflowId) {
      await loadWorkflows();
      await openWorkflow(workflowId);
    },
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
    onIdentityReset: loadWorkflows,
  });
  const graphRevisionRef = useRef(graphRevision);
  const savedGraphRevisionRef = useRef(savedGraphRevision);
  const {
    graphExitDialogOpen,
    requestGraphExitNavigation,
    clearGraphExitNavigation,
    discardGraphExitChangesAndNavigate,
    saveGraphExitChangesAndNavigate,
  } = useGraphExitNavigation({
    workflow: {
      active: screen === "detail" && Boolean(detail && workflowGraph),
      graphAutosaveEnabled,
      graphSaveStatus,
      graphRevision,
      savedGraphRevision,
      persistCurrentGraph,
      discardWorkflowGraph({ savedGraphRevision, graphSaveStatus }) {
        savedGraphRevisionRef.current = savedGraphRevision;
        setSavedGraphRevision(savedGraphRevision);
        setGraphSaveStatus(graphSaveStatus);
      },
    },
    subflow: {
      active: screen === "subflow-detail" && Boolean(selectedSubflow && selectedSubflowGraph),
      graphSaveStatus: subflowGraphSaveStatus,
      saveCurrentSubflowGraph,
      discardSubflowGraph() {
        setSubflowGraphSaveStatus("saved");
      },
    },
  });

  useEffect(() => {
    graphRevisionRef.current = graphRevision;
  }, [graphRevision]);

  useEffect(() => {
    savedGraphRevisionRef.current = savedGraphRevision;
  }, [savedGraphRevision]);

  useEffect(() => {
    void loadProjectModel();
    void loadWorkflows();
    void loadSchedules();
    void refreshRunStates();
    void loadOperationsOverview();
  }, []);

  useEffect(() => {
    if (!runSnapshots.some((snapshot) => snapshot.state.status === "running")) return;

    const intervalId = window.setInterval(() => {
      void refreshRunStates();
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [runSnapshots]);

  useEffect(() => {
    if (
      !graphAutosaveEnabled ||
      !detail ||
      !workflowGraph ||
      graphRevision === savedGraphRevision
    ) {
      return;
    }

    const workflowId = detail.workflow.id;
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
    detail,
    graphAutosaveEnabled,
    graphRevision,
    savedGraphRevision,
    workflowGraph,
  ]);

  async function loadWorkflows() {
    const items = await listWorkflows();
    setWorkflows(items);
  }

  async function loadProjectModel() {
    try {
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);
      const projectId =
        selectedProjectId && loadedProjects.some((project) => project.id === selectedProjectId)
          ? selectedProjectId
          : loadedProjects[0]?.id ?? null;
      setSelectedProjectId(projectId);
      if (!projectId) {
        setProjectEnvironments([]);
        return { projects: loadedProjects, environments: [] as ProjectEnvironment[] };
      }
      const environments = await listProjectEnvironments(projectId);
      setProjectEnvironments(environments);
      return { projects: loadedProjects, environments };
    } catch (error) {
      setAppError(commandMessage(error));
      return { projects: [] as Project[], environments: [] as ProjectEnvironment[] };
    }
  }

  function currentProjectId() {
    return (
      selectedProjectId ??
      projects[0]?.id ??
      projectEnvironments[0]?.project_id ??
      workflows.find((workflow) => workflow.project_id)?.project_id ??
      null
    );
  }

  async function ensureProjectId() {
    const existingProjectId = currentProjectId();
    if (existingProjectId) return existingProjectId;
    const loaded = await loadProjectModel();
    const projectId = loaded.projects[0]?.id ?? null;
    setSelectedProjectId(projectId);
    return projectId;
  }

  function workflowCreateOptions(
    projectId: string,
    environmentDraft: string,
  ): WorkflowCreateOptions {
    if (environmentDraft.startsWith("existing:")) {
      return {
        project_id: projectId,
        environment: {
          mode: "existing",
          environment_id: environmentDraft.slice("existing:".length),
        },
      };
    }
    if (environmentDraft === "isolated") {
      return {
        project_id: projectId,
        environment: { mode: "isolated" },
      };
    }
    return {
      project_id: projectId,
      environment: { mode: "project_default" },
    };
  }

  async function loadSubflowsForProject(projectId?: string | null) {
    setSubflowsLoading(true);
    try {
      const resolvedProjectId = projectId ?? (await ensureProjectId());
      if (!resolvedProjectId) {
        setSubflows([]);
        setAppError("Project not found");
        return [];
      }
      const items = await listSubflows(resolvedProjectId);
      setSubflows(items);
      setAppError("");
      return items;
    } catch (error) {
      setAppError(commandMessage(error));
      return [];
    } finally {
      setSubflowsLoading(false);
    }
  }

  async function selectProject(projectId: string) {
    setAppError("");
    if (projectId !== selectedProjectId) {
      setProjectCollection("workflows");
    }
    setSelectedProjectId(projectId);
    try {
      const environments = await listProjectEnvironments(projectId);
      setProjectEnvironments(environments);
      await loadSubflowsForProject(projectId);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function createProject(input: { name: string; description?: string | null }) {
    setAppError("");
    try {
      const project = await createProjectCommand(input);
      setSelectedProjectId(project.id);
      setProjectCollection("workflows");
      setProjects(await listProjects());
      await loadWorkflows();
      setProjectEnvironments(await listProjectEnvironments(project.id));
      setSubflows(await listSubflows(project.id));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function updateProject(
    projectId: string,
    input: { name?: string; description?: string | null },
  ) {
    setAppError("");
    try {
      const project = await updateProjectCommand(projectId, input);
      setSelectedProjectId(project.id);
      setProjects(await listProjects());
      showToast("Project updated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function duplicateProject(projectId: string) {
    setAppError("");
    try {
      const project = await duplicateProjectCommand(projectId);
      setSelectedProjectId(project.id);
      setProjectCollection("settings");
      setProjects(await listProjects());
      setProjectEnvironments(await listProjectEnvironments(project.id));
      setSubflows(await listSubflows(project.id));
      await loadWorkflows();
      showToast("Project duplicated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteProject(projectId: string) {
    setAppError("");
    try {
      await deleteProjectCommand(projectId);
      const loadedProjects = await listProjects();
      const nextProjectId = loadedProjects[0]?.id ?? null;
      setProjects(loadedProjects);
      setSelectedProjectId(nextProjectId);
      if (nextProjectId) {
        setProjectEnvironments(await listProjectEnvironments(nextProjectId));
        setSubflows(await listSubflows(nextProjectId));
      } else {
        setProjectEnvironments([]);
        setSubflows([]);
      }
      await loadWorkflows();
      showToast("Project deleted.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function refreshRunStates() {
    try {
      const snapshots = (await listRunStates()).map(normalizeRunSnapshot);
      setRunSnapshots(snapshots);
      const selectedSnapshot = selectedWorkflowId
        ? latestRunForWorkflow(snapshots, selectedWorkflowId)
        : latestRunSnapshot(snapshots);
      if (selectedSnapshot) {
        setRunState(selectedSnapshot.state);
        setActiveRunWorkflowName(selectedSnapshot.workflow_name);
        return;
      }
    } catch {
      // Fall back to the legacy single-run state when older test bridges omit listRunStates.
    }
    const state = await getRunState();
    const normalizedState = normalizeRunState(state);
    setRunState(normalizedState);
    if (selectedWorkflowId) {
      setRunSnapshots((current) =>
        current.map((snapshot) =>
          snapshot.run_id === legacyRunId(selectedWorkflowId)
            ? normalizeRunSnapshot({
                ...snapshot,
                state: normalizedState,
              })
            : snapshot,
        ),
      );
    }
  }

  function upsertRunSnapshot(
    snapshot: WorkflowRunSnapshot | RunState,
    context?: { workflowId: string; workflowName: string },
  ) {
    const fallbackWorkflowId =
      "workflow_id" in snapshot && snapshot.workflow_id
        ? snapshot.workflow_id
        : (context?.workflowId ?? selectedWorkflowId ?? detail?.workflow.id ?? null);
    const fallbackWorkflowName =
      "workflow_name" in snapshot && snapshot.workflow_name
        ? snapshot.workflow_name
        : (context?.workflowName ?? detail?.workflow.name ?? activeRunWorkflowName ?? "");
    const normalized = normalizeRunSnapshot({
      ...snapshot,
      run_id:
        "run_id" in snapshot && snapshot.run_id
          ? snapshot.run_id
          : legacyRunId(fallbackWorkflowId),
      workflow_id: fallbackWorkflowId,
      workflow_name: fallbackWorkflowName,
      source: "source" in snapshot && snapshot.source ? snapshot.source : "manual",
      started_at:
        "started_at" in snapshot && snapshot.started_at
          ? snapshot.started_at
          : new Date().toISOString(),
      state: "state" in snapshot && snapshot.state ? snapshot.state : snapshot,
    } as WorkflowRunSnapshot);
    setRunSnapshots((current) => [
      ...current.filter((item) => item.run_id !== normalized.run_id),
      normalized,
    ]);
    setRunState(normalized.state);
    setActiveRunWorkflowName(normalized.workflow_name);
    return normalized;
  }

  async function openWorkflow(id: string) {
    await requestGraphExitNavigation(() => performOpenWorkflow(id));
  }

  async function performOpenWorkflow(id: string) {
    setAppError("");

    try {
      const loaded = await getWorkflow(id);
      if (!loaded) {
        setScreen("projects");
        setProjectCollection("workflows");
        setSelectedWorkflowId(null);
        setDetail(null);
        setWorkflowGraph(null);
        setWorkflowSettings(null);
        setSelectedGraphNodeId(null);
        setGraphIssues([]);
        setGraphIssuesNeedRecheck(false);
        setAppError("Workflow not found");
        return;
      }

      setSelectedWorkflowId(id);
      setDetail(loaded);
      const workflowProjectId = loaded.workflow.project_id ?? currentProjectId();
      if (workflowProjectId) {
        setSelectedProjectId(workflowProjectId);
        try {
          setProjectEnvironments(await listProjectEnvironments(workflowProjectId));
        } catch {
          // Keep the workflow detail usable even if project metadata is temporarily unavailable.
        }
        await loadSubflowsForProject(workflowProjectId);
      }
      try {
        setWorkflowGraph(await getWorkflowGraph(id));
      } catch {
        setWorkflowGraph(linearGraphFromSteps(loaded.steps));
      }
      try {
        const loadedSettings = await getWorkflowSettings(id);
        const normalizedSettings = withWorkflowSettingsDefaults(loadedSettings, {
          workflowId: id,
          workflowName: loaded.workflow.name,
          createdAt: loaded.workflow.created_at,
          updatedAt: loaded.workflow.updated_at,
        });
        setWorkflowSettings(normalizedSettings);
        setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(normalizedSettings));
      } catch {
        const fallbackSettings = defaultWorkflowSettings({
          workflowId: id,
          workflowName: loaded.workflow.name,
          createdAt: loaded.workflow.created_at,
          updatedAt: loaded.workflow.updated_at,
        });
        setWorkflowSettings(fallbackSettings);
        setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(fallbackSettings));
      }
      setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
      graphRevisionRef.current = 0;
      savedGraphRevisionRef.current = 0;
      setGraphRevision(0);
      setSavedGraphRevision(0);
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      const workflowRun = latestRunForWorkflow(runSnapshots, id);
      setRunState((current) =>
        workflowRun
          ? workflowRun.state
          : idleRunStateWithRetainedSession(current),
      );
      setSelectedGraphNodeId(null);
      setSidebarCollapsed(true);
      setScreen("detail");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function openCreateWorkflowDialog() {
    setWorkflowDialogMode("create");
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setWorkflowEnvironmentDraft("project_default");
    setAppError("");
    void loadProjectModel();
  }

  function openEditWorkflowDialog(workflow: WorkflowSummary) {
    void openWorkflowSettings(workflow, "general");
  }

  function closeWorkflowDialog() {
    setWorkflowDialogMode(null);
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setWorkflowEnvironmentDraft("project_default");
    setAppError("");
  }

  async function submitWorkflowDialog(event: React.FormEvent) {
    event.preventDefault();
    setAppError("");

    try {
      if (workflowDialogMode === "create") {
        const projectId = await ensureProjectId();
        if (!projectId) {
          setAppError("Project not found");
          return;
        }
        const created = await createWorkflowCommand(
          workflowNameDraft,
          workflowCreateOptions(projectId, workflowEnvironmentDraft),
        );
        closeWorkflowDialog();
        await loadWorkflows();
        await openWorkflow(created.id);
        return;
      }

      if (workflowDialogMode === "edit" && editingWorkflowId) {
        await renameWorkflowCommand(editingWorkflowId, workflowNameDraft);
        if (detail?.workflow.id === editingWorkflowId) {
          setDetail({
            ...detail,
            workflow: { ...detail.workflow, name: workflowNameDraft },
          });
        }
        closeWorkflowDialog();
        await loadWorkflows();
      }
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function deleteWorkflow(id: string) {
    setAppError("");
    setDeleteBrowserProfileData(true);
    setDeleteWorkflowCandidate(
      workflows.find((workflow) => workflow.id === id) ?? null,
    );
  }

  async function confirmDeleteWorkflow() {
    if (!deleteWorkflowCandidate) return;
    const id = deleteWorkflowCandidate.id;
    setAppError("");

    try {
      await deleteWorkflowCommand(id, {
        deleteBrowserProfile: deleteBrowserProfileData,
      });
      setDeleteWorkflowCandidate(null);
      setDeleteBrowserProfileData(false);
      if (selectedWorkflowId === id) {
        setSelectedWorkflowId(null);
        setDetail(null);
        setWorkflowGraph(null);
        setWorkflowSettings(null);
        setGraphIssues([]);
        setGraphIssuesNeedRecheck(false);
        setScreen("projects");
        setProjectCollection("workflows");
      }
      await loadWorkflows();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function duplicateWorkflow(workflow: WorkflowSummary) {
    setAppError("");
    const copyName = `Copy of ${workflow.name}`;

    try {
      await duplicateWorkflowCommand(workflow.id, copyName);
      await loadWorkflows();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function createProjectSubflow(input: { name: string; description?: string | null }) {
    setAppError("");
    const projectId = await ensureProjectId();
    if (!projectId) {
      setAppError("Project not found");
      return;
    }

    try {
      await createSubflowCommand(projectId, input);
      await loadSubflowsForProject(projectId);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function createWorkflowSelectionSubflow(input: {
    name: string;
    graph: WorkflowGraph;
  }) {
    setAppError("");
    const projectId = detail?.workflow.project_id ?? (await ensureProjectId());
    if (!projectId) {
      setAppError("Project not found");
      throw new Error("Project not found");
    }

    try {
      const createdSubflow = await createSubflowCommand(projectId, {
        name: input.name,
        description: null,
      });
      await saveSubflowGraph(createdSubflow.id, input.graph);
      await loadSubflowsForProject(projectId);
      return createdSubflow;
    } catch (error) {
      const message = commandMessage(error);
      setAppError(message);
      throw new Error(message);
    }
  }

  async function duplicateProjectSubflow(subflow: SubflowSummary | Subflow) {
    setAppError("");
    try {
      await duplicateSubflowCommand(subflow.id, `Copy of ${subflow.name}`);
      await loadSubflowsForProject(subflow.project_id);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteProjectSubflow(subflow: SubflowSummary | Subflow) {
    setAppError("");
    try {
      await deleteSubflowCommand(subflow.id);
      await loadSubflowsForProject(subflow.project_id);
      if (selectedSubflow?.id === subflow.id) {
        setSelectedSubflow(null);
        setSelectedSubflowGraph(null);
        setSelectedSubflowUsage([]);
        setScreen("projects");
        setProjectCollection("subflows");
      }
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function openSubflowDetail(
    subflowId: string,
    backTarget: SubflowBackTarget = { type: "subflows" },
  ) {
    await requestGraphExitNavigation(() =>
      performOpenSubflowDetail(subflowId, backTarget),
    );
  }

  async function performOpenSubflowDetail(
    subflowId: string,
    backTarget: SubflowBackTarget = { type: "subflows" },
  ) {
    setAppError("");
    try {
      const loadedSubflow = await getSubflow(subflowId);
      if (!loadedSubflow) {
        setAppError("Subflow not found");
        setScreen("projects");
        setProjectCollection("subflows");
        return;
      }
      const [graph, usage] = await Promise.all([
        getSubflowGraph(subflowId),
        getSubflowUsage(subflowId),
      ]);
      setSelectedSubflow(loadedSubflow);
      setSelectedSubflowGraph(graph);
      setSelectedSubflowUsage(usage);
      setSubflowBackTarget(backTarget);
      setSubflowGraphSaveStatus("saved");
      setSidebarCollapsed(true);
      setScreen("subflow-detail");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function changeSubflowGraph(nextGraph: WorkflowGraph) {
    const hasEditableChange =
      graphEditableContentKey(selectedSubflowGraph) !== graphEditableContentKey(nextGraph);
    setSelectedSubflowGraph(nextGraph);
    if (!hasEditableChange) return;
    setSubflowGraphSaveStatus("unsaved");
  }

  async function saveCurrentSubflowGraph() {
    if (!selectedSubflow || !selectedSubflowGraph) return true;
    setAppError("");
    setSubflowGraphSaveStatus("saving");
    try {
      await saveSubflowGraph(selectedSubflow.id, selectedSubflowGraph);
      setSubflowGraphSaveStatus("saved");
      setSelectedSubflowUsage(await getSubflowUsage(selectedSubflow.id));
      await loadSubflowsForProject(selectedSubflow.project_id);
      return true;
    } catch (error) {
      setSubflowGraphSaveStatus("failed");
      setAppError(commandMessage(error));
      return false;
    }
  }

  async function startWorkflowRecording() {
    setAppError("");
    setRecordingDraft(null);
    setRecordingWorkflowName("Recorded workflow");
    setRecordingBusy(true);

    try {
      const session = await startRecordingSession({
        mode: "new_workflow",
        workflow_name: "Recorded workflow",
      });
      setRecordingSession(session);
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingBusy(false);
    }
  }

  async function stopWorkflowRecording() {
    if (!recordingSession) return;
    setAppError("");
    setRecordingBusy(true);

    try {
      const stopped = await stopRecordingSession(recordingSession.id);
      setRecordingSession(stopped);
      const draft = await generateRecordingDraft(stopped.id, {
        include_event_ids: null,
        add_terminal_success: true,
      });
      setRecordingDraft(draft);
      setRecordingWorkflowName(
        draft.workflow_settings_snapshot.general.name || "Recorded workflow",
      );
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingBusy(false);
    }
  }

  async function discardWorkflowRecording() {
    const sessionId = recordingSession?.id ?? recordingDraft?.session_id ?? null;
    setAppError("");
    setRecordingBusy(true);
    try {
      if (sessionId) {
        await discardRecordingSession(sessionId);
      }
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingSession(null);
      setRecordingDraft(null);
      setRecordingWorkflowName("Recorded workflow");
      setRecordingBusy(false);
    }
  }

  function updateRecordingStep(step: ReviewedRecordingStep) {
    setRecordingDraft((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((candidate) =>
              candidate.id === step.id ? step : candidate,
            ),
          }
        : current,
    );
  }

  async function saveReviewedRecording() {
    if (!recordingDraft) return;
    setAppError("");
    setRecordingBusy(true);

    try {
      const saved = await saveRecordingDraft(recordingDraft.id, {
        workflow_name: recordingWorkflowName,
        save_mode:
          recordingDraft.mode === "replace_current_graph"
            ? "replace_graph"
            : "create_new",
        reviewed_steps: recordingDraft.steps,
        add_terminal_success: true,
      });
      setRecordingSession(null);
      setRecordingDraft(null);
      setRecordingWorkflowName("Recorded workflow");
      await loadWorkflows();
      await openWorkflow(saved.workflow.id);
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingBusy(false);
    }
  }

  async function persistCurrentGraph() {
    if (!detail || !workflowGraph) return;
    setAppError("");
    setGraphSaveStatus("saving");

    try {
      await saveWorkflowGraph(detail.workflow.id, workflowGraph);
      setSavedGraphRevision(graphRevisionRef.current);
      savedGraphRevisionRef.current = graphRevisionRef.current;
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      await loadWorkflows();
      return true;
    } catch (error) {
      setGraphSaveStatus("failed");
      setAppError(commandMessage(error));
      return false;
    }
  }

  async function persistWorkflowSettingsSection(
    section: WorkflowSettingsSectionId,
    { force = false } = {},
  ) {
    if (!workflowSettings) return true;
    if (!force && workflowSettingsSaveStatuses[section] === "saved") return true;
    setAppError("");
    setWorkflowSettingsSaveStatuses((current) => ({
      ...current,
      [section]: "saving",
    }));

    try {
      const saved = await saveWorkflowSettingsSection(
        workflowSettings.workflow_id,
        section,
        workflowSettings[section],
      );
      const nextSettings = isWorkflowSettings(saved) ? saved : workflowSettings;
      setWorkflowSettings(nextSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
      if (section === "general") {
        updateLoadedWorkflowName(nextSettings.general.name);
      }
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [section]: "saved",
      }));
      await loadWorkflows();
      return true;
    } catch (error) {
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [section]: "failed",
      }));
      setAppError(commandMessage(error));
      return false;
    }
  }

  async function persistDirtyWorkflowSettings() {
    for (const section of Object.keys(workflowSettingsSaveStatuses) as WorkflowSettingsSectionId[]) {
      if (workflowSettingsSaveStatuses[section] === "unsaved") {
        const saved = await persistWorkflowSettingsSection(section, { force: true });
        if (!saved) return false;
      }
    }

    return true;
  }

  async function persistWorkflowSettings() {
    const saved = await persistDirtyWorkflowSettings();
    if (!saved) return false;
    if (workflowSettings) {
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(workflowSettings));
    }
    showToast("Workflow settings saved.");
    return true;
  }

  async function resetWorkflowBrowserIdentity() {
    if (!workflowSettings) return;
    const saved = await persistDirtyWorkflowSettings();
    if (!saved) return;
    setAppError("");
    try {
      const rotated = await resetWorkflowBrowserIdentityCommand(workflowSettings.workflow_id);
      setWorkflowSettings(rotated);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(rotated));
      setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
      showToast("Browser identity reset.");
      await loadWorkflows();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function runGraph() {
    if (!detail || !workflowGraph) return;
    setAppError("");

    try {
      const saved = await persistCurrentGraph();
      if (!saved) return;
      const settingsSaved = await persistDirtyWorkflowSettings();
      if (!settingsSaved) return;
      setActiveRunWorkflowName(detail.workflow.name);
      const snapshot = await runWorkflowCommand(detail.workflow.id);
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      upsertRunSnapshot(snapshot, {
        workflowId: detail.workflow.id,
        workflowName: detail.workflow.name,
      });
      await loadOperationsOverview();
    } catch (error) {
      setAppError(commandMessage(error));
      await loadOperationsOverview();
      if (workflowGraph) {
        try {
          setGraphIssues(await validateWorkflowGraph(workflowGraph));
          setGraphIssuesNeedRecheck(false);
        } catch {
          // Keep the command error as the primary system issue when validation cannot run.
        }
      }
    }
  }

  async function runSavedWorkflow(workflow: WorkflowSummary) {
    setAppError("");
    setActiveRunWorkflowName(workflow.name);

    try {
      const state = await runWorkflowCommand(workflow.id);
      upsertRunSnapshot(state, {
        workflowId: workflow.id,
        workflowName: workflow.name,
      });
      await loadOperationsOverview();
    } catch (error) {
      setAppError(commandMessage(error));
      await loadOperationsOverview();
    }
  }

  async function runGraphFromSelectedNode() {
    if (!detail || !workflowGraph || !selectedGraphNodeId) return;
    setAppError("");

    try {
      const saved = await persistCurrentGraph();
      if (!saved) return;
      const settingsSaved = await persistDirtyWorkflowSettings();
      if (!settingsSaved) return;
      setActiveRunWorkflowName(detail.workflow.name);
      const state = await runWorkflowFromNodeCommand(
        detail.workflow.id,
        selectedGraphNodeId,
      );
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      upsertRunSnapshot(state, {
        workflowId: detail.workflow.id,
        workflowName: detail.workflow.name,
      });
    } catch (error) {
      setAppError(commandMessage(error));
      if (workflowGraph) {
        try {
          setGraphIssues(await validateWorkflowGraph(workflowGraph));
          setGraphIssuesNeedRecheck(false);
        } catch {
          // Keep the command error as the primary system issue when validation cannot run.
        }
      }
    }
  }

  async function validateGraph() {
    if (!workflowGraph) return;
    setAppError("");

    try {
      setGraphIssues(await validateWorkflowGraph(workflowGraph));
      setGraphIssuesNeedRecheck(false);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function saveGraph() {
    await persistCurrentGraph();
  }

  async function stopRun(runId?: string | null) {
    setAppError("");

    try {
      const snapshot = await stopRunCommand(runId);
      upsertRunSnapshot(snapshot);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function openProjects(collection: ProjectCollection = "workflows") {
    void requestGraphExitNavigation(() => performOpenProjects(collection));
  }

  function performOpenProjects(collection: ProjectCollection = "workflows") {
    setScreen("projects");
    setProjectCollection(collection);
    setSidebarCollapsed(false);
    setAppError("");
    void (async () => {
      const loaded = await loadProjectModel();
      const projectId =
        selectedProjectId && loaded.projects.some((project) => project.id === selectedProjectId)
          ? selectedProjectId
          : loaded.projects[0]?.id ?? currentProjectId();
      if (collection === "subflows" || collection === "settings") {
        await loadSubflowsForProject(projectId);
      }
    })();
  }

  function changeProjectCollection(collection: ProjectCollection) {
    setProjectCollection(collection);
    if (collection === "subflows") {
      void loadSubflowsForProject();
    }
    if (collection === "settings") {
      void loadProjectModel();
    }
  }

  function backToList() {
    void requestGraphExitNavigation(() => {
      performOpenProjects("workflows");
      void loadWorkflows();
    });
  }

  function openOverview(focus: OverviewFocus | null = null) {
    void requestGraphExitNavigation(() => performOpenOverview(focus));
  }

  function performOpenOverview(focus: OverviewFocus | null = null) {
    setScreen("overview");
    setOverviewFocus(focus);
    setAppError("");
    void loadOperationsOverview();
  }

  function openSettings() {
    void requestGraphExitNavigation(performOpenSettings);
  }

  function performOpenSettings() {
    setScreen("settings");
    setAppError("");
    void loadSettingsDiagnostics();
  }

  function openSchedules() {
    void requestGraphExitNavigation(performOpenSchedules);
  }

  function performOpenSchedules() {
    setScreen("schedules");
    setAppError("");
    setFocusedScheduleId(null);
    void loadSchedules();
  }

  function backFromSubflowDetail() {
    const target = subflowBackTarget;
    void requestGraphExitNavigation(() => {
      setSelectedSubflow(null);
      setSelectedSubflowGraph(null);
      setSelectedSubflowUsage([]);
      setSubflowBackTarget({ type: "subflows" });
      if (target.type === "workflow-detail") {
        setAppError("");
        if (detail?.workflow.id === target.workflowId) {
          setSidebarCollapsed(true);
          setScreen("detail");
          return;
        }
        return openWorkflow(target.workflowId);
      }
      performOpenProjects("subflows");
    });
  }

  function openEvidence(nextQuery: EvidenceListRequest = evidenceQuery) {
    void requestGraphExitNavigation(() => performOpenEvidence(nextQuery));
  }

  function performOpenEvidence(nextQuery: EvidenceListRequest = evidenceQuery) {
    setScreen("evidence");
    setAppError("");
    setEvidenceDetailError("");
    void loadEvidencePage(nextQuery);
  }

  function openIdentities(target: IdentityLabTarget | null = identityLabTarget) {
    void requestGraphExitNavigation(() => performOpenIdentities(target));
  }

  function performOpenIdentities(target: IdentityLabTarget | null = identityLabTarget) {
    setScreen("identities");
    setAppError("");
    setIdentityLabTarget(target);
    void loadIdentityLabOverview(target);
  }

  function openIdentityTarget(target: IdentityLabTarget) {
    openIdentities(target);
  }

  function selectIdentity(workflowId: string, identityId: string) {
    openIdentities({ type: "managed", workflow_id: workflowId, identity_id: identityId });
  }

  function openIdentityEvidence(workflowId: string, identityId: string) {
    openEvidence({ workflow_id: workflowId, identity_id: identityId });
  }

  async function resolveWorkflowSummary(workflowId: string) {
    const cachedWorkflow = workflows.find((item) => item.id === workflowId);
    if (cachedWorkflow) return cachedWorkflow;

    const loaded = await getWorkflow(workflowId);
    if (!loaded) return null;
    const loadedWorkflow: WorkflowSummary = {
      id: loaded.workflow.id,
      name: loaded.workflow.name,
      step_count: loaded.steps.length,
      project_id: loaded.workflow.project_id ?? null,
      environment_id: loaded.workflow.environment_id ?? null,
      created_at: loaded.workflow.created_at,
      updated_at: loaded.workflow.updated_at,
    };
    setWorkflows((current) =>
      current.some((item) => item.id === loadedWorkflow.id)
        ? current.map((item) => item.id === loadedWorkflow.id ? loadedWorkflow : item)
        : [...current, loadedWorkflow],
    );
    return loadedWorkflow;
  }

  async function openWorkflowSettingsById(workflowId: string, missingMessage: string) {
    setAppError("");
    try {
      const workflow = await resolveWorkflowSummary(workflowId);
      if (!workflow) {
        setAppError(missingMessage);
        return;
      }
      await openWorkflowSettings(workflow, "browser_launch");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function openIdentityWorkflowSettings(workflowId: string) {
    await openWorkflowSettingsById(workflowId, "Workflow not found");
  }

  async function openScheduleTarget(
    scheduleId?: string | null,
    scheduleEventId?: string | null,
  ) {
    setScreen("schedules");
    setFocusedScheduleId(scheduleId ?? null);
    setAppError("");
    const items = await loadSchedules();
    if (!scheduleId) return;
    const exists = items.some((schedule) => schedule.id === scheduleId);
    if (!exists) {
      setAppError(
        scheduleEventId
          ? `Schedule event target is no longer available: ${scheduleEventId}`
          : `Schedule target is no longer available: ${scheduleId}`,
      );
      return;
    }
    await loadScheduleHistory(scheduleId);
  }

  async function navigateToMissionControlTarget(target: MissionControlTarget) {
    await requestGraphExitNavigation(() => performNavigateToMissionControlTarget(target));
  }

  async function performNavigateToMissionControlTarget(target: MissionControlTarget) {
    if (target.type === "overview") {
      performOpenOverview(target.focus ?? null);
      return;
    }
    if (target.type === "workflow") {
      if (target.mode === "list") {
        performOpenProjects("workflows");
        void loadWorkflows();
        return;
      }
      if (target.mode === "settings") {
        await openWorkflowSettingsById(
          target.workflow_id,
          `Workflow target is no longer available: ${target.workflow_id}`,
        );
        return;
      }
      await performOpenWorkflow(target.workflow_id);
      return;
    }
    if (target.type === "evidence") {
      performOpenEvidence({
        ...(target.filters ?? {}),
        ...(target.evidence_id ? { focus_evidence_id: target.evidence_id } : {}),
      });
      return;
    }
    if (target.type === "identity") {
      performOpenIdentities(target.target);
      return;
    }
    if (target.type === "schedule") {
      await openScheduleTarget(target.schedule_id, target.schedule_event_id);
      return;
    }
    await performOpenWorkflow(target.workflow_id);
    if (target.node_id) {
      setSelectedGraphNodeId(target.node_id);
    }
  }

  function navigateFromOverview(target: OperationsNavigationTarget) {
    void navigateToMissionControlTarget(operationsTargetToMissionTarget(target));
  }

  function updateGraphAutosaveEnabled(enabled: boolean) {
    setGraphAutosaveEnabled(enabled);
    writeGraphAutosaveEnabled(enabled);
    if (!enabled) {
      setGraphSaveStatus("off");
      return;
    }

    setGraphSaveStatus(
      graphRevisionRef.current === savedGraphRevisionRef.current ? "saved" : "unsaved",
    );
  }

  const changeWorkflowGraph = useCallback((nextGraph: WorkflowGraph) => {
    const hasEditableChange =
      graphEditableContentKey(workflowGraph) !== graphEditableContentKey(nextGraph);
    setWorkflowGraph(nextGraph);
    if (!hasEditableChange) return;
    setGraphIssuesNeedRecheck((current) => current || graphIssues.length > 0);
    setGraphRevision((current) => {
      const nextRevision = current + 1;
      graphRevisionRef.current = nextRevision;
      return nextRevision;
    });
    setGraphSaveStatus(graphAutosaveEnabled ? "unsaved" : "off");
  }, [graphAutosaveEnabled, graphIssues.length, workflowGraph]);

  const changeWorkflowSettings = useCallback(
    (nextSettings: WorkflowSettings) => {
      setWorkflowSettings(nextSettings);
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [workflowSettingsActiveSection]: "unsaved",
      }));
    },
    [workflowSettingsActiveSection],
  );

  async function openWorkflowSettings(
    workflow: WorkflowSummary,
    section: WorkflowSettingsSectionId,
  ) {
    setAppError("");
    setWorkflowSettingsActiveSection(section);

    try {
      const loadedSettings = await getWorkflowSettings(workflow.id);
      const normalizedSettings = withWorkflowSettingsDefaults(loadedSettings, {
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      });
      setWorkflowSettings(normalizedSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(normalizedSettings));
    } catch {
      const fallbackSettings = defaultWorkflowSettings({
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      });
      setWorkflowSettings(fallbackSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(fallbackSettings));
    }
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
    setWorkflowSettingsDialogOpen(true);
  }

  function openDetailWorkflowSettings(section: WorkflowSettingsSectionId) {
    if (!detail) return;
    if (!workflowSettings) {
      const fallbackSettings = defaultWorkflowSettings({
        workflowId: detail.workflow.id,
        workflowName: detail.workflow.name,
        createdAt: detail.workflow.created_at,
        updatedAt: detail.workflow.updated_at,
      });
      setWorkflowSettings(fallbackSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(fallbackSettings));
    }
    setWorkflowSettingsActiveSection(section);
    setWorkflowSettingsDialogOpen(true);
  }

  function closeWorkflowSettingsDialog() {
    setWorkflowSettingsDialogOpen(false);
    setAppError("");
  }

  function discardWorkflowSettingsChanges() {
    if (workflowSettingsSavedSnapshot) {
      setWorkflowSettings(cloneWorkflowSettings(workflowSettingsSavedSnapshot));
    }
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
    closeWorkflowSettingsDialog();
  }

  function updateLoadedWorkflowName(name: string) {
    setDetail((current) =>
      current
        ? {
            ...current,
            workflow: {
              ...current.workflow,
              name,
            },
          }
        : current,
    );
    setWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowSettings?.workflow_id
          ? { ...workflow, name }
          : workflow,
      ),
    );
  }

  const detailRunSnapshot = detail
    ? latestRunForWorkflow(runSnapshots, detail.workflow.id)
    : null;
  const detailRunState = detail
    ? (detailRunSnapshot?.state ?? idleRunStateWithRetainedSession(runState))
    : runState;
  const isRunning = detailRunState.status === "running";
  const runFromSelectedAvailability = workflowGraph
    ? runFromSelectedState({
        graph: workflowGraph,
        selectedNodeId: selectedGraphNodeId,
        settings: workflowSettings,
        runState: detailRunState,
        isRunning,
      })
    : { enabled: false, reason: "No workflow graph is loaded.", visible: false };
  const canSaveWorkflowGraph =
    Boolean(detail && workflowGraph) &&
    graphSaveStatus !== "saving" &&
    (graphRevision !== savedGraphRevision || graphSaveStatus === "failed");
  const canSaveSubflowGraph =
    Boolean(selectedSubflow && selectedSubflowGraph) &&
    subflowGraphSaveStatus !== "saved" &&
    subflowGraphSaveStatus !== "saving";
  const detailEnvironmentName = detail
    ? (
        workflows.find((workflow) => workflow.id === detail.workflow.id)?.environment_name ??
        projectEnvironments.find(
          (environment) => environment.id === detail.workflow.environment_id,
        )?.name ??
        null
      )
    : null;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ??
    projects[0] ??
    null;
  const projectNameForId = (projectId?: string | null) =>
    projectId ? projects.find((project) => project.id === projectId)?.name ?? null : null;
  const detailProjectName = detail
    ? projectNameForId(detail.workflow.project_id) ?? selectedProject?.name ?? null
    : null;
  const selectedSubflowProjectName = selectedSubflow
    ? projectNameForId(selectedSubflow.project_id) ?? selectedProject?.name ?? null
    : null;
  const selectedProjectWorkflows = selectedProject
    ? workflows.filter(
        (workflow) =>
          !workflow.project_id || workflow.project_id === selectedProject.id,
      )
    : workflows;
  const selectedProjectEnvironments = selectedProject
    ? projectEnvironments.filter(
        (environment) => environment.project_id === selectedProject.id,
      )
    : projectEnvironments;

  return (
    <AppShell
      activeItem={
        screen === "settings"
          ? "settings"
          : screen === "schedules"
            ? "schedules"
          : screen === "projects" || screen === "detail" || screen === "subflow-detail"
              ? "projects"
              : screen === "evidence"
                ? "evidence"
                : screen === "identities"
                  ? "identities"
              : screen === "overview"
                ? "overview"
                : "projects"
      }
      sidebarCollapsed={sidebarCollapsed}
      onOpenOverview={() => openOverview()}
      onOpenEvidence={() => openEvidence({})}
      onOpenIdentities={() => openIdentities(null)}
      onOpenProjects={() => openProjects(projectCollection)}
      onOpenSchedules={openSchedules}
      onOpenSettings={openSettings}
      onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
    >
      {screen === "overview" ? (
        <OperationsOverviewPage
          overview={operationsOverview}
          loading={operationsOverviewLoading}
          error={appError}
          focus={overviewFocus}
          onRefresh={loadOperationsOverview}
          onOpenWorkflows={() => openProjects("workflows")}
          onNavigate={navigateFromOverview}
        />
      ) : screen === "evidence" ? (
        <EvidenceExplorerPage
          page={evidencePage}
          detail={evidenceDetail}
          preview={evidencePreview}
          loading={evidenceLoading}
          detailLoading={evidenceDetailLoading}
          error={appError}
          detailError={evidenceDetailError}
          query={evidenceQuery}
          selectedEvidenceId={selectedEvidenceId}
          exportResult={evidenceExportResult}
          onQueryChange={updateEvidenceQuery}
          onRefresh={() => loadEvidencePage(evidenceQuery)}
          onSelectEvidence={selectEvidence}
          onPreviewScreenshot={previewEvidenceScreenshot}
          onRevealArtifact={revealEvidence}
          onExportSelection={exportSelectedEvidence}
          onNavigate={navigateFromOverview}
          onOpenIdentity={openIdentityTarget}
        />
      ) : screen === "identities" ? (
        <IdentityLabPage
          overview={identityLabOverview}
          loading={identityLabLoading}
          error={appError}
          selectedIdentityId={identityLabOverview?.selected?.identity_ref.id ?? identityLabTarget?.identity_id ?? null}
          onRefresh={() => loadIdentityLabOverview(identityLabTarget)}
          onSelect={selectIdentity}
          onOpenEvidence={openIdentityEvidence}
          onOpenWorkflow={(workflowId) => {
            void openWorkflow(workflowId);
          }}
          onOpenWorkflowSettings={(workflowId) => {
            void openIdentityWorkflowSettings(workflowId);
          }}
          onCloseRetainedSession={(workflowId, profileName) => {
            void closeIdentitySession(workflowId, profileName);
          }}
          onResetIdentity={(workflowId) => resetIdentityFromLab(workflowId)}
          onOpenIdentityTarget={openIdentityTarget}
        />
      ) : screen === "settings" ? (
        <SettingsPage
          graphAutosaveEnabled={graphAutosaveEnabled}
          diagnostics={settingsDiagnostics}
          diagnosticsLoading={settingsDiagnosticsLoading}
          diagnosticsError={settingsDiagnosticsError}
          maintenanceMessage={settingsMaintenanceMessage}
          onGraphAutosaveEnabledChange={updateGraphAutosaveEnabled}
          onRefreshDiagnostics={loadSettingsDiagnostics}
          onInstallBinary={installSettingsBrowserBinary}
          onCleanupProfiles={cleanupSettingsBrowserProfiles}
        />
      ) : screen === "schedules" ? (
        <SchedulesPage
          schedules={schedules}
          workflows={workflows}
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
            void navigateToMissionControlTarget({ type: "workflow", workflow_id: workflowId });
          }}
        />
      ) : screen === "projects" ? (
        <ProjectsPage
          projects={projects}
          selectedProject={selectedProject}
          activeCollection={projectCollection}
          error={selectedProject ? "" : appError}
          onSelectProject={(projectId) => {
            void selectProject(projectId);
          }}
          onCreateProject={createProject}
          onImportProjectPackageFile={importProjectPackageFile}
          onCollectionChange={changeProjectCollection}
        >
          {projectCollection === "subflows" ? (
            <SubflowListPage
              subflows={subflows}
              loading={subflowsLoading}
              error={appError}
              onCreateSubflow={createProjectSubflow}
              onDuplicateSubflow={duplicateProjectSubflow}
              onDeleteSubflow={deleteProjectSubflow}
              onOpenSubflow={(subflowId) => {
                void openSubflowDetail(subflowId);
              }}
              onRefresh={() => {
                void loadSubflowsForProject();
              }}
            />
          ) : projectCollection === "settings" ? (
            <ProjectEnvironmentSettings
              project={selectedProject}
              projectEnvironments={selectedProjectEnvironments}
              error={appError}
              onUpdateProject={updateProject}
              onDuplicateProject={duplicateProject}
              onExportProjectPackage={exportProjectPackageFile}
              onDeleteProject={deleteProject}
              onUpdateProjectEnvironment={updateProjectEnvironment}
              onResetProjectEnvironmentBrowserIdentity={
                resetProjectEnvironmentBrowserIdentity
              }
            />
          ) : (
            <WorkflowListPage
              workflows={selectedProjectWorkflows}
              workflowDialogMode={workflowDialogMode}
              workflowNameDraft={workflowNameDraft}
              workflowEnvironmentDraft={workflowEnvironmentDraft}
              appError={appError}
              runState={runState}
              runSnapshots={runSnapshots}
              activeRunWorkflowName={activeRunWorkflowName}
              onWorkflowNameDraftChange={setWorkflowNameDraft}
              onWorkflowEnvironmentDraftChange={setWorkflowEnvironmentDraft}
              onSubmitWorkflowDialog={submitWorkflowDialog}
              onOpenCreateWorkflow={openCreateWorkflowDialog}
              onOpenEditWorkflow={openEditWorkflowDialog}
              onDuplicateWorkflow={duplicateWorkflow}
              onRunWorkflow={runSavedWorkflow}
              onStopRun={(runId) => stopRun(runId)}
              onOpenExportWorkflow={openExportPackageDialog}
              onImportWorkflowPackageFile={importWorkflowPackageFile}
              onRecordWorkflow={startWorkflowRecording}
              onCloseWorkflowDialog={closeWorkflowDialog}
              onOpenWorkflow={(id) => {
                void openWorkflow(id);
              }}
              onDeleteWorkflow={deleteWorkflow}
            />
          )}
        </ProjectsPage>
      ) : screen === "subflow-detail" && selectedSubflow ? (
        <SubflowDetailPage
          subflow={selectedSubflow}
          projectName={selectedSubflowProjectName}
          usage={selectedSubflowUsage}
          graph={selectedSubflowGraph}
          graphSaveStatus={graphSaveStatusLabel(subflowGraphSaveStatus)}
          canSaveGraph={canSaveSubflowGraph}
          appError={appError}
          backLabel={
            subflowBackTarget.type === "workflow-detail"
              ? "Back to Workflow"
              : "Back to Subflows"
          }
          breadcrumbLabel={
            subflowBackTarget.type === "workflow-detail"
              ? subflowBackTarget.workflowName
              : "Subflows"
          }
          onBack={backFromSubflowDetail}
          onGraphChange={changeSubflowGraph}
          onSaveGraph={() => {
            void saveCurrentSubflowGraph();
          }}
        />
      ) : screen === "detail" && detail ? (
        <>
          <WorkflowDetailPage
            detail={detail}
            environmentName={detailEnvironmentName}
            projectName={detailProjectName}
            isRunning={isRunning}
            appError={appError}
            graphSaveStatus={graphSaveStatusLabel(graphSaveStatus)}
            canSaveGraph={canSaveWorkflowGraph}
            runState={detailRunState}
            workflowGraph={workflowGraph}
            graphIssues={graphIssues}
            subflowOptions={subflows}
            graphIssuesNeedRecheck={graphIssuesNeedRecheck}
            defaultEdgeDelay={workflowSettings?.graph_defaults?.default_edge_delay ?? null}
            liveRunEnabled={workflowSettings?.graph_defaults?.live_run_enabled ?? true}
            liveRunFollowCurrent={workflowSettings?.graph_defaults?.live_run_follow_current ?? false}
            onBack={backToList}
            onOpenWorkflowSettings={() => openDetailWorkflowSettings("browser_launch")}
            onStopRun={() => stopRun(detailRunSnapshot?.run_id ?? null)}
            onCreateSubflowFromSelection={createWorkflowSelectionSubflow}
            onOpenSubflowDetail={(subflowId) => {
              void openSubflowDetail(subflowId, {
                type: "workflow-detail",
                workflowId: detail.workflow.id,
                workflowName: detail.workflow.name,
              });
            }}
            onGraphChange={changeWorkflowGraph}
            onRunGraph={runGraph}
            onRunGraphFromSelected={runGraphFromSelectedNode}
            onSelectedGraphNodeChange={setSelectedGraphNodeId}
            showRunGraphFromSelected={runFromSelectedAvailability.visible ?? true}
            canRunGraphFromSelected={runFromSelectedAvailability.enabled}
            runGraphFromSelectedReason={runFromSelectedAvailability.reason}
            onSaveGraph={saveGraph}
            onValidateGraph={validateGraph}
          />
        </>
      ) : null}
      <RecordingReviewDialog
        open={Boolean(recordingSession)}
        session={recordingSession}
        draft={recordingDraft}
        workflowName={recordingWorkflowName}
        busy={recordingBusy}
        error={appError}
        onWorkflowNameChange={setRecordingWorkflowName}
        onStopRecording={stopWorkflowRecording}
        onDiscard={() => {
          void discardWorkflowRecording();
        }}
        onSave={() => {
          void saveReviewedRecording();
        }}
        onStepChange={updateRecordingStep}
        onOpenChange={(open) => {
          if (!open) {
            void discardWorkflowRecording();
          }
        }}
      />
      <WorkflowSettingsDialog
        open={workflowSettingsDialogOpen}
        settings={workflowSettings}
        activeSection={workflowSettingsActiveSection}
        error={appError}
        hasUnsavedChanges={Object.values(workflowSettingsSaveStatuses).some(
          (status) => status === "unsaved",
        )}
        onOpenChange={(open) => {
          if (open) {
            setWorkflowSettingsDialogOpen(true);
            return;
          }
          closeWorkflowSettingsDialog();
        }}
        onActiveSectionChange={setWorkflowSettingsActiveSection}
        onSettingsChange={changeWorkflowSettings}
        onSaveSettings={persistWorkflowSettings}
        onResetBrowserIdentity={resetWorkflowBrowserIdentity}
        onDiscardChanges={discardWorkflowSettingsChanges}
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
        deleteWorkflowCandidate={deleteWorkflowCandidate}
        deleteBrowserProfileData={deleteBrowserProfileData}
        onDeleteBrowserProfileDataChange={setDeleteBrowserProfileData}
        onConfirmDeleteWorkflow={() => {
          void confirmDeleteWorkflow();
        }}
        onCancelDeleteWorkflow={() => {
          setDeleteWorkflowCandidate(null);
          setDeleteBrowserProfileData(false);
        }}
      />
    </AppShell>
  );
}

export default App;
