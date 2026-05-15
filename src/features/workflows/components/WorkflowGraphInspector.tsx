import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import type {
  GraphEdge,
  GraphNode,
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { graphNodeLabel } from "../lib/workflowGraph";
import { NodeConfigFields } from "./WorkflowGraphInspectorFields";
import { ConnectionSummary } from "./WorkflowGraphPalettes";
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
  onCopySelection: () => void;
  onDeleteSelection: () => void;
  onDeleteSelectedEdge: () => void;
  onDeleteSelectedNode: () => void;
  onDuplicateSelection: () => void;
  onFocusSelectedNode: () => void;
  onOpenSelectedNodeHelp: () => void;
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
  onCopySelection,
  onDeleteSelection,
  onDeleteSelectedEdge,
  onDeleteSelectedNode,
  onDuplicateSelection,
  onFocusSelectedNode,
  onOpenSelectedNodeHelp,
  onUpdateNode,
}: WorkflowGraphInspectorProps) {
  const variableOptions = collectVariableOptions(graph);
  const [runErrorDetailsVisible, setRunErrorDetailsVisible] = useState(false);
  const selectedRunError =
    selectedNode && runState.error?.step_id === selectedNode.id
      ? runState.error
      : null;

  return (
    <aside className="graph-inspector" aria-label="Graph inspector">
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
          <ConnectionSummary graph={graph} node={selectedNode} />
          <PortGuidance graph={graph} node={selectedNode} />
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
            variableOptions={variableOptions}
          />
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
        </>
      ) : !selectionSummary && !selectedEdge ? (
        <p className="muted">Select a graph node.</p>
      ) : null}

    </aside>
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
      const legacyName = typeof config.name === "string" ? config.name.trim() : "";
      if (legacyName) options.push({ name: legacyName, source: "Set Variables" });
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

function objectConfig(config: unknown): Record<string, unknown> {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function PortGuidance({
  graph,
  node,
}: {
  graph: WorkflowGraph;
  node: GraphNode;
}) {
  const messages = portGuidanceMessages(graph, node);
  if (messages.length === 0) return null;

  return (
    <section className="graph-port-guidance" aria-label="Port guidance">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </section>
  );
}

function portGuidanceMessages(graph: WorkflowGraph, node: GraphNode) {
  const hasOutgoing = (portId: string) =>
    graph.edges.some(
      (edge) => edge.source_node_id === node.id && edge.source_port === portId,
    );

  switch (node.node_type) {
    case "if":
      return [
        !hasOutgoing("true")
          ? "True branch is optional; missing link will no-op."
          : null,
        !hasOutgoing("false")
          ? "False branch is optional; missing link will no-op."
          : null,
        !hasOutgoing("done")
          ? "Done continuation is optional; workflow ends successfully here."
          : null,
      ].filter((message): message is string => Boolean(message));
    case "switch":
      return [
        ...node.ports
          .filter(
            (port) =>
              port.direction === "output" &&
              (port.id.startsWith("case_") || port.id === "default") &&
              !hasOutgoing(port.id),
          )
          .map((port) => `${port.label} branch is optional; missing link will no-op.`),
        !hasOutgoing("done")
          ? "Done continuation is optional; workflow ends successfully here."
          : null,
      ].filter((message): message is string => Boolean(message));
    case "retry":
      return [
        !hasOutgoing("try") ? "Try branch is required before run." : null,
        !hasOutgoing("success")
          ? "Success continuation is optional; workflow ends successfully here."
          : null,
        !hasOutgoing("failed")
          ? "Failed branch is optional; retry failure will fail the workflow."
          : null,
      ].filter((message): message is string => Boolean(message));
    case "try_catch":
      return [
        !hasOutgoing("try") ? "Try branch is required before run." : null,
        !hasOutgoing("error")
          ? "Error branch is optional; try failure will fail the workflow."
          : null,
        !hasOutgoing("done")
          ? "Done continuation is optional; workflow ends successfully here."
          : null,
      ].filter((message): message is string => Boolean(message));
    case "fallback":
      return [
        !hasOutgoing("primary") ? "Primary branch is required before run." : null,
        !hasOutgoing("fallback")
          ? "Fallback branch is optional; primary failure will fail the workflow."
          : null,
        !hasOutgoing("done")
          ? "Done continuation is optional; workflow ends successfully here."
          : null,
      ].filter((message): message is string => Boolean(message));
    default:
      return [];
  }
}
