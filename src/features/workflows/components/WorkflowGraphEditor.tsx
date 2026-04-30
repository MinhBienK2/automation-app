import { useEffect, useMemo, useState } from "react";
import type {
  ActionConfig,
  ActionType,
  GraphEdge,
  GraphNode,
  GraphNodeType,
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
  graphNodeLabel,
  nodePorts,
} from "../lib/workflowGraph";
import { actionGroups, actionLabels, actionOptions } from "../../../lib/workflowUi";
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

const paletteNodes: GraphNodeType[] = [
  "action",
  "if",
  "repeat_times",
  "repeat_for_each",
  "retry",
  "manual_approval",
  "rate_limit",
];

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
  const [selectedNodeId, setSelectedNodeId] = useState(graph.nodes[0]?.id ?? "");
  const [sourceNodeId, setSourceNodeId] = useState(graph.nodes[0]?.id ?? "");
  const [targetNodeId, setTargetNodeId] = useState(graph.nodes[1]?.id ?? "");
  const [sourcePortId, setSourcePortId] = useState("");
  const [targetPortId, setTargetPortId] = useState("");
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const sourceNode = graph.nodes.find((node) => node.id === sourceNodeId) ?? null;
  const targetNode = graph.nodes.find((node) => node.id === targetNodeId) ?? null;
  const sourcePorts = outputPorts(sourceNode);
  const targetPorts = inputPorts(targetNode);
  const edgeLabels = useMemo(
    () =>
      graph.edges.map(
        (edge) => `${edge.source_node_id} -> ${edge.target_node_id}`,
      ),
    [graph.edges],
  );

  useEffect(() => {
    if (!sourcePorts.some((port) => port.id === sourcePortId)) {
      setSourcePortId(sourcePorts[0]?.id ?? "");
    }
  }, [sourcePortId, sourcePorts]);

  useEffect(() => {
    if (!targetPorts.some((port) => port.id === targetPortId)) {
      setTargetPortId(targetPorts[0]?.id ?? "");
    }
  }, [targetPortId, targetPorts]);

  function addNode(nodeType: GraphNodeType) {
    const node = createDefaultGraphNode(nodeType, {
      x: 120 + graph.nodes.length * 48,
      y: 120 + graph.nodes.length * 16,
    });
    onChange({ ...graph, nodes: [...graph.nodes, node] });
    setSelectedNodeId(node.id);
    setTargetNodeId(node.id);
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
    setTargetNodeId(node.id);
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
    onChange({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== selectedNode.id),
      edges: graph.edges.filter(
        (edge) =>
          edge.source_node_id !== selectedNode.id &&
          edge.target_node_id !== selectedNode.id,
      ),
    });
    const fallback = graph.nodes.find((node) => node.id !== selectedNode.id);
    setSelectedNodeId(fallback?.id ?? "");
  }

  function moveSelectedNode(deltaX: number, deltaY: number) {
    if (!selectedNode) return;
    updateNode({
      ...selectedNode,
      position: {
        x: selectedNode.position.x + deltaX,
        y: selectedNode.position.y + deltaY,
      },
    });
  }

  function connectNodes() {
    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return;
    const sourcePort = sourcePorts.find((port) => port.id === sourcePortId);
    const targetPort = targetPorts.find((port) => port.id === targetPortId);
    if (!sourcePort || !targetPort) return;

    const nextEdge: GraphEdge = {
      id: `edge-${sourceNode.id}-${sourcePort.id}-${targetNode.id}-${targetPort.id}`,
      source_node_id: sourceNode.id,
      source_port: sourcePort.id,
      target_node_id: targetNode.id,
      target_port: targetPort.id,
      label: sourcePort.label.toLowerCase(),
      condition: null,
    };

    onChange({
      ...graph,
      edges: [
        ...graph.edges.filter((edge) => edge.id !== nextEdge.id),
        nextEdge,
      ],
    });
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

      <div className="workflow-graph-layout">
        <aside className="graph-palette" aria-label="Graph node palette">
          {paletteNodes.map((nodeType) => (
            <Button
              key={nodeType}
              type="button"
              variant="secondary"
              onClick={() => {
                if (nodeType === "action") {
                  setIsActionPaletteOpen(true);
                  return;
                }
                addNode(nodeType);
              }}
            >
              Add {graphNodeLabel(nodeType)}
            </Button>
          ))}
        </aside>

        <div className="graph-canvas-wrap">
          <div className="graph-canvas" role="application" aria-label="Workflow graph canvas">
            <svg className="graph-edge-layer" aria-hidden="true">
              {graph.edges.map((edge) => {
                const source = graph.nodes.find((node) => node.id === edge.source_node_id);
                const target = graph.nodes.find((node) => node.id === edge.target_node_id);
                if (!source || !target) return null;
                return (
                  <line
                    key={edge.id}
                    x1={source.position.x + 128}
                    y1={source.position.y + 30}
                    x2={target.position.x}
                    y2={target.position.y + 30}
                  />
                );
              })}
            </svg>
            {graph.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                aria-label={`Graph canvas node ${node.id}`}
                className={
                  selectedNodeId === node.id
                    ? `graph-node graph-node-selected ${graphRunClass(node.id, runState)}`
                    : `graph-node ${graphRunClass(node.id, runState)}`
                }
                style={{
                  transform: `translate(${node.position.x}px, ${node.position.y}px)`,
                }}
                onClick={() => setSelectedNodeId(node.id)}
              >
                {node.label}
              </button>
            ))}
          </div>
          <div className="graph-minimap" aria-label="Graph minimap">
            {graph.nodes.length} nodes / {graph.edges.length} edges
          </div>
        </div>

        <aside className="graph-inspector" aria-label="Graph inspector">
          {selectedNode ? (
            <>
              <h2>{selectedNode.label}</h2>
              <p className="muted">{graphNodeLabel(selectedNode.node_type)} node</p>
              <div className="graph-port-list">
                {selectedNode.ports.map((port) => (
                  <span key={port.id}>
                    {port.direction}: {port.id}
                  </span>
                ))}
              </div>
              <NodeConfigFields node={selectedNode} onChange={updateNode} />
              <div className="graph-move-actions">
                <Button type="button" variant="secondary" onClick={() => moveSelectedNode(-24, 0)}>
                  Move Left
                </Button>
                <Button type="button" variant="secondary" onClick={() => moveSelectedNode(24, 0)}>
                  Move Right
                </Button>
              </div>
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

          <div className="graph-connect-form">
            <h3>Connect</h3>
            <Label>
              Source node
              <Select
                value={sourceNodeId}
                onChange={(event) => setSourceNodeId(event.currentTarget.value)}
              >
                {graph.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.id}
                  </option>
                ))}
              </Select>
            </Label>
            <Label>
              Source port
              <Select
                value={sourcePortId}
                onChange={(event) => setSourcePortId(event.currentTarget.value)}
              >
                {sourcePorts.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.id}
                  </option>
                ))}
              </Select>
            </Label>
            <Label>
              Target node
              <Select
                value={targetNodeId}
                onChange={(event) => setTargetNodeId(event.currentTarget.value)}
              >
                {graph.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.id}
                  </option>
                ))}
              </Select>
            </Label>
            <Label>
              Target port
              <Select
                value={targetPortId}
                onChange={(event) => setTargetPortId(event.currentTarget.value)}
              >
                {targetPorts.map((port) => (
                  <option key={port.id} value={port.id}>
                    {port.id}
                  </option>
                ))}
              </Select>
            </Label>
            <Button type="button" onClick={connectNodes}>
              Connect Nodes
            </Button>
          </div>

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

      <div className="graph-runtime-grid">
        <GraphValidationPanel issues={validationIssues} />
        <GraphTimelinePanel runState={runState} />
        <GraphOutputInspector graph={graph} />
      </div>

      <ActionNodePalette
        open={isActionPaletteOpen}
        onOpenChange={setIsActionPaletteOpen}
        onSelectAction={addActionNode}
      />
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
        ? actionOptions
        : activeCategory === "Common"
        ? commonActionTypes
        : actionGroups.find((group) => group.label === activeCategory)?.actions ?? [];

    if (!normalizedQuery) return sourceActions;

    return actionOptions.filter((actionType) => {
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
            {["All", "Common", ...actionGroups.map((group) => group.label)].map((label) => (
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

type GraphValidationPanelProps = {
  issues: GraphValidationIssue[];
};

function GraphValidationPanel({ issues }: GraphValidationPanelProps) {
  return (
    <section className="graph-runtime-panel" aria-label="Graph validation">
      <h3>Graph validation</h3>
      {issues.length ? (
        <div className="graph-runtime-list">
          {issues.map((issue) => (
            <div key={`${issue.level}-${issue.node_id ?? issue.edge_id}-${issue.message}`}>
              <span className={`graph-issue-level graph-issue-${issue.level}`}>
                {issue.level}
              </span>
              {issue.node_id ? <span>{issue.node_id}</span> : null}
              {issue.edge_id ? <span>{issue.edge_id}</span> : null}
              <p>{issue.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Graph is valid.</p>
      )}
    </section>
  );
}

type GraphTimelinePanelProps = {
  runState: RunState;
};

function GraphTimelinePanel({ runState }: GraphTimelinePanelProps) {
  const completed = runState.completed_step_ids.length
    ? runState.completed_step_ids.join(", ")
    : "none";

  return (
    <section className="graph-runtime-panel" aria-label="Graph run timeline">
      <h3>Graph run timeline</h3>
      <div className="graph-runtime-list">
        <p>Status: {runState.status}</p>
        <p>Current: {runState.current_step_id ?? "none"}</p>
        <p>Completed: {completed}</p>
        {runState.error ? <p>Error: {runState.error.reason}</p> : null}
      </div>
    </section>
  );
}

type GraphOutputInspectorProps = {
  graph: WorkflowGraph;
};

function GraphOutputInspector({ graph }: GraphOutputInspectorProps) {
  const outputs = outputNamesFromGraph(graph);

  return (
    <section className="graph-runtime-panel" aria-label="Output inspector">
      <h3>Output inspector</h3>
      <div className="graph-output-chips">
        <span>loop.index</span>
        <span>loop.number</span>
        <span>item</span>
        {outputs.map((output) => (
          <span key={output}>{output}</span>
        ))}
      </div>
      {outputs.length ? null : <p className="muted">No captured outputs yet</p>}
    </section>
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
    case "repeat_until":
    case "while":
      return (
        <div className="graph-config-fields">
          <ConditionFields
            condition={conditionFromConfig(node.config)}
            onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
          />
        </div>
      );
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
              {actionGroups.map((group) => (
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

function outputPorts(node: GraphNode | null) {
  if (!node) return [];
  const ports = node.ports.length ? node.ports : nodePorts(node.node_type);
  return ports.filter((port) => port.direction === "output");
}

function inputPorts(node: GraphNode | null) {
  if (!node) return [];
  const ports = node.ports.length ? node.ports : nodePorts(node.node_type);
  return ports.filter((port) => port.direction === "input");
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

function graphRunClass(nodeId: string, runState: RunState) {
  if (runState.error?.step_id === nodeId) return "graph-node-failed";
  if (runState.current_step_id === nodeId) return "graph-node-running";
  if (runState.completed_step_ids.includes(nodeId)) return "graph-node-completed";
  return "";
}

function outputNamesFromGraph(graph: WorkflowGraph) {
  const names = new Set<string>();

  graph.nodes.forEach((node) => {
    const config = objectConfig(node.config);
    const outputName = config.output_name;
    const name = config.name;

    if (typeof outputName === "string" && !looksSensitive(outputName)) {
      names.add(outputName);
    }
    if (node.node_type === "set_variable" && typeof name === "string" && !looksSensitive(name)) {
      names.add(name);
    }
  });

  return Array.from(names).sort();
}

function looksSensitive(value: string) {
  return /secret|password|token|credential|api[_-]?key/i.test(value);
}
