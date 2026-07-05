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
  GraphEdgeDelay,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphValidationIssue,
  RunState,
  Subflow,
  SubflowSummary,
  WorkflowGraph,
} from "../../../types/workflow";
import {
  createDefaultGraphNode,
  defaultActionConfig,
  fromReactFlowGraph,
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
import { layoutWorkflowGraph } from "../lib/graphLayout";
import type { GraphNodeHelpLanguage } from "../lib/graphNodeHelpContent";
import {
  cloneGraphEdgeDelay,
  insertSubflowGraphNodes,
} from "../lib/subflowSelection";
import { getVisibleNodeInsertionPosition } from "../lib/nodeInsertionPosition";
import {
  edgeKindForFlowSource,
  edgePortsExist,
  replacePortEdge,
} from "../lib/graphEditorEdges";
import { actionLabels, commandMessage } from "../../../lib/workflowUi";
import { WorkflowGraphEdge, WorkflowGraphNode } from "./WorkflowGraphCanvasParts";
import { WorkflowGraphInspector } from "./WorkflowGraphInspector";
import { WorkflowGraphEditorDialogs } from "./WorkflowGraphEditorDialogs";
import { RevisionHistoryDrawer } from "./RevisionHistoryDrawer";
import { useWorkflowGraphShortcuts } from "./useWorkflowGraphShortcuts";
import { useSelectionSubflowCreator } from "./useSelectionSubflowCreator";
import { useWorkflowGraphDerivedState } from "./useWorkflowGraphDerivedState";
import {
  ActionNodePalette,
  GraphNodePalette,
  LinkContextMenu,
  NodeContextMenu,
  NodeHelpDialog,
  type SubflowAddMode,
  SubflowNodePalette,
} from "./WorkflowGraphPalettes";
import { WorkflowGraphToolbar } from "./WorkflowGraphToolbar";

type WorkflowGraphEditorProps = {
  graph: WorkflowGraph;
  graphKind?: "workflow" | "subflow";
  runState: RunState;
  validationIssues: GraphValidationIssue[];
  subflowOptions?: SubflowSummary[];
  selectionRequest?: GraphSelectionRequest | null;
  onChange: (graph: WorkflowGraph) => void;
  onCreateSubflowFromSelection?: (input: {
    name: string;
    graph: WorkflowGraph;
  }) => Promise<Pick<Subflow, "id" | "name">>;
  onLoadSubflowGraph?: (subflowId: string) => Promise<WorkflowGraph>;
  onRunGraph?: () => void;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  onOpenSubflowDetail?: (subflowId: string) => void;
  onSaveGraph?: (options?: { comment?: string; tag?: string }) => void | Promise<unknown>;
  onValidateGraph?: () => void;
  onRestoreRevision?: (graph: WorkflowGraph) => void | Promise<void>;
  ownerId?: string;
  defaultEdgeDelay?: GraphEdgeDelay | null;
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
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

const graphMiniMapNodeLimit = 300;

export function WorkflowGraphEditor({
  graph,
  graphKind = "workflow",
  runState,
  validationIssues,
  subflowOptions = [],
  selectionRequest,
  defaultEdgeDelay = null,
  onChange,
  onCreateSubflowFromSelection,
  onLoadSubflowGraph,
  onRunGraph,
  onSelectedNodeChange,
  onOpenSubflowDetail,
  onSaveGraph,
  onValidateGraph,
  onRestoreRevision,
  ownerId,
  initialVariables,
  profileVariables,
}: WorkflowGraphEditorProps) {
  const [isActionPaletteOpen, setIsActionPaletteOpen] = useState(false);
  const [isSubflowPaletteOpen, setIsSubflowPaletteOpen] = useState(false);
  const [nodePalette, setNodePalette] = useState<{
    title: string;
    eyebrow: string;
    searchLabel: string;
    groups: Array<{ label: string; nodes: GraphNodeType[] }>;
  } | null>(null);
  const [selection, setSelection] = useState<GraphSelection>({
    nodeIds: [],
    edgeIds: [],
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isArrangingGraph, setIsArrangingGraph] = useState(false);
  const [arrangeError, setArrangeError] = useState<string | null>(null);
  const [subflowInsertError, setSubflowInsertError] = useState<string | null>(null);
  const [isInsertingSubflowNodes, setIsInsertingSubflowNodes] = useState(false);
  const [isToolbarPanMode, setIsToolbarPanMode] = useState(false);
  const [isSpacePanActive, setIsSpacePanActive] = useState(false);
  const isPanMode = isToolbarPanMode || isSpacePanActive;
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null);
  const activePortConnectionRef = useRef<ActivePortConnection>(null);
  const editorRef = useRef<HTMLElement | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
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
  const onChangeRef = useRef(onChange);
  const defaultEdgeDelayRef = useRef(defaultEdgeDelay);
  const syncFlowGraphRef = useRef<((nodes: any[], edges: any[]) => void) | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    defaultEdgeDelayRef.current = defaultEdgeDelay;
  }, [defaultEdgeDelay]);

  useEffect(() => {
    syncFlowGraphRef.current = syncFlowGraph;
  }, [syncFlowGraph]);
  const {
    isSelectionSubflowDialogOpen,
    selectionSubflowName,
    selectionSubflowError,
    isCreatingSelectionSubflow,
    setIsSelectionSubflowDialogOpen,
    setSelectionSubflowName,
    resetSelectionSubflowDialog,
    openSelectionSubflowDialog,
    createSubflowFromSelection,
  } = useSelectionSubflowCreator({
    graphKind,
    graphRef,
    selectionRef,
    onCreateSubflowFromSelection,
    onCommitGraphChange: commitGraphChange,
  });
  const {
    selectionSummary,
    selectedNodeId,
    selectedNode,
    selectedEdge,
    contextMenuNode,
    contextMenuSubflowId,
    contextMenuSubflowName,
    inspectorOpen,
    nodeLabels,
    issueGroups,
    flowGraph,
  } = useWorkflowGraphDerivedState({
    graph,
    selection,
    contextMenu,
    subflowOptions,
    runState,
    validationIssues,
  });
  const showGraphMiniMap = graph.nodes.length <= graphMiniMapNodeLimit;

  useEffect(() => {
    onSelectedNodeChange?.(selectedNodeId);
  }, [onSelectedNodeChange, selectedNodeId]);
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
  }, [reactFlowInstance, selectionRequest]);
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
  const workflowEdgeTypes = useMemo(
    () => ({
      workflow: WorkflowGraphEdge,
    }),
    [],
  );

  useWorkflowGraphShortcuts({
    editorRef,
    isGraphShortcutActiveRef,
    isEditingDisabled: runState.status === "running",
    onSetSpacePanActive: setIsSpacePanActive,
    onDeleteSelection: deleteSelection,
    onUndo: undoGraphEdit,
    onRedo: redoGraphEdit,
    onCopy: copySelection,
    onPaste: pasteClipboard,
    onDuplicate: duplicateSelection,
    onSave: onSaveGraph,
    onValidate: onValidateGraph,
    onRun: onRunGraph,
    onFitView: () => reactFlowInstance?.fitView(),
    onEscape: () => {
      setContextMenu(null);
      setLinkContextMenu(null);
      setIsShortcutGuideOpen(false);
      setSelection({ nodeIds: [], edgeIds: [] });
    },
  });

  function addNode(nodeType: GraphNodeType) {
    const currentGraph = graphRef.current;
    const node = createDefaultGraphNode(
      nodeType,
      getVisibleNodeInsertionPosition(
        currentGraph.nodes.length,
        reactFlowInstance,
        graphCanvasRef.current,
      ),
    );
    commitGraphChange(
      { ...currentGraph, nodes: [...currentGraph.nodes, node] },
      { nodeIds: [node.id], edgeIds: [] },
    );
    setNodePalette(null);
  }

  function addNewNode() {
    const currentGraph = graphRef.current;
    const node = {
      ...createDefaultGraphNode(
        "action",
        getVisibleNodeInsertionPosition(
          currentGraph.nodes.length,
          reactFlowInstance,
          graphCanvasRef.current,
        ),
      ),
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
      ...createDefaultGraphNode(
        "action",
        getVisibleNodeInsertionPosition(
          currentGraph.nodes.length,
          reactFlowInstance,
          graphCanvasRef.current,
        ),
      ),
      label: actionLabels[actionType],
      config: defaultActionConfig(actionType),
    };
    commitGraphChange(
      { ...currentGraph, nodes: [...currentGraph.nodes, node] },
      { nodeIds: [node.id], edgeIds: [] },
    );
    setIsActionPaletteOpen(false);
  }

  function addSubflowNode(subflow: SubflowSummary, mode: SubflowAddMode = "call_node") {
    if (mode === "insert_nodes") {
      void insertSubflowNodes(subflow);
      return;
    }
    const currentGraph = graphRef.current;
    const node = {
      ...createDefaultGraphNode(
        "call_subflow",
        getVisibleNodeInsertionPosition(
          currentGraph.nodes.length,
          reactFlowInstance,
          graphCanvasRef.current,
        ),
      ),
      label: subflow.name,
      config: {
        subflow_id: subflow.id,
        input_mapping: [],
        output_prefix: null,
      },
    };
    commitGraphChange(
      { ...currentGraph, nodes: [...currentGraph.nodes, node] },
      { nodeIds: [node.id], edgeIds: [] },
    );
    setIsSubflowPaletteOpen(false);
  }

  async function insertSubflowNodes(subflow: SubflowSummary) {
    if (!onLoadSubflowGraph) {
      setSubflowInsertError("Subflow graph loading is not available.");
      return;
    }
    setSubflowInsertError(null);
    setIsInsertingSubflowNodes(true);
    try {
      const subflowGraph = await onLoadSubflowGraph(subflow.id);
      const currentGraph = graphRef.current;
      const plan = insertSubflowGraphNodes(
        currentGraph,
        subflowGraph,
        getVisibleNodeInsertionPosition(
          currentGraph.nodes.length,
          reactFlowInstance,
          graphCanvasRef.current,
        ),
      );
      if (!plan.ok) {
        setSubflowInsertError(plan.message);
        return;
      }
      commitGraphChange(plan.graph, plan.selection);
      setIsSubflowPaletteOpen(false);
    } catch (error) {
      setSubflowInsertError(commandMessage(error));
    } finally {
      setIsInsertingSubflowNodes(false);
    }
  }

  function updateNode(nextNode: GraphNode) {
    const currentGraph = graphRef.current;
    const nextGraph = {
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
    };
    commitGraphChange(
      {
        ...nextGraph,
        edges: nextGraph.edges.filter((edge) => edgePortsExist(nextGraph, edge)),
      },
      { nodeIds: [nextNode.id], edgeIds: [] },
    );
  }

  function updateEdge(nextEdge: WorkflowGraph["edges"][number]) {
    const currentGraph = graphRef.current;
    commitGraphChange(
      {
        ...currentGraph,
        edges: currentGraph.edges.map((edge) =>
          edge.id === nextEdge.id ? nextEdge : edge,
        ),
      },
      { nodeIds: [], edgeIds: [nextEdge.id] },
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
      syncFlowGraph(nextNodes, reactFlowEdgesRef.current);
    }
  }

  function handleEdgesChange(changes: EdgeChange<WorkflowFlowEdge>[]) {
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
      syncFlowGraph(reactFlowNodesRef.current, nextEdges);
    }
  }

  function handleEdgeClick(_: unknown, edge: WorkflowFlowEdge) {
    setSelection({ nodeIds: [], edgeIds: [edge.id] });
    setLinkContextMenu(null);
  }

  function handleConnect(connection: Connection) {
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

  async function autoArrangeGraph() {
    if (runState.status === "running" || isArrangingGraph) return;
    await arrangeGraph();
    reactFlowInstance?.fitView({ duration: 240, padding: 0.18 });
  }

  async function arrangeGraph() {
    setIsArrangingGraph(true);
    setArrangeError(null);
    const layoutSource = graphRef.current;
    try {
      const result = await layoutWorkflowGraph(layoutSource);
      if (graphRef.current !== layoutSource) return;
      commitGraphChange(result.graph, selectionRef.current);
    } catch {
      setArrangeError("Could not arrange graph. Existing positions were kept.");
    } finally {
      setIsArrangingGraph(false);
    }
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

  function closeInspector() {
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection({ nodeIds: [], edgeIds: [] });
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
        graphKind={graphKind}
        isArranging={isArrangingGraph}
        isPanMode={isToolbarPanMode}
        isReadOnly={runState.status === "running"}
        onAddAction={() => setIsActionPaletteOpen(true)}
        onAddNewNode={addNewNode}
        onAddSubflow={() => setIsSubflowPaletteOpen(true)}
        onAutoArrange={autoArrangeGraph}
        onFitView={() => reactFlowInstance?.fitView()}
        onOpenHistory={ownerId ? () => setIsHistoryOpen(true) : undefined}
        onOpenShortcuts={() => setIsShortcutGuideOpen(true)}
        onOpenNodePalette={openNodePalette}
        onRedo={redoGraphEdit}
        onSelectMode={() => setIsToolbarPanMode(false)}
        onTogglePanMode={() => setIsToolbarPanMode((current) => !current)}
        onUndo={undoGraphEdit}
        nodeCount={graph.nodes.length}
        edgeCount={graph.edges.length}
        arrangeError={arrangeError}
      />

      <div className="workflow-graph-layout">
        <div className="graph-canvas-wrap">
          <div
            className={["graph-canvas", isPanMode ? "graph-canvas-pan-mode" : ""]
              .filter(Boolean)
              .join(" ")}
            onPointerUp={clearPreviewConnection}
            ref={graphCanvasRef}
            role="application"
            aria-label="Workflow graph canvas"
          >
            <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
              colorMode="dark"
              defaultViewport={flowGraph.viewport}
              edges={reactFlowEdges}
              edgeTypes={workflowEdgeTypes}
              fitView
              connectionDragThreshold={0}
              connectionRadius={32}
              nodes={reactFlowNodes}
              nodesConnectable={runState.status !== "running"}
              nodesDraggable={runState.status !== "running"}
              nodeTypes={workflowNodeTypes}
              onlyRenderVisibleElements={graph.nodes.length > graphMiniMapNodeLimit}
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
              {showGraphMiniMap ? (
                <MiniMap
                  ariaLabel="Graph minimap"
                  nodeBorderRadius={8}
                  pannable
                  position="bottom-right"
                  zoomable
                />
              ) : null}
            </ReactFlow>
            {contextMenu ? (
              <NodeContextMenu
                node={contextMenuNode}
                calledSubflowName={contextMenuSubflowName}
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
                onOpenSubflowDetail={
                  contextMenuSubflowId && onOpenSubflowDetail
                    ? () => {
                        onOpenSubflowDetail(contextMenuSubflowId);
                        setContextMenu(null);
                      }
                    : undefined
                }
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
        </div>

        {inspectorOpen ? (
          <aside
            className="graph-inspector-drawer"
            aria-label="Graph inspector drawer"
          >
            <WorkflowGraphInspector
              graph={graph}
              issueGroups={issueGroups}
              nodeLabels={nodeLabels}
              runState={runState}
              selectionSummary={selectionSummary}
              selectedEdge={selectedEdge}
              selectedNode={selectedNode}
              subflowOptions={subflowOptions}
              initialVariables={initialVariables}
              profileVariables={profileVariables}
              onCopySelection={copySelection}
              onCreateSubflowFromSelection={
                graphKind === "workflow" && onCreateSubflowFromSelection
                  ? openSelectionSubflowDialog
                  : undefined
              }
              onDeleteSelection={deleteSelection}
              onDeleteSelectedEdge={deleteSelectedEdge}
              onDeleteSelectedNode={deleteSelectedNode}
              onDuplicateSelection={duplicateSelection}
              onFocusSelectedNode={focusSelectedNode}
              onOpenSelectedNodeHelp={() => setHelpNode(selectedNode)}
              onOpenSubflowDetail={onOpenSubflowDetail}
              onClose={closeInspector}
              onUpdateEdge={updateEdge}
              onUpdateNode={updateNode}
            />
          </aside>
        ) : null}
      </div>

      {ownerId ? (
        <RevisionHistoryDrawer
          open={isHistoryOpen}
          ownerId={ownerId}
          ownerKind={graphKind}
          onClose={() => setIsHistoryOpen(false)}
          onRestore={async (restoredGraph) => {
            if (onRestoreRevision) {
              await onRestoreRevision(restoredGraph);
            } else {
              onChange(restoredGraph);
            }
            setIsHistoryOpen(false);
          }}
          onSaveBackup={onSaveGraph}
          currentGraph={graph}
        />
      ) : null}

      <ActionNodePalette
        open={isActionPaletteOpen}
        onOpenChange={setIsActionPaletteOpen}
        onSelectAction={addActionNode}
      />
      <SubflowNodePalette
        open={isSubflowPaletteOpen}
        subflows={subflowOptions}
        error={subflowInsertError}
        isSelecting={isInsertingSubflowNodes}
        onOpenChange={(open) => {
          setIsSubflowPaletteOpen(open);
          if (open) setSubflowInsertError(null);
        }}
        onSelectSubflow={addSubflowNode}
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
      <WorkflowGraphEditorDialogs
        isShortcutGuideOpen={isShortcutGuideOpen}
        isSelectionSubflowDialogOpen={isSelectionSubflowDialogOpen}
        isCreatingSelectionSubflow={isCreatingSelectionSubflow}
        selectionSubflowName={selectionSubflowName}
        selectionSubflowError={selectionSubflowError}
        onShortcutGuideOpenChange={setIsShortcutGuideOpen}
        onSelectionSubflowDialogOpenChange={setIsSelectionSubflowDialogOpen}
        onSelectionSubflowNameChange={setSelectionSubflowName}
        onResetSelectionSubflowDialog={resetSelectionSubflowDialog}
        onCreateSubflowFromSelection={(mode) => {
          void createSubflowFromSelection(mode);
        }}
      />
    </section>
  );
}
