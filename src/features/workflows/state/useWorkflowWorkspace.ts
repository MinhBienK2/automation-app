import { useState, useCallback } from "react";
import type {
  WorkflowWorkspaceAPI,
  WorkflowDialogMode,
} from "../../../shared/types/workspaceContracts";
import type {
  WorkflowSummary,
  WorkflowDetail,
  BrowserProfile,
  DesktopTarget,
  ExecutionSurfaceKind,
} from "../../../types/workflow";
import {
  listWorkflows,
  getWorkflow,
  deleteWorkflow as deleteWorkflowCommand,
  duplicateWorkflow as duplicateWorkflowCommand,
  createWorkflow as createWorkflowCommand,
  setWorkflowDesktopTarget as setWorkflowDesktopTargetCommand,
  renameWorkflow as renameWorkflowCommand,
  listBrowserProfiles,
  getWorkflowGraph,
  getWorkflowSettings,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import { defaultDesktopTargetFor } from "./defaultDesktopTarget";
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
  desktopTargets: DesktopTarget[];
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
    desktopTargets,
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
  const [selectedProfileIdDraft, setSelectedProfileIdDraft] = useState<string | null>(null);
  // The surface is a creation-time choice and cannot change afterwards, so it
  // lives only as a draft — there is no "current surface" to edit.
  const [surfaceDraft, setSurfaceDraft] = useState<ExecutionSurfaceKind>("web");
  const [selectedDesktopTargetIdDraft, setSelectedDesktopTargetIdDraft] = useState<string | null>(
    null,
  );
  const [deleteWorkflowCandidate, setDeleteWorkflowCandidate] = useState<WorkflowSummary | null>(null);
  const [workflowDialogBusy, setWorkflowDialogBusy] = useState(false);

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
    const defaultProfile = profiles.find((profile) => profile.is_default);
    return defaultProfile?.id ?? profiles[0]?.id ?? null;
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

      // Transition screen and metadata immediately to avoid blocking list screen click feedback
      setSelectedWorkflowId(id);
      setDetail(loaded);
      setWorkflowGraph(null);
      setWorkflowSettings(null);
      setSelectedGraphNodeId(null);
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      setSidebarCollapsed(true);
      setScreen("detail");

      const workflowProjectId = loaded.workflow.project_id ?? currentProjectId();

      // Initiate independent IPC API queries in parallel
      const profilesPromise = workflowProjectId
        ? Promise.resolve(listBrowserProfiles(workflowProjectId)).catch(() => null)
        : Promise.resolve(null);

      const subflowsPromise = workflowProjectId
        ? Promise.resolve(loadSubflowsForProject(workflowProjectId)).catch(() => null)
        : Promise.resolve(null);

      const graphPromise = Promise.resolve(getWorkflowGraph(id)).catch(() => null);

      const settingsPromise = Promise.resolve(getWorkflowSettings(id)).catch(() => null);

      if (workflowProjectId) {
        setSelectedProjectId(workflowProjectId);
      }

      const [profilesResult, _subflowsResult, graphResult, settingsResult] = await Promise.all([
        profilesPromise,
        subflowsPromise,
        graphPromise,
        settingsPromise,
      ]);

      const workflowBrowserProfiles = profilesResult ?? browserProfiles;
      if (profilesResult) {
        setBrowserProfiles(profilesResult);
      }

      const profileId = resolveWorkflowProfileId(
        loaded.workflow.browser_profile_id,
        workflowBrowserProfiles,
      );
      setWorkflowProfileDraftId(profileId);
      setWorkflowProfileSavedId(profileId);

      if (graphResult) {
        setWorkflowGraph(graphResult);
      } else {
        setWorkflowGraph(linearGraphFromSteps(loaded.steps));
      }

      if (settingsResult) {
        const normalizedSettings = withWorkflowSettingsDefaults(settingsResult, {
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
      } else {
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

      const workflowRun = latestRunForWorkflow(runSnapshots, id);
      setRunState((current: any) =>
        workflowRun
          ? workflowRun.state
          : idleRunStateWithRetainedSession(current),
      );
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
    const defaultProfile = browserProfiles.find((p) => p.is_default) ?? browserProfiles[0];
    setSelectedProfileIdDraft(defaultProfile?.id ?? null);
    // Web is the default because every workflow that exists today is one; a
    // desktop workflow is the deliberate choice, not the accidental one.
    setSurfaceDraft("web");
    const defaultTarget = defaultDesktopTargetFor(desktopTargets, currentProjectId());
    setSelectedDesktopTargetIdDraft(defaultTarget?.id ?? null);
    setWorkflowDialogBusy(false);
    setAppError("");
  }, [browserProfiles, desktopTargets, currentProjectId, setAppError]);

  const openEditWorkflowDialog = useCallback((workflow: WorkflowSummary) => {
    setWorkflowDialogMode("edit");
    setEditingWorkflowId(workflow.id);
    setWorkflowNameDraft(workflow.name);
    setWorkflowDialogBusy(false);
    setAppError("");
  }, [setAppError]);

  const closeWorkflowDialog = useCallback(() => {
    setWorkflowDialogMode(null);
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setWorkflowDialogBusy(false);
    setAppError("");
  }, [setAppError]);

  const submitWorkflowDialog = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setAppError("");
    setWorkflowDialogBusy(true);

    try {
      if (workflowDialogMode === "create") {
        const projectId = await ensureProjectId();
        if (!projectId) {
          setAppError("Project not found");
          return;
        }
        const created = await createWorkflowCommand(workflowNameDraft, {
          project_id: projectId,
          surface: surfaceDraft,
          browser_profile_id:
            surfaceDraft === "web" ? (selectedProfileIdDraft ?? undefined) : undefined,
        });
        // Set after creation rather than as a creation argument: the command
        // that assigns a Desktop Target is the one that checks the target
        // belongs to the workflow's project, and duplicating that check in the
        // create path is how the two drift.
        if (surfaceDraft === "desktop" && selectedDesktopTargetIdDraft) {
          await setWorkflowDesktopTargetCommand(created.id, selectedDesktopTargetIdDraft);
        }
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
    } finally {
      setWorkflowDialogBusy(false);
    }
  }, [
    workflowDialogMode,
    editingWorkflowId,
    workflowNameDraft,
    selectedProfileIdDraft,
    detail,
    ensureProjectId,
    closeWorkflowDialog,
    loadWorkflows,
    openWorkflow,
    setAppError,
  ]);

  const deleteWorkflow = useCallback((id: string) => {
    setAppError("");
    setDeleteWorkflowCandidate(
      workflows.find((workflow) => workflow.id === id) ?? null,
    );
  }, [workflows, setAppError]);

  const confirmDeleteWorkflow = useCallback(async () => {
    if (!deleteWorkflowCandidate) return;
    const id = deleteWorkflowCandidate.id;
    setAppError("");
    setWorkflowDialogBusy(true);

    try {
      await deleteWorkflowCommand(id);
      setDeleteWorkflowCandidate(null);
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
    } finally {
      setWorkflowDialogBusy(false);
    }
  }, [
    deleteWorkflowCandidate,
    selectedWorkflowId,
    loadWorkflows,
    setScreen,
    setProjectCollection,
    setWorkflowGraph,
    setWorkflowSettings,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    setDetail,
    setSelectedWorkflowId,
    setAppError,
  ]);

  const cancelDeleteWorkflow = useCallback(() => {
    setDeleteWorkflowCandidate(null);
    setWorkflowDialogBusy(false);
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
    selectedProfileIdDraft,
    surfaceDraft,
    selectedDesktopTargetIdDraft,
    deleteWorkflowCandidate,
    setWorkflows,
    setSelectedWorkflowId,
    setDetail,
    setWorkflowNameDraft,
    setSelectedProfileIdDraft,
    setSurfaceDraft,
    setSelectedDesktopTargetIdDraft,
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
    workflowDialogBusy,
  };
}
