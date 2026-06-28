import type { DatabaseSync } from "node:sqlite";
import type { WorkflowGraph } from "../../../src/types/workflow.js";
import { runMigrations } from "../graph/migrations/index.js";
import { validateActionConfig } from "../actions/schemas/index.js";
import { quarantineNode } from "../graph/quarantine.js";

export type MigrationReport = {
  scanned: number;
  migrated: number;
  failed: number;
  durationMs: number;
};

type GraphRow = { id: string; graph_json: string };

/**
 * Eagerly migrate every workflow and subflow graph on startup.
 * Runs inside a single BEGIN IMMEDIATE / COMMIT transaction.
 * Per-row failures are logged to the migration_log table and skipped.
 */
export function migrateAllGraphs(db: DatabaseSync): MigrationReport {
  const start = Date.now();
  let scanned = 0;
  let migrated = 0;
  let failed = 0;

  const insertLog = db.prepare(
    `INSERT INTO migration_log (target_table, target_id, started_at, finished_at, from_version, to_version, applied_json, failure_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const updateWorkflowGraph = db.prepare(
    "UPDATE workflows SET graph_json = ?, updated_at = ? WHERE id = ?",
  );
  const updateSubflowGraph = db.prepare(
    "UPDATE subflows SET graph_json = ?, updated_at = ? WHERE id = ?",
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    const workflows = db.prepare("SELECT id, graph_json FROM workflows").all() as GraphRow[];
    const subflows = db.prepare("SELECT id, graph_json FROM subflows").all() as GraphRow[];

    for (const row of workflows) {
      scanned++;
      const result = migrateRow(row, "workflows");
      if (result.migrated) migrated++;
      if (result.failed) failed++;
      if (result.migrated || result.failed) {
        const now = new Date().toISOString();
        if (result.migrated) {
          updateWorkflowGraph.run(result.graphJson, now, row.id);
        }
        insertLog.run(
          "workflows",
          row.id,
          result.startedAt,
          result.finishedAt,
          result.fromVersion,
          result.toVersion,
          JSON.stringify(result.applied),
          result.failure ? JSON.stringify(result.failure) : null,
        );
      }
    }

    for (const row of subflows) {
      scanned++;
      const result = migrateRow(row, "subflows");
      if (result.migrated) migrated++;
      if (result.failed) failed++;
      if (result.migrated || result.failed) {
        const now = new Date().toISOString();
        if (result.migrated) {
          updateSubflowGraph.run(result.graphJson, now, row.id);
        }
        insertLog.run(
          "subflows",
          row.id,
          result.startedAt,
          result.finishedAt,
          result.fromVersion,
          result.toVersion,
          JSON.stringify(result.applied),
          result.failure ? JSON.stringify(result.failure) : null,
        );
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { scanned, migrated, failed, durationMs: Date.now() - start };
}

type RowMigrationResult = {
  migrated: boolean;
  failed: boolean;
  graphJson: string | null;
  startedAt: string;
  finishedAt: string;
  fromVersion: number | null;
  toVersion: number | null;
  applied: Array<{ version: number; description: string }>;
  failure: { version: number; error: string } | null;
};

function migrateRow(row: GraphRow, _targetTable: string): RowMigrationResult {
  const startedAt = new Date().toISOString();
  let graph: WorkflowGraph;
  try {
    graph = JSON.parse(row.graph_json) as WorkflowGraph;
  } catch {
    return {
      migrated: false,
      failed: true,
      graphJson: null,
      startedAt,
      finishedAt: new Date().toISOString(),
      fromVersion: null,
      toVersion: null,
      applied: [],
      failure: { version: 0, error: "JSON parse error" },
    };
  }

  const fromVersion = graph.version;
  const migrationResult = runMigrations(graph);
  let processed = migrationResult.graph;

  for (let i = 0; i < processed.nodes.length; i++) {
    const node = processed.nodes[i];
    if (node.node_type !== "action") continue;
    const result = validateActionConfig(node);
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

  return {
    migrated: wasMigrated && !wasFailed,
    failed: wasFailed,
    graphJson: wasMigrated && !wasFailed ? JSON.stringify(processed) : null,
    startedAt,
    finishedAt,
    fromVersion,
    toVersion: processed.version,
    applied: migrationResult.applied,
    failure: migrationResult.failed,
  };
}
