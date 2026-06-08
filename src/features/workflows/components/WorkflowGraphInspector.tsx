import { useState } from "react";
import { ClipboardCopy, ExternalLink, X } from "lucide-react";
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
import { Select } from "../../../components/ui/select";
import { callSubflowIdFromNode, graphNodeLabel } from "../lib/workflowGraph";
import { objectConfig } from "../lib/configUtils";
import { NodeConfigFields } from "./WorkflowGraphInspectorFields";
import type { ActionConfig } from "../../../types/workflow";
import type { VariableOption } from "./TemplateTextField";

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
}: WorkflowGraphInspectorProps) {
  const variableOptions = collectVariableOptions(graph);
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
    <div className="graph-inspector" aria-label="Graph inspector">
      <div className="graph-inspector-shell-header">
        <p className="eyebrow">Inspector</p>
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
          <Button type="button" variant="destructive" onClick={onDeleteSelection}>
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
          <LinkWaitFields edge={selectedEdge} onChange={onUpdateEdge} />
          <Button
            type="button"
            variant="destructive"
            onClick={onDeleteSelectedEdge}
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
            <Button
              aria-label={`Open ${selectedNode.label} help`}
              className="step-help-button"
              type="button"
              onClick={onOpenSelectedNodeHelp}
            >
              ?
            </Button>
          </div>
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
              disabled={selectedNode.node_type === "start"}
            >
              Delete Node
            </Button>
          </div>
        </>
      ) : !selectionSummary && !selectedEdge ? (
        <p className="muted">Select a graph node.</p>
      ) : null}

    </div>
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
          <Input
            min={1}
            type="number"
            value={delay.duration_ms}
            onChange={(event) =>
              onChange({
                ...edge,
                delay: {
                  type: "fixed",
                  duration_ms: numberOrDefault(event.currentTarget.value, 1000),
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
            <Input
              min={1}
              type="number"
              value={delay.min_ms}
              onChange={(event) =>
                onChange({
                  ...edge,
                  delay: {
                    type: "random",
                    min_ms: numberOrDefault(event.currentTarget.value, 800),
                    max_ms: delay.max_ms,
                  },
                })
              }
            />
          </label>
          <label className="field">
            <span>Random max ms</span>
            <Input
              min={1}
              type="number"
              value={delay.max_ms}
              onChange={(event) =>
                onChange({
                  ...edge,
                  delay: {
                    type: "random",
                    min_ms: delay.min_ms,
                    max_ms: numberOrDefault(event.currentTarget.value, 1500),
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

function numberOrDefault(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function collectVariableOptions(graph: WorkflowGraph): VariableOption[] {
  const options: VariableOption[] = [];

  for (const node of graph.nodes) {
    if (node.node_type === "set_variable") {
      const config = objectConfig(node.config);
      const rows = Array.isArray(config.variables) ? config.variables : [];
      for (const row of rows) {
        if (row && typeof row === "object" && "name" in row) {
          const name = String(row.name ?? "").trim();
          if (name) options.push({ name, source: "Set Variables" });
        }
      }
      const singleName = typeof config.name === "string" ? config.name.trim() : "";
      if (singleName) options.push({ name: singleName, source: "Set Variables" });
      for (const name of variableNamesFromSerializedConfig(node.config)) {
        options.push({ name, source: "Set Variables" });
      }
    }

    if (node.node_type === "set_json_variables") {
      const json = objectConfig(node.config).json;
      if (typeof json === "string") {
        options.push(...jsonVariableOptions(json));
      }
    }

    if (node.node_type === "action" && isActionConfig(node.config)) {
      const outputName = outputNameForAction(node.config);
      if (outputName) options.push({ name: outputName, source: node.label });
    }
  }

  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.source}:${option.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function variableNamesFromSerializedConfig(config: unknown) {
  const matches = JSON.stringify(config).matchAll(/"name"\s*:\s*"([^"]+)"/g);
  return [...matches]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function jsonVariableOptions(json: string): VariableOption[] {
  try {
    const value = JSON.parse(json);
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return flattenObjectKeys(value).map((name) => ({
      name,
      source: "Set JSON Variables",
    }));
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
