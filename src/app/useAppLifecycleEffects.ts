import { useEffect, useRef } from "react";
import type {
  IdentityLabTarget,
  WorkflowRunSnapshot,
} from "../types/workflow";
import type { GraphSaveStatus } from "../lib/appState";
import type { AppScreen } from "../shared/types/workspaceContracts";
import { isRouteAllowed } from "../App";

export type UseAppLifecycleEffectsProps = {
  auth: {
    mode: "pending" | "team";
    currentUser: { role?: "admin" | "user" } | null;
  };
  nav: {
    screen: AppScreen;
    setScreen: (screen: AppScreen) => void;
  };
  setGraphAutosaveEnabled: (enabled: boolean) => void;
  setGraphSaveStatus: (status: GraphSaveStatus) => void;
  setGraphAutosaveDelayMs: (delay: number) => void;
  projectsWorkspace: {
    loadProjectModel: () => Promise<void>;
    selectedProjectId: string | null;
    projectCollection: string;
  };
  workflowsWorkspace: {
    loadWorkflows: () => Promise<void>;
    setSelectedWorkflowId: (id: string | null) => void;
    setDetail: (detail: null) => void;
  };
  loadSchedules: () => Promise<void>;
  runWorkspace: {
    refreshRunStates: () => Promise<void>;
  };
  loadOperationsOverview: () => Promise<void>;
  loadSettingsDiagnostics: () => Promise<void>;
  loadIdentityLabOverview: (target: IdentityLabTarget, projectId?: string | null) => Promise<void>;
  identityLabTarget: IdentityLabTarget;
  runSnapshots: Record<string, WorkflowRunSnapshot> | WorkflowRunSnapshot[];
  setRunSnapshots: (updater: (current: Record<string, WorkflowRunSnapshot>) => Record<string, WorkflowRunSnapshot>) => void;
  setWorkflowGraph: (graph: null) => void;
  setWorkflowSettings: (settings: null) => void;
  setWorkflowProfileDraftId: (id: null) => void;
  setWorkflowProfileSavedId: (id: null) => void;
  setSelectedGraphNodeId: (id: null) => void;
  setGraphIssues: (issues: never[]) => void;
  setGraphIssuesNeedRecheck: (need: boolean) => void;
  graphAutosaveEnabled: boolean;
};

export function useAppLifecycleEffects(props: UseAppLifecycleEffectsProps) {
  const {
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
    setRunSnapshots,
    setWorkflowGraph,
    setWorkflowSettings,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    setSelectedGraphNodeId,
    setGraphIssues,
    setGraphIssuesNeedRecheck,
    graphAutosaveEnabled,
  } = props;

  // Load App Settings
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
  }, [setGraphAutosaveEnabled, setGraphSaveStatus, setGraphAutosaveDelayMs]);

  // Initial Data Load
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

  // Load Identity Lab Overview on project or tab change
  useEffect(() => {
    if (projectsWorkspace.projectCollection === "profiles") {
      void loadIdentityLabOverview(identityLabTarget, projectsWorkspace.selectedProjectId);
    }
  }, [projectsWorkspace.selectedProjectId, projectsWorkspace.projectCollection]);

  // Run polling
  useEffect(() => {
    const snapshotsList = Array.isArray(runSnapshots) ? runSnapshots : Object.values(runSnapshots);
    if (!snapshotsList.some((snapshot) => snapshot.state.status === "running")) return;

    const intervalId = window.setInterval(() => {
      void runWorkspace.refreshRunStates();
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [runSnapshots]);
  // Reset finished run state when exiting the workflow details page
  const prevScreenRef = useRef<string | null>(null);
  useEffect(() => {
    const prevScreen = prevScreenRef.current;
    prevScreenRef.current = nav.screen;

    const wasEditing = prevScreen === "detail" || prevScreen === "subflow-detail";
    const isEditing = nav.screen === "detail" || nav.screen === "subflow-detail";

    if (wasEditing && !isEditing) {
      setRunSnapshots((current: unknown) => {
        const list = Array.isArray(current)
          ? (current as WorkflowRunSnapshot[])
          : Object.values(current as Record<string, WorkflowRunSnapshot>);
        return list.filter(
          (snapshot) =>
            snapshot.state.status === "running" ||
            snapshot.state.retained_session?.available === true,
        ) as never;
      });
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
    setRunSnapshots,
  ]);

  // Enforce route authorization
  useEffect(() => {
    if (auth.mode !== "pending" && !isRouteAllowed(nav.screen, auth.mode, auth.currentUser?.role)) {
      nav.setScreen("overview");
    }
  }, [auth.mode, auth.currentUser?.role, nav.screen, nav.setScreen]);
}
