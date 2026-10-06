import type { ReactNode, RefObject } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
} from "@xyflow/react";
import type {
  Connection,
  EdgeChange,
  EdgeTypes,
  NodeChange,
  NodeTypes,
  ReactFlowInstance,
  Viewport,
} from "@xyflow/react";
import type {
  GraphNode,
  RunState,
  WorkflowGraph,
} from "../../../../types/workflow";
import type {
  GraphSelection,
  WorkflowFlowEdge,
  WorkflowFlowNode,
} from "../../lib/workflowGraph";
import { execCopySelection } from "../../lib/workflowGraph";
import { NodeContextMenu, LinkContextMenu } from "./WorkflowGraphContextMenus";
import { graphMiniMapNodeLimit } from "./WorkflowGraphEditorTypes";

export type WorkflowGraphCanvasViewProps = {
  isPanMode: boolean;
  clearPreviewConnection: () => void;
  graphCanvasRef: RefObject<HTMLDivElement | null>;
  flowGraphViewport: Viewport;
  reactFlowEdges: WorkflowFlowEdge[];
  reactFlowNodes: WorkflowFlowNode[];
  workflowEdgeTypes: EdgeTypes;
  workflowNodeTypes: NodeTypes;
  runState: RunState;
  graphNodesCount: number;
  handleConnect: (connection: Connection) => void;
  handleEdgeClick: (event: unknown, edge: WorkflowFlowEdge) => void;
  handleEdgesChange: (changes: EdgeChange<WorkflowFlowEdge>[]) => void;
  setReactFlowInstance: (instance: ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null) => void;
  handleNodesChange: (changes: NodeChange<WorkflowFlowNode>[]) => void;
  selectNodeFromEvent: (event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }, nodeId: string) => void;
  syncFlowGraph: (nodes: unknown[], edges: unknown[]) => void;
  commitGraphChange: (nextGraph: WorkflowGraph, nextSelection?: GraphSelection, options?: { pushHistory?: boolean }) => void;
  graphRef: RefObject<WorkflowGraph>;
  selectionRef: RefObject<GraphSelection>;
  reactFlowNodesRef: RefObject<WorkflowFlowNode[]>;
  reactFlowEdgesRef: RefObject<WorkflowFlowEdge[]>;
  setSelection: (selection: GraphSelection) => void;
  setLinkContextMenu: (menu: { edgeId: string; x: number; y: number } | null) => void;
  setContextMenu: (menu: { nodeId: string; x: number; y: number } | null) => void;
  contextMenu: { nodeId: string; x: number; y: number } | null;
  contextMenuNode: GraphNode | null;
  contextMenuSubflowName: string | null;
  contextMenuSubflowId: string | null;
  linkContextMenu: { edgeId: string; x: number; y: number } | null;
  graph: WorkflowGraph;
  onOpenSubflowDetail?: (subflowId: string) => void;
  duplicateNode: (nodeId: string) => void;
  openNodeHelp: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
};

export function WorkflowGraphCanvasView(props: WorkflowGraphCanvasViewProps): ReactNode {
  const {
    isPanMode,
    clearPreviewConnection,
    graphCanvasRef,
    flowGraphViewport,
    reactFlowEdges,
    reactFlowNodes,
    workflowEdgeTypes,
    workflowNodeTypes,
    runState,
    graphNodesCount,
    handleConnect,
    handleEdgeClick,
    handleEdgesChange,
    setReactFlowInstance,
    handleNodesChange,
    selectNodeFromEvent,
    syncFlowGraph,
    commitGraphChange,
    graphRef,
    selectionRef,
    reactFlowNodesRef,
    reactFlowEdgesRef,
    setSelection,
    setLinkContextMenu,
    setContextMenu,
    contextMenu,
    contextMenuNode,
    contextMenuSubflowName,
    contextMenuSubflowId,
    linkContextMenu,
    graph,
    onOpenSubflowDetail,
    duplicateNode,
    openNodeHelp,
    deleteNode,
    deleteEdge,
    onDragOver,
    onDrop,
  } = props;

  const showGraphMiniMap = graphNodesCount <= graphMiniMapNodeLimit;

  return (
    <div
      className="graph-canvas-wrap"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
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
          defaultViewport={flowGraphViewport}
          minZoom={0.1}
          edges={reactFlowEdges}
          edgeTypes={workflowEdgeTypes}
          fitView
          connectionDragThreshold={0}
          connectionRadius={32}
          nodes={reactFlowNodes}
          nodesConnectable={runState.status !== "running"}
          nodesDraggable={runState.status !== "running"}
          nodeTypes={workflowNodeTypes}
          onlyRenderVisibleElements={graphNodesCount > graphMiniMapNodeLimit}
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
          onMoveEnd={(_, viewport) => {
            const currentGraph = graphRef.current;
            if (currentGraph) {
              commitGraphChange({ ...currentGraph, viewport }, selectionRef.current, {
                pushHistory: false,
              });
            }
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            setLinkContextMenu(null);
            setSelection({ nodeIds: [node.id], edgeIds: [] });
            setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
          }}
          onNodeClick={(event, node) => selectNodeFromEvent(event, node.id)}
          onNodeDragStop={() =>
            syncFlowGraph(reactFlowNodesRef.current ?? [], reactFlowEdgesRef.current ?? [])
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
              const current = graphRef.current;
              if (current) {
                execCopySelection(current, {
                  nodeIds: [contextMenu.nodeId],
                  edgeIds: [],
                });
              }
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
  );
}
