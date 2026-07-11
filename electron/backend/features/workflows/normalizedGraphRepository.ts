import type { DbAdapter } from "../../db/dbAdapter.js";
import type {
  GraphEdge,
  GraphEdgeDelay,
  GraphNode,
  GraphPort,
  WorkflowCondition,
  WorkflowGraph,
} from "../../../../src/types/workflow.js";

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
};

/**
 * Read a workflow graph from the normalized node/edge tables.
 * Source of truth after PR 2.3 (graph_json dropped).
 */
export async function assembleGraphFromTables(
  db: DbAdapter,
  workflowId: string,
): Promise<WorkflowGraph | null> {
  const ownerId = db.ownerId;
  const meta = await db.queryOne(
    ownerId
      ? "SELECT graph_version, viewport_json, migration_notes_json FROM workflows WHERE id = $1 AND owner_id = $2"
      : "SELECT graph_version, viewport_json, migration_notes_json FROM workflows WHERE id = $1",
    ownerId ? [workflowId, ownerId] : [workflowId],
  ) as GraphMetaRow | null;
  if (!meta) return null;

  const nodeRows = await db.query(
    ownerId
      ? "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY ordinal",
    ownerId ? [workflowId, ownerId] : [workflowId],
  ) as NodeRow[];

  const edgeRows = await db.query(
    ownerId
      ? "SELECT * FROM workflow_edges WHERE workflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM workflow_edges WHERE workflow_id = $1 ORDER BY ordinal",
    ownerId ? [workflowId, ownerId] : [workflowId],
  ) as EdgeRow[];

  return assembleGraph(meta, nodeRows, edgeRows);
}

/**
 * Read a subflow graph from the normalized node/edge tables.
 */
export async function assembleSubflowGraphFromTables(
  db: DbAdapter,
  subflowId: string,
): Promise<WorkflowGraph | null> {
  const ownerId = db.ownerId;
  const meta = await db.queryOne(
    ownerId
      ? "SELECT graph_version, viewport_json, migration_notes_json FROM subflows WHERE id = $1 AND owner_id = $2"
      : "SELECT graph_version, viewport_json, migration_notes_json FROM subflows WHERE id = $1",
    ownerId ? [subflowId, ownerId] : [subflowId],
  ) as GraphMetaRow | null;
  if (!meta) return null;

  const nodeRows = await db.query(
    ownerId
      ? "SELECT * FROM subflow_nodes WHERE subflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM subflow_nodes WHERE subflow_id = $1 ORDER BY ordinal",
    ownerId ? [subflowId, ownerId] : [subflowId],
  ) as NodeRow[];

  const edgeRows = await db.query(
    ownerId
      ? "SELECT * FROM subflow_edges WHERE subflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM subflow_edges WHERE subflow_id = $1 ORDER BY ordinal",
    ownerId ? [subflowId, ownerId] : [subflowId],
  ) as EdgeRow[];

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

  const edges: GraphEdge[] = edgeRows.map((row) => {
    let metadata: { label?: string | null; condition?: WorkflowCondition | null; delay?: GraphEdgeDelay | null } = {};
    try {
      if (row.metadata_json) {
        metadata = JSON.parse(row.metadata_json);
      }
    } catch {
      // ignore
    }
    return {
      id: row.id,
      source_node_id: row.source_node_id,
      source_port: row.source_handle ?? "",
      target_node_id: row.target_node_id,
      target_port: row.target_handle ?? "",
      label: metadata.label ?? null,
      condition: metadata.condition ?? null,
      delay: metadata.delay ?? null,
    };
  });

  const version = meta.graph_version ?? 2;
  const viewport = meta.viewport_json
    ? JSON.parse(meta.viewport_json)
    : { x: 0, y: 0, zoom: 1 };
  const migrationNotes = meta.migration_notes_json
    ? JSON.parse(meta.migration_notes_json)
    : [];

  return { version, nodes, edges, viewport, migration_notes: migrationNotes };
}
