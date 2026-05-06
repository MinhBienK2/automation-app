import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type {
  GraphValidationIssue,
  RunState,
  WorkflowBrowserConfig,
  WorkflowGraph,
  WorkflowDetail,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { buildRunIssues } from "../../../lib/workflowUi";
import { RunIssuePanel } from "../components/RunIssuePanel";
import { RunStatusBar } from "../components/RunStatusBar";
import {
  WorkflowGraphEditor,
  type GraphSelectionRequest,
} from "../components/WorkflowGraphEditor";
import { WorkflowBrowserConfigPanel } from "../components/WorkflowBrowserConfigPanel";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  isRunning: boolean;
  appError: string;
  graphSaveStatus: string;
  browserConfigSaveStatus: string;
  runState: RunState;
  browserConfig: WorkflowBrowserConfig | null;
  workflowGraph: WorkflowGraph | null;
  graphIssues: GraphValidationIssue[];
  onBack: () => void;
  onBrowserConfigChange: (config: WorkflowBrowserConfig) => void;
  onSaveBrowserConfig: () => boolean | Promise<boolean>;
  onStopRun: () => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => void;
  onSaveGraph: () => void;
  onValidateGraph: () => void;
};

export function WorkflowDetailPage({
  detail,
  isRunning,
  appError,
  graphSaveStatus,
  browserConfigSaveStatus,
  runState,
  browserConfig,
  workflowGraph,
  graphIssues,
  onBack,
  onBrowserConfigChange,
  onSaveBrowserConfig,
  onStopRun,
  onGraphChange,
  onRunGraph,
  onSaveGraph,
  onValidateGraph,
}: WorkflowDetailPageProps) {
  const [selectionRequest, setSelectionRequest] =
    useState<GraphSelectionRequest | null>(null);
  const [isBrowserConfigOpen, setIsBrowserConfigOpen] = useState(false);
  const runIssues = useMemo(
    () => buildRunIssues({ appError, graphIssues, runState }),
    [appError, graphIssues, runState],
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
  const saveBrowserConfigFromDialog = async () => {
    const saved = await onSaveBrowserConfig();
    if (saved) setIsBrowserConfigOpen(false);
  };

  return (
    <section className="app-screen workflow-detail-screen">
      <PageHeader
        ariaLabel="Workflow detail header"
        backLabel="Back to Workflows"
        eyebrow="Workflow Detail"
        meta={["Graph workspace", graphSaveStatus, `Updated ${detail.workflow.updated_at}`]}
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
            {browserConfig ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsBrowserConfigOpen(true)}
              >
                <SlidersHorizontal aria-hidden="true" />
                Runtime
              </Button>
            ) : null}
            <Button
              variant="secondary"
              type="button"
              onClick={onValidateGraph}
            >
              Validate
            </Button>
            <Button
              shape="pill"
              type="button"
              onClick={onRunGraph}
              disabled={isRunning}
            >
              Run
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={onSaveGraph}
            >
              Save
            </Button>
            {isRunning ? (
              <Button variant="destructive" type="button" onClick={onStopRun}>
                Stop
              </Button>
            ) : null}
          </div>
        }
      />

      <Dialog open={isBrowserConfigOpen} onOpenChange={setIsBrowserConfigOpen}>
        {browserConfig ? (
          <DialogContent className="browser-config-dialog">
            <DialogHeader className="browser-config-dialog-header">
              <div>
                <p className="eyebrow">Workflow launch</p>
                <DialogTitle>Browser Runtime</DialogTitle>
              </div>
              <DialogDescription>
                Configure the browser profile, network, device, and challenge policy
                applied before this workflow runs.
              </DialogDescription>
            </DialogHeader>
            <WorkflowBrowserConfigPanel
              config={browserConfig}
              saveStatus={browserConfigSaveStatus}
              onCancel={() => setIsBrowserConfigOpen(false)}
              onChange={onBrowserConfigChange}
              onSave={saveBrowserConfigFromDialog}
            />
          </DialogContent>
        ) : null}
      </Dialog>

      <RunIssuePanel
        issues={runIssues}
        totalBlockingIssues={totalBlockingIssues}
        onRunAgain={onRunGraph}
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
          selectionRequest={selectionRequest}
          onChange={onGraphChange}
          onRunGraph={onRunGraph}
          onSaveGraph={onSaveGraph}
          onValidateGraph={onValidateGraph}
        />
      ) : null}
    </section>
  );
}
