import React, { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, LocateFixed, X, ChevronDown, ChevronRight } from "lucide-react";
import type { GraphNode, RunState, WorkflowGraph } from "../../../../types/workflow";
import { Button } from "../../../../components/ui/button";
import { RunMonitorEnvironmentPanel } from "./RunMonitorEnvironment";

type RunMonitorDrawerProps = {
  open: boolean;
  graph: WorkflowGraph;
  runState: RunState;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
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

function resolveMainGraphNodeId(
  nodeId: string | null | undefined,
  graphNodeIds: Set<string>,
): string | null {
  if (!nodeId) return null;
  let cleanNodeId = nodeId;
  if (cleanNodeId.startsWith("__prelude:loop_item:")) {
    cleanNodeId = cleanNodeId.slice("__prelude:loop_item:".length);
  } else if (cleanNodeId.startsWith("__prelude:loop_indices:")) {
    cleanNodeId = cleanNodeId.slice("__prelude:loop_indices:".length);
  }
  if (graphNodeIds.has(cleanNodeId)) return cleanNodeId;
  const subflowCallerNodeId = cleanNodeId.split("::", 1)[0];
  if (subflowCallerNodeId && graphNodeIds.has(subflowCallerNodeId)) {
    return subflowCallerNodeId;
  }
  return cleanNodeId;
}

function buildTimeline(graph: WorkflowGraph, runState: RunState) {
  const nodes = executableNodes(graph);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index + 1]));
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const timeline: RunMonitorTimelineItem[] = [];

  const resolveNodeId = (id: string | null | undefined) => {
    return resolveMainGraphNodeId(id, graphNodeIds);
  };

  const appendNodeEvent = (
    nodeId: string | null | undefined,
    status: RunMonitorTimelineEventStatus,
    traceIndex: number,
  ) => {
    if (!nodeId) return;
    const resolvedId = resolveNodeId(nodeId);
    if (!resolvedId) return;
    const node = nodeById.get(resolvedId);
    if (!node) return;
    const eventNumber = timeline.length + 1;
    timeline.push({
      id: `${resolvedId}:${eventNumber}`,
      eventNumber,
      status,
      nodeId: node.id,
      label: node.label,
      stepNumber: stepNumberForNode(node.id, runState, nodeOrder),
      traceIndex,
    });
  };

  const rawTraces = Array.isArray(runState.outputs?.__action_traces)
    ? (runState.outputs.__action_traces as any[])
    : [];

  const traces = [...rawTraces];

  traces.forEach((trace, index) => {
    const status: RunMonitorTimelineEventStatus =
      trace.status === "failed" || trace.status === "stopped" ? "failed" : "completed";
    const nodeId = trace.node_id ?? runState.completed_step_ids[index];
    appendNodeEvent(nodeId, status, index);
  });

  if (runState.status === "running") {
    appendNodeEvent(runState.current_step_id, "running", traces.length);
  }

  if (runState.status === "failed") {
    const failedNodeId = runState.error?.step_id ?? runState.current_step_id;
    const resolvedFailedNodeId = resolveNodeId(failedNodeId);
    const lastEvent = timeline[timeline.length - 1];
    if (resolvedFailedNodeId && lastEvent?.nodeId !== resolvedFailedNodeId) {
      appendNodeEvent(failedNodeId, "failed", traces.length);
    }
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

function formatDuration(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
): string | null {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (isNaN(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function actionTypeBadge(actionType: string | null | undefined): React.ReactNode {
  if (!actionType) return null;
  const typeLower = actionType.toLowerCase().trim();
  let badgeClass = "run-monitor-badge-neutral";
  let label = typeLower.toUpperCase();

  if (typeLower === "wait") {
    badgeClass = "run-monitor-badge-wait";
    label = "WAIT";
  } else if (typeLower === "click") {
    badgeClass = "run-monitor-badge-click";
    label = "CLICK";
  } else if (typeLower === "input_text" || typeLower === "fill_field" || typeLower === "fill") {
    badgeClass = "run-monitor-badge-input";
    label = "INPUT";
  } else if (typeLower === "set_variable" || typeLower === "assign_variable" || typeLower === "assign") {
    badgeClass = "run-monitor-badge-variable";
    label = "VAR";
  } else if (typeLower === "execute_js" || typeLower === "js" || typeLower === "evaluate") {
    badgeClass = "run-monitor-badge-js";
    label = "JS";
  }

  return <span className={`run-monitor-badge ${badgeClass}`}>[{label}]</span>;
}

function variableMutationPreview(trace: any): string | null {
  if (!trace || !trace.output_summary) return null;
  const mutatedKeys = [
    ...(trace.output_summary.added_keys || []),
    ...(trace.output_summary.changed_keys || []),
  ];
  if (mutatedKeys.length === 0) return null;

  const parts = mutatedKeys.map((key) => {
    const val = trace.output_values?.[key];
    if (val === undefined) return key;
    if (val === null) return `${key} = null`;
    if (typeof val === "object") {
      return `${key} = ${Array.isArray(val) ? "[...]" : "{...}"}`;
    }
    const strVal = String(val);
    return `${key} = ${strVal.length > 20 ? strVal.slice(0, 17) + "..." : strVal}`;
  });

  return `(${parts.join(", ")})`;
}

export function RunMonitorDrawer({
  open,
  graph,
  runState,
  onFocusNode,
  onClose,
  initialVariables,
  profileVariables,
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
  const durations = useMemo(() => {
    return timeline.map((item) => {
      const trace = traces[item.traceIndex];
      if (!trace || !trace.started_at || !trace.finished_at) return 0;
      const ms = new Date(trace.finished_at).getTime() - new Date(trace.started_at).getTime();
      return isNaN(ms) || ms < 0 ? 0 : ms;
    });
  }, [timeline, traces]);
  const maxDuration = useMemo(() => {
    const val = Math.max(...durations, 0);
    return val > 0 ? val : 1;
  }, [durations]);
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
    <aside className={open ? "run-monitor-drawer open" : "run-monitor-drawer"} aria-label="Run Monitor">
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

                const durationText = trace ? formatDuration(trace.started_at, trace.finished_at) : null;
                const badgeEl = trace ? actionTypeBadge(trace.action_type) : null;
                const mutationPreview = trace ? variableMutationPreview(trace) : null;
                const itemDuration = durations[timeline.indexOf(item)] || 0;
                const durationPercentage = (itemDuration / maxDuration) * 100;

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
                        <span style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                          <span>Event {item.eventNumber} · {timelineEventTitle(item.status)}</span>
                          {durationText && <span className="run-monitor-step-duration">{durationText}</span>}
                        </span>
                        <strong style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                          {badgeEl}
                          <span>Step {item.stepNumber} · {item.label}</span>
                          {mutationPreview && (
                            <span className="run-monitor-step-mutation">
                              {mutationPreview}
                            </span>
                          )}
                        </strong>
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
                    {itemDuration > 0 && (
                      <div className="run-monitor-step-duration-bar-bg" data-testid={`duration-bar-${item.eventNumber}`}>
                        <div
                          className="run-monitor-step-duration-bar"
                          style={{ width: `${durationPercentage}%` }}
                        />
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ padding: "0 12px 12px 12px" }}>
                        {trace && (
                          <div className="run-monitor-step-meta">
                            <div><strong>Action Type:</strong></div>
                            <div>{trace.action_type || "N/A"}</div>
                            <div><strong>Execution Mode:</strong></div>
                            <div>{trace.mode || "N/A"}</div>
                            {durationText && (
                              <>
                                <div><strong>Duration:</strong></div>
                                <div>{durationText}</div>
                              </>
                            )}
                            {trace.action_summary && (
                              <>
                                <div><strong>Summary:</strong></div>
                                <div>{trace.action_summary}</div>
                              </>
                            )}
                          </div>
                        )}
                        {trace && trace.evidence_summary && trace.evidence_summary.length > 0 && (
                          <div className="run-monitor-evidence-list">
                            <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent)" }}>Evidence Saved</div>
                            {trace.evidence_summary.map((ev: any, idx: number) => (
                              <div key={idx} className="run-monitor-evidence-item">
                                <span>{ev.artifact_kind === "screenshot" ? "📸 Screenshot" : "📥 Download"}:</span>
                                <code>{ev.path}</code>
                              </div>
                            ))}
                          </div>
                        )}
                        {trace && (trace.status === "failed" || trace.status === "stopped") && trace.reason && (
                          <div style={{ color: "var(--failure)", padding: "10px", border: "1px solid var(--failure)", borderRadius: "6px", background: "var(--failure-bg)", fontSize: "13px", marginTop: "10px", marginBottom: "10px", overflowWrap: "anywhere" }}>
                            <strong>Error:</strong> {trace.reason}
                          </div>
                        )}
                        <RunMonitorEnvironmentPanel
                          initialVariables={initialVariables}
                          profileVariables={profileVariables}
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
                      </div>
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
