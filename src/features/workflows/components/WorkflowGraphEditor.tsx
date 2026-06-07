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
  GraphPosition,
  GraphPort,
  GraphValidationIssue,
  RunState,
  Subflow,
  SubflowSummary,
  WorkflowGraph,
} from "../../../types/workflow";
import {
  createDefaultGraphNode,
  callSubflowIdFromNode,
  defaultActionConfig,
  fromReactFlowGraph,
  graphIssuesByNode,
  mergeReactFlowNodeRuntimeState,
  nodePorts,
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
import { layoutWorkflowGraph, type WorkflowGraphEdgeKind } from "../lib/graphLayout";
import type { GraphNodeHelpLanguage } from "../lib/graphNodeHelpContent";
import { actionLabels } from "../../../lib/workflowUi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { GraphShortcutGuide } from "./GraphShortcutGuide";
import { WorkflowGraphEdge, WorkflowGraphNode } from "./WorkflowGraphCanvasParts";
import { WorkflowGraphInspector } from "./WorkflowGraphInspector";
import {
  ActionNodePalette,
  GraphNodePalette,
  LinkContextMenu,
  NodeContextMenu,
  NodeHelpDialog,
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
  onRunGraph?: () => void;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  onOpenSubflowDetail?: (subflowId: string) => void;
  onSaveGraph?: () => void;
  onValidateGraph?: () => void;
  defaultEdgeDelay?: GraphEdgeDelay | null;
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

type ScreenToFlowPosition = Pick<
  ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge>,
  "screenToFlowPosition"
>;

type SelectionSubflowMode = "create_only" | "create_and_replace";

type SelectionSubflowPlan =
  | {
      ok: true;
      entryNode: GraphNode;
      selectedNodes: GraphNode[];
      internalEdges: WorkflowGraph["edges"];
      externalIncomingEdges: WorkflowGraph["edges"];
      externalOutgoingEdges: WorkflowGraph["edges"];
      subflowGraph: WorkflowGraph;
      replacementPosition: GraphPosition;
    }
  | { ok: false; message: string };

type ReplaceSelectionPlan =
  | { ok: true; graph: WorkflowGraph; selection: GraphSelection }
  | { ok: false; message: string };

const graphNodeDimensions = {
  width: 160,
  height: 82,
};
const visibleNodeStagger = {
  step: 24,
  cycle: 5,
};
const graphMiniMapNodeLimit = 300;

export function replacePortEdge(
  edges: WorkflowFlowEdge[],
  nextEdge: WorkflowFlowEdge,
  nodes: WorkflowFlowNode[],
): WorkflowFlowEdge[] {
  const sourceHandle = nextEdge.sourceHandle ?? "out";
  const targetHandle = nextEdge.targetHandle ?? "in";
  const targetNode = nodes.find((node) => node.id === nextEdge.target);
  const allowsMultipleIncoming =
    targetNode?.data.nodeType === "merge" && targetHandle === "in";

  return [
    ...edges.filter((edge) => {
      const sameOutput =
        edge.source === nextEdge.source &&
        (edge.sourceHandle ?? "out") === sourceHandle;
      const sameInput =
        edge.target === nextEdge.target &&
        (edge.targetHandle ?? "in") === targetHandle;
      return edge.id !== nextEdge.id && !sameOutput && (allowsMultipleIncoming || !sameInput);
    }),
    nextEdge,
  ];
}

function edgeKindForFlowSource(
  nodes: WorkflowFlowNode[],
  sourceNodeId: string,
  sourcePortId: string,
): WorkflowGraphEdgeKind {
  const sourceNodeType = nodes.find((node) => node.id === sourceNodeId)?.data.nodeType;
  if (!sourceNodeType) return "main";
  if (
    ["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(sourceNodeType) &&
    sourcePortId === "loop"
  ) {
    return "loop";
  }
  if (
    (sourceNodeType === "retry" && (sourcePortId === "try" || sourcePortId === "failed")) ||
    (sourceNodeType === "try_catch" &&
      ["try", "error", "finally"].includes(sourcePortId)) ||
    (sourceNodeType === "fallback" && sourcePortId === "fallback") ||
    (sourceNodeType === "repeat_until" && sourcePortId === "timeout")
  ) {
    return "recovery";
  }
  if (
    (["if", "switch", "router", "random_choice", "try_catch", "fallback"].includes(sourceNodeType) &&
      sourcePortId === "done") ||
    (["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(sourceNodeType) &&
      sourcePortId === "done") ||
    (sourceNodeType === "retry" && sourcePortId === "success")
  ) {
    return "continuation";
  }
  if (
    (sourceNodeType === "if" && (sourcePortId === "true" || sourcePortId === "false")) ||
    ((sourceNodeType === "switch" || sourceNodeType === "router") &&
      (sourcePortId === "default" || sourcePortId.startsWith("case_"))) ||
    (sourceNodeType === "random_choice" && sourcePortId.startsWith("choice_")) ||
    (sourceNodeType === "fallback" && sourcePortId === "primary")
  ) {
    return "branch";
  }
  return "main";
}

function edgePortsExist(graph: WorkflowGraph, edge: WorkflowGraph["edges"][number]) {
  const source = graph.nodes.find((node) => node.id === edge.source_node_id);
  const target = graph.nodes.find((node) => node.id === edge.target_node_id);
  return Boolean(
    source?.ports.some((port) => port.direction === "output" && port.id === edge.source_port) &&
      target?.ports.some((port) => port.direction === "input" && port.id === edge.target_port),
  );
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

function fallbackNodeInsertionPosition(nodeCount: number): GraphPosition {
  return {
    x: 120 + nodeCount * 48,
    y: 120 + nodeCount * 16,
  };
}

export function getVisibleNodeInsertionPosition(
  nodeCount: number,
  reactFlowInstance: ScreenToFlowPosition | null,
  canvasElement: Pick<HTMLElement, "getBoundingClientRect"> | null,
): GraphPosition {
  const fallbackPosition = fallbackNodeInsertionPosition(nodeCount);
  if (!reactFlowInstance || !canvasElement) return fallbackPosition;

  const canvasBounds = canvasElement.getBoundingClientRect();
  if (canvasBounds.width <= 0 || canvasBounds.height <= 0) {
    return fallbackPosition;
  }

  const visibleCenter = reactFlowInstance.screenToFlowPosition(
    {
      x: canvasBounds.left + canvasBounds.width / 2,
      y: canvasBounds.top + canvasBounds.height / 2,
    },
    { snapToGrid: false },
  );
  const stagger = (nodeCount % visibleNodeStagger.cycle) * visibleNodeStagger.step;

  return {
    x: Math.round(visibleCenter.x - graphNodeDimensions.width / 2 + stagger),
    y: Math.round(visibleCenter.y - graphNodeDimensions.height / 2 + stagger),
  };
}

export function buildSelectedSubflowPlan(
  graph: WorkflowGraph,
  selection: GraphSelection,
): SelectionSubflowPlan {
  const selectedNodeIdSet = new Set(selection.nodeIds);
  const selectedNodes = graph.nodes.filter((node) => selectedNodeIdSet.has(node.id));

  if (selectedNodes.length === 0) {
    return { ok: false, message: "Select at least one node to create a subflow." };
  }
  if (selectedNodes.some((node) => node.node_type === "start")) {
    return { ok: false, message: "Start cannot be included in a reusable subflow." };
  }
  if (selectedNodes.some((node) => node.node_type === "call_subflow")) {
    return {
      ok: false,
      message: "Call Subflow nodes cannot be nested inside MVP subflows.",
    };
  }

  const internalEdges = graph.edges.filter(
    (edge) =>
      selectedNodeIdSet.has(edge.source_node_id) &&
      selectedNodeIdSet.has(edge.target_node_id),
  );
  const externalIncomingEdges = graph.edges.filter(
    (edge) =>
      !selectedNodeIdSet.has(edge.source_node_id) &&
      selectedNodeIdSet.has(edge.target_node_id),
  );
  const externalOutgoingEdges = graph.edges.filter(
    (edge) =>
      selectedNodeIdSet.has(edge.source_node_id) &&
      !selectedNodeIdSet.has(edge.target_node_id),
  );

  const entryNode = selectedSubflowEntryNode(selectedNodes, internalEdges, externalIncomingEdges);
  if (!entryNode) {
    return {
      ok: false,
      message: "Selection needs one clear first node before it can become a subflow.",
    };
  }
  const reachableNodeIds = reachableSelectedNodeIds(entryNode.id, internalEdges);
  if (selectedNodes.some((node) => !reachableNodeIds.has(node.id))) {
    return {
      ok: false,
      message: "Selection must form one connected block from its first node.",
    };
  }

  const minX = Math.min(...selectedNodes.map((node) => node.position.x));
  const minY = Math.min(...selectedNodes.map((node) => node.position.y));
  const replacementPosition = selectedNodesReplacementPosition(selectedNodes);
  const copiedNodes = selectedNodes.map((node) => ({
    ...cloneGraphNode(node),
    position: {
      x: Math.round(node.position.x - minX + 220),
      y: Math.round(node.position.y - minY),
    },
  }));
  const startNode: GraphNode = {
    id: "start",
    node_type: "start",
    label: "Start",
    position: { x: 0, y: 0 },
    config: {},
    ports: nodePorts("start"),
    group_id: null,
  };
  const startEdge = {
    id: uniqueGraphEdgeId(
      `edge-start-${entryNode.id}`,
      new Set(internalEdges.map((edge) => edge.id)),
    ),
    source_node_id: "start",
    source_port: "out",
    target_node_id: entryNode.id,
    target_port: firstInputPort(entryNode),
    label: "next",
    condition: null,
  };

  return {
    ok: true,
    entryNode,
    selectedNodes,
    internalEdges,
    externalIncomingEdges,
    externalOutgoingEdges,
    replacementPosition,
    subflowGraph: {
      version: graph.version,
      nodes: [startNode, ...copiedNodes],
      edges: [startEdge, ...internalEdges.map(cloneGraphEdge)],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

export function replaceSelectionWithSubflowNode(
  graph: WorkflowGraph,
  selection: GraphSelection,
  subflow: Pick<Subflow, "id" | "name">,
): ReplaceSelectionPlan {
  const plan = buildSelectedSubflowPlan(graph, selection);
  if (!plan.ok) return plan;
  if (plan.externalIncomingEdges.length > 1 || plan.externalOutgoingEdges.length > 1) {
    return {
      ok: false,
      message:
        "Replace supports selections with at most one incoming link and one outgoing link.",
    };
  }

  const selectedNodeIdSet = new Set(plan.selectedNodes.map((node) => node.id));
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const replacementNode = {
    ...createDefaultGraphNode("call_subflow", plan.replacementPosition),
    label: subflow.name,
    config: {
      subflow_id: subflow.id,
      input_mapping: [],
      output_prefix: null,
    },
  };
  replacementNode.id = uniqueGraphNodeId(replacementNode.id, existingNodeIds);

  const nextEdges = graph.edges.filter(
    (edge) =>
      !selectedNodeIdSet.has(edge.source_node_id) &&
      !selectedNodeIdSet.has(edge.target_node_id),
  );
  const edgeIds = new Set(nextEdges.map((edge) => edge.id));
  const incomingEdge = plan.externalIncomingEdges[0];
  if (incomingEdge) {
    const edge = {
      ...cloneGraphEdge(incomingEdge),
      id: uniqueGraphEdgeId(
        `edge-${incomingEdge.source_node_id}-${incomingEdge.source_port}-${replacementNode.id}-in`,
        edgeIds,
      ),
      target_node_id: replacementNode.id,
      target_port: "in",
    };
    edgeIds.add(edge.id);
    nextEdges.push(edge);
  }
  const outgoingEdge = plan.externalOutgoingEdges[0];
  if (outgoingEdge) {
    const edge = {
      ...cloneGraphEdge(outgoingEdge),
      id: uniqueGraphEdgeId(
        `edge-${replacementNode.id}-out-${outgoingEdge.target_node_id}-${outgoingEdge.target_port}`,
        edgeIds,
      ),
      source_node_id: replacementNode.id,
      source_port: "out",
    };
    edgeIds.add(edge.id);
    nextEdges.push(edge);
  }

  return {
    ok: true,
    graph: {
      ...graph,
      nodes: [
        ...graph.nodes.filter((node) => !selectedNodeIdSet.has(node.id)),
        replacementNode,
      ],
      edges: nextEdges,
    },
    selection: { nodeIds: [replacementNode.id], edgeIds: [] },
  };
}

function selectedSubflowEntryNode(
  selectedNodes: GraphNode[],
  internalEdges: WorkflowGraph["edges"],
  externalIncomingEdges: WorkflowGraph["edges"],
) {
  const externalIncomingTargetIds = new Set(
    externalIncomingEdges.map((edge) => edge.target_node_id),
  );
  if (externalIncomingTargetIds.size === 1) {
    return selectedNodes.find((node) => externalIncomingTargetIds.has(node.id)) ?? null;
  }
  if (externalIncomingTargetIds.size > 1) return null;

  const internalTargetIds = new Set(internalEdges.map((edge) => edge.target_node_id));
  const roots = selectedNodes.filter((node) => !internalTargetIds.has(node.id));
  if (roots.length !== 1) return null;
  return roots[0];
}

function reachableSelectedNodeIds(entryNodeId: string, internalEdges: WorkflowGraph["edges"]) {
  const reachable = new Set([entryNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of internalEdges) {
      if (reachable.has(edge.source_node_id) && !reachable.has(edge.target_node_id)) {
        reachable.add(edge.target_node_id);
        changed = true;
      }
    }
  }
  return reachable;
}

function selectedNodesReplacementPosition(nodes: GraphNode[]): GraphPosition {
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + graphNodeDimensions.width));
  const maxY = Math.max(...nodes.map((node) => node.position.y + graphNodeDimensions.height));
  return {
    x: Math.round((minX + maxX) / 2 - graphNodeDimensions.width / 2),
    y: Math.round((minY + maxY) / 2 - graphNodeDimensions.height / 2),
  };
}

function firstInputPort(node: GraphNode) {
  return node.ports.find((port) => port.direction === "input")?.id ?? "in";
}

function cloneGraphNode(node: GraphNode): GraphNode {
  return {
    ...node,
    position: { ...node.position },
    ports: node.ports.map((port) => ({ ...port })),
    config: cloneStructuredValue(node.config),
  };
}

function cloneGraphEdge(edge: WorkflowGraph["edges"][number]): WorkflowGraph["edges"][number] {
  return {
    ...edge,
    condition: edge.condition ? cloneStructuredValue(edge.condition) : null,
    delay: cloneGraphEdgeDelay(edge.delay ?? null),
  };
}

function cloneStructuredValue<T>(value: T): T {
  if (typeof value === "undefined") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueGraphNodeId(baseId: string, existingIds: Set<string>) {
  if (!existingIds.has(baseId)) return baseId;
  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  return nextId;
}

function uniqueGraphEdgeId(baseId: string, existingIds: Set<string>) {
  if (!existingIds.has(baseId)) return baseId;
  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  return nextId;
}

function graphEditorCommandMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Could not create subflow from the selected nodes.";
}

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
  onRunGraph,
  onSelectedNodeChange,
  onOpenSubflowDetail,
  onSaveGraph,
  onValidateGraph,
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
  const [isSelectionSubflowDialogOpen, setIsSelectionSubflowDialogOpen] = useState(false);
  const [selectionSubflowName, setSelectionSubflowName] = useState("");
  const [selectionSubflowError, setSelectionSubflowError] = useState<string | null>(null);
  const [isCreatingSelectionSubflow, setIsCreatingSelectionSubflow] = useState(false);
  const [isArrangingGraph, setIsArrangingGraph] = useState(false);
  const [arrangeError, setArrangeError] = useState<string | null>(null);
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
  const contextMenuNode = contextMenu
    ? graph.nodes.find((node) => node.id === contextMenu.nodeId) ?? null
    : null;
  const contextMenuSubflowId = callSubflowIdFromNode(contextMenuNode);
  const contextMenuSubflowName = contextMenuSubflowId
    ? subflowOptions.find((subflow) => subflow.id === contextMenuSubflowId)?.name ??
      contextMenuNode?.label ??
      null
    : null;
  const showGraphMiniMap = graph.nodes.length <= graphMiniMapNodeLimit;

  useEffect(() => {
    onSelectedNodeChange?.(selectedNodeId);
  }, [onSelectedNodeChange, selectedNodeId]);
  const selectedEdge = selectedEdgeId
    ? graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;
  const inspectorOpen = Boolean(selectionSummary || selectedEdge || selectedNode);
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
          delay: cloneGraphEdgeDelay(defaultEdgeDelay),
        },
      };
      const nextEdges = replacePortEdge(currentFlowGraph.edges, nextEdge, currentFlowGraph.nodes);
      setReactFlowEdges(nextEdges);
      syncFlowGraph(currentFlowGraph.nodes, nextEdges);
    },
    [defaultEdgeDelay, onChange],
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

  function addSubflowNode(subflow: SubflowSummary) {
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

  function openSelectionSubflowDialog() {
    if (!onCreateSubflowFromSelection || graphKind !== "workflow") return;
    setSelectionSubflowName("");
    setSelectionSubflowError(null);
    setIsSelectionSubflowDialogOpen(true);
  }

  async function createSubflowFromSelection(mode: SelectionSubflowMode) {
    if (!onCreateSubflowFromSelection || isCreatingSelectionSubflow) return;
    const name = selectionSubflowName.trim();
    if (!name) {
      setSelectionSubflowError("Subflow name is required.");
      return;
    }

    const sourceGraph = graphRef.current;
    const sourceSelection = selectionRef.current;
    const plan = buildSelectedSubflowPlan(sourceGraph, sourceSelection);
    if (!plan.ok) {
      setSelectionSubflowError(plan.message);
      return;
    }
    if (
      mode === "create_and_replace" &&
      (plan.externalIncomingEdges.length > 1 || plan.externalOutgoingEdges.length > 1)
    ) {
      setSelectionSubflowError(
        "Replace supports selections with at most one incoming link and one outgoing link.",
      );
      return;
    }

    setIsCreatingSelectionSubflow(true);
    setSelectionSubflowError(null);
    try {
      const createdSubflow = await onCreateSubflowFromSelection({
        name,
        graph: plan.subflowGraph,
      });
      if (mode === "create_and_replace") {
        const replacement = replaceSelectionWithSubflowNode(
          sourceGraph,
          sourceSelection,
          createdSubflow,
        );
        if (!replacement.ok) {
          setSelectionSubflowError(replacement.message);
          return;
        }
        commitGraphChange(replacement.graph, replacement.selection);
      }
      setIsSelectionSubflowDialogOpen(false);
      setSelectionSubflowName("");
      setSelectionSubflowError(null);
    } catch (error) {
      setSelectionSubflowError(graphEditorCommandMessage(error));
    } finally {
      setIsCreatingSelectionSubflow(false);
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
    await arrangeGraph({ type: "full" });
    reactFlowInstance?.fitView({ duration: 240, padding: 0.18 });
  }

  async function arrangeSelection() {
    if (
      runState.status === "running" ||
      isArrangingGraph ||
      selectionRef.current.nodeIds.length < 2
    ) {
      return;
    }
    await arrangeGraph({
      type: "selection",
      nodeIds: selectionRef.current.nodeIds,
    });
    const arrangedNodes = graphRef.current.nodes.filter((node) =>
      selectionRef.current.nodeIds.includes(node.id),
    );
    if (arrangedNodes.length === 1) {
      focusNode(arrangedNodes[0]);
    }
  }

  async function arrangeGraph(
    mode: { type: "full" } | { type: "selection"; nodeIds: string[] },
  ) {
    setIsArrangingGraph(true);
    setArrangeError(null);
    const layoutSource = graphRef.current;
    try {
      const result = await layoutWorkflowGraph(layoutSource, mode);
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
        isArrangeSelectionDisabled={
          runState.status === "running" || selection.nodeIds.length < 2
        }
        isArranging={isArrangingGraph}
        isPanMode={isToolbarPanMode}
        onAddAction={() => setIsActionPaletteOpen(true)}
        onAddNewNode={addNewNode}
        onAddSubflow={() => setIsSubflowPaletteOpen(true)}
        onArrangeSelection={arrangeSelection}
        onAutoArrange={autoArrangeGraph}
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
              nodesConnectable
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
          <div className="graph-minimap" aria-label="Graph summary">
            {graph.nodes.length} nodes / {graph.edges.length} edges
            {isArrangingGraph ? (
              <span role="status">Arranging graph...</span>
            ) : null}
            {arrangeError ? (
              <span className="graph-arrange-error" role="status">{arrangeError}</span>
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

      <ActionNodePalette
        open={isActionPaletteOpen}
        onOpenChange={setIsActionPaletteOpen}
        onSelectAction={addActionNode}
      />
      <SubflowNodePalette
        open={isSubflowPaletteOpen}
        subflows={subflowOptions}
        onOpenChange={setIsSubflowPaletteOpen}
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
      <Dialog
        open={isSelectionSubflowDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingSelectionSubflow) return;
          setIsSelectionSubflowDialogOpen(open);
          if (!open) {
            setSelectionSubflowName("");
            setSelectionSubflowError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader className="modal-header">
            <div>
              <p className="eyebrow">Reusable block</p>
              <DialogTitle>Create subflow from selection</DialogTitle>
              <DialogDescription>
                Create a reusable subflow from the selected graph nodes.
              </DialogDescription>
            </div>
          </DialogHeader>
          <label className="field">
            <span>Subflow name</span>
            <Input
              autoFocus
              value={selectionSubflowName}
              onChange={(event) => setSelectionSubflowName(event.currentTarget.value)}
              placeholder="Login block"
            />
          </label>
          {selectionSubflowError ? (
            <p className="graph-subflow-create-error" role="alert">
              {selectionSubflowError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isCreatingSelectionSubflow}
              onClick={() => {
                setIsSelectionSubflowDialogOpen(false);
                setSelectionSubflowName("");
                setSelectionSubflowError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isCreatingSelectionSubflow}
              onClick={() => {
                void createSubflowFromSelection("create_only");
              }}
            >
              Chỉ tạo
            </Button>
            <Button
              type="button"
              disabled={isCreatingSelectionSubflow}
              onClick={() => {
                void createSubflowFromSelection("create_and_replace");
              }}
            >
              Tạo và thay thế
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function cloneGraphEdgeDelay(delay: GraphEdgeDelay | null): GraphEdgeDelay | null {
  return delay ? { ...delay } : null;
}
