import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ViewportPortal,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useUpdateNodeInternals,
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
  ActionConfig,
  ActionType,
  GraphNode,
  GraphNodeType,
  GraphPort,
  GraphValidationIssue,
  RunState,
  WorkflowCondition,
  WorkflowGraph,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import {
  createDefaultGraphNode,
  defaultActionConfig,
  fromReactFlowGraph,
  graphEdgeOrders,
  graphNodeLabel,
  graphIssuesByNode,
  type WorkflowFlowEdge,
  toReactFlowGraph,
  type WorkflowFlowNode,
  type WorkflowFlowNodeStatus,
} from "../lib/workflowGraph";
import { actionGroups, actionLabels } from "../../../lib/workflowUi";
import { ActionConfigEditor } from "./StepForm";

type WorkflowGraphEditorProps = {
  graph: WorkflowGraph;
  isRunning: boolean;
  runState: RunState;
  validationIssues: GraphValidationIssue[];
  onChange: (graph: WorkflowGraph) => void;
  onRunGraph: () => void;
  onSave: () => void;
  onValidate: () => void;
};

type ActivePortConnection = {
  nodeId: string;
  portId: string;
  direction: GraphPort["direction"];
} | null;

const hiddenActionPickerTypes = new Set<ActionType>([
  "if_condition",
  "repeat_times",
  "repeat_for_each",
  "retry_block",
  "stop_workflow",
]);

const actionPickerGroups = actionGroups
  .filter((group) => group.label !== "Logic")
  .map((group) => ({
    ...group,
    actions: group.actions.filter((actionType) => !hiddenActionPickerTypes.has(actionType)),
  }))
  .filter((group) => group.actions.length > 0);

const actionPickerOptions = actionPickerGroups.flatMap((group) => group.actions);

const logicNodeGroups: Array<{
  label: string;
  nodes: GraphNodeType[];
}> = [
  { label: "Branching", nodes: ["if", "switch"] },
  {
    label: "Loops",
    nodes: ["repeat_times", "repeat_for_each", "while", "repeat_until"],
  },
  { label: "Recovery", nodes: ["retry", "try_catch", "fallback"] },
  {
    label: "Flow Control",
    nodes: ["break_loop", "continue_loop", "stop_workflow"],
  },
  {
    label: "Safety",
    nodes: ["manual_approval", "rate_limit", "domain_allowlist"],
  },
];

const variableNodeGroups = [
  { label: "Variables", nodes: ["set_variable", "transform_variable"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

const outputNodeGroups = [
  { label: "Outputs", nodes: ["assert_output", "run_subworkflow"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

const endNodeGroups = [
  { label: "End", nodes: ["end_failure", "stop_workflow"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

const graphNodeDescriptions: Partial<Record<GraphNodeType, string>> = {
  action: "Run a browser, data, session, network, or advanced action.",
  if: "Branch the workflow into True and False paths.",
  switch: "Route execution to a matching case or a default path.",
  repeat_times: "Run a loop path a fixed number of times.",
  repeat_for_each: "Run a loop path once for each item.",
  while: "Repeat while a condition stays true.",
  repeat_until: "Repeat until a condition becomes true or times out.",
  retry: "Retry a path and continue through success or failure.",
  try_catch: "Separate normal work, errors, and final cleanup.",
  fallback: "Try a primary path, then use a fallback path if needed.",
  break_loop: "Exit the current loop.",
  continue_loop: "Skip to the next loop iteration.",
  stop_workflow: "Stop execution with a success or failure status.",
  manual_approval: "Pause for a human checkpoint.",
  rate_limit: "Add safe pacing before continuing.",
  set_variable: "Store a workflow value.",
  transform_variable: "Create an output from an existing value.",
  assert_output: "Require an output value to match an expectation.",
  run_subworkflow: "Run another workflow from this graph.",
  domain_allowlist: "Restrict navigation to allowed domains.",
  end_failure: "End the graph as a failure.",
};

const graphNodeWidth = 160;
const graphNodeHeight = 64;

export function WorkflowGraphEditor({
  graph,
  isRunning,
  runState,
  validationIssues,
  onChange,
  onRunGraph,
  onSave,
  onValidate,
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
  const [helpNode, setHelpNode] = useState<GraphNode | null>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<WorkflowFlowNode, Edge> | null>(null);
  const activePortConnectionRef = useRef<ActivePortConnection>(null);
  const graphRef = useRef(graph);
  const flowGraphRef = useRef<ReturnType<typeof toReactFlowGraph> | null>(null);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
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
  const edgeLabels = useMemo(
    () =>
      graph.edges.map(
        (edge) => `${edge.source_node_id} -> ${edge.target_node_id}`,
      ),
    [graph.edges],
  );
  const startPortConnection = useCallback(
    (nodeId: string, port: GraphPort) => {
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
      setSelectedNodeId(selectedChange.id);
    }
    const nextNodes = applyNodeChanges(changes, flowGraph.nodes);
    syncFlowGraph(nextNodes, flowGraph.edges);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
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
    onChange({
      ...graph,
      edges: graph.edges.filter((edge) => edge.id !== edgeId),
    });
  }

  return (
    <section className="workflow-graph-editor panel" aria-label="Visual Graph">
      <div className="panel-heading workflow-graph-heading">
        <div>
          <p className="eyebrow">Visual Logic</p>
          <h2>Visual Graph</h2>
        </div>
        <div className="graph-header-actions">
          <Button type="button" variant="secondary" onClick={onValidate}>
            Validate Graph
          </Button>
          <Button type="button" onClick={onRunGraph} disabled={isRunning}>
            Run
          </Button>
          <Button type="button" shape="pill" onClick={onSave}>
            Save Graph
          </Button>
        </div>
      </div>

      <div className="graph-toolbar" role="toolbar" aria-label="Graph tools">
        <Button type="button" variant="secondary" onClick={() => setIsActionPaletteOpen(true)}>
          Add Action
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            openNodePalette(
              "Choose a logic node",
              "Add Logic Node",
              "Search logic nodes",
              logicNodeGroups,
            )
          }
        >
          Add Logic
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            openNodePalette(
              "Choose a variable node",
              "Add Variable Node",
              "Search variable nodes",
              variableNodeGroups,
            )
          }
        >
          Add Variable
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            openNodePalette(
              "Choose an output node",
              "Add Output Node",
              "Search output nodes",
              outputNodeGroups,
            )
          }
        >
          Add Output
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            openNodePalette(
              "Choose an end node",
              "Add End Node",
              "Search end nodes",
              endNodeGroups,
            )
          }
        >
          Add End
        </Button>
        <Button type="button" variant="secondary" onClick={() => reactFlowInstance?.fitView()}>
          Fit
        </Button>
      </div>

      <div className="workflow-graph-layout">
        <div className="graph-canvas-wrap">
          <div className="graph-canvas" role="application" aria-label="Workflow graph canvas">
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
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onNodesChange={handleNodesChange}
              panOnDrag={[1, 2]}
            >
              <ViewportPortal>
                <GraphEdgeOverlay graph={graph} issueEdgeIds={issueEdgeIds} />
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

        <aside className="graph-inspector" aria-label="Graph inspector">
          {selectedNode ? (
            <>
              <h2>{selectedNode.label}</h2>
              <p className="muted">{graphNodeLabel(selectedNode.node_type)} node</p>
              <ConnectionSummary graph={graph} node={selectedNode} />
              {issueGroups.get(selectedNode.id)?.length ? (
                <div className="graph-node-issues" aria-label="Selected node issues">
                  {issueGroups.get(selectedNode.id)?.map((issue) => (
                    <p key={`${issue.level}-${issue.message}`}>
                      {issue.level}: {issue.message}
                    </p>
                  ))}
                </div>
              ) : null}
              <NodeConfigFields node={selectedNode} onChange={updateNode} />
              <Button type="button" variant="secondary" onClick={focusSelectedNode}>
                Focus
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={deleteSelectedNode}
                disabled={selectedNode.node_type === "start"}
              >
                Delete Node
              </Button>
            </>
          ) : (
            <p className="muted">Select a graph node.</p>
          )}

          <div className="graph-edge-summary" aria-label="Graph edge summary">
            {graph.edges.map((edge, index) => (
              <span key={edge.id}>
                {edgeLabels[index]}
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`Delete edge ${edgeLabels[index]}`}
                  onClick={() => deleteEdge(edge.id)}
                >
                  Delete
                </Button>
              </span>
            ))}
          </div>
        </aside>
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

type GraphEdgeOverlayProps = {
  graph: WorkflowGraph;
  issueEdgeIds: Set<string>;
};

function GraphEdgeOverlay({ graph, issueEdgeIds }: GraphEdgeOverlayProps) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeOrders = graphEdgeOrders(graph);

  return (
    <svg
      aria-label="Visible workflow graph edges"
      className="graph-edge-overlay"
      focusable="false"
      role="img"
    >
      {graph.edges.map((edge) => {
        const sourceNode = nodeById.get(edge.source_node_id);
        const targetNode = nodeById.get(edge.target_node_id);
        if (!sourceNode || !targetNode) return null;

        const sourcePoint = edgePoint(sourceNode, edge.source_port, "output");
        const targetPoint = edgePoint(targetNode, edge.target_port, "input");
        const order = edgeOrders.get(edge.id);
        const hasIssue = issueEdgeIds.has(edge.id);
        const labelX = (sourcePoint.x + targetPoint.x) / 2;
        const labelY = (sourcePoint.y + targetPoint.y) / 2;

        return (
          <g
            aria-label={`Visible edge ${sourceNode.label} to ${targetNode.label}`}
            className={hasIssue ? "graph-visible-edge graph-visible-edge-issue" : "graph-visible-edge"}
            key={edge.id}
            role="img"
          >
            <path d={edgePath(sourcePoint, targetPoint)} />
            {order ? (
              <g
                aria-label={`Edge direction order ${order}`}
                className="graph-visible-edge-order"
                role="img"
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
  onPortPointerDown: (nodeId: string, port: GraphPort) => void;
  onPortPointerUp: (nodeId: string, port: GraphPort) => void;
};

function WorkflowGraphNode({
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
          onPointerDown={() => onPortPointerDown(id, port)}
          position={Position.Right}
          style={{ top: portOffset(index, outputPorts.length) }}
          type="source"
        />
      ))}
    </div>
  );
}

type GraphNodePaletteProps = {
  palette: {
    title: string;
    eyebrow: string;
    searchLabel: string;
    groups: Array<{ label: string; nodes: GraphNodeType[] }>;
  } | null;
  onOpenChange: (open: boolean) => void;
  onSelectNode: (nodeType: GraphNodeType) => void;
};

function GraphNodePalette({
  palette,
  onOpenChange,
  onSelectNode,
}: GraphNodePaletteProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();
  const groups = palette?.groups ?? [];
  const nodeOptions = groups.flatMap((group) => group.nodes);

  const visibleNodes = useMemo(() => {
    const sourceNodes =
      activeCategory === "All"
        ? nodeOptions
        : groups.find((group) => group.label === activeCategory)?.nodes ?? [];

    if (!normalizedQuery) return sourceNodes;

    return nodeOptions.filter((nodeType) => {
      const label = graphNodeLabel(nodeType).toLowerCase();
      const description = (graphNodeDescriptions[nodeType] ?? "").toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [activeCategory, groups, nodeOptions, normalizedQuery]);

  function resetPalette() {
    setQuery("");
    setActiveCategory("All");
  }

  return (
    <Dialog
      open={Boolean(palette)}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetPalette();
      }}
    >
      <DialogContent className="add-step-palette">
        <DialogHeader>
          <p className="eyebrow">{palette?.eyebrow}</p>
          <DialogTitle>{palette?.title}</DialogTitle>
          <DialogDescription>
            Search or browse categories, then choose a node to add it to the graph.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label={palette?.searchLabel}
          placeholder="Search nodes..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="add-step-palette-body">
          <div aria-label="Node categories" className="action-category-list">
            {["All", ...groups.map((group) => group.label)].map((label) => (
              <Button
                aria-pressed={activeCategory === label && !normalizedQuery}
                className={
                  activeCategory === label && !normalizedQuery
                    ? "action-category action-category-active"
                    : "action-category"
                }
                key={label}
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveCategory(label);
                  setQuery("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <div aria-label="Node results" className="action-result-list">
            {visibleNodes.length === 0 ? (
              <p className="muted">No matching nodes</p>
            ) : (
              visibleNodes.map((nodeType) => (
                <Button
                  className="action-result"
                  data-value={nodeType}
                  key={nodeType}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSelectNode(nodeType);
                    resetPalette();
                  }}
                >
                  <span>{graphNodeLabel(nodeType)}</span>
                  <small>{graphNodeDescriptions[nodeType]}</small>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NodeContextMenuProps = {
  node: GraphNode | null;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onFocus: () => void;
  onHelp: () => void;
  onDelete: () => void;
};

function NodeContextMenu({
  node,
  x,
  y,
  onClose,
  onEdit,
  onRename,
  onDuplicate,
  onFocus,
  onHelp,
  onDelete,
}: NodeContextMenuProps) {
  if (!node) return null;
  const canDelete = node.node_type !== "start";

  return (
    <div
      aria-label="Node actions"
      className="graph-node-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <button type="button" role="menuitem" onClick={onEdit}>
        Edit
      </button>
      <button type="button" role="menuitem" onClick={onRename}>
        Rename
      </button>
      <button type="button" role="menuitem" onClick={onDuplicate}>
        Duplicate
      </button>
      <button type="button" role="menuitem" onClick={onFocus}>
        Focus
      </button>
      <button type="button" role="menuitem" onClick={onHelp}>
        Help
      </button>
      <button type="button" role="menuitem" onClick={onDelete} disabled={!canDelete}>
        Delete
      </button>
    </div>
  );
}

type NodeHelpDialogProps = {
  node: GraphNode | null;
  onOpenChange: (open: boolean) => void;
};

function NodeHelpDialog({ node, onOpenChange }: NodeHelpDialogProps) {
  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow">Node Help</p>
          <DialogTitle>{node ? graphNodeLabel(node.node_type) : "Node"}</DialogTitle>
          <DialogDescription>
            {node ? graphNodeDescriptions[node.node_type] ?? "Graph node" : ""}
          </DialogDescription>
        </DialogHeader>
        {node ? (
          <div className="graph-help-ports">
            {node.ports.map((port) => (
              <span key={port.id}>{port.label}</span>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type ConnectionSummaryProps = {
  graph: WorkflowGraph;
  node: GraphNode;
};

function ConnectionSummary({ graph, node }: ConnectionSummaryProps) {
  const incoming = graph.edges.filter((edge) => edge.target_node_id === node.id);
  const outgoing = graph.edges.filter((edge) => edge.source_node_id === node.id);
  const nodeLabels = new Map(graph.nodes.map((item) => [item.id, item.label]));

  return (
    <section className="graph-connection-summary" aria-label="Node connections">
      <h3>Connections</h3>
      {incoming.length ? (
        incoming.map((edge) => (
          <span key={edge.id}>
            Incoming from {nodeLabels.get(edge.source_node_id) ?? edge.source_node_id}
          </span>
        ))
      ) : (
        <span>No incoming link</span>
      )}
      {outgoing.length ? (
        outgoing.map((edge) => (
          <span key={edge.id}>
            {portLabel(node, edge.source_port)} to{" "}
            {nodeLabels.get(edge.target_node_id) ?? edge.target_node_id}
          </span>
        ))
      ) : (
        <span>No outgoing link</span>
      )}
    </section>
  );
}

type ActionNodePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (actionType: ActionType) => void;
};

const commonActionTypes: ActionType[] = [
  "navigate",
  "click",
  "input_text",
  "wait",
  "extract_text",
  "take_screenshot",
];

const actionDescriptions: Record<ActionType, string> = {
  navigate: "Open a page",
  wait: "Pause or wait for a condition",
  input_text: "Fill a field",
  clear_input: "Clear a field",
  click: "Click an element",
  scroll: "Move the page or an element",
  select_option: "Choose a native select option",
  set_checkbox: "Set checkbox state",
  press_key: "Press one key",
  hotkey: "Press a keyboard shortcut",
  hover: "Move over an element",
  double_click: "Double click an element",
  right_click: "Open a context click",
  drag_and_drop: "Drag one element to another",
  focus_element: "Focus an element",
  blur_element: "Remove focus from an element",
  type_sequence: "Type text as a sequence",
  set_clipboard: "Store clipboard text",
  paste_clipboard: "Paste stored clipboard text",
  check: "Check a checkbox",
  uncheck: "Uncheck a checkbox",
  toggle_checkbox: "Toggle a checkbox",
  select_radio: "Select a radio option",
  upload_file: "Upload a local file",
  submit_form: "Submit a form",
  select_custom_option: "Choose a custom dropdown option",
  set_contenteditable: "Fill editable content",
  extract_text: "Capture page text",
  extract_attribute: "Capture an element attribute",
  extract_input_value: "Capture a field value",
  extract_table: "Capture table data",
  extract_list: "Capture repeated items",
  take_screenshot: "Save visual evidence",
  go_back: "Go back in history",
  go_forward: "Go forward in history",
  reload: "Reload the page",
  open_new_tab: "Open a browser tab",
  switch_tab: "Change the active tab",
  close_tab: "Close a browser tab",
  switch_frame: "Target an iframe",
  accept_dialog: "Accept a browser dialog",
  dismiss_dialog: "Dismiss a browser dialog",
  set_download_directory: "Choose download location",
  wait_for_download: "Wait for a download",
  set_variable: "Store a workflow value",
  assert_element: "Require an element state",
  assert_text: "Require matching text",
  if_condition: "Run steps conditionally",
  repeat_times: "Repeat nested steps",
  repeat_for_each: "Repeat for each item",
  retry_block: "Retry a group of steps",
  stop_workflow: "Stop execution",
  use_profile: "Use a browser profile",
  save_session: "Save browser session",
  load_session: "Load browser session",
  set_cookie: "Set a browser cookie",
  clear_cookies: "Clear browser cookies",
  set_secret: "Store a secret value",
  use_proxy: "Route traffic through a proxy",
  set_user_agent: "Set user agent string",
  set_viewport: "Set viewport size",
  set_geolocation: "Set location data",
  set_extra_headers: "Attach request headers",
  grant_permission: "Grant browser permission",
  detect_challenge: "Detect human verification",
  pause_for_human: "Pause for manual action",
  resume_when_condition: "Resume after a condition",
  fallback_selector: "Use a fallback selector",
  retry_step: "Retry one flaky step",
  checkpoint: "Save a recovery point",
  execute_js: "Run JavaScript",
  wait_for_request: "Wait for a request",
  wait_for_response: "Wait for a response",
  block_request: "Block matching requests",
  mock_response: "Mock a response",
  set_local_storage: "Set local storage",
  set_session_storage: "Set session storage",
};

function ActionNodePalette({
  open,
  onOpenChange,
  onSelectAction,
}: ActionNodePaletteProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleActions = useMemo(() => {
    const sourceActions =
      activeCategory === "All"
        ? actionPickerOptions
        : activeCategory === "Common"
        ? commonActionTypes
        : actionPickerGroups.find((group) => group.label === activeCategory)?.actions ?? [];

    if (!normalizedQuery) return sourceActions;

    return actionPickerOptions.filter((actionType) => {
      const label = actionLabels[actionType].toLowerCase();
      const description = actionDescriptions[actionType].toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [activeCategory, normalizedQuery]);

  function resetPalette() {
    setQuery("");
    setActiveCategory("All");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetPalette();
      }}
    >
      <DialogContent className="add-step-palette">
        <DialogHeader>
          <p className="eyebrow">Add Action Node</p>
          <DialogTitle>Choose an action type</DialogTitle>
          <DialogDescription>
            Search or browse categories, then choose an action to add it to the graph.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Search actions"
          placeholder="Search actions..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="add-step-palette-body">
          <div aria-label="Action categories" className="action-category-list">
            {["All", "Common", ...actionPickerGroups.map((group) => group.label)].map((label) => (
              <Button
                aria-pressed={activeCategory === label && !normalizedQuery}
                className={
                  activeCategory === label && !normalizedQuery
                    ? "action-category action-category-active"
                    : "action-category"
                }
                key={label}
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveCategory(label);
                  setQuery("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <div aria-label="Action results" className="action-result-list">
            {visibleActions.length === 0 ? (
              <p className="muted">No matching actions</p>
            ) : (
              visibleActions.map((actionType) => (
                <Button
                  className="action-result"
                  data-value={actionType}
                  key={actionType}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSelectAction(actionType);
                    resetPalette();
                  }}
                >
                  <span>{actionLabels[actionType]}</span>
                  <small>{actionDescriptions[actionType]}</small>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NodeConfigFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
};

function NodeConfigFields({ node, onChange }: NodeConfigFieldsProps) {
  function updateConfig(config: unknown) {
    onChange({ ...node, config });
  }

  function updateActionType(actionType: ActionType) {
    onChange({
      ...node,
      label: actionLabels[actionType],
      config: defaultActionConfig(actionType),
    });
  }

  switch (node.node_type) {
    case "if":
      return (
        <div className="graph-config-fields">
          <ConditionFields
            condition={conditionFromConfig(node.config)}
            onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
          />
        </div>
      );
    case "repeat_until":
    case "while":
      return (
        <div className="graph-config-fields">
          <ConditionFields
            condition={conditionFromConfig(node.config)}
            onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
          />
          <Label>
            Loop max attempts
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "max_attempts", 10)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  max_attempts: Number(event.currentTarget.value) || 1,
                })
              }
            />
          </Label>
          <Label>
            Loop timeout ms
            <Input
              min="0"
              type="number"
              value={numberConfig(node.config, "timeout_ms", 0)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  timeout_ms: Number(event.currentTarget.value) || null,
                })
              }
            />
          </Label>
        </div>
      );
    case "switch": {
      const cases = arrayConfig(node.config, "cases");
      return (
        <div className="graph-config-fields">
          <Label>
            Switch expression
            <Input
              value={stringConfig(node.config, "expression", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  expression: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Switch cases
            <Textarea
              value={cases.join("\n")}
              onChange={(event) => {
                const nextCases = event.currentTarget.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean);
                onChange({
                  ...node,
                  config: {
                    ...objectConfig(node.config),
                    cases: nextCases,
                  },
                  ports: switchPortsForCases(nextCases),
                });
              }}
            />
          </Label>
        </div>
      );
    }
    case "repeat_times":
      return (
        <div className="graph-config-fields">
          <Label>
            Times
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "times", 1)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  times: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </div>
      );
    case "repeat_for_each":
      return (
        <div className="graph-config-fields">
          <Label>
            Item name
            <Input
              value={stringConfig(node.config, "item_name", "item")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  item_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Items
            <Textarea
              value={arrayConfig(node.config, "items").join("\n")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  items: event.currentTarget.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </Label>
        </div>
      );
    case "retry":
      return (
        <div className="graph-config-fields">
          <Label>
            Max attempts
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "max_attempts", 3)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  max_attempts: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="0"
              type="number"
              value={numberConfig(node.config, "delay_ms", 100)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  delay_ms: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </div>
      );
    case "manual_approval":
      return (
        <div className="graph-config-fields">
          <p className="muted">Human checkpoint only; this does not bypass challenges.</p>
          <Label>
            Approval reason
            <Textarea
              value={stringConfig(node.config, "reason", "Manual approval required")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  reason: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Timeout ms
            <Input
              min="0"
              type="number"
              value={numberConfig(node.config, "timeout_ms", 0)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  timeout_ms: Number(event.currentTarget.value) || null,
                })
              }
            />
          </Label>
        </div>
      );
    case "rate_limit":
      return (
        <div className="graph-config-fields">
          <p className="muted">Adds safe pacing before continuing.</p>
          <Label>
            Delay ms
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "delay_ms", 1000)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  delay_ms: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </div>
      );
    case "end_failure":
      return (
        <div className="graph-config-fields">
          <Label>
            Failure reason
            <Input
              value={stringConfig(node.config, "reason", "Graph reached failure end")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  reason: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "stop_workflow":
      return (
        <div className="graph-config-fields">
          <Label>
            Status
            <Select
              value={stringConfig(node.config, "status", "success")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  status: event.currentTarget.value,
                })
              }
            >
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </Select>
          </Label>
          <Label>
            Reason
            <Input
              value={stringConfig(node.config, "reason", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  reason: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "set_variable":
      return (
        <div className="graph-config-fields">
          <Label>
            Variable name
            <Input
              value={stringConfig(node.config, "name", "variable")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Value
            <Input
              value={stringConfig(node.config, "value", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  value: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "transform_variable":
      return (
        <div className="graph-config-fields">
          <Label>
            Source output
            <Input
              value={stringConfig(node.config, "source_name", "input")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  source_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Target output
            <Input
              value={stringConfig(node.config, "target_name", "output")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  target_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Expression
            <Textarea
              value={stringConfig(node.config, "expression", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  expression: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "assert_output":
      return (
        <div className="graph-config-fields">
          <Label>
            Output name
            <Input
              value={stringConfig(node.config, "name", "output")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Match
            <Select
              value={stringConfig(node.config, "match", "equals")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  match: event.currentTarget.value,
                })
              }
            >
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
            </Select>
          </Label>
          <Label>
            Expected value
            <Input
              value={stringConfig(node.config, "value", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  value: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "run_subworkflow":
      return (
        <div className="graph-config-fields">
          <Label>
            Workflow id
            <Input
              value={stringConfig(node.config, "workflow_id", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  workflow_id: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "domain_allowlist":
      return (
        <div className="graph-config-fields">
          <Label>
            Allowed domains
            <Textarea
              value={arrayConfig(node.config, "domains").join("\n")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  domains: event.currentTarget.value
                    .split("\n")
                    .map((domain) => domain.trim())
                    .filter(Boolean),
                })
              }
            />
          </Label>
        </div>
      );
    case "try_catch":
    case "fallback":
    case "break_loop":
    case "continue_loop":
      return (
        <div className="graph-config-fields">
          <p className="muted">
            Configure this node by connecting its named ports on the canvas.
          </p>
        </div>
      );
    case "action":
      if (!isActionConfig(node.config)) return null;
      return (
        <div className="graph-config-fields">
          <Label>
            Action type
            <Select
              value={node.config.type}
              onChange={(event) =>
                updateActionType(event.currentTarget.value as ActionType)
              }
            >
              {actionPickerGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((actionType) => (
                    <option key={actionType} value={actionType}>
                      {actionLabels[actionType]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Label>
          <ActionConfigEditor
            config={node.config}
            onChange={(config) => updateConfig(config)}
          />
        </div>
      );
    default:
      return null;
  }
}

function isActionConfig(config: unknown): config is ActionConfig {
  return Boolean(
    config &&
      typeof config === "object" &&
      "type" in config &&
      "config" in config,
  );
}

type ConditionFieldsProps = {
  condition: WorkflowCondition;
  onChange: (condition: WorkflowCondition) => void;
};

function ConditionFields({ condition, onChange }: ConditionFieldsProps) {
  return (
    <>
      <Label>
        Condition kind
        <Select
          value={condition.kind}
          onChange={(event) => onChange(defaultCondition(event.currentTarget.value))}
        >
          <option value="output_equals">Output equals</option>
          <option value="output_contains">Output contains</option>
          <option value="text_visible">Text visible</option>
          <option value="url_contains">URL contains</option>
          <option value="element_visible">Element visible</option>
        </Select>
      </Label>
      {condition.kind === "output_equals" || condition.kind === "output_contains" ? (
        <>
          <Label>
            Output name
            <Input
              value={condition.name}
              onChange={(event) =>
                onChange({ ...condition, name: event.currentTarget.value })
              }
            />
          </Label>
          <Label>
            Value
            <Input
              value={condition.value}
              onChange={(event) =>
                onChange({ ...condition, value: event.currentTarget.value })
              }
            />
          </Label>
        </>
      ) : null}
      {condition.kind === "text_visible" ? (
        <Label>
          Text
          <Input
            value={condition.text}
            onChange={(event) =>
              onChange({ ...condition, text: event.currentTarget.value })
            }
          />
        </Label>
      ) : null}
      {condition.kind === "url_contains" ? (
        <Label>
          URL contains
          <Input
            value={condition.value}
            onChange={(event) =>
              onChange({ ...condition, value: event.currentTarget.value })
            }
          />
        </Label>
      ) : null}
      {condition.kind === "element_visible" ? (
        <Label>
          XPath
          <Input
            value={condition.xpath}
            onChange={(event) =>
              onChange({ ...condition, xpath: event.currentTarget.value })
            }
          />
        </Label>
      ) : null}
    </>
  );
}

function conditionFromConfig(config: unknown): WorkflowCondition {
  const condition = objectConfig(config).condition;
  if (isWorkflowCondition(condition)) return condition;
  return { kind: "output_equals", name: "name", value: "" };
}

function defaultCondition(kind: string): WorkflowCondition {
  switch (kind) {
    case "output_contains":
      return { kind: "output_contains", name: "name", value: "" };
    case "text_visible":
      return { kind: "text_visible", text: "" };
    case "url_contains":
      return { kind: "url_contains", value: "" };
    case "element_visible":
      return { kind: "element_visible", xpath: "" };
    default:
      return { kind: "output_equals", name: "name", value: "" };
  }
}

function isWorkflowCondition(value: unknown): value is WorkflowCondition {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  return [
    "output_equals",
    "output_contains",
    "text_visible",
    "url_contains",
    "element_visible",
  ].includes(String((value as { kind: unknown }).kind));
}

function objectConfig(config: unknown): Record<string, unknown> {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function stringConfig(config: unknown, key: string, fallback: string) {
  const value = objectConfig(config)[key];
  return typeof value === "string" ? value : fallback;
}

function numberConfig(config: unknown, key: string, fallback: number) {
  const value = objectConfig(config)[key];
  return typeof value === "number" ? value : fallback;
}

function arrayConfig(config: unknown, key: string) {
  const value = objectConfig(config)[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function portsByDirection(
  ports: GraphPort[],
  direction: GraphPort["direction"],
) {
  return ports.filter((port) => port.direction === direction);
}

function portLabel(node: GraphNode, portId: string) {
  const label = node.ports.find((port) => port.id === portId)?.label ?? portId;
  if (label.toLowerCase() === "out") return "Next";
  return label;
}

function switchPortsForCases(cases: string[]): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...cases.map((_, index) => ({
      id: `case_${index + 1}`,
      label: `Case ${index + 1}`,
      direction: "output" as const,
    })),
    { id: "default", label: "Default", direction: "output" },
  ];
}

type GraphEdgePoint = {
  x: number;
  y: number;
};

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

function edgePath(source: GraphEdgePoint, target: GraphEdgePoint) {
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
