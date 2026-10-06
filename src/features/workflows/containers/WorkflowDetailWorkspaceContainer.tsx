import type {
  GraphValidationIssue,
  RunState,
  VariableAssignment,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowRunFromSelectedMode,
  WorkflowRunSnapshot,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";
import { WorkflowDetailPage } from "../pages/WorkflowDetailPage";

export type WorkflowDetailWorkspaceContainerProps = {
  detail: WorkflowDetail;
  projectName: string;
  isRunning: boolean;
  isStartingRun: boolean;
  appError: string;
  graphSaveStatus: string;
  canSaveWorkflowGraph: boolean;
  detailRunState: RunState;
  workflowGraph: WorkflowGraph;
  graphIssues: GraphValidationIssue[];
  subflowOptions: Array<{ id: string; name: string }>;
  graphIssuesNeedRecheck: boolean;
  workflowSettings: WorkflowSettings | null;
  profileVariables: VariableAssignment[];
  onBack: () => void;
  openDetailWorkflowSettings: (section?: WorkflowSettingsSectionId) => void;
  stopRun: (runId: string) => void;
  detailRunSnapshot: WorkflowRunSnapshot | null;
  onCreateSubflowFromSelection: (input: { name: string; graph: WorkflowGraph }) => Promise<unknown>;
  onLoadSubflowGraph: (subflowId: string) => Promise<WorkflowGraph>;
  onOpenSubflowDetail: (subflowId: string) => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => Promise<void>;
  onRunGraphFromSelected: (mode: WorkflowRunFromSelectedMode) => Promise<void>;
  onSelectedGraphNodeChange: (nodeId: string | null) => void;
  runFromSelectedAvailability: { visible?: boolean; enabled: boolean; reason?: string };
  onSaveGraph: () => Promise<void>;
  onValidateGraph: () => void;
  onRestoreRevision: (graph: WorkflowGraph) => Promise<void>;
  isSavingGraph: boolean;
};

export function WorkflowDetailWorkspaceContainer(props: WorkflowDetailWorkspaceContainerProps) {
  const {
    detail,
    projectName,
    isRunning,
    isStartingRun,
    appError,
    graphSaveStatus,
    canSaveWorkflowGraph,
    detailRunState,
    workflowGraph,
    graphIssues,
    subflowOptions,
    graphIssuesNeedRecheck,
    workflowSettings,
    profileVariables,
    onBack,
    openDetailWorkflowSettings,
    stopRun,
    detailRunSnapshot,
    onCreateSubflowFromSelection,
    onLoadSubflowGraph,
    onOpenSubflowDetail,
    onGraphChange,
    onRunGraph,
    onRunGraphFromSelected,
    onSelectedGraphNodeChange,
    runFromSelectedAvailability,
    onSaveGraph,
    onValidateGraph,
    onRestoreRevision,
    isSavingGraph,
  } = props;

  return (
    <WorkflowDetailPage
      detail={detail}
      projectName={projectName}
      isRunning={isRunning}
      isStartingRun={isStartingRun}
      appError={appError}
      graphSaveStatus={graphSaveStatus}
      canSaveGraph={canSaveWorkflowGraph}
      runState={detailRunState}
      workflowGraph={workflowGraph}
      graphIssues={graphIssues}
      subflowOptions={subflowOptions}
      graphIssuesNeedRecheck={graphIssuesNeedRecheck}
      defaultEdgeDelay={workflowSettings?.graph_defaults?.default_edge_delay ?? null}
      liveRunEnabled={workflowSettings?.graph_defaults?.live_run_enabled ?? true}
      liveRunFollowCurrent={workflowSettings?.graph_defaults?.live_run_follow_current ?? false}
      initialVariables={workflowSettings?.environment?.initial_variables}
      profileVariables={profileVariables}
      onBack={onBack}
      onOpenWorkflowSettings={() => openDetailWorkflowSettings("browser_launch")}
      onStopRun={() => stopRun(detailRunSnapshot?.run_id ?? "")}
      onCreateSubflowFromSelection={onCreateSubflowFromSelection}
      onLoadSubflowGraph={onLoadSubflowGraph}
      onOpenSubflowDetail={onOpenSubflowDetail}
      onGraphChange={onGraphChange}
      onRunGraph={onRunGraph}
      onRunGraphFromSelected={onRunGraphFromSelected}
      onSelectedGraphNodeChange={onSelectedGraphNodeChange}
      showRunGraphFromSelected={runFromSelectedAvailability.visible ?? true}
      canRunGraphFromSelected={runFromSelectedAvailability.enabled}
      runGraphFromSelectedReason={runFromSelectedAvailability.reason}
      onSaveGraph={onSaveGraph}
      onValidateGraph={onValidateGraph}
      onRestoreRevision={onRestoreRevision}
      isSavingGraph={isSavingGraph}
    />
  );
}
