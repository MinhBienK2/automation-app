import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import type {
  Connection,
  Edge,
  EdgeChange,
  EdgeTypes,
  Node,
  NodeChange,
  NodeProps,
  NodeTypes,
  ReactFlowInstance,
} from "@xyflow/react";
import type {
  ActionType,
  GraphEdgeDelay,
  GraphNode,
  GraphPort,
  RunState,
  WorkflowGraph,
} from "../../../../types/workflow";
import {
  createDefaultGraphNode,
  defaultActionConfig,
  mergeReactFlowNodeRuntimeState,
  type WorkflowFlowEdge,
  type WorkflowFlowNode,
  type GraphSelection,
} from "../../lib/workflowGraph";
import {
  cloneGraphEdgeDelay,
} from "../../lib/subflowSelection";
import {
  edgeKindForFlowSource,
  replacePortEdge,
} from "../../lib/graphEditorEdges";
import { actionLabels } from "../../../../lib/workflowUi";
import { WorkflowGraphEdge, WorkflowGraphNode } from "./WorkflowGraphCanvasParts";
import type { ActivePortConnection, GraphSelectionRequest } from "./WorkflowGraphEditorTypes";

export type UseWorkflowGraphFlowBridgeProps = {
  graph: WorkflowGraph;
  flowGraph: { nodes: WorkflowFlowNode[]; edges: WorkflowFlowEdge[] };
  runState: RunState;
  selectionRequest?: GraphSelectionRequest | null;
  defaultEdgeDelay: GraphEdgeDelay | null;
  reactFlowInstance: ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null;
  graphRef: RefObject<WorkflowGraph>;
  selectedNode: GraphNode | null;
  setSelection: (selection: GraphSelection | ((current: GraphSelection) => GraphSelection)) => void;
  setContextMenu: (menu: null) => void;
  setLinkContextMenu: (menu: null) => void;
  commitGraphChange: (nextGraph: WorkflowGraph, nextSelection?: GraphSelection) => void;
  syncFlowGraph: (nodes: Node[], edges: Edge[]) => void;
};

export function useWorkflowGraphFlowBridge(props: UseWorkflowGraphFlowBridgeProps) {
  const {
    graph,
    flowGraph,
    runState,
    selectionRequest,
    defaultEdgeDelay,
    reactFlowInstance,
    graphRef,
    selectedNode,
    setSelection,
    setContextMenu,
    setLinkContextMenu,
    commitGraphChange,
    syncFlowGraph,
  } = props;

  const activePortConnectionRef = useRef<ActivePortConnection>(null);
  const flowGraphRef = useRef<{ nodes: WorkflowFlowNode[]; edges: WorkflowFlowEdge[] } | null>(null);
  const reactFlowNodesRef = useRef<WorkflowFlowNode[]>([]);
  const reactFlowEdgesRef = useRef<WorkflowFlowEdge[]>([]);
  const defaultEdgeDelayRef = useRef(defaultEdgeDelay);
  const syncFlowGraphRef = useRef<((nodes: Node[], edges: Edge[]) => void) | null>(null);

  const [reactFlowNodes, setReactFlowNodes] = useState<WorkflowFlowNode[]>(
    () => flowGraph.nodes,
  );
  const [reactFlowEdges, setReactFlowEdges] = useState<WorkflowFlowEdge[]>(
    () => flowGraph.edges,
  );

  useEffect(() => {
    defaultEdgeDelayRef.current = defaultEdgeDelay;
  }, [defaultEdgeDelay]);

  useEffect(() => {
    syncFlowGraphRef.current = syncFlowGraph;
  }, [syncFlowGraph]);

  useEffect(() => {
    setReactFlowNodes((currentNodes) =>
      mergeReactFlowNodeRuntimeState(flowGraph.nodes, currentNodes),
    );
    setReactFlowEdges(flowGraph.edges);
  }, [flowGraph.edges, flowGraph.nodes]);

  useEffect(() => {
    reactFlowNodesRef.current = reactFlowNodes;
    reactFlowEdgesRef.current = reactFlowEdges;
    flowGraphRef.current = {
      nodes: reactFlowNodes,
      edges: reactFlowEdges,
    };
  }, [reactFlowEdges, reactFlowNodes]);

  const focusNode = useCallback((node: GraphNode) => {
    if (!reactFlowInstance) return;
    reactFlowInstance.setCenter(
      node.position.x + 96,
      node.position.y + 32,
      { zoom: Math.max(graph.viewport.zoom, 0.9), duration: 240 },
    );
  }, [graph.viewport.zoom, reactFlowInstance]);

  const focusSelectedNode = useCallback(() => {
    if (!selectedNode || !reactFlowInstance) return;
    focusNode(selectedNode);
  }, [focusNode, reactFlowInstance, selectedNode]);

  useEffect(() => {
    if (!selectionRequest) return;
    if (selectionRequest.nodeId) {
      setSelection({ nodeIds: [selectionRequest.nodeId], edgeIds: [] });
      const node = graphRef.current.nodes.find(
        (candidate) => candidate.id === selectionRequest.nodeId,
      );
      if (node && reactFlowInstance) {
        focusNode(node);
      }
      return;
    }
    if (selectionRequest.edgeId) {
      setSelection({ nodeIds: [], edgeIds: [selectionRequest.edgeId] });
    }
  }, [focusNode, graphRef, reactFlowInstance, selectionRequest, setSelection]);

  const startPortConnection = useCallback(
    (_event: ReactPointerEvent, nodeId: string, port: GraphPort) => {
      activePortConnectionRef.current = {
        nodeId,
        portId: port.id,
        direction: port.direction,
      };
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
      if (!currentFlowGraph) return;

      const nextEdge: WorkflowFlowEdge = {
        id: `edge-${source.nodeId}-${source.portId}-${nodeId}-${port.id}`,
        source: source.nodeId,
        sourceHandle: source.portId,
        target: nodeId,
        targetHandle: port.id,
        label: source.portId,
        data: {
          hasIssue: false,
          status: "idle",
          kind: edgeKindForFlowSource(currentFlowGraph.nodes, source.nodeId, source.portId),
          delay: cloneGraphEdgeDelay(defaultEdgeDelayRef.current),
        },
      };
      const nextEdges = replacePortEdge(currentFlowGraph.edges, nextEdge, currentFlowGraph.nodes);
      setReactFlowEdges(nextEdges);
      syncFlowGraphRef.current?.(currentFlowGraph.nodes, nextEdges);
    },
    [],
  );

  const clearPreviewConnection = useCallback(() => {
    activePortConnectionRef.current = null;
  }, []);

  const selectNodeFromEvent = useCallback(
    (
      event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean },
      nodeId: string,
    ) => {
      setLinkContextMenu(null);
      setContextMenu(null);
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        setSelection((current) => {
          const nodeIds = current.nodeIds.includes(nodeId)
            ? current.nodeIds.filter((selectedNodeId) => selectedNodeId !== nodeId)
            : [...current.nodeIds, nodeId];
          return {
            nodeIds,
            edgeIds: current.edgeIds,
          };
        });
        return;
      }
      setSelection({ nodeIds: [nodeId], edgeIds: [] });
    },
    [setContextMenu, setLinkContextMenu, setSelection],
  );

  const workflowNodeTypes = useMemo<NodeTypes>(
    () => ({
      workflow: (nodeProps: NodeProps<WorkflowFlowNode>) => (
        <WorkflowGraphNode
          {...nodeProps}
          onNodeSelect={selectNodeFromEvent}
          onPortPointerDown={startPortConnection}
          onPortPointerUp={completePortConnection}
        />
      ),
    }),
    [completePortConnection, selectNodeFromEvent, startPortConnection],
  );

  const workflowEdgeTypes = useMemo<EdgeTypes>(
    () => ({
      workflow: WorkflowGraphEdge,
    }),
    [],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const dataStr = event.dataTransfer.getData("application/reactflow");
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (!reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const currentGraph = graphRef.current;
      let node: GraphNode;

      if (data.type === "action" && data.actionType) {
        node = {
          ...createDefaultGraphNode("action", position),
          label: actionLabels[data.actionType as ActionType] || data.label,
          config: defaultActionConfig(data.actionType as ActionType),
        } as GraphNode;
      } else {
        node = createDefaultGraphNode(data.type, position) as GraphNode;
        if (data.label) {
          node.label = data.label;
        }
      }

      commitGraphChange(
        { ...currentGraph, nodes: [...currentGraph.nodes, node] },
        { nodeIds: [node.id], edgeIds: [] },
      );
    } catch (err) {
      console.error("Drop failed:", err);
    }
  }, [commitGraphChange, graphRef, reactFlowInstance]);

  const handleNodesChange = useCallback((changes: NodeChange<WorkflowFlowNode>[]) => {
    if (runState.status === "running") {
      changes = changes.filter((change) => change.type === "select" || change.type === "dimensions");
      if (changes.length === 0) return;
    }
    const hasSelectionChange = changes.some((change) => change.type === "select");
    const shouldPersist = changes.some((change) =>
      ["add", "remove", "replace"].includes(change.type),
    );
    const currentNodes = reactFlowNodesRef.current;
    const nextNodes = applyNodeChanges<WorkflowFlowNode>(changes, currentNodes);
    reactFlowNodesRef.current = nextNodes;
    setReactFlowNodes(nextNodes);
    if (hasSelectionChange) {
      setSelection({
        nodeIds: nextNodes.filter((node) => node.selected).map((node) => node.id),
        edgeIds: reactFlowEdgesRef.current
          .filter((edge) => edge.selected)
          .map((edge) => edge.id),
      });
      setLinkContextMenu(null);
    }
    if (shouldPersist) {
      syncFlowGraphRef.current?.(nextNodes, reactFlowEdgesRef.current);
    }
  }, [runState.status, setLinkContextMenu, setSelection]);

  const handleEdgesChange = useCallback((changes: EdgeChange<WorkflowFlowEdge>[]) => {
    if (runState.status === "running") {
      changes = changes.filter((change) => change.type === "select");
      if (changes.length === 0) return;
    }
    const hasSelectionChange = changes.some((change) => change.type === "select");
    const shouldPersist = changes.some((change) =>
      ["add", "remove", "replace"].includes(change.type),
    );
    const currentEdges = reactFlowEdgesRef.current;
    const nextEdges = applyEdgeChanges<WorkflowFlowEdge>(changes, currentEdges);
    reactFlowEdgesRef.current = nextEdges;
    setReactFlowEdges(nextEdges);
    if (hasSelectionChange) {
      setSelection({
        nodeIds: reactFlowNodesRef.current
          .filter((node) => node.selected)
          .map((node) => node.id),
        edgeIds: nextEdges.filter((edge) => edge.selected).map((edge) => edge.id),
      });
    }
    if (shouldPersist) {
      syncFlowGraphRef.current?.(reactFlowNodesRef.current, nextEdges);
    }
  }, [runState.status, setSelection]);

  const handleEdgeClick = useCallback((_: unknown, edge: WorkflowFlowEdge) => {
    setSelection({ nodeIds: [], edgeIds: [edge.id] });
    setLinkContextMenu(null);
  }, [setLinkContextMenu, setSelection]);

  const handleConnect = useCallback((connection: Connection) => {
    if (runState.status === "running") return;
    if (!connection.source || !connection.target || !connection.sourceHandle) return;
    if (!connection.targetHandle) return;
    const nextEdge: WorkflowFlowEdge = {
      ...connection,
      id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      label: connection.sourceHandle,
      data: {
        hasIssue: false,
        status: "idle",
        kind: edgeKindForFlowSource(
          reactFlowNodesRef.current,
          connection.source,
          connection.sourceHandle,
        ),
        delay: cloneGraphEdgeDelay(defaultEdgeDelay),
      },
    };
    const nextEdges = replacePortEdge(
      reactFlowEdgesRef.current,
      nextEdge,
      reactFlowNodesRef.current,
    );
    setReactFlowEdges(nextEdges);
    syncFlowGraphRef.current?.(reactFlowNodesRef.current, nextEdges);
  }, [defaultEdgeDelay, runState.status]);

  return {
    reactFlowNodes,
    reactFlowEdges,
    reactFlowNodesRef,
    reactFlowEdgesRef,
    workflowNodeTypes,
    workflowEdgeTypes,
    startPortConnection,
    completePortConnection,
    clearPreviewConnection,
    selectNodeFromEvent,
    focusNode,
    focusSelectedNode,
    onDragOver,
    onDrop,
    handleNodesChange,
    handleEdgesChange,
    handleEdgeClick,
    handleConnect,
  };
}
