import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, LocateFixed, X, ChevronDown, ChevronRight } from "lucide-react";
import type { GraphNode, RunState, WorkflowGraph } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { RunMonitorEnvironmentPanel } from "./RunMonitorEnvironment";

type RunMonitorDrawerProps = {
  graph: WorkflowGraph;
  runState: RunState;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
  initialVariables?: Array<{ name: string; value: string }> | null;
};

type RunMonitorTimelineEventStatus = "running" | "completed" | "failed";

type RunMonitorTimelineItem = {
  id: string;
  eventNumber: number;
  status: RunMonitorTimelineEventStatus;
  nodeId: string;
  label: string;
  stepNumber: number;
  traceIndex: number;
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
    traceIndex: number,
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
      traceIndex,
    });
  };

  runState.completed_step_ids.forEach((nodeId, index) => {
    appendNodeEvent(nodeId, "completed", index);
  });

  if (runState.status === "running") {
    appendNodeEvent(runState.current_step_id, "running", runState.completed_step_ids.length);
  }

  if (runState.status === "failed") {
    const failedNodeId = runState.error?.step_id ?? runState.current_step_id;
    appendNodeEvent(failedNodeId, "failed", runState.completed_step_ids.length);
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
  initialVariables,
}: RunMonitorDrawerProps) {
  const [expandedEventNumbers, setExpandedEventNumbers] = useState<Record<number, boolean>>({});
  const [showAllVars, setShowAllVars] = useState<Record<number, boolean>>({});
  const traces = useMemo(() => {
    return Array.isArray(runState.outputs?.__action_traces)
      ? (runState.outputs.__action_traces as any[])
      : [];
  }, [runState.outputs?.__action_traces]);
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
  const errorLocation = runState.error?.diagnostics?.label_path?.length
    ? runState.error.diagnostics.label_path.join(" > ")
    : runState.error?.step_name?.trim() || null;
  const errorSubflowContext = runState.error ? subflowContextLine(runState.error) : null;
  const errorActionSummary = runState.error?.diagnostics?.action_summary?.trim() || null;

  const isRunning = runState.status === "running";

  useEffect(() => {
    if (isRunning && typeof timelineEndRef.current?.scrollIntoView === "function") {
      timelineEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [timeline.length, isRunning]);

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
          {errorLocation ? <p>Location: {errorLocation}</p> : null}
          {errorSubflowContext ? <p>{errorSubflowContext}</p> : null}
          {errorActionSummary ? <p>Action target: {errorActionSummary}</p> : null}
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
              {timeline.map((item) => {
                const isExpanded = expandedEventNumbers[item.eventNumber] ?? false;
                const isShowAll = showAllVars[item.eventNumber] ?? false;
                const trace = traces[item.traceIndex];
                const contextText = (() => {
                  if (!trace) return null;
                  const parts: string[] = [];
                  if (trace.subflow_name) {
                    parts.push(`Subflow: ${trace.subflow_name}`);
                  }
                  if (trace.parent_node_id) {
                    const parentNode = nodeById.get(trace.parent_node_id);
                    const parentLabel = parentNode?.label || trace.parent_node_id;
                    parts.push(`Logic: ${parentLabel}`);
                  }
                  return parts.length > 0 ? parts.join(" · ") : null;
                })();

                return (
                  <li key={item.id} className="run-monitor-timeline-item">
                    <button
                      type="button"
                      className="run-monitor-step"
                      data-status={item.status}
                      aria-label={timelineItemLabel(item)}
                      onClick={() => {
                        onFocusNode(item.nodeId);
                      }}
                    >
                      <span
                        className="run-monitor-step-expand-icon"
                        role="button"
                        tabIndex={0}
                        aria-label={isExpanded ? "Collapse event details" : "Expand event details"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedEventNumbers((prev) => ({
                            ...prev,
                            [item.eventNumber]: !isExpanded,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedEventNumbers((prev) => ({
                              ...prev,
                              [item.eventNumber]: !isExpanded,
                            }));
                          }
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="run-monitor-step-marker" aria-hidden="true" />
                      <span className="run-monitor-step-copy">
                        <span>Event {item.eventNumber} · {timelineEventTitle(item.status)}</span>
                        <strong>Step {item.stepNumber} · {item.label}</strong>
                        {contextText && (
                          <span className="run-monitor-step-parent">
                            {contextText}
                          </span>
                        )}
                      </span>
                      <span className="run-monitor-step-status-cell">
                        <small>{monitorStatusLabel(item.status)}</small>
                      </span>
                    </button>
                    {isExpanded && (
                      <RunMonitorEnvironmentPanel
                        initialVariables={initialVariables}
                        traces={traces}
                        stepIndex={item.traceIndex}
                        trace={trace}
                        showAll={isShowAll}
                        onToggleShowAll={(e) => {
                          e.stopPropagation();
                          setShowAllVars((prev) => ({
                            ...prev,
                            [item.eventNumber]: !isShowAll,
                          }));
                        }}
                      />
                    )}
                  </li>
                );
              })}
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

function subflowContextLine(error: NonNullable<RunState["error"]>) {
  const stepNumber = error.diagnostics?.subflow_step_number;
  const stepCount = error.diagnostics?.subflow_step_count;
  const actionType = error.action_type.trim();
  if (typeof stepNumber !== "number" && !actionType) return null;
  const stepLabel = typeof stepNumber === "number"
    ? `Subflow step: ${stepNumber}${typeof stepCount === "number" ? ` of ${stepCount}` : ""}`
    : "Subflow step";
  return actionType ? `${stepLabel} · node ${actionType}` : stepLabel;
}
