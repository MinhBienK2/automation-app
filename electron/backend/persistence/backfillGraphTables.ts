import type { DatabaseSync } from "node:sqlite";
import type { WorkflowGraph, GraphNode } from "../../../src/types/workflow.js";

export type BackfillResult = {
  scanned: number;
  backfilled: number;
  skipped: number;
  durationMs: number;
};

const BACKFILL_KEY = "graph_backfill_v1";

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

/**
 * Backfill normalized node/edge tables from graph_json (legacy column).
 * Idempotent: skips owners whose normalized tables already contain nodes.
 * Gated by app_meta: runs once on first startup, then is a no-op.
 * Safe to call after graph_json has been dropped — detects missing column
 * and becomes a no-op.
 */
export function backfillGraphTables(db: DatabaseSync): BackfillResult {
  const start = Date.now();

  const alreadyDone = db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(BACKFILL_KEY) as { value: string } | undefined;

  if (alreadyDone?.value === "done") {
    return { scanned: 0, backfilled: 0, skipped: 0, durationMs: 0 };
  }

  const hasWorkflowGraphJson = hasColumn(db, "workflows", "graph_json");
  const hasSubflowGraphJson = hasColumn(db, "subflows", "graph_json");

  let scanned = 0;
  let backfilled = 0;
  let skipped = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (hasWorkflowGraphJson) {
      const workflows = db
        .prepare("SELECT id, graph_json FROM workflows")
        .all() as Array<{ id: string; graph_json: string }>;

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
        backfillOwner(db, row.id, row.graph_json, "workflow");
        backfilled++;
      }
    }

    if (hasSubflowGraphJson) {
      const subflows = db
        .prepare("SELECT id, graph_json FROM subflows")
        .all() as Array<{ id: string; graph_json: string }>;

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
        backfillOwner(db, row.id, row.graph_json, "subflow");
        backfilled++;
      }
    }

    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, 'done')").run(BACKFILL_KEY);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { scanned, backfilled, skipped, durationMs: Date.now() - start };
}

function backfillOwner(
  db: DatabaseSync,
  ownerId: string,
  graphJson: string,
  kind: "workflow" | "subflow",
): void {
  let graph: WorkflowGraph;
  try {
    graph = JSON.parse(graphJson) as WorkflowGraph;
  } catch {
    return;
  }

  const now = new Date().toISOString();
  writeGraphToNormalizedTables(db, graph, kind, ownerId, now);
}

type NodeMeta = { action_type: string | null; subflow_ref: string | null };

function extractNodeMeta(node: GraphNode): NodeMeta {
  const config = node.config as { type?: string; subflow_id?: string } | null;
  if (!config) return { action_type: null, subflow_ref: null };

  if (node.node_type === "action" && typeof config.type === "string") {
    return { action_type: config.type, subflow_ref: null };
  }
  if (node.node_type === "call_subflow" && typeof config.subflow_id === "string") {
    return { action_type: null, subflow_ref: config.subflow_id };
  }
  return { action_type: null, subflow_ref: null };
}

function decomposeAndInsert(
  db: DatabaseSync,
  graph: WorkflowGraph,
  nodeTable: string,
  edgeTable: string,
  ownerColumn: string,
  ownerId: string,
  now: string,
): void {
  const insertNode = db.prepare(
    `INSERT INTO ${nodeTable} (id, ${ownerColumn}, node_type, action_type, config_json, position_x, position_y, label, ports_json, subflow_ref, ordinal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  graph.nodes.forEach((node, i) => {
    const meta = extractNodeMeta(node);
    insertNode.run(
      node.id,
      ownerId,
      node.node_type,
      meta.action_type,
      JSON.stringify(node.config),
      node.position?.x ?? 0,
      node.position?.y ?? 0,
      node.label ?? null,
      JSON.stringify(node.ports ?? []),
      meta.subflow_ref,
      i,
      now,
      now,
    );
  });

  const insertEdge = db.prepare(
    `INSERT INTO ${edgeTable} (id, ${ownerColumn}, source_node_id, source_handle, target_node_id, target_handle, edge_kind, metadata_json, ordinal)
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
 * Write a graph to the normalized tables (single source of truth after PR 2.3).
 * Deletes existing rows for this owner first, then inserts fresh.
 * Also updates graph-level meta columns (version, viewport, migration_notes).
 */
export function writeGraphToNormalizedTables(
  db: DatabaseSync,
  graph: WorkflowGraph,
  tableKind: "workflow" | "subflow",
  ownerId: string,
  now: string,
): void {
  const metaTable = tableKind === "workflow" ? "workflows" : "subflows";
  const nodeTable = tableKind === "workflow" ? "workflow_nodes" : "subflow_nodes";
  const edgeTable = tableKind === "workflow" ? "workflow_edges" : "subflow_edges";
  const ownerColumn = tableKind === "workflow" ? "workflow_id" : "subflow_id";

  db.prepare(`DELETE FROM ${edgeTable} WHERE ${ownerColumn} = ?`).run(ownerId);
  db.prepare(`DELETE FROM ${nodeTable} WHERE ${ownerColumn} = ?`).run(ownerId);
  decomposeAndInsert(db, graph, nodeTable, edgeTable, ownerColumn, ownerId, now);

  db.prepare(
    `UPDATE ${metaTable} SET graph_version = ?, viewport_json = ?, migration_notes_json = ? WHERE id = ?`,
  ).run(
    graph.version,
    JSON.stringify(graph.viewport),
    JSON.stringify(graph.migration_notes ?? []),
    ownerId,
  );
}
