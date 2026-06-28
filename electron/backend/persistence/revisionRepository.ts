import type { DatabaseSync } from "node:sqlite";
import type { WorkflowGraph, WorkflowSettings } from "../../../src/types/workflow.js";
import { writeGraphToNormalizedTables } from "./backfillGraphTables.js";

export type WorkflowRevision = {
  id: string;
  workflow_id: string;
  revision_number: number;
  graph_snapshot_json: string;
  settings_snapshot_json: string | null;
  created_at: string;
  created_by: string | null;
  comment: string | null;
  tag: string | null;
  size_bytes: number;
};

export type SubflowRevision = {
  id: string;
  subflow_id: string;
  revision_number: number;
  graph_snapshot_json: string;
  created_at: string;
  created_by: string | null;
  comment: string | null;
  tag: string | null;
  size_bytes: number;
};

export type RevisionSummary = {
  id: string;
  revision_number: number;
  created_at: string;
  created_by: string | null;
  comment: string | null;
  tag: string | null;
  size_bytes: number;
};

export type RevisionOwner = "workflow" | "subflow";

const MAX_UNTAGGED_REVISIONS = 50;

/**
 * Write a revision snapshot for a workflow or subflow.
 * Assigns the next monotonic revision_number for that owner.
 */
export function snapshotRevision(
  db: DatabaseSync,
  owner: RevisionOwner,
  ownerId: string,
  graph: WorkflowGraph,
  options: {
    settings?: WorkflowSettings | null;
    createdAt?: string;
    createdBy?: string | null;
    comment?: string | null;
    tag?: string | null;
  } = {},
): WorkflowRevision | SubflowRevision {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const id = crypto.randomUUID();
  const graphJson = JSON.stringify(graph);
  const settingsJson = options.settings ? JSON.stringify(options.settings) : null;
  const sizeBytes = graphJson.length + (settingsJson?.length ?? 0);

  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";

  const maxRow = db
    .prepare(`SELECT MAX(revision_number) as max_num FROM ${table} WHERE ${ownerColumn} = ?`)
    .get(ownerId) as { max_num: number | null } | undefined;
  const revisionNumber = (maxRow?.max_num ?? 0) + 1;

  if (owner === "workflow") {
    db.prepare(
      `INSERT INTO ${table} (id, ${ownerColumn}, revision_number, graph_snapshot_json, settings_snapshot_json, created_at, created_by, comment, tag, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      ownerId,
      revisionNumber,
      graphJson,
      settingsJson,
      createdAt,
      options.createdBy ?? null,
      options.comment ?? null,
      options.tag ?? null,
      sizeBytes,
    );
    return {
      id,
      workflow_id: ownerId,
      revision_number: revisionNumber,
      graph_snapshot_json: graphJson,
      settings_snapshot_json: settingsJson,
      created_at: createdAt,
      created_by: options.createdBy ?? null,
      comment: options.comment ?? null,
      tag: options.tag ?? null,
      size_bytes: sizeBytes,
    };
  }

  db.prepare(
    `INSERT INTO ${table} (id, ${ownerColumn}, revision_number, graph_snapshot_json, created_at, created_by, comment, tag, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    ownerId,
    revisionNumber,
    graphJson,
    createdAt,
    options.createdBy ?? null,
    options.comment ?? null,
    options.tag ?? null,
    sizeBytes,
  );
  return {
    id,
    subflow_id: ownerId,
    revision_number: revisionNumber,
    graph_snapshot_json: graphJson,
    created_at: createdAt,
    created_by: options.createdBy ?? null,
    comment: options.comment ?? null,
    tag: options.tag ?? null,
    size_bytes: sizeBytes,
  };
}

export function listRevisions(
  db: DatabaseSync,
  owner: RevisionOwner,
  ownerId: string,
  options: { limit?: number; offset?: number } = {},
): RevisionSummary[] {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT id, revision_number, created_at, created_by, comment, tag, size_bytes
       FROM ${table}
       WHERE ${ownerColumn} = ?
       ORDER BY revision_number DESC
       LIMIT ? OFFSET ?`,
    )
    .all(ownerId, limit, offset) as RevisionRow[];

  return rows.map((row) => ({
    id: row.id,
    revision_number: row.revision_number,
    created_at: row.created_at,
    created_by: row.created_by,
    comment: row.comment,
    tag: row.tag,
    size_bytes: row.size_bytes,
  }));
}

export function getRevision(
  db: DatabaseSync,
  owner: RevisionOwner,
  revisionId: string,
): WorkflowRevision | SubflowRevision | null {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";

  const row = db
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(revisionId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const ownerId = row[ownerColumn] as string;
  const base = {
    id: row.id as string,
    revision_number: row.revision_number as number,
    graph_snapshot_json: row.graph_snapshot_json as string,
    created_at: row.created_at as string,
    created_by: (row.created_by as string | null) ?? null,
    comment: (row.comment as string | null) ?? null,
    tag: (row.tag as string | null) ?? null,
    size_bytes: row.size_bytes as number,
  };

  if (owner === "workflow") {
    return {
      ...base,
      workflow_id: ownerId,
      settings_snapshot_json: (row.settings_snapshot_json as string | null) ?? null,
    };
  }
  return {
    ...base,
    subflow_id: ownerId,
  };
}

export function tagRevision(
  db: DatabaseSync,
  owner: RevisionOwner,
  revisionId: string,
  tag: string,
): void {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  db.prepare(`UPDATE ${table} SET tag = ? WHERE id = ?`).run(tag, revisionId);
}

export function untagRevision(
  db: DatabaseSync,
  owner: RevisionOwner,
  revisionId: string,
): void {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  db.prepare(`UPDATE ${table} SET tag = NULL WHERE id = ?`).run(revisionId);
}

/**
 * Prune untagged revisions beyond the retention limit.
 * Keeps all tagged revisions indefinitely.
 * Runs in batches of 100.
 */
export function pruneRevisions(db: DatabaseSync, owner: RevisionOwner): { pruned: number } {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";

  const owners = db
    .prepare(`SELECT DISTINCT ${ownerColumn} as id FROM ${table}`)
    .all() as Array<{ id: string }>;

  let pruned = 0;
  for (const { id } of owners) {
    const countRow = db
      .prepare(
        `SELECT COUNT(*) as c FROM ${table} WHERE ${ownerColumn} = ? AND tag IS NULL`,
      )
      .get(id) as { c: number };

    if (countRow.c <= MAX_UNTAGGED_REVISIONS) continue;

    const toDelete = countRow.c - MAX_UNTAGGED_REVISIONS;
    const result = db
      .prepare(
        `DELETE FROM ${table}
         WHERE rowid IN (
           SELECT rowid FROM ${table}
           WHERE ${ownerColumn} = ? AND tag IS NULL
           ORDER BY revision_number ASC
           LIMIT ?
         )`,
      )
      .run(id, Math.min(toDelete, 100));
    pruned += Number(result.changes);
  }

  return { pruned };
}

export type RestoreResult = {
  restoredRevisionNumber: number;
  capturedRevisionNumber: number;
};

/**
 * Restore a workflow or subflow to a previous revision.
 * Atomically:
 * 1. Captures the current graph as a new revision (so restores are undoable)
 * 2. Writes the target revision's graph back to the normalized tables
 * Returns the restored revision number and the captured (pre-restore) revision number.
 */
export function restoreRevision(
  db: DatabaseSync,
  owner: RevisionOwner,
  ownerId: string,
  revisionId: string,
  options: { comment?: string; createdAt?: string } = {},
): RestoreResult {
  const revision = getRevision(db, owner, revisionId);
  if (!revision) {
    throw new Error(`Revision ${revisionId} not found`);
  }

  const graph = JSON.parse(revision.graph_snapshot_json) as WorkflowGraph;
  const createdAt = options.createdAt ?? new Date().toISOString();

  // Capture pre-restore state as a new revision
  const captured = captureCurrentState(db, owner, ownerId, {
    comment: options.comment ?? "Pre-restore snapshot",
    createdAt,
  });

  // Write the target graph back to normalized tables
  if (owner === "workflow") {
    writeWorkflowGraph(db, ownerId, graph, createdAt);
  } else {
    writeSubflowGraph(db, ownerId, graph, createdAt);
  }

  return {
    restoredRevisionNumber: revision.revision_number,
    capturedRevisionNumber: captured,
  };
}

function captureCurrentState(
  db: DatabaseSync,
  owner: RevisionOwner,
  ownerId: string,
  options: { comment?: string; createdAt: string },
): number {
  const graph = owner === "workflow"
    ? readWorkflowGraph(db, ownerId)
    : readSubflowGraph(db, ownerId);

  if (!graph) {
    throw new Error(`${owner} ${ownerId} not found`);
  }

  const rev = snapshotRevision(db, owner, ownerId, graph, {
    comment: options.comment,
    createdAt: options.createdAt,
  });
  return rev.revision_number;
}

function readWorkflowGraph(db: DatabaseSync, workflowId: string): WorkflowGraph | null {
  const meta = db
    .prepare("SELECT graph_version, viewport_json, migration_notes_json FROM workflows WHERE id = ?")
    .get(workflowId) as { graph_version: number | null; viewport_json: string | null; migration_notes_json: string } | undefined;
  if (!meta) return null;

  const nodes = db
    .prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ? ORDER BY ordinal")
    .all(workflowId) as Array<Record<string, unknown>>;
  const edges = db
    .prepare("SELECT * FROM workflow_edges WHERE workflow_id = ? ORDER BY ordinal")
    .all(workflowId) as Array<Record<string, unknown>>;

  return assembleGraph(meta, nodes, edges);
}

function readSubflowGraph(db: DatabaseSync, subflowId: string): WorkflowGraph | null {
  const meta = db
    .prepare("SELECT graph_version, viewport_json, migration_notes_json FROM subflows WHERE id = ?")
    .get(subflowId) as { graph_version: number | null; viewport_json: string | null; migration_notes_json: string } | undefined;
  if (!meta) return null;

  const nodes = db
    .prepare("SELECT * FROM subflow_nodes WHERE subflow_id = ? ORDER BY ordinal")
    .all(subflowId) as Array<Record<string, unknown>>;
  const edges = db
    .prepare("SELECT * FROM subflow_edges WHERE subflow_id = ? ORDER BY ordinal")
    .all(subflowId) as Array<Record<string, unknown>>;

  return assembleGraph(meta, nodes, edges);
}

function writeWorkflowGraph(db: DatabaseSync, workflowId: string, graph: WorkflowGraph, timestamp: string): void {
  db.prepare("UPDATE workflows SET updated_at = ? WHERE id = ?").run(timestamp, workflowId);
  writeGraphToNormalizedTables(db, graph, "workflow", workflowId, timestamp);
}

function writeSubflowGraph(db: DatabaseSync, subflowId: string, graph: WorkflowGraph, timestamp: string): void {
  db.prepare("UPDATE subflows SET updated_at = ? WHERE id = ?").run(timestamp, subflowId);
  writeGraphToNormalizedTables(db, graph, "subflow", subflowId, timestamp);
}

type GraphMetaRow = {
  graph_version: number | null;
  viewport_json: string | null;
  migration_notes_json: string;
};

type RevisionRow = {
  id: string;
  revision_number: number;
  created_at: string;
  created_by: string | null;
  comment: string | null;
  tag: string | null;
  size_bytes: number;
};

function assembleGraph(
  meta: GraphMetaRow,
  nodes: Array<Record<string, unknown>>,
  edges: Array<Record<string, unknown>>,
): WorkflowGraph {
  const graphNodes = nodes.map((row) => ({
    id: row.id as string,
    node_type: row.node_type as WorkflowGraph["nodes"][number]["node_type"],
    label: (row.label as string) ?? "",
    position: { x: row.position_x as number, y: row.position_y as number },
    config: JSON.parse(row.config_json as string),
    ports: JSON.parse(row.ports_json as string) as WorkflowGraph["nodes"][number]["ports"],
    ...(row.group_id ? { group_id: row.group_id as string } : {}),
  }));

  const graphEdges = edges.map((row) => ({
    id: row.id as string,
    source_node_id: row.source_node_id as string,
    source_port: (row.source_handle as string) ?? "",
    target_node_id: row.target_node_id as string,
    target_port: (row.target_handle as string) ?? "",
  }));

  return {
    version: meta.graph_version ?? 2,
    nodes: graphNodes,
    edges: graphEdges,
    viewport: meta.viewport_json ? JSON.parse(meta.viewport_json) : { x: 0, y: 0, zoom: 1 },
    migration_notes: meta.migration_notes_json ? JSON.parse(meta.migration_notes_json) : [],
  };
}
