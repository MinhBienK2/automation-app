import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 004_migrate_object_nodes — migrates legacy update_object_variable node types to the new granular nodes:
 * - merge_objects (for operations: merge, deep_merge)
 * - set_object_property (for operation: set_key)
 * - remove_object_property (for operation: delete_key)
 */
export const migration004MigrateObjectNodes: Migration = {
  version: 5,
  description: "Migrate update_object_variable to granular object processing nodes",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const nodes = graph.nodes.map((node) => {
      if ((node.node_type as string) === "update_object_variable") {
        const config = node.config as any;
        const name = config?.name ?? "";
        const operation = config?.operation ?? "";
        const value = config?.value ?? "";
        const property_key = config?.property_key ?? "";
        const property_value = config?.property_value ?? "";
        const property_value_type = config?.property_value_type ?? "text";

        if (operation === "merge" || operation === "deep_merge") {
          const deep = operation === "deep_merge";
          return {
            ...node,
            node_type: "merge_objects" as any,
            config: {
              name,
              value,
              deep,
            },
          };
        }

        if (operation === "set_key") {
          return {
            ...node,
            node_type: "set_object_property" as any,
            config: {
              name,
              property_key,
              value_type: property_value_type,
              value: property_value,
            },
          };
        }

        if (operation === "delete_key") {
          return {
            ...node,
            node_type: "remove_object_property" as any,
            config: {
              name,
              property_key,
            },
          };
        }
      }
      return node;
    });

    return {
      ...graph,
      version: 5,
      nodes,
    };
  },
};
