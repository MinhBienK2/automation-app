import type { DatabaseSync } from "node:sqlite";
import type { WorkflowGraph, WorkflowSettings } from "../../../src/types/workflow.js";

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
    pruned += result.changes;
  }

  return { pruned };
}
