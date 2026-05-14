import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
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
  mergeReactFlowNodeRuntimeState,
  type WorkflowFlowEdge,
  toReactFlowGraph,
  type WorkflowFlowNode,
} from "../lib/workflowGraph";
import {
  copyGraphSelection,
  deleteGraphSelection,
  duplicateGraphSelection,
  pasteGraphClipboard,
  pushGraphHistory,
  redoGraphHistory,
  undoGraphHistory,
  type GraphClipboard,
  type GraphHistoryState,
  type GraphSelection,
} from "../lib/graphEditorCommands";
import type { GraphNodeHelpLanguage } from "../lib/graphNodeHelpContent";
import { actionLabels } from "../../../lib/workflowUi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { GraphShortcutGuide } from "./GraphShortcutGuide";
import { WorkflowGraphNode } from "./WorkflowGraphCanvasParts";
import { WorkflowGraphInspector } from "./WorkflowGraphInspector";
import {
  ActionNodePalette,
  GraphNodePalette,
  LinkContextMenu,
  NodeContextMenu,
  NodeHelpDialog,
} from "./WorkflowGraphPalettes";
import { WorkflowGraphToolbar } from "./WorkflowGraphToolbar";

type WorkflowGraphEditorProps = {
  graph: WorkflowGraph;
  runState: RunState;
  validationIssues: GraphValidationIssue[];
  selectionRequest?: GraphSelectionRequest | null;
  onChange: (graph: WorkflowGraph) => void;
  onRunGraph?: () => void;
  onSaveGraph?: () => void;
  onValidateGraph?: () => void;
};

export type GraphSelectionRequest = {
  requestId: number;
  nodeId?: string | null;
  edgeId?: string | null;
};

type ActivePortConnection = {
  nodeId: string;
  portId: string;
  direction: GraphPort["direction"];
} | null;

function initialSelectedNodeId(graph: WorkflowGraph) {
  return (
    graph.nodes.find((node) => node.node_type !== "start")?.id ??
    graph.nodes[0]?.id ??
    null
  );
}

function replacePortEdge(
  edges: WorkflowFlowEdge[],
  nextEdge: WorkflowFlowEdge,
): WorkflowFlowEdge[] {
  const sourceHandle = nextEdge.sourceHandle ?? "out";
  const targetHandle = nextEdge.targetHandle ?? "in";

  return [
    ...edges.filter((edge) => {
      const sameOutput =
        edge.source === nextEdge.source &&
        (edge.sourceHandle ?? "out") === sourceHandle;
      const sameInput =
        edge.target === nextEdge.target &&
        (edge.targetHandle ?? "in") === targetHandle;
      return edge.id !== nextEdge.id && !sameOutput && !sameInput;
    }),
    nextEdge,
  ];
}

function shouldIgnoreGraphShortcut(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return false;

  const tagName = target.tagName.toLowerCase();
  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.getAttribute("contenteditable") === "true"
  ) {
    return true;
  }

  return Boolean(target.closest('[role="dialog"], .action-type-popover'));
}

export function WorkflowGraphEditor({
  graph,
  runState,
  validationIssues,
  selectionRequest,
  onChange,
  onRunGraph,
  onSaveGraph,
  onValidateGraph,
}: WorkflowGraphEditorProps) {
  const [isActionPaletteOpen, setIsActionPaletteOpen] = useState(false);
  const [nodePalette, setNodePalette] = useState<{
    title: string;
    eyebrow: string;
    searchLabel: string;
    groups: Array<{ label: string; nodes: GraphNodeType[] }>;
  } | null>(null);
  const [selection, setSelection] = useState<GraphSelection>(() => {
    const initialNodeId = initialSelectedNodeId(graph);
    return {
      nodeIds: initialNodeId ? [initialNodeId] : [],
      edgeIds: [],
    };
  });
  const [clipboard, setClipboard] = useState<GraphClipboard | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [helpNode, setHelpNode] = useState<GraphNode | null>(null);
  const [helpLanguage, setHelpLanguage] = useState<GraphNodeHelpLanguage>("vi");
  const [isShortcutGuideOpen, setIsShortcutGuideOpen] = useState(false);
  const [isToolbarPanMode, setIsToolbarPanMode] = useState(false);
  const [isSpacePanActive, setIsSpacePanActive] = useState(false);
  const isPanMode = isToolbarPanMode || isSpacePanActive;
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null);
  const activePortConnectionRef = useRef<ActivePortConnection>(null);
  const editorRef = useRef<HTMLElement | null>(null);
  const isGraphShortcutActiveRef = useRef(false);
  const graphRef = useRef(graph);
  const selectionRef = useRef(selection);
  const clipboardRef = useRef(clipboard);
  const historyRef = useRef<GraphHistoryState>({
    past: [],
    present: graph,
    future: [],
    limit: 50,
  });
  const flowGraphRef = useRef<ReturnType<typeof toReactFlowGraph> | null>(null);
  const reactFlowNodesRef = useRef<WorkflowFlowNode[]>([]);
  const reactFlowEdgesRef = useRef<WorkflowFlowEdge[]>([]);
  const selectionCount = selection.nodeIds.length + selection.edgeIds.length;
  const selectionSummary =
    selectionCount > 1
      ? {
          nodeCount: selection.nodeIds.length,
          edgeCount: selection.edgeIds.length,
        }
      : null;
  const selectedNodeId =
    !selectionSummary && selection.nodeIds.length === 1 && selection.edgeIds.length === 0
      ? selection.nodeIds[0]
      : null;
  const selectedEdgeId =
    !selectionSummary && selection.edgeIds.length === 1 && selection.nodeIds.length === 0
      ? selection.edgeIds[0]
      : null;
  const selectedNode = selectedNodeId
    ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;
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
        selectedNodeIds: new Set(selection.nodeIds),
        runningNodeId: runState.current_step_id,
        completedNodeIds,
        failedNodeId: runState.error?.step_id ?? null,
        issueNodeIds,
        issueEdgeIds,
        selectedEdgeIds: new Set(selection.edgeIds),
      }),
    [
      graph,
      selection.edgeIds,
      selection.nodeIds,
      runState.current_step_id,
      completedNodeIds,
      runState.error?.step_id,
      issueNodeIds,
      issueEdgeIds,
    ],
  );
  const [reactFlowNodes, setReactFlowNodes] = useState<WorkflowFlowNode[]>(
    () => flowGraph.nodes,
  );
  const [reactFlowEdges, setReactFlowEdges] = useState<WorkflowFlowEdge[]>(
    () => flowGraph.edges,
  );
  useEffect(() => {
    graphRef.current = graph;
    historyRef.current = {
      ...historyRef.current,
      present: graph,
    };
  }, [graph]);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  useEffect(() => {
    clipboardRef.current = clipboard;
  }, [clipboard]);
  useEffect(() => {
    setReactFlowNodes((currentNodes) =>
      mergeReactFlowNodeRuntimeState(flowGraph.nodes, currentNodes),
    );
    setReactFlowEdges(flowGraph.edges);
  }, [flowGraph.edges, flowGraph.nodes]);
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
  }, [selectionRequest?.requestId]);
  useEffect(() => {
    reactFlowNodesRef.current = reactFlowNodes;
    reactFlowEdgesRef.current = reactFlowEdges;
    flowGraphRef.current = {
      ...flowGraph,
      nodes: reactFlowNodes,
      edges: reactFlowEdges,
    };
  }, [flowGraph, reactFlowEdges, reactFlowNodes]);
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
        data: { hasIssue: false, status: "idle" },
      };
      const nextEdges = replacePortEdge(currentFlowGraph.edges, nextEdge);
      setReactFlowEdges(nextEdges);
      syncFlowGraph(currentFlowGraph.nodes, nextEdges);
    },
    [onChange],
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
    [],
  );
  const workflowNodeTypes = useMemo(
    () => ({
      workflow: (props: NodeProps<WorkflowFlowNode>) => (
        <WorkflowGraphNode
          {...props}
          onNodeSelect={selectNodeFromEvent}
          onPortPointerDown={startPortConnection}
          onPortPointerUp={completePortConnection}
        />
      ),
    }),
    [completePortConnection, selectNodeFromEvent, startPortConnection],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      isGraphShortcutActiveRef.current =
        target instanceof Node && Boolean(editorRef.current?.contains(target));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isGraphShortcutActiveRef.current) return;
      if (shouldIgnoreGraphShortcut(event)) return;

      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePanActive(true);
        return;
      }

      const usesModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const isEditingDisabled = runState.status === "running";

      if (!usesModifier && (event.key === "Delete" || event.key === "Backspace")) {
        if (isEditingDisabled) return;
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (usesModifier && key === "z" && !event.shiftKey) {
        if (isEditingDisabled) return;
        event.preventDefault();
        undoGraphEdit();
        return;
      }

      if (
        usesModifier &&
        ((key === "z" && event.shiftKey) || key === "y")
      ) {
        if (isEditingDisabled) return;
        event.preventDefault();
        redoGraphEdit();
        return;
      }

      if (usesModifier && key === "c") {
        if (isEditingDisabled) return;
        event.preventDefault();
        copySelection();
        return;
      }

      if (usesModifier && key === "v") {
        if (isEditingDisabled) return;
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (usesModifier && key === "d") {
        if (isEditingDisabled) return;
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (usesModifier && key === "s" && onSaveGraph) {
        event.preventDefault();
        onSaveGraph();
        return;
      }

      if (usesModifier && event.key === "Enter" && event.shiftKey && onValidateGraph) {
        event.preventDefault();
        onValidateGraph();
        return;
      }

      if (
        usesModifier &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !isEditingDisabled &&
        onRunGraph
      ) {
        event.preventDefault();
        onRunGraph();
        return;
      }

      if (
        (!usesModifier && key === "f") ||
        (usesModifier && event.key === "0")
      ) {
        event.preventDefault();
        reactFlowInstance?.fitView();
        return;
      }

      if (!usesModifier && event.key === "Escape") {
        event.preventDefault();
        setContextMenu(null);
        setLinkContextMenu(null);
        setIsShortcutGuideOpen(false);
        setSelection({ nodeIds: [], edgeIds: [] });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!isGraphShortcutActiveRef.current) return;
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePanActive(false);
      }
    }

    function stopPanMode() {
      setIsSpacePanActive(false);
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", stopPanMode);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", stopPanMode);
    };
  });

  function addNode(nodeType: GraphNodeType) {
    const currentGraph = graphRef.current;
    const node = createDefaultGraphNode(nodeType, {
      x: 120 + currentGraph.nodes.length * 48,
      y: 120 + currentGraph.nodes.length * 16,
    });
    commitGraphChange(
      { ...currentGraph, nodes: [...currentGraph.nodes, node] },
      { nodeIds: [node.id], edgeIds: [] },
    );
    setNodePalette(null);
  }

  function addNewNode() {
    const currentGraph = graphRef.current;
    const node = {
      ...createDefaultGraphNode("action", {
        x: 120 + currentGraph.nodes.length * 48,
        y: 120 + currentGraph.nodes.length * 16,
      }),
      label: "New node",
      config: null,
    };
    commitGraphChange(
      { ...currentGraph, nodes: [...currentGraph.nodes, node] },
      { nodeIds: [node.id], edgeIds: [] },
    );
  }

  function addActionNode(actionType: ActionType) {
    const currentGraph = graphRef.current;
    const node = {
      ...createDefaultGraphNode("action", {
        x: 120 + currentGraph.nodes.length * 48,
        y: 120 + currentGraph.nodes.length * 16,
      }),
      label: actionLabels[actionType],
      config: defaultActionConfig(actionType),
    };
    commitGraphChange(
      { ...currentGraph, nodes: [...currentGraph.nodes, node] },
      { nodeIds: [node.id], edgeIds: [] },
    );
    setIsActionPaletteOpen(false);
  }

  function updateNode(nextNode: GraphNode) {
    const currentGraph = graphRef.current;
    commitGraphChange(
      {
        ...currentGraph,
        nodes: currentGraph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
      },
      { nodeIds: [nextNode.id], edgeIds: [] },
    );
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.node_type === "start") return;
    deleteNode(selectedNode.id);
  }

  function syncFlowGraph(nodes: Node[], edges: Edge[]) {
    const currentGraph = graphRef.current;
    commitGraphChange(
      fromReactFlowGraph(currentGraph, nodes, edges, currentGraph.viewport),
      selectionRef.current,
    );
  }

  function commitGraphChange(
    nextGraph: WorkflowGraph,
    nextSelection: GraphSelection = selectionRef.current,
    options: { pushHistory?: boolean } = {},
  ) {
    const shouldPushHistory = options.pushHistory ?? true;
    graphRef.current = nextGraph;
    if (shouldPushHistory) {
      historyRef.current = pushGraphHistory(historyRef.current, nextGraph);
    } else {
      historyRef.current = {
        ...historyRef.current,
        present: nextGraph,
      };
    }
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection(nextSelection);
    onChange(nextGraph);
  }

  function undoGraphEdit() {
    if (runState.status === "running") return;
    const nextHistory = undoGraphHistory(historyRef.current);
    if (nextHistory === historyRef.current) return;
    historyRef.current = nextHistory;
    graphRef.current = nextHistory.present;
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    onChange(nextHistory.present);
  }

  function redoGraphEdit() {
    if (runState.status === "running") return;
    const nextHistory = redoGraphHistory(historyRef.current);
    if (nextHistory === historyRef.current) return;
    historyRef.current = nextHistory;
    graphRef.current = nextHistory.present;
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    onChange(nextHistory.present);
  }

  function handleNodesChange(changes: NodeChange<WorkflowFlowNode>[]) {
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
      syncFlowGraph(nextNodes, reactFlowEdgesRef.current);
    }
  }

  function handleEdgesChange(changes: EdgeChange<WorkflowFlowEdge>[]) {
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
      syncFlowGraph(reactFlowNodesRef.current, nextEdges);
    }
  }

  function handleEdgeClick(_: unknown, edge: WorkflowFlowEdge) {
    setSelection({ nodeIds: [], edgeIds: [edge.id] });
    setLinkContextMenu(null);
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || !connection.sourceHandle) return;
    if (!connection.targetHandle) return;
    const nextEdge: WorkflowFlowEdge = {
      ...connection,
      id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
      label: connection.sourceHandle,
      data: { hasIssue: false, status: "idle" },
    };
    const nextEdges = replacePortEdge(reactFlowEdgesRef.current, nextEdge);
    setReactFlowEdges(nextEdges);
    syncFlowGraph(reactFlowNodesRef.current, nextEdges);
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
    const currentGraph = graphRef.current;
    const nodeToDelete = currentGraph.nodes.find((node) => node.id === nodeId);
    if (!nodeToDelete || nodeToDelete.node_type === "start") return;
    const result = deleteGraphSelection(currentGraph, {
      nodeIds: [nodeId],
      edgeIds: [],
    });
    commitGraphChange(result.graph, result.selection);
  }

  function duplicateNode(nodeId: string) {
    const result = duplicateGraphSelection(graphRef.current, {
      nodeIds: [nodeId],
      edgeIds: [],
    });
    commitGraphChange(result.graph, result.selection);
    setContextMenu(null);
  }

  function duplicateSelection() {
    if (runState.status === "running") return;
    const result = duplicateGraphSelection(graphRef.current, selectionRef.current);
    commitGraphChange(result.graph, result.selection);
  }

  function copySelection() {
    const nextClipboard = copyGraphSelection(graphRef.current, selectionRef.current);
    if (nextClipboard) setClipboard(nextClipboard);
  }

  function pasteClipboard() {
    if (runState.status === "running") return;
    const result = pasteGraphClipboard(graphRef.current, clipboardRef.current);
    commitGraphChange(result.graph, result.selection);
  }

  function deleteSelection() {
    if (runState.status === "running") return;
    const result = deleteGraphSelection(graphRef.current, selectionRef.current);
    commitGraphChange(result.graph, result.selection);
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
    setLinkContextMenu((current) => (current?.edgeId === edgeId ? null : current));
    const result = deleteGraphSelection(graphRef.current, {
      nodeIds: [],
      edgeIds: [edgeId],
    });
    commitGraphChange(result.graph, result.selection);
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) return;
    deleteEdge(selectedEdge.id);
  }

  return (
    <section
      ref={editorRef}
      className="workflow-graph-editor panel"
      aria-label="Visual Graph"
      onFocusCapture={() => {
        isGraphShortcutActiveRef.current = true;
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !editorRef.current?.contains(nextTarget)) {
          isGraphShortcutActiveRef.current = false;
        }
      }}
    >
      <WorkflowGraphToolbar
        isPanMode={isToolbarPanMode}
        onAddAction={() => setIsActionPaletteOpen(true)}
        onAddNewNode={addNewNode}
        onFitView={() => reactFlowInstance?.fitView()}
        onOpenShortcuts={() => setIsShortcutGuideOpen(true)}
        onOpenNodePalette={openNodePalette}
        onRedo={redoGraphEdit}
        onSelectMode={() => setIsToolbarPanMode(false)}
        onTogglePanMode={() => setIsToolbarPanMode((current) => !current)}
        onUndo={undoGraphEdit}
      />

      <div className="workflow-graph-layout">
        <div className="graph-canvas-wrap">
          <div
            className={["graph-canvas", isPanMode ? "graph-canvas-pan-mode" : ""]
              .filter(Boolean)
              .join(" ")}
            onPointerUp={clearPreviewConnection}
            role="application"
            aria-label="Workflow graph canvas"
          >
            <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
              colorMode="dark"
              defaultViewport={flowGraph.viewport}
              edges={reactFlowEdges}
              fitView
              connectionDragThreshold={0}
              connectionRadius={32}
              nodes={reactFlowNodes}
              nodesConnectable
              nodeTypes={workflowNodeTypes}
              onConnect={handleConnect}
              onEdgeClick={handleEdgeClick}
              onEdgeContextMenu={(event, edge) => {
                event.preventDefault();
                setSelection({ nodeIds: [], edgeIds: [edge.id] });
                setLinkContextMenu({
                  edgeId: edge.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              onEdgesChange={handleEdgesChange}
              onInit={setReactFlowInstance}
              onMoveEnd={(_, viewport) =>
                commitGraphChange({ ...graphRef.current, viewport }, selectionRef.current, {
                  pushHistory: false,
                })
              }
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setLinkContextMenu(null);
                setSelection({ nodeIds: [node.id], edgeIds: [] });
                setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
              }}
              onNodeClick={(event, node) => selectNodeFromEvent(event, node.id)}
              onNodeDragStop={() =>
                syncFlowGraph(reactFlowNodesRef.current, reactFlowEdgesRef.current)
              }
              onNodesChange={handleNodesChange}
              panOnDrag={isPanMode}
              selectionMode={SelectionMode.Partial}
              selectionOnDrag={!isPanMode}
            >
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
            {contextMenu ? (
              <NodeContextMenu
                node={graph.nodes.find((node) => node.id === contextMenu.nodeId) ?? null}
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                onCopy={() => {
                  const nextClipboard = copyGraphSelection(graphRef.current, {
                    nodeIds: [contextMenu.nodeId],
                    edgeIds: [],
                  });
                  if (nextClipboard) setClipboard(nextClipboard);
                  setContextMenu(null);
                }}
                onDuplicate={() => duplicateNode(contextMenu.nodeId)}
                onHelp={() => openNodeHelp(contextMenu.nodeId)}
                onDelete={() => {
                  deleteNode(contextMenu.nodeId);
                  setContextMenu(null);
                }}
              />
            ) : null}
            {linkContextMenu ? (
              <LinkContextMenu
                edge={graph.edges.find((edge) => edge.id === linkContextMenu.edgeId) ?? null}
                x={linkContextMenu.x}
                y={linkContextMenu.y}
                onClose={() => setLinkContextMenu(null)}
                onDelete={() => deleteEdge(linkContextMenu.edgeId)}
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
          runState={runState}
          selectionSummary={selectionSummary}
          selectedEdge={selectedEdge}
          selectedNode={selectedNode}
          onCopySelection={copySelection}
          onDeleteSelection={deleteSelection}
          onDeleteSelectedEdge={deleteSelectedEdge}
          onDeleteSelectedNode={deleteSelectedNode}
          onDuplicateSelection={duplicateSelection}
          onFocusSelectedNode={focusSelectedNode}
          onOpenSelectedNodeHelp={() => setHelpNode(selectedNode)}
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
      <NodeHelpDialog
        node={helpNode}
        language={helpLanguage}
        onOpenChange={(open) => !open && setHelpNode(null)}
        onLanguageChange={setHelpLanguage}
      />
      <Dialog open={isShortcutGuideOpen} onOpenChange={setIsShortcutGuideOpen}>
        <DialogContent className="graph-shortcuts-dialog">
          <DialogHeader className="modal-header">
            <div>
              <p className="eyebrow">Visual Graph</p>
              <DialogTitle>Graph Shortcuts</DialogTitle>
              <DialogDescription>
                Mouse and keyboard controls for selecting, moving, editing, and running graph workflows.
              </DialogDescription>
            </div>
          </DialogHeader>
          <GraphShortcutGuide />
        </DialogContent>
      </Dialog>
    </section>
  );
}
