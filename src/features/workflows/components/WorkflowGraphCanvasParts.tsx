import { useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type {
  GraphNode,
  GraphPort,
  GraphPosition,
  WorkflowGraph,
} from "../../../types/workflow";
import {
  graphEdgeOrders,
  graphNodeLabel,
  type WorkflowFlowNode,
  type WorkflowFlowNodeStatus,
} from "../lib/workflowGraph";

type GraphEdgeOverlayProps = {
  graph: WorkflowGraph;
  issueEdgeIds: Set<string>;
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string) => void;
};

export function GraphEdgeOverlay({
  graph,
  issueEdgeIds,
  selectedEdgeId,
  onSelectEdge,
}: GraphEdgeOverlayProps) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeOrders = graphEdgeOrders(graph);

  return (
    <svg
      aria-label="Visible workflow graph edges"
      className="graph-edge-overlay"
      focusable="false"
      role="img"
    >
      <defs>
        <marker
          id="graph-edge-arrow"
          markerHeight="6"
          markerWidth="6"
          orient="auto"
          refX="5.6"
          refY="3"
          viewBox="0 0 6 6"
        >
          <path d="M0 0 L6 3 L0 6 Z" />
        </marker>
        <marker
          id="graph-edge-arrow-issue"
          markerHeight="6"
          markerWidth="6"
          orient="auto"
          refX="5.6"
          refY="3"
          viewBox="0 0 6 6"
        >
          <path d="M0 0 L6 3 L0 6 Z" />
        </marker>
      </defs>
      {graph.edges.map((edge) => {
        const sourceNode = nodeById.get(edge.source_node_id);
        const targetNode = nodeById.get(edge.target_node_id);
        if (!sourceNode || !targetNode) return null;

        const sourcePoint = edgePoint(sourceNode, edge.source_port, "output");
        const targetPoint = insetEdgeTarget(
          sourcePoint,
          edgePoint(targetNode, edge.target_port, "input"),
        );
        const order = edgeOrders.get(edge.id);
        const hasIssue = issueEdgeIds.has(edge.id);
        const labelX = (sourcePoint.x + targetPoint.x) / 2;
        const labelY = (sourcePoint.y + targetPoint.y) / 2;
        const isSelected = selectedEdgeId === edge.id;

        return (
          <g
            aria-label={`Visible edge ${sourceNode.label} to ${targetNode.label}`}
            className={[
              "graph-visible-edge",
              hasIssue ? "graph-visible-edge-issue" : "",
              isSelected ? "graph-visible-edge-selected" : "",
            ].filter(Boolean).join(" ")}
            key={edge.id}
            role="img"
          >
            <path
              d={edgePath(sourcePoint, targetPoint)}
              markerEnd={
                hasIssue ? "url(#graph-edge-arrow-issue)" : "url(#graph-edge-arrow)"
              }
            />
            <path
              aria-label={`Select edge ${sourceNode.label} to ${targetNode.label}`}
              className="graph-visible-edge-hit-target"
              d={edgePath(sourcePoint, targetPoint)}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectEdge(edge.id);
                }
              }}
              role="button"
              tabIndex={0}
            />
            {order ? (
              <g
                aria-label={`Edge direction order ${order}`}
                className="graph-visible-edge-order"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectEdge(edge.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectEdge(edge.id);
                  }
                }}
                role="img"
                tabIndex={0}
                transform={`translate(${labelX} ${labelY})`}
              >
                <circle r="10" />
                <text dominantBaseline="central" textAnchor="middle">
                  {order}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

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

type GraphEdgePoint = {
  x: number;
  y: number;
};

const graphNodeWidth = 160;
const graphNodeHeight = 64;

function edgePoint(
  node: GraphNode,
  portId: string,
  direction: GraphPort["direction"],
): GraphEdgePoint {
  const ports = portsByDirection(node.ports, direction);
  const portIndex = Math.max(
    ports.findIndex((port) => port.id === portId),
    0,
  );
  const y = node.position.y + graphNodeHeight * portOffsetRatio(portIndex, ports.length);

  return {
    x: node.position.x + (direction === "output" ? graphNodeWidth : 0),
    y,
  };
}

function portsByDirection(
  ports: GraphPort[],
  direction: GraphPort["direction"],
) {
  return ports.filter((port) => port.direction === direction);
}

export function insetEdgeTarget(
  source: GraphPosition,
  target: GraphPosition,
): GraphEdgePoint {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return target;
  const inset = 22;
  return {
    x: target.x - (dx / length) * inset,
    y: target.y - (dy / length) * inset,
  };
}

function edgePath(source: GraphEdgePoint, target: GraphEdgePoint) {
  const distance = Math.max(Math.abs(target.x - source.x) * 0.45, 48);
  return [
    `M ${source.x} ${source.y}`,
    `C ${source.x + distance} ${source.y}`,
    `${target.x - distance} ${target.y}`,
    `${target.x} ${target.y}`,
  ].join(" ");
}

export function previewEdgePath(source: GraphPosition, target: GraphPosition) {
  const distance = Math.max(Math.abs(target.x - source.x) * 0.45, 48);
  return [
    `M ${source.x} ${source.y}`,
    `C ${source.x + distance} ${source.y}`,
    `${target.x - distance} ${target.y}`,
    `${target.x} ${target.y}`,
  ].join(" ");
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
