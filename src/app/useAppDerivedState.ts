import type {
  BrowserProfile,
  DesktopTarget,
  Project,
  RunState,
  VariableAssignment,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowRunSnapshot,
  WorkflowSettings,
} from "../types/workflow";
import {
  idleRunStateWithRetainedSession,
  latestRunForWorkflow,
} from "../lib/appState";
import { runFromSelectedState } from "../features/workflows/lib/runFromSelected";

export type UseAppDerivedStateProps = {
  workflowsWorkspace: {
    detail: WorkflowDetail | null;
    workflows: Workflow[];
  };
  projectsWorkspace: {
    projects: Project[];
    selectedProjectId: string | null;
    browserProfiles: BrowserProfile[];
    desktopTargets: DesktopTarget[];
  };
  subflowsWorkspace: {
    subflows: Array<{ id: string; project_id: string }>;
    selectedSubflow: { id: string; project_id: string } | null;
    selectedSubflowGraph: WorkflowGraph | null;
    subflowGraphSaveStatus: "saved" | "unsaved" | "saving" | "failed";
  };
  runSnapshots: WorkflowRunSnapshot[];
  runState: RunState;
  workflowGraph: WorkflowGraph | null;
  workflowSettings: WorkflowSettings | null;
  graphRevision: number;
  savedGraphRevision: number;
  graphSaveStatus: string;
  workflowProfileDraftId: string | null;
  selectedGraphNodeId: string | null;
};

export function useAppDerivedState(props: UseAppDerivedStateProps) {
  const {
    workflowsWorkspace,
    projectsWorkspace,
    subflowsWorkspace,
    runSnapshots,
    runState,
    workflowGraph,
    workflowSettings,
    graphRevision,
    savedGraphRevision,
    graphSaveStatus,
    workflowProfileDraftId,
    selectedGraphNodeId,
  } = props;

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
        selectedNodeId: selectedGraphNodeId,
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
    ? projectNameForId(workflowsWorkspace.detail.workflow.project_id) ?? selectedProject?.name ?? ""
    : "";

  const selectedSubflowProjectName = subflowsWorkspace.selectedSubflow
    ? projectNameForId(subflowsWorkspace.selectedSubflow.project_id) ?? selectedProject?.name ?? ""
    : "";

  const selectedBrowserProfiles = selectedProject
    ? projectsWorkspace.browserProfiles.filter((profile) => profile.project_id === selectedProject.id)
    : [];

  const selectedDesktopTargets = selectedProject
    ? projectsWorkspace.desktopTargets.filter((target) => target.project_id === selectedProject.id)
    : [];

  const selectedProjectWorkflows = selectedProject
    ? workflowsWorkspace.workflows.filter(
        (workflow) => !workflow.project_id || workflow.project_id === selectedProject.id,
      )
    : [];

  const profileVariables = ((): VariableAssignment[] => {
    const profile = selectedBrowserProfiles.find((p) => p.id === workflowProfileDraftId);
    return profile?.initial_variables ?? [];
  })();

  const projectStats = ((): Record<string, { workflows: number; subflows: number; profiles: number }> => {
    const stats: Record<string, { workflows: number; subflows: number; profiles: number }> = {};
    for (const project of projectsWorkspace.projects) {
      stats[project.id] = {
        workflows: workflowsWorkspace.workflows.filter(
          (workflow) => !workflow.project_id || workflow.project_id === project.id,
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
  })();

  return {
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
  };
}
