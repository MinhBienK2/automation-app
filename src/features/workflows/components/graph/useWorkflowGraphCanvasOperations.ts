import type { RefObject } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type {
  ActionType,
  GraphNode,
  GraphNodeType,
  RunState,
  SubflowSummary,
  WorkflowGraph,
} from "../../../../types/workflow";
import type {
  GraphSelection,
  NodePaletteState,
  SubflowAddMode,
  WorkflowFlowEdge,
  WorkflowFlowNode,
} from "../../lib/workflowGraphUi";
import { createDefaultGraphNode } from "../../lib/workflowGraph";
import { deleteGraphSelection } from "../../lib/graphEditorCommands";
import { edgePortsExist } from "../../lib/graphEditorEdges";
import { getVisibleNodeInsertionPosition } from "../../lib/nodeInsertionPosition";
import { insertSubflowGraphNodes } from "../../lib/subflowSelection";
import { defaultActionConfig } from "../../lib/workflowActionDefaults";
import { layoutWorkflowGraph } from "../../lib/graphLayout";
import { actionLabels, commandMessage } from "../../../../lib/workflowUi";

export type UseWorkflowGraphCanvasOperationsProps = {
  graphRef: RefObject<WorkflowGraph>;
  selectionRef: RefObject<GraphSelection>;
  reactFlowInstance: ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null;
  graphCanvasRef: RefObject<HTMLDivElement | null>;
  runState: RunState;
  selectedNode: GraphNode | null;
  selectedEdge: WorkflowGraph["edges"][number] | null;
  onLoadSubflowGraph?: (subflowId: string) => Promise<WorkflowGraph>;
  commitGraphChange: (nextGraph: WorkflowGraph, nextSelection?: GraphSelection) => void;
  setSelection: (selection: GraphSelection) => void;
  setContextMenu: (menu: null) => void;
  setLinkContextMenu: (updater: ((current: { edgeId: string } | null) => null) | null) => void;
  setHelpNode: (node: GraphNode | null) => void;
  setNodePalette: (palette: NodePaletteState | null) => void;
  setIsActionPaletteOpen: (open: boolean) => void;
  setIsSubflowPaletteOpen: (open: boolean) => void;
  setSubflowInsertError: (error: string | null) => void;
  setIsInsertingSubflowNodes: (inserting: boolean) => void;
  isArrangingGraph: boolean;
  setIsArrangingGraph: (arranging: boolean) => void;
  setArrangeError: (error: string | null) => void;
  execCopySelection: (graph: WorkflowGraph, selection: GraphSelection) => void;
  execDuplicateSelection: (graph: WorkflowGraph, selection: GraphSelection) => { graph: WorkflowGraph; selection: GraphSelection };
  execPasteClipboard: (graph: WorkflowGraph) => { graph: WorkflowGraph; selection: GraphSelection } | null;
};

export function useWorkflowGraphCanvasOperations(props: UseWorkflowGraphCanvasOperationsProps) {
  const {
    graphRef,
    selectionRef,
    reactFlowInstance,
    graphCanvasRef,
    runState,
    selectedNode,
    selectedEdge,
    onLoadSubflowGraph,
    commitGraphChange,
    setSelection,
    setContextMenu,
    setLinkContextMenu,
    setHelpNode,
    setNodePalette,
    setIsActionPaletteOpen,
    setIsSubflowPaletteOpen,
    setSubflowInsertError,
    setIsInsertingSubflowNodes,
    isArrangingGraph,
    setIsArrangingGraph,
    setArrangeError,
    execCopySelection,
    execDuplicateSelection,
    execPasteClipboard,
  } = props;

  function addNode(nodeType: GraphNodeType) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
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
    if (!currentGraph) return;
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
    if (!currentGraph) return;
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
      if (!currentGraph) return;
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

  function addSubflowNode(subflow: SubflowSummary, mode: SubflowAddMode = "call_node") {
    if (mode === "insert_nodes") {
      void insertSubflowNodes(subflow);
      return;
    }
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
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

  function updateNode(nextNode: GraphNode) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
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
    if (!currentGraph) return;
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

  function deleteNode(nodeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const nodeToDelete = currentGraph.nodes.find((node) => node.id === nodeId);
    if (!nodeToDelete || nodeToDelete.node_type === "start") return;
    const result = deleteGraphSelection(currentGraph, {
      nodeIds: [nodeId],
      edgeIds: [],
    });
    commitGraphChange(result.graph, result.selection);
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.node_type === "start") return;
    deleteNode(selectedNode.id);
  }

  function duplicateNode(nodeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const result = execDuplicateSelection(currentGraph, {
      nodeIds: [nodeId],
      edgeIds: [],
    });
    commitGraphChange(result.graph, result.selection);
    setContextMenu(null);
  }

  function duplicateSelection() {
    if (runState.status === "running") return;
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const result = execDuplicateSelection(currentGraph, selectionRef.current);
    commitGraphChange(result.graph, result.selection);
  }

  function copySelection() {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    execCopySelection(currentGraph, selectionRef.current);
  }

  function pasteClipboard() {
    if (runState.status === "running") return;
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const result = execPasteClipboard(currentGraph);
    if (result) {
      commitGraphChange(result.graph, result.selection);
    }
  }

  function deleteSelection() {
    if (runState.status === "running") return;
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const result = deleteGraphSelection(currentGraph, selectionRef.current);
    commitGraphChange(result.graph, result.selection);
  }

  function openNodeHelp(nodeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const node = currentGraph.nodes.find((item) => item.id === nodeId) ?? null;
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
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const result = deleteGraphSelection(currentGraph, {
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

  async function arrangeGraph() {
    setIsArrangingGraph(true);
    setArrangeError(null);
    const layoutSource = graphRef.current;
    if (!layoutSource) return;
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

  async function autoArrangeGraph() {
    if (runState.status === "running" || isArrangingGraph) return;
    await arrangeGraph();
    reactFlowInstance?.fitView({ duration: 240, padding: 0.18 });
  }

  return {
    addNode,
    addNewNode,
    addActionNode,
    addSubflowNode,
    insertSubflowNodes,
    updateNode,
    updateEdge,
    deleteNode,
    deleteSelectedNode,
    duplicateNode,
    duplicateSelection,
    copySelection,
    pasteClipboard,
    deleteSelection,
    openNodeHelp,
    openNodePalette,
    deleteEdge,
    deleteSelectedEdge,
    closeInspector,
    arrangeGraph,
    autoArrangeGraph,
  };
}
