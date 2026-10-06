import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider, useViewport } from "@xyflow/react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphNode, GraphNodeType, WorkflowGraph } from "../../../../types/workflow";
import { fromReactFlowGraph, type WorkflowFlowEdge, type WorkflowFlowNode } from "../../lib/workflowGraph";
import type { GraphSelection } from "../../lib/graphEditorCommands";
import type { GraphNodeHelpLanguage } from "../../lib/graphNodeHelpContent";
import { useWorkflowGraphHistory } from "../../hooks/useWorkflowGraphHistory";
import { useWorkflowGraphClipboard } from "../../hooks/useWorkflowGraphClipboard";
import { useWorkflowGraphShortcuts } from "../hooks/useWorkflowGraphShortcuts";
import { useSelectionSubflowCreator } from "../hooks/useSelectionSubflowCreator";
import { useWorkflowGraphDerivedState } from "../hooks/useWorkflowGraphDerivedState";
import { WorkflowGraphToolbar } from "./WorkflowGraphToolbar";
import { WorkflowGraphEditorOverlays } from "./WorkflowGraphEditorOverlays";
import { WorkflowGraphInspectorDrawer } from "./WorkflowGraphInspectorDrawer";
import { WorkflowGraphCanvasView } from "./WorkflowGraphCanvasView";
import { useWorkflowGraphCanvasOperations } from "./useWorkflowGraphCanvasOperations";
import { useWorkflowGraphFlowBridge } from "./useWorkflowGraphFlowBridge";
import type { WorkflowGraphEditorProps, GraphSelectionRequest } from "./WorkflowGraphEditorTypes";

export type { GraphSelectionRequest };


export function WorkflowGraphEditor(props: WorkflowGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowGraphEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowGraphEditorInner({
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
  const {
    copySelection: execCopySelection,
    pasteClipboard: execPasteClipboard,
    duplicateSelection: execDuplicateSelection,
  } = useWorkflowGraphClipboard();
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
  const handleZoomChange = useCallback((level: number) => {
    reactFlowInstance?.zoomTo(level, { duration: 150 });
  }, [reactFlowInstance]);
  const { zoom } = useViewport();

  const editorRef = useRef<HTMLElement | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const isGraphShortcutActiveRef = useRef(false);
  const graphRef = useRef(graph);
  const selectionRef = useRef(selection);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const {
    commitHistoryChange,
    undo,
    redo,
    updatePresent,
    resetHistory,
  } = useWorkflowGraphHistory(graph);

  useEffect(() => {
    graphRef.current = graph;
    updatePresent(graph);
  }, [graph, updatePresent]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  function commitGraphChange(
    nextGraph: WorkflowGraph,
    nextSelection: GraphSelection = selectionRef.current,
    options: { pushHistory?: boolean } = {},
  ) {
    const shouldPushHistory = options.pushHistory ?? true;
    graphRef.current = nextGraph;
    if (shouldPushHistory) {
      commitHistoryChange(nextGraph);
    } else {
      resetHistory(nextGraph);
    }
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection(nextSelection);
    onChange(nextGraph);
  }

  function syncFlowGraph(nodes: Node[], edges: Edge[]) {
    const currentGraph = graphRef.current;
    commitGraphChange(
      fromReactFlowGraph(currentGraph, nodes, edges, currentGraph.viewport),
      selectionRef.current,
    );
  }

  function undoGraphEdit() {
    if (runState.status === "running") return;
    const nextPresent = undo();
    if (!nextPresent) return;
    graphRef.current = nextPresent;
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    onChange(nextPresent);
  }

  function redoGraphEdit() {
    if (runState.status === "running") return;
    const nextPresent = redo();
    if (!nextPresent) return;
    graphRef.current = nextPresent;
    setContextMenu(null);
    setLinkContextMenu(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    onChange(nextPresent);
  }

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

  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);

  useEffect(() => {
    if (selectedNodeId || selection.edgeIds.length > 0 || selection.nodeIds.length > 0) {
      setIsInspectorCollapsed(false);
    }
  }, [selectedNodeId, selection.edgeIds.length, selection.nodeIds.length]);

  useEffect(() => {
    onSelectedNodeChange?.(selectedNodeId);
  }, [onSelectedNodeChange, selectedNodeId]);

  const canvasOps = useWorkflowGraphCanvasOperations({
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
  });

  const {
    addNode,
    addNewNode,
    addActionNode,
    addSubflowNode,
    updateNode,
    deleteSelectedNode,
    deleteNode,
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
  } = canvasOps;

  const flowBridge = useWorkflowGraphFlowBridge({
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
  });

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

  return (
    <section
      ref={editorRef}
      className="workflow-graph-editor panel"
      aria-label="Visual Graph"
      onFocusCapture={() => {
        isGraphShortcutActiveRef.current = true;
      }}
      onBlurCapture={(event) => {
        if (!editorRef.current?.contains(event.relatedTarget as Node | null)) {
          isGraphShortcutActiveRef.current = false;
        }
      }}
    >
      <WorkflowGraphToolbar
        graphKind={graphKind}
        isArranging={isArrangingGraph}
        isPanMode={isPanMode}
        isReadOnly={runState.status === "running"}
        onAddAction={() => setIsActionPaletteOpen(true)}
        onAddNewNode={addNewNode}
        onAddSubflow={() => setIsSubflowPaletteOpen(true)}
        onAutoArrange={autoArrangeGraph}
        onFitView={() => reactFlowInstance?.fitView({ duration: 200, padding: 0.15 })}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenShortcuts={() => setIsShortcutGuideOpen(true)}
        onOpenNodePalette={openNodePalette}
        onRedo={redoGraphEdit}
        onResetZoom={() => reactFlowInstance?.zoomTo(1, { duration: 200 })}
        onSelectMode={() => {
          setIsToolbarPanMode(false);
          setIsSpacePanActive(false);
        }}
        onTogglePanMode={() => setIsToolbarPanMode((v) => !v)}
        onUndo={undoGraphEdit}
        nodeCount={graph.nodes.length}
        edgeCount={graph.edges.length}
        arrangeError={arrangeError}
        zoom={zoom}
        onZoomChange={handleZoomChange}
      />

      <div className={
        [
          "workflow-graph-layout",
          inspectorOpen && !isInspectorCollapsed ? "inspector-open" : "",
        ]
          .filter(Boolean)
          .join(" ")
      }>
        <WorkflowGraphCanvasView
          isPanMode={isPanMode}
          clearPreviewConnection={flowBridge.clearPreviewConnection}
          graphCanvasRef={graphCanvasRef}
          flowGraphViewport={flowGraph.viewport}
          reactFlowEdges={flowBridge.reactFlowEdges}
          reactFlowNodes={flowBridge.reactFlowNodes}
          workflowEdgeTypes={flowBridge.workflowEdgeTypes}
          workflowNodeTypes={flowBridge.workflowNodeTypes}
          runState={runState}
          graphNodesCount={graph.nodes.length}
          handleConnect={flowBridge.handleConnect}
          handleEdgeClick={flowBridge.handleEdgeClick}
          handleEdgesChange={flowBridge.handleEdgesChange}
          setReactFlowInstance={setReactFlowInstance}
          handleNodesChange={flowBridge.handleNodesChange}
          selectNodeFromEvent={flowBridge.selectNodeFromEvent}
          syncFlowGraph={syncFlowGraph}
          commitGraphChange={commitGraphChange}
          graphRef={graphRef}
          selectionRef={selectionRef}
          reactFlowNodesRef={flowBridge.reactFlowNodesRef}
          reactFlowEdgesRef={flowBridge.reactFlowEdgesRef}
          setSelection={setSelection}
          setLinkContextMenu={setLinkContextMenu}
          setContextMenu={setContextMenu}
          contextMenu={contextMenu}
          contextMenuNode={contextMenuNode}
          contextMenuSubflowName={contextMenuSubflowName}
          contextMenuSubflowId={contextMenuSubflowId}
          linkContextMenu={linkContextMenu}
          graph={graph}
          onOpenSubflowDetail={onOpenSubflowDetail}
          duplicateNode={duplicateNode}
          openNodeHelp={openNodeHelp}
          deleteNode={deleteNode}
          deleteEdge={deleteEdge}
          onDragOver={flowBridge.onDragOver}
          onDrop={flowBridge.onDrop}
        />

        <WorkflowGraphInspectorDrawer
          inspectorOpen={inspectorOpen}
          isInspectorCollapsed={isInspectorCollapsed}
          setIsInspectorCollapsed={setIsInspectorCollapsed}
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
          graphKind={graphKind}
          onCreateSubflowFromSelection={onCreateSubflowFromSelection}
          openSelectionSubflowDialog={openSelectionSubflowDialog}
          onCopySelection={copySelection}
          onDeleteSelection={deleteSelection}
          onDeleteSelectedEdge={deleteSelectedEdge}
          onDeleteSelectedNode={deleteSelectedNode}
          onDuplicateSelection={duplicateSelection}
          onFocusSelectedNode={flowBridge.focusSelectedNode}
          setHelpNode={setHelpNode}
          onOpenSubflowDetail={onOpenSubflowDetail}
          closeInspector={closeInspector}
          updateEdge={updateEdge}
          updateNode={updateNode}
        />
      </div>
      <WorkflowGraphEditorOverlays
        ownerId={ownerId}
        graphKind={graphKind}
        isHistoryOpen={isHistoryOpen}
        setIsHistoryOpen={setIsHistoryOpen}
        graph={graph}
        onSaveGraph={onSaveGraph}
        onRestoreRevision={onRestoreRevision}
        onChange={onChange}
        isActionPaletteOpen={isActionPaletteOpen}
        setIsActionPaletteOpen={setIsActionPaletteOpen}
        addActionNode={addActionNode}
        isSubflowPaletteOpen={isSubflowPaletteOpen}
        setIsSubflowPaletteOpen={setIsSubflowPaletteOpen}
        subflowOptions={subflowOptions}
        subflowInsertError={subflowInsertError}
        setSubflowInsertError={setSubflowInsertError}
        isInsertingSubflowNodes={isInsertingSubflowNodes}
        addSubflowNode={addSubflowNode}
        nodePalette={nodePalette}
        setNodePalette={setNodePalette}
        addNode={addNode}
        helpNode={helpNode}
        setHelpNode={setHelpNode}
        helpLanguage={helpLanguage}
        setHelpLanguage={setHelpLanguage}
        isShortcutGuideOpen={isShortcutGuideOpen}
        setIsShortcutGuideOpen={setIsShortcutGuideOpen}
        isSelectionSubflowDialogOpen={isSelectionSubflowDialogOpen}
        setIsSelectionSubflowDialogOpen={setIsSelectionSubflowDialogOpen}
        isCreatingSelectionSubflow={isCreatingSelectionSubflow}
        selectionSubflowName={selectionSubflowName}
        selectionSubflowError={selectionSubflowError}
        setSelectionSubflowName={setSelectionSubflowName}
        resetSelectionSubflowDialog={resetSelectionSubflowDialog}
        createSubflowFromSelection={createSubflowFromSelection}
      />
    </section>
  );
}
