import type { DbAdapter } from "../db/dbAdapter.js";
import type { WorkflowGraph, WorkflowSettings } from "../../../src/types/workflow.js";
import { writeGraphToNormalizedTables } from "../db/migrations/backfillGraphTables.js";

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
export async function snapshotRevision(
  db: DbAdapter,
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
): Promise<WorkflowRevision | SubflowRevision> {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const id = crypto.randomUUID();

  let graphJson = "";
  if (owner === "workflow" && (options.comment || options.tag)) {
    const subflowBackups = await getSubflowSnapshotsForWorkflow(db, ownerId, graph);
    if (subflowBackups.length > 0) {
      const graphWithBackups = {
        ...graph,
        __subflow_backups__: subflowBackups,
      };
      graphJson = JSON.stringify(graphWithBackups);
    } else {
      graphJson = JSON.stringify(graph);
    }
  } else {
    graphJson = JSON.stringify(graph);
  }

  const settingsJson = options.settings ? JSON.stringify(options.settings) : null;
  const sizeBytes = graphJson.length + (settingsJson?.length ?? 0);

  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";

  const maxRow = await db.queryOne(
    `SELECT MAX(revision_number) as max_num FROM ${table} WHERE ${ownerColumn} = $1 AND owner_id = $2`,
    [ownerId, db.ownerId],
  ) as { max_num: number | string | null } | null;
  const revisionNumber = (maxRow?.max_num ? Number(maxRow.max_num) : 0) + 1;

  if (owner === "workflow") {
    await db.execute(
      `INSERT INTO ${table} (id, ${ownerColumn}, revision_number, graph_snapshot_json, settings_snapshot_json, created_at, created_by, comment, tag, size_bytes, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
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
        db.ownerId,
      ],
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

  await db.execute(
    `INSERT INTO ${table} (id, ${ownerColumn}, revision_number, graph_snapshot_json, created_at, created_by, comment, tag, size_bytes, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      ownerId,
      revisionNumber,
      graphJson,
      createdAt,
      options.createdBy ?? null,
      options.comment ?? null,
      options.tag ?? null,
      sizeBytes,
      db.ownerId,
    ],
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

export async function listRevisions(
  db: DbAdapter,
  owner: RevisionOwner,
  ownerId: string,
  options: { limit?: number; offset?: number; onlyBackups?: boolean } = {},
): Promise<RevisionSummary[]> {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = `SELECT id, revision_number, created_at, created_by, comment, tag, size_bytes
       FROM ${table}
       WHERE ${ownerColumn} = $1 AND owner_id = $2`;

  if (options.onlyBackups) {
    query += ` AND (comment IS NOT NULL OR tag IS NOT NULL)`;
  }

  query += ` ORDER BY revision_number DESC LIMIT $3 OFFSET $4`;

  const rows = await db.query(query, [ownerId, db.ownerId, limit, offset]) as RevisionRow[];

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

export async function getRevision(
  db: DbAdapter,
  owner: RevisionOwner,
  revisionId: string,
): Promise<WorkflowRevision | SubflowRevision | null> {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";

  const row = await db.queryOne(
    `SELECT * FROM ${table} WHERE id = $1 AND owner_id = $2`,
    [revisionId, db.ownerId],
  ) as Record<string, unknown> | null;
  if (!row) return null;

  const ownerIdValue = row[ownerColumn] as string;
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
      workflow_id: ownerIdValue,
      settings_snapshot_json: (row.settings_snapshot_json as string | null) ?? null,
    };
  }
  return {
    ...base,
    subflow_id: ownerIdValue,
  };
}

export async function tagRevision(
  db: DbAdapter,
  owner: RevisionOwner,
  revisionId: string,
  tag: string,
): Promise<void> {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  await db.execute(`UPDATE ${table} SET tag = $1 WHERE id = $2 AND owner_id = $3`, [tag, revisionId, db.ownerId]);
}

export async function untagRevision(
  db: DbAdapter,
  owner: RevisionOwner,
  revisionId: string,
): Promise<void> {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  await db.execute(`UPDATE ${table} SET tag = NULL WHERE id = $1 AND owner_id = $2`, [revisionId, db.ownerId]);
}

export async function deleteRevision(
  db: DbAdapter,
  owner: RevisionOwner,
  revisionId: string,
): Promise<void> {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  await db.execute(`DELETE FROM ${table} WHERE id = $1 AND owner_id = $2`, [revisionId, db.ownerId]);
}

/**
 * Prune untagged revisions beyond the retention limit.
 * Keeps all tagged revisions indefinitely.
 */
export async function pruneRevisions(db: DbAdapter, owner: RevisionOwner): Promise<{ pruned: number }> {
  const table = owner === "workflow" ? "workflow_revisions" : "subflow_revisions";
  const ownerColumn = owner === "workflow" ? "workflow_id" : "subflow_id";
  const ownerId = db.ownerId;
  if (!ownerId) {
    return { pruned: 0 };
  }

  const owners = await db.query(
    `SELECT DISTINCT ${ownerColumn} as id FROM ${table} WHERE owner_id = $1`,
    [ownerId],
  ) as Array<{ id: string }>;

  let pruned = 0;
  for (const { id } of owners) {
    const countRow = await db.queryOne(
      `SELECT COUNT(*) as c FROM ${table} WHERE ${ownerColumn} = $1 AND tag IS NULL AND owner_id = $2`,
      [id, ownerId],
    ) as { c: number | string } | null;

    const count = countRow ? Number(countRow.c) : 0;
    if (count <= MAX_UNTAGGED_REVISIONS) continue;

    const toDelete = count - MAX_UNTAGGED_REVISIONS;
    const limit = Math.min(toDelete, 100);

    const result = await db.execute(
      `DELETE FROM ${table}
       WHERE id IN (
         SELECT id FROM ${table}
         WHERE ${ownerColumn} = $1 AND tag IS NULL AND owner_id = $2
         ORDER BY revision_number ASC
         LIMIT $3
       )`,
      [id, ownerId, limit],
    );
    pruned += result.changes;
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
export async function restoreRevision(
  db: DbAdapter,
  owner: RevisionOwner,
  ownerId: string,
  revisionId: string,
  options: { comment?: string; createdAt?: string } = {},
): Promise<RestoreResult> {
  const revision = await getRevision(db, owner, revisionId);
  if (!revision) {
    throw new Error(`Revision ${revisionId} not found`);
  }

  let graph = JSON.parse(revision.graph_snapshot_json) as WorkflowGraph & {
    __subflow_backups__?: Array<{
      subflowId: string;
      name: string;
      description: string;
      graph: WorkflowGraph;
    }>;
  };
  const createdAt = options.createdAt ?? new Date().toISOString();

  // Capture pre-restore state as a new revision
  const preRestoreComment = options.comment ?? (owner === "workflow"
    ? `Pre-restore backup before restoring revision #${revision.revision_number}`
    : `Pre-restore backup before restoring subflow revision #${revision.revision_number}`);

  const captured = await captureCurrentState(db, owner, ownerId, {
    comment: preRestoreComment,
    createdAt,
  });

  // If restoring a workflow with subflow backups, duplicate and remap them
  if (owner === "workflow" && graph.__subflow_backups__ && graph.__subflow_backups__.length > 0) {
    const subflowIdMap = new Map<string, string>();
    const workflowRow = await db.queryOne(
      "SELECT project_id FROM workflows WHERE id = $1 AND owner_id = $2",
      [ownerId, db.ownerId],
    ) as { project_id: string } | null;
    const projectId = workflowRow?.project_id;

    if (projectId) {
      for (const backup of graph.__subflow_backups__) {
        const newSubflowId = crypto.randomUUID();
        const newSubflowName = `${backup.name} (Backup)`;

        await db.execute(
          `INSERT INTO subflows (id, project_id, name, description, tags_json, created_at, updated_at, owner_id)
           VALUES ($1, $2, $3, $4, '[]', $5, $6, $7)`,
          [newSubflowId, projectId, newSubflowName, backup.description, createdAt, createdAt, db.ownerId],
        );

        await writeSubflowGraph(db, newSubflowId, backup.graph, createdAt);

        await snapshotRevision(db, "subflow", newSubflowId, backup.graph, {
          comment: `Created as backup subflow for restored workflow revision #${revision.revision_number}`,
          createdAt,
        });

        subflowIdMap.set(backup.subflowId, newSubflowId);
      }

      graph = {
        ...graph,
        nodes: graph.nodes.map((node) => {
          if (node.node_type !== "call_subflow") return node;
          const config = node.config as { subflow_id?: unknown };
          const oldSubflowId = config.subflow_id;
          if (typeof oldSubflowId === "string" && subflowIdMap.has(oldSubflowId)) {
            const newSubflowId = subflowIdMap.get(oldSubflowId)!;
            return {
              ...node,
              config: {
                ...config,
                subflow_id: newSubflowId,
              },
            };
          }
          return node;
        }),
      };
    }
  }

  // Write the target graph back to normalized tables
  if (owner === "workflow") {
    await writeWorkflowGraph(db, ownerId, graph, createdAt);
  } else {
    await writeSubflowGraph(db, ownerId, graph, createdAt);
  }

  return {
    restoredRevisionNumber: revision.revision_number,
    capturedRevisionNumber: captured,
  };
}

async function captureCurrentState(
  db: DbAdapter,
  owner: RevisionOwner,
  ownerId: string,
  options: { comment?: string; createdAt: string },
): Promise<number> {
  const graph = owner === "workflow"
    ? await readWorkflowGraph(db, ownerId)
    : await readSubflowGraph(db, ownerId);

  if (!graph) {
    throw new Error(`${owner} ${ownerId} not found`);
  }

  const rev = await snapshotRevision(db, owner, ownerId, graph, {
    comment: options.comment,
    createdAt: options.createdAt,
  });
  return rev.revision_number;
}

async function readWorkflowGraph(db: DbAdapter, workflowId: string): Promise<WorkflowGraph | null> {
  const ownerId = db.ownerId;
  const meta = await db.queryOne(
    ownerId
      ? "SELECT graph_version, viewport_json, migration_notes_json FROM workflows WHERE id = $1 AND owner_id = $2"
      : "SELECT graph_version, viewport_json, migration_notes_json FROM workflows WHERE id = $1",
    ownerId ? [workflowId, ownerId] : [workflowId],
  ) as { graph_version: number | null; viewport_json: string | null; migration_notes_json: string } | null;
  if (!meta) return null;

  const nodes = await db.query(
    ownerId
      ? "SELECT * FROM workflow_nodes WHERE workflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM workflow_nodes WHERE workflow_id = $1 ORDER BY ordinal",
    ownerId ? [workflowId, ownerId] : [workflowId],
  );
  const edges = await db.query(
    ownerId
      ? "SELECT * FROM workflow_edges WHERE workflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM workflow_edges WHERE workflow_id = $1 ORDER BY ordinal",
    ownerId ? [workflowId, ownerId] : [workflowId],
  );

  return assembleGraph(meta, nodes, edges);
}

async function readSubflowGraph(db: DbAdapter, subflowId: string): Promise<WorkflowGraph | null> {
  const ownerId = db.ownerId;
  const meta = await db.queryOne(
    ownerId
      ? "SELECT graph_version, viewport_json, migration_notes_json FROM subflows WHERE id = $1 AND owner_id = $2"
      : "SELECT graph_version, viewport_json, migration_notes_json FROM subflows WHERE id = $1",
    ownerId ? [subflowId, ownerId] : [subflowId],
  ) as { graph_version: number | null; viewport_json: string | null; migration_notes_json: string } | null;
  if (!meta) return null;

  const nodes = await db.query(
    ownerId
      ? "SELECT * FROM subflow_nodes WHERE subflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM subflow_nodes WHERE subflow_id = $1 ORDER BY ordinal",
    ownerId ? [subflowId, ownerId] : [subflowId],
  );
  const edges = await db.query(
    ownerId
      ? "SELECT * FROM subflow_edges WHERE subflow_id = $1 AND owner_id = $2 ORDER BY ordinal"
      : "SELECT * FROM subflow_edges WHERE subflow_id = $1 ORDER BY ordinal",
    ownerId ? [subflowId, ownerId] : [subflowId],
  );

  return assembleGraph(meta, nodes, edges);
}

async function writeWorkflowGraph(db: DbAdapter, workflowId: string, graph: WorkflowGraph, timestamp: string): Promise<void> {
  await db.execute("UPDATE workflows SET updated_at = $1 WHERE id = $2 AND owner_id = $3", [timestamp, workflowId, db.ownerId]);
  await writeGraphToNormalizedTables(db, graph, "workflow", workflowId, timestamp);
}

async function writeSubflowGraph(db: DbAdapter, subflowId: string, graph: WorkflowGraph, timestamp: string): Promise<void> {
  await db.execute("UPDATE subflows SET updated_at = $1 WHERE id = $2 AND owner_id = $3", [timestamp, subflowId, db.ownerId]);
  await writeGraphToNormalizedTables(db, graph, "subflow", subflowId, timestamp);
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

  const graphEdges = edges.map((row) => {
    let metadata: { label?: string | null; condition?: any; delay?: any } = {};
    try {
      if (row.metadata_json) {
        metadata = JSON.parse(row.metadata_json as string);
      }
    } catch {
      // ignore
    }
    return {
      id: row.id as string,
      source_node_id: row.source_node_id as string,
      source_port: (row.source_handle as string) ?? "",
      target_node_id: row.target_node_id as string,
      target_port: (row.target_handle as string) ?? "",
      label: metadata.label ?? null,
      condition: metadata.condition ?? null,
      delay: metadata.delay ?? null,
    };
  });

  return {
    version: meta.graph_version ?? 2,
    nodes: graphNodes,
    edges: graphEdges,
    viewport: meta.viewport_json ? JSON.parse(meta.viewport_json) : { x: 0, y: 0, zoom: 1 },
    migration_notes: meta.migration_notes_json ? JSON.parse(meta.migration_notes_json) : [],
  };
}

async function getSubflowSnapshotsForWorkflow(
  db: DbAdapter,
  workflowId: string,
  graph: WorkflowGraph,
): Promise<Array<{
  subflowId: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
}>> {
  const subflowIds = [
    ...new Set(
      graph.nodes
        .filter((node) => node.node_type === "call_subflow")
        .map((node) => (node.config as { subflow_id?: unknown })?.subflow_id)
        .filter((subflowId): subflowId is string => typeof subflowId === "string" && subflowId.trim().length > 0)
    )
  ];

  const subflowBackups: Array<{
    subflowId: string;
    name: string;
    description: string;
    graph: WorkflowGraph;
  }> = [];

  for (const subflowId of subflowIds) {
    const usages = await db.query(
      `SELECT DISTINCT workflow_id FROM workflow_nodes WHERE subflow_ref = $1 AND owner_id = $2`,
      [subflowId, db.ownerId]
    ) as Array<{ workflow_id: string }>;

    const isExclusive = usages.length === 0 || (usages.length === 1 && usages[0].workflow_id === workflowId);
    if (isExclusive) {
      const subflowRow = await db.queryOne(
        "SELECT name, description FROM subflows WHERE id = $1 AND owner_id = $2",
        [subflowId, db.ownerId]
      ) as { name: string; description: string } | null;

      if (subflowRow) {
        const subflowGraph = await readSubflowGraph(db, subflowId);
        if (subflowGraph) {
          subflowBackups.push({
            subflowId,
            name: subflowRow.name,
            description: subflowRow.description,
            graph: subflowGraph,
          });
        }
      }
    }
  }

  return subflowBackups;
}
