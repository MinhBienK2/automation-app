import type { DbAdapter } from "../dbAdapter.js";
import crypto from "node:crypto";
import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import { runMigrations } from "../../graph/migrations/index.js";
import { parseActionConfigShape } from "../../actions/schemas/index.js";
import { quarantineNode } from "../../graph/quarantine.js";
import { assembleGraphFromTables, assembleSubflowGraphFromTables } from "../../features/workflows/normalizedGraphRepository.js";
import { writeGraphToNormalizedTables } from "./backfillGraphTables.js";

export type MigrationReport = {
  scanned: number;
  migrated: number;
  failed: number;
  durationMs: number;
};

type IdRow = { id: string };

type GraphTarget = {
  kind: "workflow" | "subflow";
  table: "workflows" | "subflows";
  label: string;
  assemble: AssembleFn;
};

/** Workflows and subflows migrate identically; only the table differs. */
const GRAPH_TARGETS: GraphTarget[] = [
  { kind: "workflow", table: "workflows", label: "Workflow", assemble: assembleGraphFromTables },
  { kind: "subflow", table: "subflows", label: "Subflow", assemble: assembleSubflowGraphFromTables },
];

/**
 * Writes one row's outcome to `migration_log`, or to the console where that
 * table does not exist. Postgres supplies its own id; SQLite autoincrements.
 */
async function recordMigration(
  tx: DbAdapter,
  hasMigrationLog: boolean,
  target: GraphTarget,
  rowId: string,
  result: RowMigrationResult,
): Promise<void> {
  if (!hasMigrationLog) {
    console.log(
      `[migrateAllGraphs] ${target.label} ${rowId} migrated from version ${result.fromVersion} to ${result.toVersion}`,
    );
    return;
  }

  const params = [
    target.table,
    rowId,
    result.startedAt,
    result.finishedAt,
    result.fromVersion,
    result.toVersion,
    JSON.stringify(result.applied),
    result.failure ? JSON.stringify(result.failure) : null,
  ];

  if (tx.ownerId) {
    await tx.execute(
      `INSERT INTO migration_log (id, target_table, target_id, started_at, finished_at, from_version, to_version, applied_json, failure_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [crypto.randomUUID(), ...params],
    );
    return;
  }

  await tx.execute(
    `INSERT INTO migration_log (target_table, target_id, started_at, finished_at, from_version, to_version, applied_json, failure_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    params,
  );
}

/**
 * Eagerly migrate every workflow and subflow graph on startup.
 * Safe for both SQLite (legacy) and PostgreSQL (DbAdapter).
 * If migration_log table doesn't exist, logs to console.
 */
export async function migrateAllGraphs(db: DbAdapter): Promise<MigrationReport> {
  const start = Date.now();
  let scanned = 0;
  let migrated = 0;
  let failed = 0;

  // Check if migration_log table exists (only SQLite has it by default)
  let hasMigrationLog = false;
  try {
    if (!db.ownerId) {
      // If we don't have user context yet, skip
      return { scanned: 0, migrated: 0, failed: 0, durationMs: 0 };
    }
    // In PG, check if migration_log exists
    const tableCheck = await db.query(
      "SELECT tablename FROM pg_tables WHERE tablename = 'migration_log'"
    );
    hasMigrationLog = tableCheck.length > 0;
  } catch {
    hasMigrationLog = false;
  }

  await db.transaction(async (tx) => {
    for (const target of GRAPH_TARGETS) {
      const rows = (await tx.query(
        `SELECT id FROM ${target.table} WHERE owner_id = $1`,
        [tx.ownerId],
      )) as IdRow[];

      for (const row of rows) {
        scanned++;
        const result = await migrateGraphRow(tx, row.id, target.kind, target.assemble);
        if (result.migrated) migrated++;
        if (result.failed) failed++;
        if (result.migrated || result.failed) {
          await recordMigration(tx, hasMigrationLog, target, row.id, result);
        }
      }
    }
  });

  return { scanned, migrated, failed, durationMs: Date.now() - start };
}


type AssembleFn = (db: DbAdapter, id: string) => Promise<WorkflowGraph | null>;

type RowMigrationResult = {
  migrated: boolean;
  failed: boolean;
  startedAt: string;
  finishedAt: string;
  fromVersion: number | null;
  toVersion: number | null;
  applied: Array<{ version: number; description: string }>;
  failure: { version: number; error: string } | null;
};

async function migrateGraphRow(
  db: DbAdapter,
  id: string,
  kind: "workflow" | "subflow",
  assemble: AssembleFn,
): Promise<RowMigrationResult> {
  const startedAt = new Date().toISOString();

  const graph = await assemble(db, id);
  if (!graph) {
    return {
      migrated: false,
      failed: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      fromVersion: null,
      toVersion: null,
      applied: [],
      failure: null,
    };
  }

  const fromVersion = graph.version;
  const migrationResult = runMigrations(graph);
  let processed = migrationResult.graph;

  for (let i = 0; i < processed.nodes.length; i++) {
    const node = processed.nodes[i];
    if (node.node_type !== "action") continue;
    const result = parseActionConfigShape(node);
    if (result.ok) continue;

    const message =
      result.reason === "no_schema"
        ? `Unknown action type: ${(node.config as { type?: string })?.type ?? "unknown"}`
        : result.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");

    processed = { ...processed };
    processed.nodes = [...processed.nodes];
    processed.nodes[i] = quarantineNode(node, {
      reason: result.reason === "no_schema" ? "unknown_type" : "invalid_config",
      message,
    });
  }

  const finishedAt = new Date().toISOString();
  const wasMigrated = migrationResult.applied.length > 0;
  const wasFailed = migrationResult.failed !== null;

  if (wasMigrated && !wasFailed) {
    const now = new Date().toISOString();
    await writeGraphToNormalizedTables(db, processed, kind, id, now);
  }

  return {
    migrated: wasMigrated && !wasFailed,
    failed: wasFailed,
    startedAt,
    finishedAt,
    fromVersion,
    toVersion: processed.version,
    applied: migrationResult.applied,
    failure: migrationResult.failed,
  };
}
