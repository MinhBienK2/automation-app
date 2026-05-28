import { useMemo, useState } from "react";
import { CheckCircle2, CircleDot, Save, Settings } from "lucide-react";
import type {
  GraphValidationIssue,
  GraphEdgeDelay,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { IconButton } from "../../../components/ui/icon-button";
import { buildRunIssues } from "../../../lib/workflowUi";
import { RunIssuePanel } from "../components/RunIssuePanel";
import { RunStatusBar } from "../components/RunStatusBar";
import {
  WorkflowGraphEditor,
  type GraphSelectionRequest,
} from "../components/WorkflowGraphEditor";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  isRunning: boolean;
  appError: string;
  graphSaveStatus: string;
  runState: RunState;
  workflowGraph: WorkflowGraph | null;
  graphIssues: GraphValidationIssue[];
  graphIssuesNeedRecheck: boolean;
  defaultEdgeDelay?: GraphEdgeDelay | null;
  workflowIdentityLabel?: string | null;
  workflowSessionLabel?: string | null;
  onBack: () => void;
  onOpenWorkflowSettings: () => void;
  onStopRun: () => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => void;
  onRunGraphFromSelected: () => void;
  onRecordReplacement: () => void;
  onSelectedGraphNodeChange: (nodeId: string | null) => void;
  showRunGraphFromSelected: boolean;
  canRunGraphFromSelected: boolean;
  runGraphFromSelectedReason: string;
  onSaveGraph: () => void;
  onValidateGraph: () => void;
};

export function WorkflowDetailPage({
  detail,
  isRunning,
  appError,
  graphSaveStatus,
  runState,
  workflowGraph,
  graphIssues,
  graphIssuesNeedRecheck,
  defaultEdgeDelay,
  workflowIdentityLabel,
  workflowSessionLabel,
  onBack,
  onOpenWorkflowSettings,
  onStopRun,
  onGraphChange,
  onRunGraph,
  onRunGraphFromSelected,
  onRecordReplacement,
  onSelectedGraphNodeChange,
  showRunGraphFromSelected,
  canRunGraphFromSelected,
  runGraphFromSelectedReason,
  onSaveGraph,
  onValidateGraph,
}: WorkflowDetailPageProps) {
  const [selectionRequest, setSelectionRequest] =
    useState<GraphSelectionRequest | null>(null);
  const [launchRunOpen, setLaunchRunOpen] = useState(false);
  const runIssues = useMemo(
    () =>
      buildRunIssues({
        appError,
        graphIssues,
        graphIssuesNeedRecheck,
        runState,
      }),
    [appError, graphIssues, graphIssuesNeedRecheck, runState],
  );
  const totalBlockingIssues = graphIssues.filter((issue) => issue.level === "error").length;
  const hasBlockingIssues = totalBlockingIssues > 0;
  const requestNodeSelection = (nodeId: string) => {
    setSelectionRequest({
      requestId: Date.now(),
      nodeId,
      edgeId: null,
    });
  };
  const requestEdgeSelection = (edgeId: string) => {
    setSelectionRequest({
      requestId: Date.now(),
      nodeId: null,
      edgeId,
    });
  };
  const requestLaunchRun = () => setLaunchRunOpen(true);
  const confirmLaunchRun = () => {
    setLaunchRunOpen(false);
    onRunGraph();
  };
  return (
    <section className="app-screen workflow-detail-screen">
      <PageHeader
        ariaLabel="Workflow detail header"
        backLabel="Back to Workflows"
        eyebrow="Workflow Detail"
        meta={[graphSaveStatus]}
        status={
          <RunStatusBar
            state={runState}
            error={appError}
            hasBlockingIssues={hasBlockingIssues}
          />
        }
        title={detail.workflow.name}
        onBack={onBack}
        actions={
          <div className={isRunning ? "run-actions run-actions-with-stop" : "run-actions"}>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Settings"
              onClick={onOpenWorkflowSettings}
            >
              <Settings aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Validate"
              onClick={onValidateGraph}
            >
              <CheckCircle2 aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Save"
              onClick={onSaveGraph}
            >
              <Save aria-hidden="true" />
            </IconButton>
            {showRunGraphFromSelected ? (
              <Button
                className="workflow-command-secondary"
                variant="secondary"
                size="sm"
                type="button"
                onClick={onRunGraphFromSelected}
                disabled={!canRunGraphFromSelected}
                title={runGraphFromSelectedReason}
              >
                Run from selected
              </Button>
            ) : null}
            <Button
              className="workflow-command-secondary"
              variant="secondary"
              size="sm"
              type="button"
              onClick={onRecordReplacement}
              disabled={isRunning}
            >
              <CircleDot aria-hidden="true" />
              Record Replacement
            </Button>
            <Button
              className="workflow-command-primary"
              size="sm"
              type="button"
              onClick={requestLaunchRun}
              disabled={isRunning}
            >
              Launch Run
            </Button>
            {isRunning ? (
              <Button
                className="workflow-command-stop"
                variant="destructive"
                size="sm"
                type="button"
                onClick={onStopRun}
              >
                Stop
              </Button>
            ) : null}
          </div>
        }
      />

      <RunIssuePanel
        issues={runIssues}
        issuesNeedRecheck={graphIssuesNeedRecheck}
        totalBlockingIssues={totalBlockingIssues}
        onRunAgain={requestLaunchRun}
        onSaveAgain={onSaveGraph}
        onSelectEdge={requestEdgeSelection}
        onSelectNode={requestNodeSelection}
        onValidateAgain={onValidateGraph}
      />

      {workflowGraph ? (
        <WorkflowGraphEditor
          graph={workflowGraph}
          runState={runState}
          validationIssues={graphIssues}
          issuesNeedRecheck={graphIssuesNeedRecheck}
          selectionRequest={selectionRequest}
          defaultEdgeDelay={defaultEdgeDelay}
          onChange={onGraphChange}
          onRunGraph={requestLaunchRun}
          onSelectedNodeChange={onSelectedGraphNodeChange}
          onSaveGraph={onSaveGraph}
          onValidateGraph={onValidateGraph}
        />
      ) : null}

      <Dialog open={launchRunOpen} onOpenChange={setLaunchRunOpen}>
        <DialogContent className="launch-run-dialog">
          <DialogHeader className="modal-header">
            <div>
              <p className="eyebrow">Graph Builder</p>
              <DialogTitle>Launch Run</DialogTitle>
              <DialogDescription>
                Confirm a full workflow run before the existing save, settings,
                validation, and browser launch pipeline starts.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="launch-run-summary" aria-label="Launch run summary">
            <dl>
              <div>
                <dt>Workflow</dt>
                <dd>{detail.workflow.name}</dd>
              </div>
              <div>
                <dt>Graph save state</dt>
                <dd>{graphSaveStatus}</dd>
              </div>
              <div>
                <dt>Browser identity</dt>
                <dd>{workflowIdentityLabel || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Session reuse</dt>
                <dd>{workflowSessionLabel || "Unavailable"}</dd>
              </div>
            </dl>
            {hasBlockingIssues ? (
              <p className="field-warning">
                Current validation has {totalBlockingIssues} blocking issue
                {totalBlockingIssues === 1 ? "" : "s"}; launch will still use
                the existing validation gate before browser startup.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLaunchRunOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmLaunchRun} disabled={isRunning}>
              Launch Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
