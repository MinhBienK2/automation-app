import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ViewportPortal,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeProps,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  ActionType,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
} from "../../../types/workflow";
import {
  createDefaultGraphNode,
  defaultActionConfig,
  fromReactFlowGraph,
  graphIssuesByNode,
  type WorkflowFlowEdge,
  toReactFlowGraph,
  type WorkflowFlowNode,
} from "../lib/workflowGraph";
import { actionLabels } from "../../../lib/workflowUi";
import {
  GraphEdgeOverlay,
  WorkflowGraphNode,
  insetEdgeTarget,
  previewEdgePath,
} from "./WorkflowGraphCanvasParts";
import { WorkflowGraphInspector } from "./WorkflowGraphInspector";
import {
  ActionNodePalette,
  GraphNodePalette,
  NodeContextMenu,
  NodeHelpDialog,
} from "./WorkflowGraphPalettes";
import { WorkflowGraphToolbar } from "./WorkflowGraphToolbar";

type WorkflowGraphEditorProps = {
  graph: WorkflowGraph;
  runState: RunState;
  validationIssues: GraphValidationIssue[];
  onChange: (graph: WorkflowGraph) => void;
};

type ActivePortConnection = {
  nodeId: string;
  portId: string;
  direction: GraphPort["direction"];
  sourcePoint: { x: number; y: number };
} | null;

export function WorkflowGraphEditor({
  graph,
  runState,
  validationIssues,
  onChange,
}: WorkflowGraphEditorProps) {
  const [isActionPaletteOpen, setIsActionPaletteOpen] = useState(false);
  const [nodePalette, setNodePalette] = useState<{
    title: string;
    eyebrow: string;
    searchLabel: string;
    groups: Array<{ label: string; nodes: GraphNodeType[] }>;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(graph.nodes[0]?.id ?? "");
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [helpNode, setHelpNode] = useState<GraphNode | null>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<WorkflowFlowNode, Edge> | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const previewPathRef = useRef<SVGPathElement | null>(null);
  const activePortConnectionRef = useRef<ActivePortConnection>(null);
  const graphRef = useRef(graph);
  const flowGraphRef = useRef<ReturnType<typeof toReactFlowGraph> | null>(null);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const nodeLabels = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.label])),
    [graph.nodes],
  );
  const completedNodeIds = useMemo(
    () => new Set(runState.completed_step_ids),
    [runState.completed_step_ids],
  );
  const issueGroups = useMemo(
    () => graphIssuesByNode(validationIssues),
    [validationIssues],
  );
  const issueNodeIds = useMemo(
    () =>
      new Set(
        validationIssues
          .map((issue) => issue.node_id)
          .filter((nodeId): nodeId is string => Boolean(nodeId)),
      ),
    [validationIssues],
  );
  const issueEdgeIds = useMemo(
    () =>
      new Set(
        validationIssues
          .map((issue) => issue.edge_id)
          .filter((edgeId): edgeId is string => Boolean(edgeId)),
      ),
    [validationIssues],
  );
  const flowGraph = useMemo(
    () =>
      toReactFlowGraph(graph, {
        selectedNodeId,
        runningNodeId: runState.current_step_id,
        completedNodeIds,
        failedNodeId: runState.error?.step_id ?? null,
        issueNodeIds,
        issueEdgeIds,
      }),
    [
      graph,
      selectedNodeId,
      runState.current_step_id,
      completedNodeIds,
      runState.error?.step_id,
      issueNodeIds,
      issueEdgeIds,
    ],
  );
  useEffect(() => {
    graphRef.current = graph;
    flowGraphRef.current = flowGraph;
  }, [flowGraph, graph]);
  const startPortConnection = useCallback(
    (event: ReactPointerEvent, nodeId: string, port: GraphPort) => {
      const canvasBounds = graphCanvasRef.current?.getBoundingClientRect();
      const handleBounds = event.currentTarget.getBoundingClientRect();
      if (!canvasBounds) return;
      const sourcePoint = {
        x: handleBounds.left + handleBounds.width / 2 - canvasBounds.left,
        y: handleBounds.top + handleBounds.height / 2 - canvasBounds.top,
      };
      activePortConnectionRef.current = {
        nodeId,
        portId: port.id,
        direction: port.direction,
        sourcePoint,
      };
      previewPathRef.current?.setAttribute(
        "d",
        previewEdgePath(sourcePoint, sourcePoint),
      );
    },
    [],
  );
  const completePortConnection = useCallback(
    (nodeId: string, port: GraphPort) => {
      const source = activePortConnectionRef.current;
      activePortConnectionRef.current = null;
      if (
        !source ||
        source.direction !== "output" ||
        port.direction !== "input" ||
        source.nodeId === nodeId
      ) {
        return;
      }
      const currentFlowGraph = flowGraphRef.current;
      const currentGraph = graphRef.current;
      if (!currentFlowGraph) return;

      const nextEdge: WorkflowFlowEdge = {
        id: `edge-${source.nodeId}-${source.portId}-${nodeId}-${port.id}`,
        source: source.nodeId,
        sourceHandle: source.portId,
        target: nodeId,
        targetHandle: port.id,
        label: source.portId,
        data: { hasIssue: false },
      };
      onChange(
        fromReactFlowGraph(
          currentGraph,
          currentFlowGraph.nodes,
          addEdge(nextEdge, currentFlowGraph.edges),
          currentGraph.viewport,
        ),
      );
    },
    [onChange],
  );
  const movePreviewConnection = useCallback((event: ReactPointerEvent) => {
    const source = activePortConnectionRef.current;
    const canvasBounds = graphCanvasRef.current?.getBoundingClientRect();
    if (!source || !canvasBounds) return;
    previewPathRef.current?.setAttribute(
      "d",
      previewEdgePath(
        source.sourcePoint,
        insetEdgeTarget(source.sourcePoint, {
          x: event.clientX - canvasBounds.left,
          y: event.clientY - canvasBounds.top,
        }),
      ),
    );
  }, []);
  const clearPreviewConnection = useCallback(() => {
    activePortConnectionRef.current = null;
    previewPathRef.current?.setAttribute("d", "");
  }, []);
  const workflowNodeTypes = useMemo(
    () => ({
      workflow: (props: NodeProps<WorkflowFlowNode>) => (
        <WorkflowGraphNode
          {...props}
          onPortPointerDown={startPortConnection}
          onPortPointerUp={completePortConnection}
        />
      ),
    }),
    [completePortConnection, startPortConnection],
  );

  function addNode(nodeType: GraphNodeType) {
    const node = createDefaultGraphNode(nodeType, {
      x: 120 + graph.nodes.length * 48,
      y: 120 + graph.nodes.length * 16,
    });
    onChange({ ...graph, nodes: [...graph.nodes, node] });
    setSelectedNodeId(node.id);
    setNodePalette(null);
  }

  function addActionNode(actionType: ActionType) {
    const node = {
      ...createDefaultGraphNode("action", {
        x: 120 + graph.nodes.length * 48,
        y: 120 + graph.nodes.length * 16,
      }),
      label: actionLabels[actionType],
      config: defaultActionConfig(actionType),
    };
    onChange({ ...graph, nodes: [...graph.nodes, node] });
    setSelectedNodeId(node.id);
    setIsActionPaletteOpen(false);
  }

  function updateNode(nextNode: GraphNode) {
    setSelectedEdgeId(null);
    onChange({
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
    });
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.node_type === "start") return;
    deleteNode(selectedNode.id);
  }

  function syncFlowGraph(nodes: Node[], edges: Edge[]) {
    onChange(fromReactFlowGraph(graph, nodes, edges, graph.viewport));
  }

  function handleNodesChange(changes: NodeChange[]) {
    const selectedChange = changes.find(
      (change) => change.type === "select" && change.selected,
    );
    if (selectedChange && "id" in selectedChange) {
      setSelectedEdgeId(null);
      setSelectedNodeId(selectedChange.id);
    }
    const shouldPersist = changes.some((change) =>
      ["add", "position", "remove", "replace"].includes(change.type),
    );
    if (!shouldPersist) return;

    const nextNodes = applyNodeChanges(changes, flowGraph.nodes);
    syncFlowGraph(nextNodes, flowGraph.edges);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    const shouldPersist = changes.some((change) =>
      ["add", "remove", "replace"].includes(change.type),
    );
    if (!shouldPersist) return;

    const nextEdges = applyEdgeChanges(changes, flowGraph.edges);
    syncFlowGraph(flowGraph.nodes, nextEdges);
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || !connection.sourceHandle) return;
    if (!connection.targetHandle) return;
    const nextEdge: WorkflowFlowEdge = {
      ...connection,
      id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      label: connection.sourceHandle,
      data: { hasIssue: false },
    };
    const nextEdges = addEdge(nextEdge, flowGraph.edges);
    syncFlowGraph(flowGraph.nodes, nextEdges);
  }

  function focusSelectedNode() {
    if (!selectedNode || !reactFlowInstance) return;
    focusNode(selectedNode);
  }

  function focusNode(node: GraphNode) {
    if (!reactFlowInstance) return;
    reactFlowInstance.setCenter(
      node.position.x + 96,
      node.position.y + 32,
      { zoom: Math.max(graph.viewport.zoom, 0.9), duration: 240 },
    );
  }

  function deleteNode(nodeId: string) {
    const nodeToDelete = graph.nodes.find((node) => node.id === nodeId);
    if (!nodeToDelete || nodeToDelete.node_type === "start") return;
    onChange({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      edges: graph.edges.filter(
        (edge) =>
          edge.source_node_id !== nodeId &&
          edge.target_node_id !== nodeId,
      ),
    });
    const fallback = graph.nodes.find((node) => node.id !== nodeId);
    setSelectedNodeId(fallback?.id ?? "");
  }

  function duplicateNode(nodeId: string) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const copy = {
      ...node,
      id: `node-${node.node_type}-${Date.now()}`,
      label: `${node.label} Copy`,
      position: {
        x: node.position.x + 36,
        y: node.position.y + 36,
      },
    };
    onChange({ ...graph, nodes: [...graph.nodes, copy] });
    setSelectedNodeId(copy.id);
    setContextMenu(null);
  }

  function renameNode(nodeId: string) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const nextLabel = window.prompt("Rename node", node.label)?.trim();
    if (!nextLabel) return;
    updateNode({ ...node, label: nextLabel });
    setContextMenu(null);
  }

  function openNodeHelp(nodeId: string) {
    const node = graph.nodes.find((item) => item.id === nodeId) ?? null;
    setHelpNode(node);
    setContextMenu(null);
  }

  function openNodePalette(
    title: string,
    eyebrow: string,
    searchLabel: string,
    groups: Array<{ label: string; nodes: GraphNodeType[] }>,
  ) {
    setNodePalette({ title, eyebrow, searchLabel, groups });
  }

  function deleteEdge(edgeId: string) {
    setSelectedEdgeId((current) => (current === edgeId ? null : current));
    onChange({
      ...graph,
      edges: graph.edges.filter((edge) => edge.id !== edgeId),
    });
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) return;
    deleteEdge(selectedEdge.id);
  }

  return (
    <section className="workflow-graph-editor panel" aria-label="Visual Graph">
      <div className="panel-heading workflow-graph-heading">
        <div>
          <p className="eyebrow">Visual Logic</p>
          <h2>Visual Graph</h2>
        </div>
      </div>

      <WorkflowGraphToolbar
        onAddAction={() => setIsActionPaletteOpen(true)}
        onFitView={() => reactFlowInstance?.fitView()}
        onOpenNodePalette={openNodePalette}
      />

      <div className="workflow-graph-layout">
        <div className="graph-canvas-wrap">
          <div
            className="graph-canvas"
            onPointerMove={movePreviewConnection}
            onPointerUp={clearPreviewConnection}
            ref={graphCanvasRef}
            role="application"
            aria-label="Workflow graph canvas"
          >
            <ReactFlow
              colorMode="dark"
              defaultViewport={flowGraph.viewport}
              edges={flowGraph.edges}
              fitView
              connectionDragThreshold={0}
              connectionRadius={32}
              nodes={flowGraph.nodes}
              nodesConnectable
              nodeTypes={workflowNodeTypes}
              onConnect={handleConnect}
              onEdgesChange={handleEdgesChange}
              onInit={setReactFlowInstance}
              onMoveEnd={(_, viewport) =>
                onChange({ ...graph, viewport })
              }
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setSelectedNodeId(node.id);
                setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
              }}
              onNodeClick={(_, node) => {
                setSelectedEdgeId(null);
                setSelectedNodeId(node.id);
              }}
              onNodesChange={handleNodesChange}
              panOnDrag
            >
              <ViewportPortal>
                <GraphEdgeOverlay
                  graph={graph}
                  issueEdgeIds={issueEdgeIds}
                  selectedEdgeId={selectedEdgeId}
                  onSelectEdge={(edgeId) => {
                    setSelectedEdgeId(edgeId);
                  }}
                />
              </ViewportPortal>
              <Background color="rgba(62, 207, 142, 0.14)" gap={32} />
              <Controls position="bottom-left" />
              <MiniMap
                ariaLabel="Graph minimap"
                nodeBorderRadius={8}
                pannable
                position="bottom-right"
                zoomable
              />
            </ReactFlow>
            <svg
              aria-hidden="true"
              className="graph-connection-preview"
              focusable="false"
            >
              <defs>
                <marker
                  id="graph-preview-arrow"
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
              <path markerEnd="url(#graph-preview-arrow)" ref={previewPathRef} />
            </svg>
            {contextMenu ? (
              <NodeContextMenu
                node={graph.nodes.find((node) => node.id === contextMenu.nodeId) ?? null}
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                onEdit={() => {
                  setSelectedNodeId(contextMenu.nodeId);
                  setContextMenu(null);
                }}
                onRename={() => renameNode(contextMenu.nodeId)}
                onDuplicate={() => duplicateNode(contextMenu.nodeId)}
                onFocus={() => {
                  const node = graph.nodes.find((item) => item.id === contextMenu.nodeId);
                  if (node) focusNode(node);
                  setContextMenu(null);
                }}
                onHelp={() => openNodeHelp(contextMenu.nodeId)}
                onDelete={() => {
                  deleteNode(contextMenu.nodeId);
                  setContextMenu(null);
                }}
              />
            ) : null}
          </div>
          <div className="graph-minimap" aria-label="Graph summary">
            {graph.nodes.length} nodes / {graph.edges.length} edges
          </div>
        </div>

        <WorkflowGraphInspector
          graph={graph}
          issueGroups={issueGroups}
          nodeLabels={nodeLabels}
          selectedEdge={selectedEdge}
          selectedNode={selectedNode}
          onDeleteEdge={deleteEdge}
          onDeleteSelectedEdge={deleteSelectedEdge}
          onDeleteSelectedNode={deleteSelectedNode}
          onFocusSelectedNode={focusSelectedNode}
          onUpdateNode={updateNode}
        />
      </div>

      <ActionNodePalette
        open={isActionPaletteOpen}
        onOpenChange={setIsActionPaletteOpen}
        onSelectAction={addActionNode}
      />
      <GraphNodePalette
        palette={nodePalette}
        onOpenChange={(open) => {
          if (!open) setNodePalette(null);
        }}
        onSelectNode={addNode}
      />
      <NodeHelpDialog node={helpNode} onOpenChange={(open) => !open && setHelpNode(null)} />
    </section>
  );
}
