import { useMemo } from "react";
import { ClipboardCopy, LocateFixed, X } from "lucide-react";
import type { GraphNode, RunState, WorkflowGraph } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { SwitchField } from "../../../components/ui/switch";
import { actionLabels } from "../../../lib/workflowUi";
import { graphCanvasNodeKindLabel } from "../lib/workflowGraph";

type RunMonitorDrawerProps = {
  graph: WorkflowGraph;
  runState: RunState;
  followCurrentNode: boolean;
  onFollowCurrentNodeChange: (checked: boolean) => void;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
};

type RunMonitorStepStatus = "pending" | "running" | "success" | "failed";

type RunMonitorTimelineItem = {
  id: string;
  label: string;
  stepNumber: number | null;
  status: RunMonitorStepStatus;
  target: boolean;
};

function nodeLabel(nodeById: Map<string, GraphNode>, nodeId: string | null | undefined) {
  if (!nodeId) return null;
  return nodeById.get(nodeId)?.label ?? nodeId;
}

function nodeKindLabel(node: GraphNode | null, runState: RunState) {
  if (node) return graphCanvasNodeKindLabel(node);
  const errorActionType = runState.error?.action_type;
  if (errorActionType && errorActionType in actionLabels) {
    return actionLabels[errorActionType as keyof typeof actionLabels];
  }
  return "Workflow step";
}

function targetNodeId(runState: RunState) {
  if (runState.status === "failed") {
    return (
      runState.error?.step_id ??
      runState.current_step_id ??
      runState.completed_step_ids[runState.completed_step_ids.length - 1] ??
      null
    );
  }
  if (runState.status === "running") return runState.current_step_id;
  return runState.completed_step_ids[runState.completed_step_ids.length - 1] ?? null;
}

function statusLabel(runState: RunState) {
  if (runState.status === "running") {
    return runState.current_step_number
      ? `Running step ${runState.current_step_number}`
      : "Running";
  }
  if (runState.status === "failed") {
    return runState.error?.step_number
      ? `Failed at step ${runState.error.step_number}`
      : "Run failed";
  }
  if (runState.status === "success") return "Run succeeded";
  if (runState.status === "stopped") return "Stopped";
  return "Idle";
}

function executableNodes(graph: WorkflowGraph) {
  return graph.nodes.filter((node) => node.node_type !== "start");
}

function statusForNode(nodeId: string, runState: RunState): RunMonitorStepStatus {
  if (runState.error?.step_id === nodeId) return "failed";
  if (runState.status === "running" && runState.current_step_id === nodeId) return "running";
  if (runState.completed_step_ids.includes(nodeId)) return "success";
  return "pending";
}

function stepNumberForNode(
  nodeId: string,
  index: number,
  runState: RunState,
): number {
  if (runState.current_step_id === nodeId && runState.current_step_number) {
    return runState.current_step_number;
  }
  if (runState.error?.step_id === nodeId && runState.error.step_number) {
    return runState.error.step_number;
  }
  return index + 1;
}

function buildTimeline(graph: WorkflowGraph, runState: RunState) {
  return executableNodes(graph).map<RunMonitorTimelineItem>((node, index) => ({
    id: node.id,
    label: node.label,
    stepNumber: stepNumberForNode(node.id, index, runState),
    status: statusForNode(node.id, runState),
    target: node.id === targetNodeId(runState),
  }));
}

function monitorStatusLabel(status: RunMonitorStepStatus) {
  if (status === "success") return "success";
  if (status === "failed") return "failed";
  if (status === "running") return "running";
  return "pending";
}

function timelineItemLabel(item: RunMonitorTimelineItem) {
  return `Step ${item.stepNumber ?? ""} ${monitorStatusLabel(item.status)}: ${item.label}`;
}

function copyRunError(message: string) {
  void navigator.clipboard?.writeText(message);
}

export function RunMonitorDrawer({
  graph,
  runState,
  followCurrentNode,
  onFollowCurrentNodeChange,
  onFocusNode,
  onClose,
}: RunMonitorDrawerProps) {
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const currentNodeId = targetNodeId(runState);
  const currentNode = currentNodeId ? nodeById.get(currentNodeId) ?? null : null;
  const currentLabel =
    nodeLabel(nodeById, currentNodeId) ?? runState.error?.step_name ?? "No active node";
  const timeline = useMemo(() => buildTimeline(graph, runState), [graph, runState]);
  const hasError = runState.status === "failed" && Boolean(runState.error);
  const focusLabel =
    runState.status === "failed"
      ? "Focus failed node"
      : runState.status === "running"
        ? "Focus current"
        : "Focus last step";

  return (
    <aside className="run-monitor-drawer" aria-label="Run Monitor">
      <header className="run-monitor-header">
        <div>
          <p className="eyebrow">Run Monitor</p>
          <h2>{statusLabel(runState)}</h2>
        </div>
        <Button
          className="run-monitor-close"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close monitor"
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <section className="run-monitor-current" aria-label="Current run step">
        <span className="run-monitor-status" data-status={runState.status}>
          {statusLabel(runState)}
        </span>
        <h3>{currentLabel}</h3>
        <p>{nodeKindLabel(currentNode, runState)}</p>
        <div className="run-monitor-actions">
          <SwitchField
            checked={followCurrentNode}
            className="run-monitor-follow"
            label="Follow current"
            onCheckedChange={onFollowCurrentNodeChange}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => currentNodeId && onFocusNode(currentNodeId)}
            disabled={!currentNodeId}
          >
            <LocateFixed aria-hidden="true" />
            {focusLabel}
          </Button>
        </div>
      </section>

      {hasError && runState.error ? (
        <section className="run-monitor-issue" aria-label="Run monitor issue">
          <span>Runtime failure</span>
          <h3>Step {runState.error.step_number}: {runState.error.step_name ?? currentLabel}</h3>
          <p>{runState.error.reason.split(/\r?\n/)[0]}</p>
          <div className="run-monitor-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => runState.error?.step_id && onFocusNode(runState.error.step_id)}
              disabled={!runState.error.step_id}
            >
              <LocateFixed aria-hidden="true" />
              Focus failed node
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copyRunError(runState.error?.reason ?? "")}
            >
              <ClipboardCopy aria-hidden="true" />
              Copy details
            </Button>
          </div>
        </section>
      ) : null}

      <section className="run-monitor-timeline" aria-label="Run timeline">
        <div className="run-monitor-section-heading">
          <h3>Timeline</h3>
          <span>{timeline.length} steps</span>
        </div>
        <ol>
          {timeline.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="run-monitor-step"
                data-status={item.status}
                data-current={item.target ? "true" : "false"}
                aria-label={timelineItemLabel(item)}
                onClick={() => onFocusNode(item.id)}
              >
                <span>Step {item.stepNumber}</span>
                <strong>{item.label}</strong>
                <small>{monitorStatusLabel(item.status)}</small>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
