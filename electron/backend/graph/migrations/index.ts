import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration, MigrationResult } from "./types.js";
import { migration001Baseline } from "./001_baseline.js";
import { migration002RenameEvalNodes } from "./002_rename_eval_nodes.js";
import { migration003MigrateListNodes } from "./003_migrate_list_nodes.js";
import { migration004MigrateObjectNodes } from "./004_migrate_object_nodes.js";

/**
 * Manually registered, ordered migration registry.
 * Each entry's `version` must be strictly greater than the previous one.
 */
export const MIGRATIONS: Migration[] = [
  migration001Baseline,
  migration002RenameEvalNodes,
  migration003MigrateListNodes,
  migration004MigrateObjectNodes,
];

function assertMonotonic(migrations: Migration[]): void {
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version <= migrations[i - 1].version) {
      throw new Error(
        `Migration registry is not monotonic: v${migrations[i].version} follows v${migrations[i - 1].version}`,
      );
    }
  }
}

assertMonotonic(MIGRATIONS);

/**
 * Apply every migration whose `version` is greater than the graph's current
 * version, in ascending order.
 *
 * - Idempotent: running twice on the same input returns identical output
 *   (no duplicate `migration_notes` entries on the second run).
 * - On failure: stop, return the **last successful** graph + `failed` populated.
 *   Caller decides whether to persist.
 */
export function runMigrations(graph: WorkflowGraph): MigrationResult {
  const applied: Array<{ version: number; description: string }> = [];
  let current = graph;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current.version) continue;

    try {
      current = migration.up(current);
      applied.push({ version: migration.version, description: migration.description });
    } catch (error) {
      return {
        graph: current,
        applied,
        failed: {
          version: migration.version,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  return { graph: current, applied, failed: null };
}
