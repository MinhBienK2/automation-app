import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { EvidenceExplorerPage } from "./features/evidence/pages/EvidenceExplorerPage";
import { IdentityLabPage } from "./features/identities/pages/IdentityLabPage";
import { OperationsOverviewPage } from "./features/overview/pages/OperationsOverviewPage";
import { ProjectEnvironmentSettings } from "./features/projects/components/ProjectEnvironmentSettings";
import {
  ProjectsPage,
  type ProjectCollection,
} from "./features/projects/pages/ProjectsPage";
import { SchedulesPage } from "./features/schedules/pages/SchedulesPage";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { SubflowListPage } from "./features/workflows/pages/SubflowListPage";
import { SubflowDetailPage } from "./features/workflows/pages/SubflowDetailPage";
import { AppShell } from "./layouts/AppShell";
import {
  closeIdentityRetainedSession,
  cleanupOrphanedBrowserProfiles,
  createProject as createProjectCommand,
  createProjectEnvironment as createProjectEnvironmentCommand,
  createSubflow as createSubflowCommand,
  createWorkflow as createWorkflowCommand,
  createSchedule,
  deleteSubflow as deleteSubflowCommand,
  deleteWorkflow as deleteWorkflowCommand,
  deleteSchedule,
  discardRecordingSession,
  disableSchedule,
  duplicateSubflow as duplicateSubflowCommand,
  duplicateWorkflow as duplicateWorkflowCommand,
  enableSchedule,
  exportWorkflowPackage,
  generateRecordingDraft,
  exportEvidenceBundle,
  getEvidenceDetail,
  getEvidenceScreenshotPreview,
  getIdentityLabOverview,
  getCloakBrowserDiagnostics,
  getSubflow,
  getSubflowGraph,
  getSubflowUsage,
  getWorkflowGraph,
  getOperationsOverview,
  getRunState,
  getWorkflow,
  getWorkflowSettings,
  importWorkflowPackage,
  installCloakBrowserBinary,
  listEvidenceItems,
  listProjectEnvironments,
  listProjects,
  listRunStates,
  listScheduleEvents,
  listSchedules,
  listSubflows,
  listWorkflows,
  previewWorkflowPackage,
  resetWorkflowBrowserIdentity as resetWorkflowBrowserIdentityCommand,
  renameWorkflow as renameWorkflowCommand,
  runWorkflow as runWorkflowCommand,
  runWorkflowFromNode as runWorkflowFromNodeCommand,
  saveRecordingDraft,
  saveSubflowGraph,
  saveWorkflowPackageFile,
  saveWorkflowGraph,
  saveWorkflowSettingsSection,
  revealEvidenceArtifact,
  startRecordingSession,
  stopRecordingSession,
  stopRun as stopRunCommand,
  updateProjectEnvironment as updateProjectEnvironmentCommand,
  updateSchedule,
  validateWorkflowGraph,
} from "./lib/workflowApi";
import { linearGraphFromSteps } from "./features/workflows/lib/workflowGraph";
import {
  commandMessage,
  initialRunState,
  normalizeRunSnapshot,
  normalizeRunState,
} from "./lib/workflowUi";
import {
  defaultWorkflowSettings,
} from "./features/workflows/lib/workflowSettings";
import { RecordingReviewDialog } from "./features/workflows/components/RecordingReviewDialog";
import { WorkflowSettingsDialog } from "./features/workflows/components/WorkflowSettingsDialog";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  PackageFlowCheckbox,
  PackageSectionPicker,
  sectionLabel,
} from "./features/workflows/components/WorkflowPackageOptions";
import type {
  CloakBrowserDiagnostics,
  GraphValidationIssue,
  GraphNodeType,
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
  EvidenceBundleExportResult,
  EvidenceDetail,
  EvidenceListRequest,
  EvidencePage,
  EvidenceScreenshotPreview,
  IdentityLabOverview,
  IdentityLabTarget,
  MissionControlTarget,
  OperationsNavigationTarget,
  OperationsOverview,
  RunState,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  WorkflowCreateOptions,
  WorkflowGraph,
  WorkflowDetail,
  WorkflowPackage,
  WorkflowPackagePreview,
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "./types/workflow";
import "./App.css";

type AppScreen = "overview" | "projects" | "detail" | "subflow-detail" | "settings" | "schedules" | "evidence" | "identities";
type WorkflowDialogMode = "create" | "edit" | null;
type GraphSaveStatus = "saved" | "unsaved" | "saving" | "failed" | "off";
type WorkflowSettingsSaveStatus = "saved" | "unsaved" | "saving" | "failed";
type OverviewFocus = NonNullable<Extract<MissionControlTarget, { type: "overview" }>["focus"]>;

const appSettingsStorageKey = "workflow-manager:settings:v1";
const workflowPackageSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "graph_defaults",
  "environment",
];
const workflowPackageFileSizeLimitBytes = 5 * 1024 * 1024;

function readGraphAutosaveEnabled() {
  try {
    const stored = window.localStorage.getItem(appSettingsStorageKey);
    if (!stored) return true;
    const parsed = JSON.parse(stored) as { graphAutosaveEnabled?: unknown };
    return typeof parsed.graphAutosaveEnabled === "boolean"
      ? parsed.graphAutosaveEnabled
      : true;
  } catch {
    return true;
  }
}

function writeGraphAutosaveEnabled(enabled: boolean) {
  window.localStorage.setItem(
    appSettingsStorageKey,
    JSON.stringify({ graphAutosaveEnabled: enabled }),
  );
}

function runFromSelectedState({
  graph,
  selectedNodeId,
  settings,
  runState,
  isRunning,
}: {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  settings: WorkflowSettings | null;
  runState: RunState;
  isRunning: boolean;
}) {
  if (!settings) {
    return {
      enabled: false,
      reason: "Workflow settings are not loaded.",
      visible: false,
    };
  }
  if (!settings.run_policy?.run_from_selected_enabled) {
    return {
      enabled: false,
      reason: "Enable Run from selected in Workflow Settings Run Policy first.",
      visible: false,
    };
  }
  if (isRunning) return { enabled: false, reason: "A workflow run is already active.", visible: true };
  if (!selectedNodeId) return { enabled: false, reason: "Select one main-path node to run from.", visible: true };
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  if (!selectedNode || selectedNode.node_type === "start") {
    return { enabled: false, reason: "Select an executable graph node.", visible: true };
  }
  if (!mainPathNodeIds(graph).has(selectedNodeId)) {
    return {
      enabled: false,
      reason: "Run from selected only supports main-path nodes in this version.",
      visible: true,
    };
  }
  const retainedProfileKey = workflowBrowserProfileKey(settings);
  if (!retainedProfileKey) {
    return {
      enabled: false,
      reason: "Enable Reuse login session in Workflow Settings first.",
      visible: true,
    };
  }
  if (settings.run_policy?.browser_retention !== "retain") {
    return {
      enabled: false,
      reason: "Set Browser retention to retain before using Run from selected.",
      visible: true,
    };
  }
  if (
    !runState.retained_session?.available ||
    runState.retained_session.workflow_id !== settings.workflow_id ||
    runState.retained_session.profile_name !== retainedProfileKey
  ) {
    return {
      enabled: false,
      reason: "Browser session was closed. Run the workflow again to create a reusable session.",
      visible: true,
    };
  }
  return {
    enabled: true,
    reason:
      settings.run_policy.run_from_selected_mode === "selected_only"
        ? "Run only the selected node using the retained browser session."
        : "Run from the selected node using the retained browser session.",
    visible: true,
  };
}

function workflowBrowserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch?.session_mode !== "persistent_profile") return null;
  return (
    settings.browser_launch.profile_dir?.trim() ||
    settings.browser_launch.profile_name?.trim() ||
    null
  );
}

function mainPathNodeIds(graph: WorkflowGraph) {
  const ids = new Set<string>();
  let node = graph.nodes.find((candidate) => candidate.node_type === "start") ?? null;
  const visited = new Set<string>();

  while (node && !visited.has(node.id)) {
    ids.add(node.id);
    visited.add(node.id);
    const nextPort = mainContinuationPort(node.node_type);
    if (!nextPort) break;
    const currentNodeId = node.id;
    const nextId = graph.edges
      .filter((edge) => edge.source_node_id === currentNodeId && edge.source_port === nextPort)
      .sort((left, right) => left.id.localeCompare(right.id))[0]?.target_node_id;
    node = nextId
      ? graph.nodes.find((candidate) => candidate.id === nextId) ?? null
      : null;
  }

  return ids;
}

function mainContinuationPort(nodeType: GraphNodeType) {
  switch (nodeType) {
    case "start":
    case "action":
    case "set_variable":
    case "set_json_variables":
    case "transform_variable":
    case "assert_output":
    case "domain_allowlist":
    case "call_subflow":
    case "merge":
      return "out";
    case "if":
    case "switch":
    case "router":
    case "random_choice":
    case "repeat_times":
    case "repeat_for_each":
    case "while":
    case "repeat_until":
    case "try_catch":
    case "fallback":
      return "done";
    case "retry":
      return "success";
    default:
      return null;
  }
}

function graphSaveStatusLabel(status: GraphSaveStatus) {
  switch (status) {
    case "saved":
      return "Saved";
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving...";
    case "failed":
      return "Autosave failed";
    case "off":
      return "Autosave off";
  }
}

function latestRunSnapshot(snapshots: WorkflowRunSnapshot[]) {
  return [...snapshots].sort((left, right) =>
    right.started_at.localeCompare(left.started_at),
  )[0] ?? null;
}

function latestRunForWorkflow(
  snapshots: WorkflowRunSnapshot[],
  workflowId: string,
) {
  return latestRunSnapshot(
    snapshots.filter((snapshot) => snapshot.workflow_id === workflowId),
  );
}

function idleRunStateWithRetainedSession(state: RunState): RunState {
  return { ...initialRunState, retained_session: state.retained_session };
}

function legacyRunId(workflowId: string | null) {
  return `legacy-${workflowId ?? "run"}`;
}

function operationsTargetToMissionTarget(
  target: OperationsNavigationTarget,
): MissionControlTarget {
  if (target.type === "workflow") {
    return { type: "workflow", workflow_id: target.workflow_id };
  }
  if (target.type === "schedule") {
    return { type: "schedule", schedule_id: target.schedule_id };
  }
  return { type: "evidence", evidence_id: target.evidence_id };
}

function formatMaintenanceBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

function todayOperationsRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    day_start_utc: start.toISOString(),
    day_end_utc: end.toISOString(),
    timezone_label: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
  };
}

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
  const [subflowGraphSaveStatus, setSubflowGraphSaveStatus] =
    useState<GraphSaveStatus>("saved");
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WorkflowScheduleEvent[]>([]);
  const [focusedScheduleId, setFocusedScheduleId] = useState<string | null>(null);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [operationsOverview, setOperationsOverview] =
    useState<OperationsOverview | null>(null);
  const [operationsOverviewLoading, setOperationsOverviewLoading] = useState(false);
  const [overviewFocus, setOverviewFocus] = useState<OverviewFocus | null>(null);
  const [evidencePage, setEvidencePage] = useState<EvidencePage | null>(null);
  const [evidenceQuery, setEvidenceQuery] = useState<EvidenceListRequest>({});
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [evidenceDetail, setEvidenceDetail] = useState<EvidenceDetail | null>(null);
  const [evidenceDetailLoading, setEvidenceDetailLoading] = useState(false);
  const [evidenceDetailError, setEvidenceDetailError] = useState("");
  const [evidencePreview, setEvidencePreview] = useState<EvidenceScreenshotPreview | null>(null);
  const [evidenceExportResult, setEvidenceExportResult] =
    useState<EvidenceBundleExportResult>(null);
  const [identityLabOverview, setIdentityLabOverview] =
    useState<IdentityLabOverview | null>(null);
  const [identityLabTarget, setIdentityLabTarget] =
    useState<IdentityLabTarget | null>(null);
  const [identityLabLoading, setIdentityLabLoading] = useState(false);
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
  const [settingsDiagnostics, setSettingsDiagnostics] =
    useState<CloakBrowserDiagnostics | null>(null);
  const [settingsDiagnosticsLoading, setSettingsDiagnosticsLoading] = useState(false);
  const [settingsDiagnosticsError, setSettingsDiagnosticsError] = useState("");
  const [settingsMaintenanceMessage, setSettingsMaintenanceMessage] = useState("");
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
  const [exportPackageWorkflow, setExportPackageWorkflow] =
    useState<WorkflowSummary | null>(null);
  const [exportPackageIncludeFlow, setExportPackageIncludeFlow] = useState(true);
  const [exportPackageSections, setExportPackageSections] =
    useState<WorkflowSettingsSectionId[]>(workflowPackageSections);
  const [importPackage, setImportPackage] = useState<WorkflowPackage | null>(null);
  const [importPackagePreview, setImportPackagePreview] =
    useState<WorkflowPackagePreview | null>(null);
  const [importPackageIncludeFlow, setImportPackageIncludeFlow] = useState(true);
  const [importPackageSections, setImportPackageSections] =
    useState<WorkflowSettingsSectionId[]>([]);
  const [appError, setAppError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const graphRevisionRef = useRef(graphRevision);
  const savedGraphRevisionRef = useRef(savedGraphRevision);

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

  async function createProjectEnvironment(input: { name: string; description?: string | null }) {
    setAppError("");
    const projectId = await ensureProjectId();
    if (!projectId) {
      setAppError("Project not found");
      return;
    }
    try {
      await createProjectEnvironmentCommand(projectId, input);
      const environments = await listProjectEnvironments(projectId);
      setProjectEnvironments(environments);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function updateProjectEnvironment(
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
  ) {
    setAppError("");
    try {
      const updated = await updateProjectEnvironmentCommand(environmentId, input);
      setProjectEnvironments(await listProjectEnvironments(updated.project_id));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function selectProject(projectId: string) {
    setAppError("");
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
      setProjectEnvironments(await listProjectEnvironments(project.id));
      setSubflows(await listSubflows(project.id));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function loadSchedules() {
    setSchedulesLoading(true);
    try {
      const items = await listSchedules();
      setSchedules(items);
      return items;
    } catch (error) {
      setAppError(commandMessage(error));
      return [];
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function loadOperationsOverview() {
    setOperationsOverviewLoading(true);
    try {
      setOperationsOverview(await getOperationsOverview(todayOperationsRange()));
      setAppError("");
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setOperationsOverviewLoading(false);
    }
  }

  async function loadSettingsDiagnostics() {
    setSettingsDiagnosticsLoading(true);
    try {
      setSettingsDiagnostics(await getCloakBrowserDiagnostics());
      setSettingsDiagnosticsError("");
    } catch (error) {
      setSettingsDiagnosticsError(commandMessage(error));
    } finally {
      setSettingsDiagnosticsLoading(false);
    }
  }

  async function installSettingsBrowserBinary() {
    setSettingsMaintenanceMessage("");
    try {
      setSettingsDiagnostics(await installCloakBrowserBinary());
      setSettingsDiagnosticsError("");
      setSettingsMaintenanceMessage("CloakBrowser binary install check completed.");
    } catch (error) {
      setSettingsDiagnosticsError(commandMessage(error));
    }
  }

  async function cleanupSettingsBrowserProfiles() {
    setSettingsMaintenanceMessage("");
    try {
      const result = await cleanupOrphanedBrowserProfiles();
      setSettingsMaintenanceMessage(
        `Deleted ${result.deleted_profiles.length} orphaned profile${
          result.deleted_profiles.length === 1 ? "" : "s"
        }; reclaimed ${formatMaintenanceBytes(result.reclaimed_bytes)}.`,
      );
      await loadSettingsDiagnostics();
    } catch (error) {
      setSettingsDiagnosticsError(commandMessage(error));
    }
  }

  async function loadEvidencePage(nextQuery: EvidenceListRequest = evidenceQuery) {
    setEvidenceLoading(true);
    try {
      const page = await listEvidenceItems(nextQuery);
      setEvidencePage(page);
      setEvidenceQuery(nextQuery);
      setAppError("");
      const nextSelected =
        nextQuery.focus_evidence_id ??
        (selectedEvidenceId && page.items.some((item) => item.evidence_id === selectedEvidenceId)
          ? selectedEvidenceId
          : page.items[0]?.evidence_id ?? null);
      setSelectedEvidenceId(nextSelected);
      if (nextSelected) {
        await loadEvidenceDetail(nextSelected);
      } else {
        setEvidenceDetail(null);
        setEvidencePreview(null);
      }
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function loadEvidenceDetail(evidenceId: string) {
    setEvidenceDetailLoading(true);
    setEvidenceDetailError("");
    try {
      setEvidenceDetail(await getEvidenceDetail(evidenceId));
      setEvidencePreview(null);
    } catch (error) {
      setEvidenceDetail(null);
      setEvidenceDetailError(commandMessage(error));
    } finally {
      setEvidenceDetailLoading(false);
    }
  }

  async function loadIdentityLabOverview(nextTarget: IdentityLabTarget | null = identityLabTarget) {
    setIdentityLabLoading(true);
    try {
      const overview = await getIdentityLabOverview(
        nextTarget ? { selected_target: nextTarget } : {},
      );
      setIdentityLabOverview(overview);
      if (overview.selected?.kind === "managed") {
        setIdentityLabTarget({
          type: "managed",
          workflow_id: overview.selected.workflow_ref.id,
          identity_id: overview.selected.identity_ref.id,
        });
      } else if (overview.selected?.kind === "historical") {
        setIdentityLabTarget({
          type: "historical",
          identity_id: overview.selected.identity_ref.id,
          workflow_id: overview.selected.workflow_ref?.id ?? null,
          run_id: overview.selected.run_id ?? null,
          evidence_id: overview.selected.evidence_id ?? null,
        });
      } else {
        setIdentityLabTarget(nextTarget);
      }
      setAppError("");
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setIdentityLabLoading(false);
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
      if (loaded.workflow.project_id) {
        setSelectedProjectId(loaded.workflow.project_id);
        try {
          setProjectEnvironments(await listProjectEnvironments(loaded.workflow.project_id));
        } catch {
          // Keep the workflow detail usable even if project metadata is temporarily unavailable.
        }
        await loadSubflowsForProject(loaded.workflow.project_id);
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

  async function openSubflowDetail(subflowId: string) {
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
      setSubflowGraphSaveStatus("saved");
      setSidebarCollapsed(true);
      setScreen("subflow-detail");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function changeSubflowGraph(nextGraph: WorkflowGraph) {
    setSelectedSubflowGraph(nextGraph);
    setSubflowGraphSaveStatus("unsaved");
  }

  async function saveCurrentSubflowGraph() {
    if (!selectedSubflow || !selectedSubflowGraph) return;
    setAppError("");
    setSubflowGraphSaveStatus("saving");
    try {
      await saveSubflowGraph(selectedSubflow.id, selectedSubflowGraph);
      setSubflowGraphSaveStatus("saved");
      setSelectedSubflowUsage(await getSubflowUsage(selectedSubflow.id));
      await loadSubflowsForProject(selectedSubflow.project_id);
    } catch (error) {
      setSubflowGraphSaveStatus("failed");
      setAppError(commandMessage(error));
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

  function openExportPackageDialog(workflow: WorkflowSummary) {
    setAppError("");
    setExportPackageWorkflow(workflow);
    setExportPackageIncludeFlow(true);
    setExportPackageSections(workflowPackageSections);
  }

  function closeExportPackageDialog() {
    setExportPackageWorkflow(null);
    setExportPackageIncludeFlow(true);
    setExportPackageSections(workflowPackageSections);
    setAppError("");
  }

  async function submitExportPackage(event: React.FormEvent) {
    event.preventDefault();
    if (!exportPackageWorkflow) return;
    if (!exportPackageIncludeFlow && exportPackageSections.length === 0) {
      setAppError("Select at least Flow or one Settings section");
      return;
    }

    setAppError("");

    try {
      const packageValue = await exportWorkflowPackage(exportPackageWorkflow.id, {
        include_flow: exportPackageIncludeFlow,
        settings_sections: exportPackageSections,
      });
      const filePath = await saveWorkflowPackageFile(packageValue);
      if (!filePath) return;
      closeExportPackageDialog();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function importWorkflowPackageFile(file: File | null) {
    if (!file) return;
    setAppError("");
    if (file.size > workflowPackageFileSizeLimitBytes) {
      setAppError("Workflow package file must be 5 MB or smaller");
      return;
    }

    try {
      const packageValue = JSON.parse(await file.text()) as WorkflowPackage;
      const preview = await previewWorkflowPackage(packageValue);
      setImportPackage(packageValue);
      setImportPackagePreview(preview);
      setImportPackageIncludeFlow(preview.includes_flow);
      setImportPackageSections(preview.settings_sections);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function closeImportPackageDialog() {
    setImportPackage(null);
    setImportPackagePreview(null);
    setImportPackageIncludeFlow(true);
    setImportPackageSections([]);
    setAppError("");
  }

  async function submitImportPackage(event: React.FormEvent) {
    event.preventDefault();
    if (!importPackage) return;
    if (!importPackageIncludeFlow && importPackageSections.length === 0) {
      setAppError("Select at least Flow or one Settings section");
      return;
    }

    setAppError("");

    try {
      const imported = await importWorkflowPackage(importPackage, {
        include_flow: importPackageIncludeFlow,
        settings_sections: importPackageSections,
      });
      closeImportPackageDialog();
      await loadWorkflows();
      await openWorkflow(imported.workflow.id);
    } catch (error) {
      setAppError(commandMessage(error));
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
    setToastMessage("Workflow settings saved.");
    window.setTimeout(() => setToastMessage(""), 2200);
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
      setToastMessage("Browser identity reset.");
      window.setTimeout(() => setToastMessage(""), 2200);
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
    openProjects("workflows");
    void loadWorkflows();
  }

  function openOverview(focus: OverviewFocus | null = null) {
    setScreen("overview");
    setOverviewFocus(focus);
    setAppError("");
    void loadOperationsOverview();
  }

  function openSettings() {
    setScreen("settings");
    setAppError("");
    void loadSettingsDiagnostics();
  }

  function openSchedules() {
    setScreen("schedules");
    setAppError("");
    setFocusedScheduleId(null);
    void loadSchedules();
  }

  function backToSubflows() {
    setSelectedSubflow(null);
    setSelectedSubflowGraph(null);
    setSelectedSubflowUsage([]);
    openProjects("subflows");
  }

  function openEvidence(nextQuery: EvidenceListRequest = evidenceQuery) {
    setScreen("evidence");
    setAppError("");
    setEvidenceDetailError("");
    void loadEvidencePage(nextQuery);
  }

  function openIdentities(target: IdentityLabTarget | null = identityLabTarget) {
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

  async function openIdentityWorkflowSettings(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) {
      setAppError("Workflow not found");
      return;
    }
    await openWorkflowSettings(workflow, "browser_launch");
  }

  async function closeIdentitySession(workflowId: string, profileName: string) {
    setAppError("");
    try {
      await closeIdentityRetainedSession(workflowId, profileName);
      await loadIdentityLabOverview(identityLabTarget);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function resetIdentityFromLab(workflowId: string) {
    setAppError("");
    try {
      const rotated = await resetWorkflowBrowserIdentityCommand(workflowId);
      const nextTarget: IdentityLabTarget = {
        type: "managed",
        workflow_id: workflowId,
        identity_id: rotated.browser_launch.identity_id,
      };
      await loadWorkflows();
      await loadIdentityLabOverview(nextTarget);
      setToastMessage("Browser identity reset.");
      window.setTimeout(() => setToastMessage(""), 2200);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function updateEvidenceQuery(nextQuery: EvidenceListRequest) {
    setEvidenceQuery(nextQuery);
    void loadEvidencePage(nextQuery);
  }

  function selectEvidence(evidenceId: string) {
    setSelectedEvidenceId(evidenceId);
    void loadEvidenceDetail(evidenceId);
  }

  async function previewEvidenceScreenshot(evidenceId: string) {
    setEvidenceDetailError("");
    try {
      setEvidencePreview(await getEvidenceScreenshotPreview(evidenceId));
    } catch (error) {
      setEvidencePreview(null);
      setEvidenceDetailError(commandMessage(error));
    }
  }

  async function revealEvidence(evidenceId: string) {
    setEvidenceDetailError("");
    try {
      await revealEvidenceArtifact(evidenceId);
    } catch (error) {
      setEvidenceDetailError(commandMessage(error));
    }
  }

  async function exportSelectedEvidence(evidenceIds: string[]) {
    setEvidenceDetailError("");
    try {
      setEvidenceExportResult(await exportEvidenceBundle({ evidence_ids: evidenceIds }));
    } catch (error) {
      setEvidenceDetailError(commandMessage(error));
    }
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
    if (target.type === "overview") {
      openOverview(target.focus ?? null);
      return;
    }
    if (target.type === "workflow") {
      if (target.mode === "list") {
        backToList();
        return;
      }
      if (target.mode === "settings") {
        const workflow = workflows.find((item) => item.id === target.workflow_id);
        if (!workflow) {
          setAppError(`Workflow target is no longer available: ${target.workflow_id}`);
          return;
        }
        await openWorkflowSettings(workflow, "browser_launch");
        return;
      }
      await openWorkflow(target.workflow_id);
      return;
    }
    if (target.type === "evidence") {
      openEvidence({
        ...(target.filters ?? {}),
        ...(target.evidence_id ? { focus_evidence_id: target.evidence_id } : {}),
      });
      return;
    }
    if (target.type === "identity") {
      openIdentities(target.target);
      return;
    }
    if (target.type === "schedule") {
      await openScheduleTarget(target.schedule_id, target.schedule_event_id);
      return;
    }
    await openWorkflow(target.workflow_id);
    if (target.node_id) {
      setSelectedGraphNodeId(target.node_id);
    }
  }

  function navigateFromOverview(target: OperationsNavigationTarget) {
    void navigateToMissionControlTarget(operationsTargetToMissionTarget(target));
  }

  async function submitCreateSchedule(input: WorkflowScheduleInput) {
    await createSchedule(input);
    await loadSchedules();
  }

  async function submitUpdateSchedule(
    scheduleId: string,
    input: WorkflowScheduleInput,
  ) {
    await updateSchedule(scheduleId, input);
    await loadSchedules();
  }

  async function removeSchedule(scheduleId: string) {
    setAppError("");
    try {
      await deleteSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function toggleSchedule(scheduleId: string, enabled: boolean) {
    setAppError("");
    try {
      if (enabled) {
        await enableSchedule(scheduleId);
      } else {
        await disableSchedule(scheduleId);
      }
      await loadSchedules();
    } catch (error) {
      setAppError(commandMessage(error));
      throw error;
    }
  }

  async function loadScheduleHistory(scheduleId: string) {
    setAppError("");
    try {
      setScheduleEvents(await listScheduleEvents({ schedule_id: scheduleId }));
    } catch (error) {
      setAppError(commandMessage(error));
    }
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
    setWorkflowGraph(nextGraph);
    setGraphIssuesNeedRecheck((current) => current || graphIssues.length > 0);
    setGraphRevision((current) => {
      const nextRevision = current + 1;
      graphRevisionRef.current = nextRevision;
      return nextRevision;
    });
    setGraphSaveStatus(graphAutosaveEnabled ? "unsaved" : "off");
  }, [graphAutosaveEnabled, graphIssues.length]);

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
          error=""
          onSelectProject={(projectId) => {
            void selectProject(projectId);
          }}
          onCreateProject={createProject}
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
              projectEnvironments={selectedProjectEnvironments}
              error={appError}
              onCreateProjectEnvironment={createProjectEnvironment}
              onUpdateProjectEnvironment={updateProjectEnvironment}
            />
          ) : (
            <WorkflowListPage
              workflows={selectedProjectWorkflows}
              workflowDialogMode={workflowDialogMode}
              workflowNameDraft={workflowNameDraft}
              workflowEnvironmentDraft={workflowEnvironmentDraft}
              projectEnvironments={selectedProjectEnvironments}
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
          usage={selectedSubflowUsage}
          graph={selectedSubflowGraph}
          graphSaveStatus={graphSaveStatusLabel(subflowGraphSaveStatus)}
          appError={appError}
          onBack={backToSubflows}
          onGraphChange={changeSubflowGraph}
          onSaveGraph={() => {
            void saveCurrentSubflowGraph();
          }}
          onDuplicateSubflow={duplicateProjectSubflow}
          onDeleteSubflow={deleteProjectSubflow}
        />
      ) : screen === "detail" && detail ? (
        <>
          <WorkflowDetailPage
            detail={detail}
            environmentName={detailEnvironmentName}
            isRunning={isRunning}
            appError={appError}
            graphSaveStatus={graphSaveStatusLabel(graphSaveStatus)}
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
      {toastMessage ? (
        <div className="toast-alert app-toast" role="status">
          {toastMessage}
        </div>
      ) : null}
      <Dialog
        open={Boolean(exportPackageWorkflow)}
        onOpenChange={(open) => {
          if (!open) closeExportPackageDialog();
        }}
      >
        {exportPackageWorkflow ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Package</p>
              <DialogTitle>Export Workflow</DialogTitle>
              <DialogDescription>
                Choose the workflow parts to include in the JSON package.
              </DialogDescription>
            </DialogHeader>
            <form className="workflow-dialog-form" onSubmit={submitExportPackage}>
              <PackageFlowCheckbox
                checked={exportPackageIncludeFlow}
                label="Flow"
                onChange={setExportPackageIncludeFlow}
              />
              <PackageSectionPicker
                availableSections={workflowPackageSections}
                selectedSections={exportPackageSections}
                onSelectedSectionsChange={setExportPackageSections}
              />
              {appError ? <p className="field-error">{appError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  Export
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeExportPackageDialog}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(importPackage && importPackagePreview)}
        onOpenChange={(open) => {
          if (!open) closeImportPackageDialog();
        }}
      >
        {importPackagePreview ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Package</p>
              <DialogTitle>Import Workflow</DialogTitle>
              <DialogDescription>
                Import creates a new workflow and never overwrites an existing one.
              </DialogDescription>
            </DialogHeader>
            <form className="workflow-dialog-form" onSubmit={submitImportPackage}>
              <dl className="package-preview-list">
                <div>
                  <dt>Name</dt>
                  <dd>{importPackagePreview.workflow_name}</dd>
                </div>
                <div>
                  <dt>Included</dt>
                  <dd>
                    {[
                      importPackagePreview.includes_flow ? "Flow" : null,
                      ...importPackagePreview.settings_sections.map(sectionLabel),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
              </dl>
              <PackageFlowCheckbox
                checked={importPackageIncludeFlow}
                disabled={!importPackagePreview.includes_flow}
                label="Flow"
                onChange={setImportPackageIncludeFlow}
              />
              <PackageSectionPicker
                availableSections={importPackagePreview.settings_sections}
                selectedSections={importPackageSections}
                onSelectedSectionsChange={setImportPackageSections}
              />
              {importPackagePreview.omitted_fields.length > 0 ? (
                <p className="muted">
                  Sanitized fields: {importPackagePreview.omitted_fields.join(", ")}
                </p>
              ) : null}
              {appError ? <p className="field-error">{appError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  Import
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeImportPackageDialog}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(deleteWorkflowCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteWorkflowCandidate(null);
            setDeleteBrowserProfileData(false);
          }
        }}
      >
        {deleteWorkflowCandidate ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Workflow</p>
              <DialogTitle>Delete Workflow</DialogTitle>
              <DialogDescription>
                This removes {deleteWorkflowCandidate.name} from the app. This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="package-section-list">
              <PackageFlowCheckbox
                checked={deleteBrowserProfileData}
                label="Delete private browser profile data"
                onChange={setDeleteBrowserProfileData}
              />
              <p className="muted">
                Uncheck it when you want retained login state available for
                manual recovery or a later profile cleanup.
              </p>
            </div>
            {appError ? <p className="field-error">{appError}</p> : null}
            <DialogFooter className="form-actions">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  void confirmDeleteWorkflow();
                }}
              >
                Delete Workflow
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDeleteWorkflowCandidate(null);
                  setDeleteBrowserProfileData(false);
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </AppShell>
  );
}

function settingsSaveStatuses(status: WorkflowSettingsSaveStatus) {
  return {
    general: status,
    run_policy: status,
    browser_launch: status,
    graph_defaults: status,
    environment: status,
  };
}

function cloneWorkflowSettings(settings: WorkflowSettings) {
  return JSON.parse(JSON.stringify(settings)) as WorkflowSettings;
}

function withWorkflowSettingsDefaults(
  settings: WorkflowSettings,
  workflow: {
    workflowId: string;
    workflowName: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  },
) {
  const defaults = defaultWorkflowSettings(workflow);
  return {
    ...defaults,
    ...settings,
    general: { ...defaults.general, ...settings.general },
    run_policy: { ...defaults.run_policy, ...settings.run_policy },
    browser_launch: { ...defaults.browser_launch, ...settings.browser_launch },
    graph_defaults: { ...defaults.graph_defaults, ...settings.graph_defaults },
    environment: { ...defaults.environment, ...settings.environment },
  };
}

function isWorkflowSettings(value: unknown): value is WorkflowSettings {
  return Boolean(
    value &&
      typeof value === "object" &&
      "workflow_id" in value &&
      "general" in value &&
      "browser_launch" in value,
  );
}

export default App;
