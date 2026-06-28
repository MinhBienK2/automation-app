import type { DatabaseSync } from "node:sqlite";
import type {
  GraphEdge,
  GraphNode,
  GraphPort,
  WorkflowGraph,
} from "../../../src/types/workflow.js";

type NodeRow = {
  id: string;
  node_type: string;
  config_json: string;
  position_x: number;
  position_y: number;
  label: string | null;
  ports_json: string;
  group_id: string | null;
};

type EdgeRow = {
  id: string;
  source_node_id: string;
  source_handle: string | null;
  target_node_id: string;
  target_handle: string | null;
  edge_kind: string;
  metadata_json: string;
};

type GraphMetaRow = {
  graph_version: number | null;
  viewport_json: string | null;
  migration_notes_json: string;
  graph_json: string;
};

/**
 * Read a workflow graph from the normalized node/edge tables.
 * Used by PR 2.1 to verify the new tables produce identical output
 * to the legacy graph_json reader.
 */
export function assembleGraphFromTables(
  db: DatabaseSync,
  workflowId: string,
): WorkflowGraph | null {
  const meta = db
    .prepare(
      "SELECT graph_version, viewport_json, migration_notes_json, graph_json FROM workflows WHERE id = ?",
    )
    .get(workflowId) as GraphMetaRow | undefined;
  if (!meta) return null;

  const nodeRows = db
    .prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ? ORDER BY ordinal")
    .all(workflowId) as NodeRow[];

  const edgeRows = db
    .prepare("SELECT * FROM workflow_edges WHERE workflow_id = ? ORDER BY ordinal")
    .all(workflowId) as EdgeRow[];

  return assembleGraph(meta, nodeRows, edgeRows);
}

/**
 * Read a subflow graph from the normalized node/edge tables.
 */
export function assembleSubflowGraphFromTables(
  db: DatabaseSync,
  subflowId: string,
): WorkflowGraph | null {
  const meta = db
    .prepare("SELECT graph_json FROM subflows WHERE id = ?")
    .get(subflowId) as GraphMetaRow | undefined;
  if (!meta) return null;

  const nodeRows = db
    .prepare("SELECT * FROM subflow_nodes WHERE subflow_id = ? ORDER BY ordinal")
    .all(subflowId) as NodeRow[];

  const edgeRows = db
    .prepare("SELECT * FROM subflow_edges WHERE subflow_id = ? ORDER BY ordinal")
    .all(subflowId) as EdgeRow[];

  return assembleGraph(meta, nodeRows, edgeRows);
}

function assembleGraph(
  meta: GraphMetaRow,
  nodeRows: NodeRow[],
  edgeRows: EdgeRow[],
): WorkflowGraph {
  const nodes: GraphNode[] = nodeRows.map((row) => ({
    id: row.id,
    node_type: row.node_type as GraphNode["node_type"],
    label: row.label ?? "",
    position: { x: row.position_x, y: row.position_y },
    config: JSON.parse(row.config_json),
    ports: JSON.parse(row.ports_json) as GraphPort[],
    ...(row.group_id ? { group_id: row.group_id } : {}),
  }));

  const edges: GraphEdge[] = edgeRows.map((row) => ({
    id: row.id,
    source_node_id: row.source_node_id,
    source_port: row.source_handle ?? "",
    target_node_id: row.target_node_id,
    target_port: row.target_handle ?? "",
  }));

  const version = meta.graph_version ?? 2;
  const viewport = meta.viewport_json
    ? JSON.parse(meta.viewport_json)
    : { x: 0, y: 0, zoom: 1 };
  const migrationNotes = meta.migration_notes_json
    ? JSON.parse(meta.migration_notes_json)
    : [];

  return { version, nodes, edges, viewport, migration_notes: migrationNotes };
}
