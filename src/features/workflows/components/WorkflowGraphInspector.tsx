import { useState } from "react";
import { ClipboardCopy, ExternalLink, X, ChevronRight, HelpCircle } from "lucide-react";
import type {
  GraphEdge,
  GraphNode,
  GraphValidationIssue,
  RunState,
  SubflowSummary,
  WorkflowGraph,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { IconButton } from "../../../components/ui/icon-button";
import { Input } from "../../../components/ui/input";
import { NumberInput } from "../../../components/ui/number-input";
import { Select } from "../../../components/ui/select";
import { callSubflowIdFromNode, graphNodeLabel } from "../lib/workflowGraph";
import { objectConfig } from "../lib/configUtils";
import { NodeConfigFields } from "./WorkflowGraphInspectorFields";
import type { ActionConfig } from "../../../types/workflow";
import { VariableOptionsContext, type VariableOption } from "./TemplateTextField";

type SelectionSummary = {
  nodeCount: number;
  edgeCount: number;
};

type WorkflowGraphInspectorProps = {
  graph: WorkflowGraph;
  issueGroups: Map<string, GraphValidationIssue[]>;
  nodeLabels: Map<string, string>;
  runState: RunState;
  selectionSummary: SelectionSummary | null;
  selectedEdge: GraphEdge | null;
  selectedNode: GraphNode | null;
  subflowOptions?: SubflowSummary[];
  onCopySelection: () => void;
  onCreateSubflowFromSelection?: () => void;
  onDeleteSelection: () => void;
  onDeleteSelectedEdge: () => void;
  onDeleteSelectedNode: () => void;
  onDuplicateSelection: () => void;
  onFocusSelectedNode: () => void;
  onOpenSelectedNodeHelp: () => void;
  onOpenSubflowDetail?: (subflowId: string) => void;
  onClose: () => void;
  onUpdateEdge: (edge: GraphEdge) => void;
  onUpdateNode: (node: GraphNode) => void;
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
  onToggleCollapse?: () => void;
};

export function WorkflowGraphInspector({
  graph,
  issueGroups,
  nodeLabels,
  runState,
  selectionSummary,
  selectedEdge,
  selectedNode,
  subflowOptions = [],
  onCopySelection,
  onCreateSubflowFromSelection,
  onDeleteSelection,
  onDeleteSelectedEdge,
  onDeleteSelectedNode,
  onDuplicateSelection,
  onFocusSelectedNode,
  onOpenSelectedNodeHelp,
  onOpenSubflowDetail,
  onClose,
  onUpdateEdge,
  onUpdateNode,
  initialVariables,
  profileVariables,
  onToggleCollapse,
}: WorkflowGraphInspectorProps) {
  const variableOptions = collectVariableOptions(graph, selectedNode, initialVariables, profileVariables);
  const [runErrorDetailsVisible, setRunErrorDetailsVisible] = useState(false);
  const selectedRunError =
    selectedNode && runState.error?.step_id === selectedNode.id
      ? runState.error
      : null;
  const selectedSubflowId = callSubflowIdFromNode(selectedNode);
  const selectedSubflow = selectedSubflowId
    ? subflowOptions.find((subflow) => subflow.id === selectedSubflowId) ?? null
    : null;
  const selectedSubflowName = selectedSubflow?.name ?? selectedNode?.label ?? "selected subflow";

  return (
    <VariableOptionsContext.Provider value={variableOptions}>
      <div className="graph-inspector" aria-label="Graph inspector">
      <div className="graph-inspector-shell-header">
        <p className="eyebrow">Inspector</p>
        <div style={{ display: "flex", gap: "4px" }}>
          {onToggleCollapse && (
            <IconButton
              variant="ghost"
              type="button"
              label="Collapse"
              onClick={onToggleCollapse}
            >
              <ChevronRight aria-hidden="true" />
            </IconButton>
          )}
          <IconButton
            className="graph-inspector-close"
            variant="ghost"
            type="button"
            label="Close inspector"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {selectionSummary ? (
        <section className="graph-selected-edge" aria-label="Graph selection summary">
          <h2>Selection</h2>
          <p>
            {selectionSummary.nodeCount} nodes selected /{" "}
            {selectionSummary.edgeCount} links selected
          </p>
          <Button type="button" variant="secondary" onClick={onDuplicateSelection}>
            Duplicate selection
          </Button>
          <Button type="button" variant="secondary" onClick={onCopySelection}>
            Copy selection
          </Button>
          {onCreateSubflowFromSelection && selectionSummary.nodeCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onCreateSubflowFromSelection}
              disabled={runState.status === "running"}
            >
              Create subflow
            </Button>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            onClick={onDeleteSelection}
            disabled={runState.status === "running"}
          >
            Delete selection
          </Button>
        </section>
      ) : null}
      {selectedEdge ? (
        <section className="graph-selected-edge" aria-label="Selected link">
          <p>
            Selected link: {nodeLabels.get(selectedEdge.source_node_id) ?? selectedEdge.source_node_id}
            {" -> "}
            {nodeLabels.get(selectedEdge.target_node_id) ?? selectedEdge.target_node_id}
          </p>
          <fieldset disabled={runState.status === "running"} className="contents">
            <LinkWaitFields edge={selectedEdge} onChange={onUpdateEdge} />
          </fieldset>
          <Button
            type="button"
            variant="destructive"
            onClick={onDeleteSelectedEdge}
            disabled={runState.status === "running"}
          >
            Delete selected link
          </Button>
        </section>
      ) : null}
      {!selectionSummary && selectedNode ? (
        <>
          <div className="graph-inspector-header">
            <div>
              <h2>{selectedNode.label}</h2>
              <p className="muted">{graphNodeLabel(selectedNode.node_type)} node</p>
            </div>
            <IconButton
              className="step-help-button"
              variant="ghost"
              type="button"
              label={`Open ${selectedNode.label} help`}
              tooltip="Open help guide"
              onClick={onOpenSelectedNodeHelp}
            >
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </IconButton>
          </div>
          <fieldset disabled={runState.status === "running"} className="contents">
            {selectedNode.node_type !== "start" ? (
              <label className="field">
                <span>Node name</span>
                <Input
                  value={selectedNode.label}
                  onChange={(event) =>
                    onUpdateNode({
                      ...selectedNode,
                      label: event.currentTarget.value,
                    })
                  }
                />
              </label>
            ) : null}
            {issueGroups.get(selectedNode.id)?.length ? (
              <div className="graph-node-issues" aria-label="Selected node issues">
                {issueGroups.get(selectedNode.id)?.map((issue) => (
                  <p key={`${issue.level}-${issue.message}`}>
                    {issue.level}: {issue.message}
                  </p>
                ))}
              </div>
            ) : null}
            {selectedRunError ? (
              <section className="graph-last-run-error" aria-label="Last run error">
                <div className="graph-error-card-header">
                  <Badge variant="destructive">Runtime failure</Badge>
                  <h3>Last run error</h3>
                </div>
                <p className="graph-error-context">
                  Step {selectedRunError.step_number}:{" "}
                  {selectedRunError.step_name ?? selectedNode.label}
                </p>
                <p className="graph-error-summary">
                  {summarizeRunError(selectedRunError.reason)}
                </p>
                <div className="graph-error-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setRunErrorDetailsVisible((current) => !current)}
                  >
                    {runErrorDetailsVisible ? "Hide details" : "View details"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyRunError(selectedRunError.reason)}
                  >
                    <ClipboardCopy aria-hidden="true" />
                    Copy details
                  </Button>
                </div>
                {runErrorDetailsVisible ? (
                  <pre className="graph-error-details">{selectedRunError.reason}</pre>
                ) : null}
              </section>
            ) : null}
            <NodeConfigFields
              node={selectedNode}
              onChange={onUpdateNode}
              subflowOptions={subflowOptions}
              variableOptions={variableOptions}
            />
          </fieldset>
          <div className="graph-inspector-actions" aria-label="Selected node actions">
            {selectedSubflowId && onOpenSubflowDetail ? (
              <Button
                type="button"
                variant="secondary"
                aria-label={`Open subflow ${selectedSubflowName}`}
                onClick={() => onOpenSubflowDetail(selectedSubflowId)}
              >
                <ExternalLink aria-hidden="true" />
                Open subflow
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onFocusSelectedNode}>
              Focus
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDeleteSelectedNode}
              disabled={runState.status === "running" || selectedNode.node_type === "start"}
            >
              Delete Node
            </Button>
          </div>
        </>
      ) : !selectionSummary && !selectedEdge ? (
        <p className="muted">Select a graph node.</p>
      ) : null}

      </div>
    </VariableOptionsContext.Provider>
  );
}

function LinkWaitFields({
  edge,
  onChange,
}: {
  edge: GraphEdge;
  onChange: (edge: GraphEdge) => void;
}) {
  const delay = edge.delay ?? null;
  const mode = delay?.type ?? "none";
  return (
    <div className="settings-form-grid">
      <label className="field">
        <span>Link wait</span>
        <Select
          value={mode}
          onChange={(event) => {
            const nextMode = event.currentTarget.value;
            if (nextMode === "fixed") {
              onChange({ ...edge, delay: { type: "fixed", duration_ms: 1000 } });
              return;
            }
            if (nextMode === "random") {
              onChange({ ...edge, delay: { type: "random", min_ms: 800, max_ms: 1500 } });
              return;
            }
            onChange({ ...edge, delay: null });
          }}
        >
          <option value="none">No wait</option>
          <option value="fixed">Fixed duration</option>
          <option value="random">Random range</option>
        </Select>
      </label>
      {delay?.type === "fixed" ? (
        <label className="field">
          <span>Fixed duration ms</span>
          <NumberInput
            value={delay.duration_ms}
            fallback={1000}
            min={1}
            onChange={(val) =>
              onChange({
                ...edge,
                delay: {
                  type: "fixed",
                  duration_ms: val ?? 1000,
                },
              })
            }
          />
        </label>
      ) : null}
      {delay?.type === "random" ? (
        <>
          <label className="field">
            <span>Random min ms</span>
            <NumberInput
              value={delay.min_ms}
              fallback={800}
              min={1}
              onChange={(val) =>
                onChange({
                  ...edge,
                  delay: {
                    type: "random",
                    min_ms: val ?? 800,
                    max_ms: delay.max_ms,
                  },
                })
              }
            />
          </label>
          <label className="field">
            <span>Random max ms</span>
            <NumberInput
              value={delay.max_ms}
              fallback={1500}
              min={1}
              onChange={(val) =>
                onChange({
                  ...edge,
                  delay: {
                    type: "random",
                    min_ms: delay.min_ms,
                    max_ms: val ?? 1500,
                  },
                })
              }
            />
          </label>
        </>
      ) : null}
    </div>
  );
}




function summarizeRunError(reason: string) {
  const firstLine = reason
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? reason.trim();
  if (firstLine.length <= 160) return firstLine;
  return `${firstLine.slice(0, 157)}...`;
}

function copyRunError(reason: string) {
  void navigator.clipboard?.writeText(reason);
}

export function collectVariableOptions(
  graph: WorkflowGraph,
  selectedNode?: GraphNode | null,
  initialVariables?: Array<{ name: string; value: string }> | null,
  profileVariables?: Array<{ name: string; value: string }> | null,
): VariableOption[] {
  const options: VariableOption[] = [];

  if (initialVariables) {
    for (const v of initialVariables) {
      if (v.name?.trim()) {
        options.push({ name: v.name.trim(), source: "Workflow Settings Env", type: "text" });
      }
    }
  }

  if (profileVariables) {
    for (const v of profileVariables) {
      if (v.name?.trim()) {
        options.push({ name: v.name.trim(), source: "Profile Env", type: "text" });
      }
    }
  }

  let allowedNodeIds: Set<string> | null = null;
  if (selectedNode) {
    allowedNodeIds = new Set<string>();
    const predecessors = new Map<string, string[]>();
    for (const edge of graph.edges) {
      let list = predecessors.get(edge.target_node_id);
      if (!list) {
        list = [];
        predecessors.set(edge.target_node_id, list);
      }
      list.push(edge.source_node_id);
    }

    const visited = new Set<string>();
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const preds = predecessors.get(current) ?? [];
      for (const pred of preds) {
        if (!visited.has(pred)) {
          visited.add(pred);
          allowedNodeIds.add(pred);
          queue.push(pred);
        }
      }
    }
  }

  for (const node of graph.nodes) {
    if (allowedNodeIds && !allowedNodeIds.has(node.id)) {
      continue;
    }

    const config = objectConfig(node.config);
    const outputName = typeof config.output_name === "string" ? config.output_name.trim() : "";
    if (outputName) {
      options.push({
        name: outputName,
        source: node.label || graphNodeLabel(node.node_type),
        evaluation_type: config.evaluation_type === "dynamic" ? "dynamic" : "static",
        type: getVariableTypeForNodeType(node.node_type),
      });
    }

    if (node.node_type === "set_variable") {
      const config = objectConfig(node.config);
      const rows = Array.isArray(config.variables) ? config.variables : [];
      for (const row of rows) {
        if (row && typeof row === "object" && "name" in row) {
          const name = String(row.name ?? "").trim();
          const valType = String((row as any).value_type ?? "text");
          if (name) options.push({ name, source: "Set Variables", type: mapValueType(valType) });
        }
      }
      const singleName = typeof config.name === "string" ? config.name.trim() : "";
      const singleType = String(config.value_type ?? "text");
      if (singleName) options.push({ name: singleName, source: "Set Variables", type: mapValueType(singleType) });
      for (const name of variableNamesFromSerializedConfig(node.config)) {
        options.push({ name, source: "Set Variables", type: "text" });
      }
    }

    if (node.node_type === "set_json_variables") {
      const json = objectConfig(node.config).json;
      if (typeof json === "string") {
        options.push(...jsonVariableOptions(json));
      }
    }

    const isVariableUpdate = [
      "update_variable",
      "update_number_variable",
      "update_text_variable",
      "update_flag_variable",
      "update_list_variable",
      "update_object_variable",
    ].includes(node.node_type);
    if (isVariableUpdate) {
      const name = objectConfig(node.config).name;
      if (typeof name === "string" && name.trim()) {
        let type: "text" | "number" | "boolean" | "list" | "object" | undefined;
        const nodeTypeStr = node.node_type as string;
        if (nodeTypeStr === "update_number_variable") type = "number";
        else if (nodeTypeStr === "update_text_variable") type = "text";
        else if (nodeTypeStr === "update_flag_variable") type = "boolean";
        else if (nodeTypeStr === "update_list_variable") type = "list";
        else if (nodeTypeStr === "update_object_variable") type = "object";
        options.push({ name: name.trim(), source: "Update Variable", type });
      }
    }

    if (node.node_type === "repeat_for_each") {
      const config = objectConfig(node.config);
      const itemName = typeof config.item_name === "string" ? config.item_name.trim() : "";
      if (itemName) {
        options.push({ name: itemName, source: "Loop variable" });
      }
    }

    if (node.node_type === "action" && isActionConfig(node.config)) {
      const outputName = outputNameForAction(node.config);
      if (outputName) options.push({ name: outputName, source: node.label, type: "text" });
    }

    if (node.node_type === "get_current_url" || (node.node_type === "action" && isActionConfig(node.config) && node.config.type === "get_current_url")) {
      options.push(
        { name: "system.current_url", source: "Get Current URL", type: "text" },
      );
    }
  }

  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.name?.trim()) return false;
    option.name = option.name.trim();
    const key = `${option.source}:${option.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getVariableTypeForNodeType(nodeType: string): "text" | "number" | "boolean" | "list" | "object" | undefined {
  if ([
    "set_boolean_variable", "generate_random_boolean", "parse_to_boolean",
    "boolean_logical_op", "compare_booleans", "check_boolean_property",
    "check_object_key_exists", "check_object_empty", "check_list_empty",
    "check_list_contains", "check_list_any_match", "check_list_all_match",
    "check_text_empty", "check_text_contains", "check_text_regex_matches"
  ].includes(nodeType)) {
    return "boolean";
  }
  if ([
    "set_number_variable", "generate_random_number", "parse_text_to_number",
    "math_operation", "round_number", "format_number",
    "get_list_length", "get_text_length"
  ].includes(nodeType)) {
    return "number";
  }
  if ([
    "create_empty_list", "create_list_manual", "split_text_to_list",
    "generate_number_range", "slice_list", "filter_list",
    "map_list_property", "sort_reverse_list",
    "get_object_keys", "get_object_values"
  ].includes(nodeType)) {
    return "list";
  }
  if ([
    "create_empty_object", "create_object_manual", "parse_json_to_object",
    "execute_object_script", "execute_list_script"
  ].includes(nodeType)) {
    return "object";
  }
  if ([
    "set_text_variable", "slice_text", "regex_extract", "join_list", "stringify_object", "get_current_url"
  ].includes(nodeType)) {
    return "text";
  }
  return undefined;
}

function mapValueType(valType: string): "text" | "number" | "boolean" | "list" | "object" {
  if (valType === "json") return "object";
  if (valType === "number") return "number";
  if (valType === "boolean") return "boolean";
  return "text";
}

function variableNamesFromSerializedConfig(config: unknown) {
  const matches = JSON.stringify(config).matchAll(/"name"\s*:\s*"([^"]+)"/g);
  return [...matches]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function getValueAtPath(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function jsonVariableOptions(json: string): VariableOption[] {
  try {
    const value = JSON.parse(json);
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return flattenObjectKeys(value).map((name) => {
      const val = getValueAtPath(value, name);
      const valType = typeof val;
      let type: "text" | "number" | "boolean" | "list" | "object" | undefined;
      if (valType === "number") type = "number";
      else if (valType === "boolean") type = "boolean";
      else if (Array.isArray(val)) type = "list";
      else if (val && valType === "object") type = "object";
      else if (valType === "string") type = "text";
      return {
        name,
        source: "Set JSON Variables",
        type,
      };
    });
  } catch {
    return [];
  }
}

function flattenObjectKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return flattenObjectKeys(item as Record<string, unknown>, path);
    }
    return [path];
  });
}

function outputNameForAction(config: ActionConfig) {
  const maybeOutput = config.config as { output_name?: unknown };
  return typeof maybeOutput.output_name === "string" && maybeOutput.output_name.trim()
    ? maybeOutput.output_name.trim()
    : null;
}

function isActionConfig(config: unknown): config is ActionConfig {
  return Boolean(
    config &&
      typeof config === "object" &&
      "type" in config &&
      "config" in config,
  );
}
