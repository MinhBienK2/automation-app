import { useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphPort } from "../../../types/workflow";
import {
  graphNodeLabel,
  type WorkflowFlowNode,
  type WorkflowFlowNodeStatus,
} from "../lib/workflowGraph";

type WorkflowGraphNodeProps = NodeProps<WorkflowFlowNode> & {
  onPortPointerDown: (
    event: ReactPointerEvent,
    nodeId: string,
    port: GraphPort,
  ) => void;
  onPortPointerUp: (nodeId: string, port: GraphPort) => void;
};

export function WorkflowGraphNode({
  id,
  data,
  selected,
  isConnectable,
  onPortPointerDown,
  onPortPointerUp,
}: WorkflowGraphNodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const inputPorts = portsByDirection(data.ports, "input");
  const outputPorts = portsByDirection(data.ports, "output");

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.ports, updateNodeInternals]);

  return (
    <div
      className={[
        "graph-node",
        selected ? "graph-node-selected" : "",
        data.hasIssue ? "graph-node-has-issue" : "",
        graphStatusClass(data.status),
      ].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        aria-label={`Graph canvas node ${id}`}
        className="graph-node-button nodrag"
      >
        <span>{data.label}</span>
        <small>{graphNodeLabel(data.nodeType)}</small>
      </button>
      <div
        aria-label={`Drag node ${id}`}
        className="graph-node-drag-handle"
        role="button"
        tabIndex={0}
      />

      {inputPorts.map((port, index) => (
        <Handle
          aria-label={`${data.label} ${port.label} port`}
          className="graph-handle graph-handle-input"
          id={port.id}
          isConnectable={isConnectable}
          key={port.id}
          onPointerUp={() => onPortPointerUp(id, port)}
          position={Position.Left}
          style={{ top: portOffset(index, inputPorts.length) }}
          type="target"
        />
      ))}
      {outputPorts.map((port, index) => (
        <Handle
          aria-label={`${data.label} ${port.label} port`}
          className="graph-handle graph-handle-output"
          id={port.id}
          isConnectable={isConnectable}
          key={port.id}
          onPointerDown={(event) => onPortPointerDown(event, id, port)}
          position={Position.Right}
          style={{ top: portOffset(index, outputPorts.length) }}
          type="source"
        />
      ))}
    </div>
  );
}

function portsByDirection(
  ports: GraphPort[],
  direction: GraphPort["direction"],
) {
  return ports.filter((port) => port.direction === direction);
}

function portOffset(index: number, total: number) {
  return `${portOffsetRatio(index, total) * 100}%`;
}

function portOffsetRatio(index: number, total: number) {
  if (total <= 1) return 0.5;
  return (index + 1) / (total + 1);
}

function graphStatusClass(status: WorkflowFlowNodeStatus) {
  switch (status) {
    case "failed":
      return "graph-node-failed";
    case "running":
      return "graph-node-running";
    case "completed":
      return "graph-node-completed";
    default:
      return "";
  }
}
