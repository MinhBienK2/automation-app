import type { DatabaseSync } from "node:sqlite";
import type { WorkflowGraph, GraphNode, GraphEdge } from "../../../src/types/workflow.js";

type WorkflowRow = { id: string; graph_json: string };
type SubflowRow = { id: string; graph_json: string };

export type BackfillResult = {
  scanned: number;
  backfilled: number;
  skipped: number;
  durationMs: number;
};

const BACKFILL_KEY = "graph_backfill_v1";

/**
 * Backfill normalized node/edge tables from graph_json.
 * Idempotent: skips workflows whose normalized tables already contain nodes.
 * Gated by app_meta: runs once on first startup, then is a no-op.
 */
export function backfillGraphTables(db: DatabaseSync): BackfillResult {
  const start = Date.now();

  const alreadyDone = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(BACKFILL_KEY) as { value: string } | undefined;

  if (alreadyDone?.value === "done") {
    return { scanned: 0, backfilled: 0, skipped: 0, durationMs: 0 };
  }

  let scanned = 0;
  let backfilled = 0;
  let skipped = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    const workflows = db.prepare("SELECT id, graph_json FROM workflows").all() as WorkflowRow[];
    const subflows = db.prepare("SELECT id, graph_json FROM subflows").all() as SubflowRow[];

    for (const row of workflows) {
      scanned++;
      const existingCount = (
        db
          .prepare("SELECT COUNT(*) as c FROM workflow_nodes WHERE workflow_id = ?")
          .get(row.id) as { c: number }
      ).c;
      if (existingCount > 0) {
        skipped++;
        continue;
      }
      backfillWorkflow(db, row.id, row.graph_json);
      backfilled++;
    }

    for (const row of subflows) {
      scanned++;
      const existingCount = (
        db
          .prepare("SELECT COUNT(*) as c FROM subflow_nodes WHERE subflow_id = ?")
          .get(row.id) as { c: number }
      ).c;
      if (existingCount > 0) {
        skipped++;
        continue;
      }
      backfillSubflow(db, row.id, row.graph_json);
      backfilled++;
    }

    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, 'done')").run(BACKFILL_KEY);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { scanned, backfilled, skipped, durationMs: Date.now() - start };
}

function backfillWorkflow(db: DatabaseSync, workflowId: string, graphJson: string): void {
  let graph: WorkflowGraph;
  try {
    graph = JSON.parse(graphJson) as WorkflowGraph;
  } catch {
    return;
  }

  const now = new Date().toISOString();
  decomposeAndInsert(
    db,
    graph,
    "workflow_nodes",
    "workflow_edges",
    "workflow_id",
    workflowId,
    now,
  );

  db.prepare(
    "UPDATE workflows SET graph_version = ?, viewport_json = ?, migration_notes_json = ? WHERE id = ?",
  ).run(
    graph.version,
    JSON.stringify(graph.viewport),
    JSON.stringify(graph.migration_notes ?? []),
    workflowId,
  );
}

function backfillSubflow(db: DatabaseSync, subflowId: string, graphJson: string): void {
  let graph: WorkflowGraph;
  try {
    graph = JSON.parse(graphJson) as WorkflowGraph;
  } catch {
    return;
  }

  const now = new Date().toISOString();
  decomposeAndInsert(
    db,
    graph,
    "subflow_nodes",
    "subflow_edges",
    "subflow_id",
    subflowId,
    now,
  );
}

function decomposeAndInsert(
  db: DatabaseSync,
  graph: WorkflowGraph,
  nodeTable: string,
  _edgeTable: string,
  ownerColumn: string,
  ownerId: string,
  now: string,
): void {
  const insertNode = db.prepare(
    `INSERT INTO ${nodeTable} (id, ${ownerColumn}, node_type, config_json, position_x, position_y, label, ports_json, ordinal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  graph.nodes.forEach((node, i) => {
    insertNode.run(
      node.id,
      ownerId,
      node.node_type,
      JSON.stringify(node.config),
      node.position?.x ?? 0,
      node.position?.y ?? 0,
      node.label ?? null,
      JSON.stringify(node.ports ?? []),
      i,
      now,
      now,
    );
  });

  const insertEdge = db.prepare(
    `INSERT INTO ${_edgeTable} (id, ${ownerColumn}, source_node_id, source_handle, target_node_id, target_handle, edge_kind, metadata_json, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, 'flow', '{}', ?)`,
  );

  graph.edges.forEach((edge, i) => {
    insertEdge.run(
      edge.id,
      ownerId,
      edge.source_node_id,
      edge.source_port,
      edge.target_node_id,
      edge.target_port,
      i,
    );
  });
}

/**
 * Write a graph to the normalized tables (used by dual-write on save).
 * Deletes existing rows for this owner first, then inserts fresh.
 */
export function writeGraphToNormalizedTables(
  db: DatabaseSync,
  graph: WorkflowGraph,
  tableKind: "workflow" | "subflow",
  ownerId: string,
  now: string,
): void {
  if (tableKind === "workflow") {
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(ownerId);
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(ownerId);
    decomposeAndInsert(db, graph, "workflow_nodes", "workflow_edges", "workflow_id", ownerId, now);
    db.prepare(
      "UPDATE workflows SET graph_version = ?, viewport_json = ?, migration_notes_json = ? WHERE id = ?",
    ).run(
      graph.version,
      JSON.stringify(graph.viewport),
      JSON.stringify(graph.migration_notes ?? []),
      ownerId,
    );
  } else {
    db.prepare("DELETE FROM subflow_edges WHERE subflow_id = ?").run(ownerId);
    db.prepare("DELETE FROM subflow_nodes WHERE subflow_id = ?").run(ownerId);
    decomposeAndInsert(db, graph, "subflow_nodes", "subflow_edges", "subflow_id", ownerId, now);
  }
}
