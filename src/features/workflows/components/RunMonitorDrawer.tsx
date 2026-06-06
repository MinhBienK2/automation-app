import { useEffect, useMemo, useRef } from "react";
import { ClipboardCopy, LocateFixed, X } from "lucide-react";
import type { GraphNode, RunState, WorkflowGraph } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";

type RunMonitorDrawerProps = {
  graph: WorkflowGraph;
  runState: RunState;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
};

type RunMonitorTimelineEventStatus = "running" | "completed" | "failed";

type RunMonitorTimelineItem = {
  id: string;
  eventNumber: number;
  status: RunMonitorTimelineEventStatus;
  nodeId: string;
  label: string;
  stepNumber: number;
};

function nodeLabel(nodeById: Map<string, GraphNode>, nodeId: string | null | undefined) {
  if (!nodeId) return null;
  return nodeById.get(nodeId)?.label ?? nodeId;
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
      : "Failed";
  }
  if (runState.status === "success") return "Succeeded";
  if (runState.status === "stopped") return "Stopped";
  return "Idle";
}

function executableNodes(graph: WorkflowGraph) {
  return graph.nodes.filter((node) => node.node_type !== "start");
}

function stepNumberForNode(
  nodeId: string,
  runState: RunState,
  nodeOrder: Map<string, number>,
): number {
  if (runState.current_step_id === nodeId && runState.current_step_number) {
    return runState.current_step_number;
  }
  if (runState.error?.step_id === nodeId && runState.error.step_number) {
    return runState.error.step_number;
  }
  return nodeOrder.get(nodeId) ?? 0;
}

function buildTimeline(graph: WorkflowGraph, runState: RunState) {
  const nodes = executableNodes(graph);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index + 1]));
  const timeline: RunMonitorTimelineItem[] = [];

  const appendNodeEvent = (
    nodeId: string | null | undefined,
    status: RunMonitorTimelineEventStatus,
  ) => {
    if (!nodeId) return;
    const node = nodeById.get(nodeId);
    if (!node) return;
    const eventNumber = timeline.length + 1;
    timeline.push({
      id: `${nodeId}:${eventNumber}`,
      eventNumber,
      status,
      nodeId: node.id,
      label: node.label,
      stepNumber: stepNumberForNode(node.id, runState, nodeOrder),
    });
  };

  runState.completed_step_ids.forEach((nodeId) => {
    appendNodeEvent(nodeId, "completed");
  });

  if (runState.status === "running") {
    appendNodeEvent(runState.current_step_id, "running");
  }

  if (runState.status === "failed") {
    const failedNodeId = runState.error?.step_id ?? runState.current_step_id;
    appendNodeEvent(failedNodeId, "failed");
  }

  return timeline;
}

function monitorStatusLabel(status: RunMonitorTimelineEventStatus) {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "running";
}

function timelineEventTitle(status: RunMonitorTimelineEventStatus) {
  if (status === "completed") return "Completed node";
  if (status === "failed") return "Failed node";
  return "Running node";
}

function timelineItemLabel(item: RunMonitorTimelineItem) {
  return `Event ${item.eventNumber} ${monitorStatusLabel(item.status)}: Step ${item.stepNumber} ${item.label}`;
}

function copyRunError(message: string) {
  void navigator.clipboard?.writeText(message);
}

export function RunMonitorDrawer({
  graph,
  runState,
  onFocusNode,
  onClose,
}: RunMonitorDrawerProps) {
  const timelineEndRef = useRef<HTMLSpanElement | null>(null);
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const currentNodeId = targetNodeId(runState);
  const currentLabel =
    nodeLabel(nodeById, currentNodeId) ?? runState.error?.step_name ?? "No active node";
  const timeline = useMemo(() => buildTimeline(graph, runState), [graph, runState]);
  const hasError = runState.status === "failed" && Boolean(runState.error);

  useEffect(() => {
    if (typeof timelineEndRef.current?.scrollIntoView === "function") {
      timelineEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [timeline.length]);

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
          <h3>Run Timeline</h3>
          <span>{timeline.length} {timeline.length === 1 ? "event" : "events"}</span>
        </div>
        {timeline.length > 0 ? (
          <>
            <ol>
              {timeline.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="run-monitor-step"
                    data-status={item.status}
                    aria-label={timelineItemLabel(item)}
                    onClick={() => onFocusNode(item.nodeId)}
                  >
                    <span className="run-monitor-step-marker" aria-hidden="true" />
                    <span className="run-monitor-step-copy">
                      <span>Event {item.eventNumber} · {timelineEventTitle(item.status)}</span>
                      <strong>Step {item.stepNumber} · {item.label}</strong>
                    </span>
                    <small>{monitorStatusLabel(item.status)}</small>
                  </button>
                </li>
              ))}
            </ol>
            <span ref={timelineEndRef} aria-hidden="true" className="run-monitor-scroll-target" />
          </>
        ) : (
          <p className="run-monitor-empty">Timeline events appear as nodes start running.</p>
        )}
      </section>
    </aside>
  );
}
