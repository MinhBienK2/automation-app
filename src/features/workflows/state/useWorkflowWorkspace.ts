import { useState, useCallback } from "react";
import type {
  WorkflowWorkspaceAPI,
  WorkflowDialogMode,
} from "../../../shared/types/workspaceContracts";
import type {
  WorkflowSummary,
  WorkflowDetail,
  BrowserProfile,
} from "../../../types/workflow";
import {
  listWorkflows,
  getWorkflow,
  deleteWorkflow as deleteWorkflowCommand,
  duplicateWorkflow as duplicateWorkflowCommand,
  createWorkflow as createWorkflowCommand,
  renameWorkflow as renameWorkflowCommand,
  listBrowserProfiles,
  getWorkflowGraph,
  getWorkflowSettings,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import { linearGraphFromSteps } from "../lib/workflowGraph";
import {
  withWorkflowSettingsDefaults,
  defaultWorkflowSettings,
} from "../lib/workflowSettings";
import {
  cloneWorkflowSettings,
  settingsSaveStatuses,
  latestRunForWorkflow,
  idleRunStateWithRetainedSession,
} from "../../../lib/appState";

export interface WorkflowWorkspaceDeps {
  setAppError: (error: string) => void;
  showToast: (message: string) => void;
  requestGraphExitNavigation: (navigate: () => void | Promise<void>) => Promise<boolean> | boolean;
  setSelectedProjectId: (id: string | null) => void;
  currentProjectId: () => string | null;
  browserProfiles: BrowserProfile[];
  setBrowserProfiles: (profiles: BrowserProfile[]) => void;
  loadSubflowsForProject: (projectId?: string | null) => Promise<any[]>;
  graphAutosaveEnabled: boolean;
  setWorkflowGraph: (graph: any) => void;
  setWorkflowSettings: (settings: any) => void;
  setWorkflowSettingsSavedSnapshot: (settings: any) => void;
  setWorkflowSettingsSaveStatuses: (statuses: any) => void;
  setWorkflowProfileDraftId: (id: string | null) => void;
  setWorkflowProfileSavedId: (id: string | null) => void;
  setSavedGraphRevision: (revision: number) => void;
  setGraphRevision: (revision: number) => void;
  setGraphSaveStatus: (status: any) => void;
  setGraphIssues: (issues: any[]) => void;
  setGraphIssuesNeedRecheck: (needRecheck: boolean) => void;
  runSnapshots: any[];
  setRunState: (state: any) => void;
  setSelectedGraphNodeId: (nodeId: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setScreen: (screen: any) => void;
  setProjectCollection: (collection: any) => void;
  ensureProjectId: () => Promise<string>;
}

export function useWorkflowWorkspace(deps: WorkflowWorkspaceDeps): WorkflowWorkspaceAPI {
  const {
    setAppError,
    showToast: _showToast,
    requestGraphExitNavigation,
    setSelectedProjectId,
    currentProjectId,
    browserProfiles,
    setBrowserProfiles,
    loadSubflowsForProject,
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
    setSidebarCollapsed,
    setScreen,
    setProjectCollection,
    ensureProjectId,
  } = deps;

  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [workflowDialogMode, setWorkflowDialogMode] = useState<WorkflowDialogMode>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
  const [deleteWorkflowCandidate, setDeleteWorkflowCandidate] = useState<WorkflowSummary | null>(null);
  const [deleteBrowserProfileData, setDeleteBrowserProfileData] = useState(false);

  const loadWorkflows = useCallback(async () => {
    const items = await listWorkflows();
    setWorkflows(items);
  }, []);

  const resolveWorkflowProfileId = useCallback((
    profileId: string | null | undefined,
    profiles: BrowserProfile[],
  ) => {
    if (profileId && profiles.some((profile) => profile.id === profileId)) {
      return profileId;
    }
    return profiles[0]?.id ?? null;
  }, []);

  const performOpenWorkflow = useCallback(async (id: string) => {
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
      let workflowBrowserProfiles = browserProfiles;
      if (workflowProjectId) {
        setSelectedProjectId(workflowProjectId);
        try {
          workflowBrowserProfiles = await listBrowserProfiles(workflowProjectId);
          setBrowserProfiles(workflowBrowserProfiles);
        } catch {
          // Keep the workflow detail usable even if project metadata is temporarily unavailable.
        }
        await loadSubflowsForProject(workflowProjectId);
      }
      const profileId = resolveWorkflowProfileId(
        loaded.workflow.browser_profile_id,
        workflowBrowserProfiles,
      );
      setWorkflowProfileDraftId(profileId);
      setWorkflowProfileSavedId(profileId);
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
        const selectedProfile = workflowBrowserProfiles.find((profile) => profile.id === profileId);
        const nextSettings = selectedProfile
          ? { ...normalizedSettings, browser_launch: selectedProfile.browser_launch }
          : normalizedSettings;
        setWorkflowSettings(nextSettings);
        setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
      } catch {
        const fallbackSettings = defaultWorkflowSettings({
          workflowId: id,
          workflowName: loaded.workflow.name,
          createdAt: loaded.workflow.created_at,
          updatedAt: loaded.workflow.updated_at,
        });
        const selectedProfile = workflowBrowserProfiles.find((profile) => profile.id === profileId);
        const nextSettings = selectedProfile
          ? { ...fallbackSettings, browser_launch: selectedProfile.browser_launch }
          : fallbackSettings;
        setWorkflowSettings(nextSettings);
        setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
      }
      setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
      setGraphRevision(0);
      setSavedGraphRevision(0);
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      const workflowRun = latestRunForWorkflow(runSnapshots, id);
      setRunState((current: any) =>
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
  }, [
    currentProjectId,
    browserProfiles,
    graphAutosaveEnabled,
    runSnapshots,
    setScreen,
    setProjectCollection,
    setSelectedProjectId,
    setBrowserProfiles,
    loadSubflowsForProject,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    setWorkflowGraph,
    setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsSaveStatuses,
    setGraphRevision,
    setSavedGraphRevision,
    setGraphSaveStatus,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    setRunState,
    setSelectedGraphNodeId,
    setSidebarCollapsed,
    setAppError,
    resolveWorkflowProfileId,
  ]);

  const openWorkflow = useCallback(async (id: string) => {
    await requestGraphExitNavigation(() => performOpenWorkflow(id));
  }, [requestGraphExitNavigation, performOpenWorkflow]);

  const openCreateWorkflowDialog = useCallback(() => {
    setWorkflowDialogMode("create");
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setAppError("");
  }, [setAppError]);

  const openEditWorkflowDialog = useCallback((workflow: WorkflowSummary) => {
    setWorkflowDialogMode("edit");
    setEditingWorkflowId(workflow.id);
    setWorkflowNameDraft(workflow.name);
    setAppError("");
  }, [setAppError]);

  const closeWorkflowDialog = useCallback(() => {
    setWorkflowDialogMode(null);
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setAppError("");
  }, [setAppError]);

  const submitWorkflowDialog = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setAppError("");

    try {
      if (workflowDialogMode === "create") {
        const projectId = await ensureProjectId();
        if (!projectId) {
          setAppError("Project not found");
          return;
        }
        const created = await createWorkflowCommand(workflowNameDraft, {
          project_id: projectId,
        });
        closeWorkflowDialog();
        await loadWorkflows();
        await openWorkflow(created.id);
        return;
      }

      if (workflowDialogMode === "edit" && editingWorkflowId) {
        await renameWorkflowCommand(editingWorkflowId, workflowNameDraft);
        if (detail?.workflow.id === editingWorkflowId) {
          setDetail((curr) =>
            curr
              ? {
                  ...curr,
                  workflow: { ...curr.workflow, name: workflowNameDraft },
                }
              : curr
          );
        }
        closeWorkflowDialog();
        await loadWorkflows();
      }
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [
    workflowDialogMode,
    editingWorkflowId,
    workflowNameDraft,
    detail,
    ensureProjectId,
    closeWorkflowDialog,
    loadWorkflows,
    openWorkflow,
    setAppError,
  ]);

  const deleteWorkflow = useCallback((id: string) => {
    setAppError("");
    setDeleteBrowserProfileData(true);
    setDeleteWorkflowCandidate(
      workflows.find((workflow) => workflow.id === id) ?? null,
    );
  }, [workflows, setAppError]);

  const confirmDeleteWorkflow = useCallback(async () => {
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
  }, [
    deleteWorkflowCandidate,
    deleteBrowserProfileData,
    selectedWorkflowId,
    loadWorkflows,
    setScreen,
    setProjectCollection,
    setWorkflowGraph,
    setWorkflowSettings,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    setAppError,
  ]);

  const cancelDeleteWorkflow = useCallback(() => {
    setDeleteWorkflowCandidate(null);
    setDeleteBrowserProfileData(false);
  }, []);

  const duplicateWorkflow = useCallback(async (workflow: WorkflowSummary) => {
    setAppError("");
    const copyName = `Copy of ${workflow.name}`;

    try {
      await duplicateWorkflowCommand(workflow.id, copyName);
      await loadWorkflows();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [loadWorkflows, setAppError]);

  return {
    workflows,
    selectedWorkflowId,
    detail,
    workflowDialogMode,
    editingWorkflowId,
    workflowNameDraft,
    deleteWorkflowCandidate,
    deleteBrowserProfileData,
    setWorkflows,
    setSelectedWorkflowId,
    setDetail,
    setWorkflowNameDraft,
    setDeleteBrowserProfileData,
    setDeleteWorkflowCandidate,
    loadWorkflows,
    openWorkflow,
    performOpenWorkflow,
    openCreateWorkflowDialog,
    openEditWorkflowDialog,
    closeWorkflowDialog,
    submitWorkflowDialog,
    deleteWorkflow,
    confirmDeleteWorkflow,
    cancelDeleteWorkflow,
    duplicateWorkflow,
  };
}
