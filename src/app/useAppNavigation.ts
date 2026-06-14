import { useState, useCallback } from "react";
import type {
  AppNavigationAPI,
  AppScreen,
  OverviewFocus,
  SubflowBackTarget,
} from "../shared/types/workspaceContracts";
import type {
  MissionControlTarget,
  WorkflowSummary,
} from "../types/workflow";
import {
  commandMessage,
} from "../lib/workflowUi";
import { getWorkflow } from "../lib/workflowApi";

export interface AppNavigationDeps {
  requestGraphExitNavigation: (navigate: () => void | Promise<void>) => Promise<boolean> | boolean;
  loadProjectModel: () => Promise<any>;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  currentProjectId: () => string | null;
  loadSubflowsForProject: (projectId?: string | null) => Promise<any>;
  loadWorkflows: () => Promise<void>;
  loadOperationsOverview: () => Promise<any>;
  loadSettingsDiagnostics: () => Promise<any>;
  setFocusedScheduleId: (id: string | null) => void;
  loadSchedules: () => Promise<any[]>;
  loadScheduleHistory: (id: string) => Promise<any>;
  setSelectedSubflow: (subflow: any) => void;
  setSelectedSubflowGraph: (graph: any) => void;
  setSelectedSubflowUsage: (usage: any) => void;
  setSubflowBackTarget: (target: SubflowBackTarget) => void;
  subflowBackTarget: SubflowBackTarget;
  detail: any;
  openWorkflow: (id: string) => Promise<void>;
  performOpenWorkflow: (id: string) => Promise<void>;
  setIdentityLabTarget: (target: any) => void;
  loadIdentityLabOverview: (target: any, projectId?: string | null) => Promise<any>;
  workflows: WorkflowSummary[];
  setWorkflows: React.Dispatch<React.SetStateAction<WorkflowSummary[]>>;
  openWorkflowSettings: (workflow: WorkflowSummary, sectionId?: any) => Promise<void>;
  setProjectCollection: (collection: "workflows" | "subflows" | "profiles" | "settings") => void;
  setSelectedGraphNodeId: (nodeId: string | null) => void;
  setAppError: (error: string) => void;
}

export function useAppNavigation(deps: AppNavigationDeps): AppNavigationAPI {
  const [screen, setScreen] = useState<AppScreen>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overviewFocus, setOverviewFocus] = useState<OverviewFocus>(null);

  const {
    requestGraphExitNavigation,
    loadProjectModel,
    selectedProjectId,
    setSelectedProjectId: _setSelectedProjectId,
    currentProjectId,
    loadSubflowsForProject,
    loadWorkflows,
    loadOperationsOverview,
    loadSettingsDiagnostics,
    setFocusedScheduleId,
    loadSchedules,
    loadScheduleHistory,
    setSelectedSubflow,
    setSelectedSubflowGraph,
    setSelectedSubflowUsage,
    setSubflowBackTarget,
    subflowBackTarget,
    detail,
    openWorkflow,
    performOpenWorkflow,
    setIdentityLabTarget,
    loadIdentityLabOverview,
    workflows,
    setWorkflows,
    openWorkflowSettings,
    setProjectCollection,
    setSelectedGraphNodeId,
    setAppError,
  } = deps;

  const performOpenProjects = useCallback((collection: "workflows" | "subflows" | "profiles" | "settings" = "workflows") => {
    setScreen("projects");
    setProjectCollection(collection);
    setSidebarCollapsed(false);
    setAppError("");
    void (async () => {
      const loaded = await loadProjectModel();
      const projectId =
        selectedProjectId && loaded.projects.some((project: any) => project.id === selectedProjectId)
          ? selectedProjectId
          : loaded.projects[0]?.id ?? currentProjectId();
      if (collection === "subflows" || collection === "settings" || collection === "profiles") {
        await loadSubflowsForProject(projectId);
      }
    })();
  }, [
    selectedProjectId,
    currentProjectId,
    loadProjectModel,
    loadSubflowsForProject,
    setProjectCollection,
    setAppError,
  ]);

  const openProjects = useCallback((collection: "workflows" | "subflows" | "profiles" | "settings" = "workflows") => {
    void requestGraphExitNavigation(() => performOpenProjects(collection));
  }, [requestGraphExitNavigation, performOpenProjects]);

  const backToList = useCallback(() => {
    void requestGraphExitNavigation(() => {
      performOpenProjects("workflows");
      void loadWorkflows();
    });
  }, [requestGraphExitNavigation, performOpenProjects, loadWorkflows]);

  const performOpenOverview = useCallback((focus: OverviewFocus = null) => {
    setScreen("overview");
    setOverviewFocus(focus);
    setAppError("");
    void loadOperationsOverview();
  }, [loadOperationsOverview, setAppError]);

  const openOverview = useCallback((focus: OverviewFocus = null) => {
    void requestGraphExitNavigation(() => performOpenOverview(focus));
  }, [requestGraphExitNavigation, performOpenOverview]);

  const performOpenSettings = useCallback(() => {
    setScreen("settings");
    setAppError("");
    void loadSettingsDiagnostics();
  }, [loadSettingsDiagnostics, setAppError]);

  const openSettings = useCallback(() => {
    void requestGraphExitNavigation(performOpenSettings);
  }, [requestGraphExitNavigation, performOpenSettings]);

  const performOpenSettingsHelp = useCallback(() => {
    setScreen("settings-help");
    setAppError("");
  }, [setAppError]);

  const openSettingsHelp = useCallback(() => {
    void requestGraphExitNavigation(performOpenSettingsHelp);
  }, [requestGraphExitNavigation, performOpenSettingsHelp]);

  const performOpenSchedules = useCallback(() => {
    setScreen("schedules");
    setAppError("");
    setFocusedScheduleId(null);
    void loadSchedules();
  }, [loadSchedules, setFocusedScheduleId, setAppError]);

  const openSchedules = useCallback(() => {
    void requestGraphExitNavigation(performOpenSchedules);
  }, [requestGraphExitNavigation, performOpenSchedules]);

  const backFromSubflowDetail = useCallback(() => {
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
  }, [
    subflowBackTarget,
    detail,
    openWorkflow,
    performOpenProjects,
    requestGraphExitNavigation,
    setSelectedSubflow,
    setSelectedSubflowGraph,
    setSelectedSubflowUsage,
    setSubflowBackTarget,
    setAppError,
  ]);


  const resolveWorkflowSummary = useCallback(async (workflowId: string) => {
    const cachedWorkflow = workflows.find((item) => item.id === workflowId);
    if (cachedWorkflow) return cachedWorkflow;

    const loaded = await getWorkflow(workflowId);
    if (!loaded) return null;
    const loadedWorkflow: WorkflowSummary = {
      id: loaded.workflow.id,
      name: loaded.workflow.name,
      step_count: loaded.steps.length,
      project_id: loaded.workflow.project_id ?? null,
      browser_profile_id: loaded.workflow.browser_profile_id ?? null,
      created_at: loaded.workflow.created_at,
      updated_at: loaded.workflow.updated_at,
    };
    setWorkflows((current) =>
      current.some((item) => item.id === loadedWorkflow.id)
        ? current.map((item) => item.id === loadedWorkflow.id ? loadedWorkflow : item)
        : [...current, loadedWorkflow],
    );
    return loadedWorkflow;
  }, [workflows, setWorkflows]);

  const openWorkflowSettingsById = useCallback(async (workflowId: string, missingMessage: string) => {
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
  }, [resolveWorkflowSummary, openWorkflowSettings, setAppError]);

  const openScheduleTarget = useCallback(async (
    scheduleId?: string | null,
    scheduleEventId?: string | null,
  ) => {
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
  }, [loadSchedules, loadScheduleHistory, setFocusedScheduleId, setAppError]);

  const performNavigateToMissionControlTarget = useCallback(async (target: MissionControlTarget) => {
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
    if (target.type === "identity") {
      const workflowId = target.target.workflow_id;
      const wf = workflows.find((w) => w.id === workflowId);
      if (wf?.project_id) {
        performOpenProjects("profiles");
        _setSelectedProjectId(wf.project_id);
        setIdentityLabTarget(target.target);
        void loadIdentityLabOverview(target.target, wf.project_id);
      }
      return;
    }
    if (target.type === "schedule") {
      await openScheduleTarget(target.schedule_id, target.schedule_event_id);
      return;
    }
    if (target.type === "graph_issue") {
      await performOpenWorkflow(target.workflow_id);
      if (target.node_id) {
        setSelectedGraphNodeId(target.node_id);
      }
      return;
    }
  }, [
    performOpenProjects,
    loadWorkflows,
    openWorkflowSettingsById,
    performOpenWorkflow,
    _setSelectedProjectId,
    setIdentityLabTarget,
    loadIdentityLabOverview,
    workflows,
    openScheduleTarget,
    setSelectedGraphNodeId,
  ]);

  const navigateToMissionControlTarget = useCallback(async (target: MissionControlTarget) => {
    await requestGraphExitNavigation(() => performNavigateToMissionControlTarget(target));
  }, [requestGraphExitNavigation, performNavigateToMissionControlTarget]);

  return {
    screen,
    sidebarCollapsed,
    overviewFocus,
    setScreen,
    setSidebarCollapsed,
    setOverviewFocus,
    openProjects,
    openOverview,
    openSettings,
    openSettingsHelp,
    openSchedules,
    navigateToMissionControlTarget,
    backToList,
    backFromSubflowDetail,
  };
}
