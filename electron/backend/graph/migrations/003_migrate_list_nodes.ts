import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 003_migrate_list_nodes — migrates legacy update_list_variable node types to the new granular nodes:
 * - add_to_list (for operations: push, unshift, push_unique)
 * - remove_from_list_by_index (for operations: pop, shift, remove_by_index)
 * - remove_from_list_by_value (for operation: remove_by_value)
 * - merge_lists (for operations: merge, merge_unique)
 */
export const migration003MigrateListNodes: Migration = {
  version: 4,
  description: "Migrate update_list_variable to granular array/list processing nodes",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const nodes = graph.nodes.map((node) => {
      if ((node.node_type as string) === "update_list_variable") {
        const config = node.config as any;
        const name = config?.name ?? "";
        const operation = config?.operation ?? "";
        const value = config?.value ?? "";
        const value_type = config?.value_type ?? "text";
        const index = config?.index ?? null;

        if (["push", "unshift", "push_unique"].includes(operation)) {
          const position =
            operation === "push"
              ? "end"
              : operation === "unshift"
              ? "start"
              : "unique_end";
          return {
            ...node,
            node_type: "add_to_list" as any,
            config: {
              name,
              position,
              value_type,
              value,
            },
          };
        }

        if (["pop", "shift", "remove_by_index"].includes(operation)) {
          const finalIndex =
            operation === "pop"
              ? "last"
              : operation === "shift"
              ? 0
              : index;
          return {
            ...node,
            node_type: "remove_from_list_by_index" as any,
            config: {
              name,
              index: finalIndex,
            },
          };
        }

        if (operation === "remove_by_value") {
          return {
            ...node,
            node_type: "remove_from_list_by_value" as any,
            config: {
              name,
              value_type,
              value,
            },
          };
        }

        if (["merge", "merge_unique"].includes(operation)) {
          const unique = operation === "merge_unique";
          return {
            ...node,
            node_type: "merge_lists" as any,
            config: {
              name,
              value,
              unique,
            },
          };
        }
      }
      return node;
    });

    return {
      ...graph,
      version: 4,
      nodes,
    };
  },
};
