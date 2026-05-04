import type {
  GraphEdge,
  GraphNode,
  GraphValidationIssue,
  WorkflowGraph,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { graphNodeLabel } from "../lib/workflowGraph";
import { NodeConfigFields } from "./WorkflowGraphInspectorFields";
import { ConnectionSummary } from "./WorkflowGraphPalettes";

type SelectionSummary = {
  nodeCount: number;
  edgeCount: number;
};

type WorkflowGraphInspectorProps = {
  graph: WorkflowGraph;
  issueGroups: Map<string, GraphValidationIssue[]>;
  nodeLabels: Map<string, string>;
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
          <NodeConfigFields node={selectedNode} onChange={onUpdateNode} />
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
