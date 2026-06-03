import { useMemo } from "react";
import { LocateFixed } from "lucide-react";
import type { GraphNode, RunState, WorkflowGraph } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { SwitchField } from "../../../components/ui/switch";
import { actionLabels } from "../../../lib/workflowUi";
import { graphCanvasNodeKindLabel } from "../lib/workflowGraph";

type RunProgressNavigatorProps = {
  graph: WorkflowGraph;
  runState: RunState;
  followCurrentNode: boolean;
  onFollowCurrentNodeChange: (checked: boolean) => void;
  onFocusNode: (nodeId: string) => void;
};

type RunProgressItem = {
  id: string;
  label: string;
  stepNumber: number | null;
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

function buildTrail(
  nodeById: Map<string, GraphNode>,
  runState: RunState,
  targetId: string | null,
) {
  const trailIds = [...runState.completed_step_ids];
  if (targetId && trailIds[trailIds.length - 1] !== targetId) {
    trailIds.push(targetId);
  }

  const visibleTrail = trailIds.slice(-6);
  const firstVisibleIndex = trailIds.length - visibleTrail.length;

  return visibleTrail.map<RunProgressItem>((nodeId, index) => {
    const stepNumber =
      nodeId === targetId && runState.current_step_number
        ? runState.current_step_number
        : firstVisibleIndex + index + 1;
    return {
      id: nodeId,
      label: nodeLabel(nodeById, nodeId) ?? nodeId,
      stepNumber,
      target: nodeId === targetId,
    };
  });
}

function trailItemLabel(item: RunProgressItem, runState: RunState) {
  if (item.target && runState.status === "running") {
    return `Current step ${item.stepNumber ?? ""}: ${item.label}`;
  }
  if (item.target && runState.status === "failed") {
    return `Failed step ${item.stepNumber ?? ""}: ${item.label}`;
  }
  return `Step ${item.stepNumber ?? ""}: ${item.label}`;
}

export function RunProgressNavigator({
  graph,
  runState,
  followCurrentNode,
  onFollowCurrentNodeChange,
  onFocusNode,
}: RunProgressNavigatorProps) {
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const currentNodeId = targetNodeId(runState);
  const currentNode = currentNodeId ? nodeById.get(currentNodeId) ?? null : null;
  const currentLabel =
    nodeLabel(nodeById, currentNodeId) ?? runState.error?.step_name ?? "No active node";
  const trail = useMemo(
    () => buildTrail(nodeById, runState, currentNodeId),
    [currentNodeId, nodeById, runState],
  );
  const hasProgress = runState.status !== "idle" && Boolean(currentNodeId);

  if (!hasProgress) return null;

  const focusLabel =
    runState.status === "failed"
      ? "Focus failed node"
      : runState.status === "running"
        ? "Focus current"
        : "Focus last step";

  return (
    <section className="run-progress-navigator" aria-label="Live run navigator">
      <div className="run-progress-main">
        <div className="run-progress-copy">
          <p className="eyebrow">Live Run</p>
          <div>
            <span className="run-progress-status">{statusLabel(runState)}</span>
            <h2>{currentLabel}</h2>
            <p>{nodeKindLabel(currentNode, runState)}</p>
          </div>
        </div>
        <div className="run-progress-actions">
          <SwitchField
            checked={followCurrentNode}
            className="run-progress-follow"
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
      </div>
      {trail.length > 0 ? (
        <ol className="run-progress-trail" aria-label="Recent execution trail">
          {trail.map((item) => (
            <li key={`${item.id}-${item.stepNumber ?? "step"}`}>
              <button
                type="button"
                className="run-progress-trail-item"
                data-current={item.target ? "true" : "false"}
                aria-label={trailItemLabel(item, runState)}
                onClick={() => onFocusNode(item.id)}
              >
                <span>{item.stepNumber ? `Step ${item.stepNumber}` : "Step"}</span>
                <strong>{item.label}</strong>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
