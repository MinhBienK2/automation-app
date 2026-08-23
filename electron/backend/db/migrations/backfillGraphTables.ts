import type { DbAdapter } from "../dbAdapter.js";
import type { WorkflowGraph, GraphNode } from "../../../../src/types/workflow.js";

export type BackfillResult = {
  scanned: number;
  backfilled: number;
  skipped: number;
  durationMs: number;
};

/**
 * Backfill normalized node/edge tables from graph_json (legacy column).
 * No-op since we are Remote-First PostgreSQL only now.
 */
export function backfillGraphTables(_db: DbAdapter): BackfillResult {
  return { scanned: 0, backfilled: 0, skipped: 0, durationMs: 0 };
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

async function insertNodesChunked(
  db: DbAdapter,
  nodeTable: string,
  ownerColumn: string,
  ownerId: string,
  dbOwnerId: string,
  graph: WorkflowGraph,
  now: string,
): Promise<void> {
  const nodeChunkSize = 100;
  for (let c = 0; c < graph.nodes.length; c += nodeChunkSize) {
    const chunk = graph.nodes.slice(c, c + nodeChunkSize);
    const placeholders: string[] = [];
    const values: any[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const node = chunk[i];
      const meta = extractNodeMeta(node);
      const ordinal = c + i;
      const baseIdx = i * 14;
      placeholders.push(
        `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9}, $${baseIdx + 10}, $${baseIdx + 11}, $${baseIdx + 12}, $${baseIdx + 13}, $${baseIdx + 14})`
      );
      values.push(
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
        ordinal,
        now,
        now,
        dbOwnerId,
      );
    }

    if (chunk.length > 0) {
      await db.execute(
        `INSERT INTO ${nodeTable} (
          id, ${ownerColumn}, node_type, action_type, config_json, position_x, position_y, label, ports_json, subflow_ref, ordinal, created_at, updated_at, owner_id
        ) VALUES ${placeholders.join(", ")}`,
        values
      );
    }
  }
}

async function decomposeAndInsert(
  db: DbAdapter,
  graph: WorkflowGraph,
  nodeTable: string,
  edgeTable: string,
  ownerColumn: string,
  ownerId: string,
  now: string,
): Promise<void> {
  const dbOwnerId = db.ownerId;
  if (!dbOwnerId) {
    throw new Error("decomposeAndInsert requires a DbAdapter with a valid ownerId");
  }
  await insertNodesChunked(db, nodeTable, ownerColumn, ownerId, dbOwnerId, graph, now);
  await insertEdgesChunked(db, edgeTable, ownerColumn, ownerId, dbOwnerId, graph);
}

async function insertEdgesChunked(
  db: DbAdapter,
  edgeTable: string,
  ownerColumn: string,
  ownerId: string,
  dbOwnerId: string,
  graph: WorkflowGraph,
): Promise<void> {
  const edgeChunkSize = 100;
  for (let c = 0; c < graph.edges.length; c += edgeChunkSize) {
    const chunk = graph.edges.slice(c, c + edgeChunkSize);
    const placeholders: string[] = [];
    const values: any[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const edge = chunk[i];
      const metadata = {
        label: edge.label ?? null,
        condition: edge.condition ?? null,
        delay: edge.delay ?? null,
      };
      const ordinal = c + i;
      const baseIdx = i * 9;
      placeholders.push(
        `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, 'flow', $${baseIdx + 7}, $${baseIdx + 8}, $${baseIdx + 9})`
      );
      values.push(
        edge.id,
        ownerId,
        edge.source_node_id,
        edge.source_port,
        edge.target_node_id,
        edge.target_port,
        JSON.stringify(metadata),
        ordinal,
        dbOwnerId,
      );
    }

    if (chunk.length > 0) {
      await db.execute(
        `INSERT INTO ${edgeTable} (
          id, ${ownerColumn}, source_node_id, source_handle, target_node_id, target_handle, edge_kind, metadata_json, ordinal, owner_id
        ) VALUES ${placeholders.join(", ")}`,
        values
      );
    }
  }
}


const writeLocks = new Map<string, Promise<any>>();

/**
 * Write a graph to the normalized tables (single source of truth after PR 2.3).
 * Deletes existing rows for this owner first, then inserts fresh.
 * Also updates graph-level meta columns (version, viewport, migration_notes).
 */
export async function writeGraphToNormalizedTables(
  db: DbAdapter,
  graph: WorkflowGraph,
  tableKind: "workflow" | "subflow",
  ownerId: string,
  now: string,
): Promise<void> {
  const lockKey = `${tableKind}:${ownerId}`;
  const prevLock = writeLocks.get(lockKey) || Promise.resolve();

  const currentLock = (async () => {
    // Wait for the previous write lock on this workflow/subflow to finish,
    // ignoring errors in the previous operation.
    try {
      await prevLock;
    } catch {
      // ignore
    }

    const metaTable = tableKind === "workflow" ? "workflows" : "subflows";
    const nodeTable = tableKind === "workflow" ? "workflow_nodes" : "subflow_nodes";
    const edgeTable = tableKind === "workflow" ? "workflow_edges" : "subflow_edges";
    const ownerColumn = tableKind === "workflow" ? "workflow_id" : "subflow_id";
    const dbOwnerId = db.ownerId;

    await db.transaction(async (tx) => {
      if (dbOwnerId) {
        await tx.execute(`DELETE FROM ${edgeTable} WHERE ${ownerColumn} = $1 AND owner_id = $2`, [ownerId, dbOwnerId]);
        await tx.execute(`DELETE FROM ${nodeTable} WHERE ${ownerColumn} = $1 AND owner_id = $2`, [ownerId, dbOwnerId]);
      } else {
        await tx.execute(`DELETE FROM ${edgeTable} WHERE ${ownerColumn} = $1`, [ownerId]);
        await tx.execute(`DELETE FROM ${nodeTable} WHERE ${ownerColumn} = $1`, [ownerId]);
      }

      await decomposeAndInsert(tx, graph, nodeTable, edgeTable, ownerColumn, ownerId, now);

      if (dbOwnerId) {
        await tx.execute(
          `UPDATE ${metaTable} SET graph_version = $1, viewport_json = $2, migration_notes_json = $3 WHERE id = $4 AND owner_id = $5`,
          [
            graph.version,
            JSON.stringify(graph.viewport),
            JSON.stringify(graph.migration_notes ?? []),
            ownerId,
            dbOwnerId,
          ],
        );
      } else {
        await tx.execute(
          `UPDATE ${metaTable} SET graph_version = $1, viewport_json = $2, migration_notes_json = $3 WHERE id = $4`,
          [
            graph.version,
            JSON.stringify(graph.viewport),
            JSON.stringify(graph.migration_notes ?? []),
            ownerId,
          ],
        );
      }
    });
  })();

  // Put the lock in the map so subsequent writes wait for it.
  writeLocks.set(lockKey, currentLock);

  // Clean up the lock from the map after it is completed,
  // but only if it's still the active one (hasn't been overwritten by a newer write).
  const cleanUp = () => {
    if (writeLocks.get(lockKey) === currentLock) {
      writeLocks.delete(lockKey);
    }
  };
  currentLock.then(cleanUp, cleanUp);

  return currentLock;
}
