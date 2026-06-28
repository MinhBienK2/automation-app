import type { WorkflowGraph } from "../../../../src/types/workflow.js";

export type Migration = {
  /** Version produced after applying this migration. Strictly monotonic. */
  version: number;
  /** Short human-readable description; included in migration_notes. */
  description: string;
  /** Pure transform. Must not throw on well-formed input of (version - 1). */
  up: (graph: WorkflowGraph) => WorkflowGraph;
};

export type MigrationResult = {
  graph: WorkflowGraph;
  applied: Array<{ version: number; description: string }>;
  failed: { version: number; error: string } | null;
};
