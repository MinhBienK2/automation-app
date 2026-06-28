import type {
  WorkflowGraph,
  WorkflowGraphMigrationNote,
} from "../../../src/types/workflow.js";
import { runMigrations } from "../graph/migrations/index.js";
import { validateActionConfig } from "../actions/schemas/index.js";
import { quarantineNode } from "../graph/quarantine.js";

export type GraphLoadResult = {
  graph: WorkflowGraph;
  /** Number of migrations applied (0 if already up to date). */
  migrationsApplied: number;
  /** True if a migration failed (graph is last-successful state). */
  migrationFailed: boolean;
};

/**
 * Load-path graph processing:
 * 1. Run migrations (version upgrades, audit trail)
 * 2. Validate each action node's config against its Zod schema
 * 3. Quarantine invalid nodes
 *
 * This never throws — malformed nodes are quarantined instead.
 */
export function processGraphOnLoad(graph: WorkflowGraph): GraphLoadResult {
  const migrationResult = runMigrations(graph);
  const processed = migrationResult.graph;
  const notes: WorkflowGraphMigrationNote[] = processed.migration_notes ?? [];

  for (let i = 0; i < processed.nodes.length; i++) {
    const node = processed.nodes[i];
    if (node.node_type !== "action") continue;

    const result = validateActionConfig(node);
    if (result.ok) continue;

    const message =
      result.reason === "no_schema"
        ? `Unknown action type: ${(node.config as { type?: string })?.type ?? "unknown"}`
        : result.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");

    notes.push({
      path: `node/${node.id}`,
      action: "review",
      message: `Quarantined: ${result.reason === "no_schema" ? message : (result.issues[0]?.message ?? "invalid config")}`,
    });

    processed.nodes[i] = quarantineNode(node, {
      reason: result.reason === "no_schema" ? "unknown_type" : "invalid_config",
      message,
    });
  }

  return {
    graph: { ...processed, migration_notes: notes },
    migrationsApplied: migrationResult.applied.length,
    migrationFailed: migrationResult.failed !== null,
  };
}
