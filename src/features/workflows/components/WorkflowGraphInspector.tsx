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

type WorkflowGraphInspectorProps = {
  graph: WorkflowGraph;
  issueGroups: Map<string, GraphValidationIssue[]>;
  nodeLabels: Map<string, string>;
  selectedEdge: GraphEdge | null;
  selectedNode: GraphNode | null;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteSelectedEdge: () => void;
  onDeleteSelectedNode: () => void;
  onFocusSelectedNode: () => void;
  onUpdateNode: (node: GraphNode) => void;
};

export function WorkflowGraphInspector({
  graph,
  issueGroups,
  nodeLabels,
  selectedEdge,
  selectedNode,
  onDeleteEdge,
  onDeleteSelectedEdge,
  onDeleteSelectedNode,
  onFocusSelectedNode,
  onUpdateNode,
}: WorkflowGraphInspectorProps) {
  const edgeLabels = graph.edges.map(
    (edge) => `${edge.source_node_id} -> ${edge.target_node_id}`,
  );

  return (
    <aside className="graph-inspector" aria-label="Graph inspector">
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
              onClick={() => onDeleteEdge(edge.id)}
            >
              Delete
            </Button>
          </span>
        ))}
      </div>
    </aside>
  );
}
