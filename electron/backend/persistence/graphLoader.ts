import type {
  WorkflowGraph,
  WorkflowGraphMigrationNote,
} from "../../../src/types/workflow.js";
import { runMigrations } from "../graph/migrations/index.js";
import { validateActionConfig } from "../actions/schemas/index.js";
import { quarantineNode } from "../graph/quarantine.js";

/**
 * Load-path graph processing:
 * 1. Run migrations (version upgrades, audit trail)
 * 2. Validate each action node's config against its Zod schema
 * 3. Quarantine invalid nodes (pass-through for no_schema until PR 1.4)
 *
 * This never throws — malformed nodes are quarantined instead.
 */
export function processGraphOnLoad(graph: WorkflowGraph): WorkflowGraph {
  const migrationResult = runMigrations(graph);
  const processed = migrationResult.graph;
  const notes: WorkflowGraphMigrationNote[] = processed.migration_notes ?? [];

  for (let i = 0; i < processed.nodes.length; i++) {
    const node = processed.nodes[i];
    if (node.node_type !== "action") continue;

    const result = validateActionConfig(node);
    if (result.ok) continue;
    if (result.reason === "no_schema") continue;

    const message = result.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    notes.push({
      path: `node/${node.id}`,
      action: "review",
      message: `Quarantined: ${result.issues[0]?.message ?? "invalid config"}`,
    });

    processed.nodes[i] = quarantineNode(node, {
      reason: "invalid_config",
      message,
    });
  }

  return { ...processed, migration_notes: notes };
}
