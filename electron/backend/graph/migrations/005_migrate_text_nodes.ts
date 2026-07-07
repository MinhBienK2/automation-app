import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 005_migrate_text_nodes — migrates legacy update_text_variable node types to the new granular nodes:
 * - append_text
 * - prepend_text
 * - replace_text
 * - trim_text
 * - change_text_case
 */
export const migration005MigrateTextNodes: Migration = {
  version: 6,
  description: "Migrate update_text_variable to granular text processing nodes",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const nodes = graph.nodes.map((node) => {
      if ((node.node_type as string) === "update_text_variable") {
        const config = node.config as any;
        const name = config?.name ?? "";
        const operation = config?.operation ?? "";
        const value = config?.value ?? "";
        const search_pattern = config?.search_pattern ?? "";

        if (operation === "append") {
          return {
            ...node,
            node_type: "append_text" as any,
            config: {
              name,
              value,
            },
          };
        }

        if (operation === "prepend") {
          return {
            ...node,
            node_type: "prepend_text" as any,
            config: {
              name,
              value,
            },
          };
        }

        if (operation === "replace") {
          return {
            ...node,
            node_type: "replace_text" as any,
            config: {
              name,
              search_pattern,
              replacement: value,
            },
          };
        }

        if (operation === "trim") {
          return {
            ...node,
            node_type: "trim_text" as any,
            config: {
              name,
            },
          };
        }

        if (operation === "uppercase" || operation === "lowercase") {
          return {
            ...node,
            node_type: "change_text_case" as any,
            config: {
              name,
              to_case: operation === "uppercase" ? "upper" : "lower",
            },
          };
        }
      }
      return node;
    });

    return {
      ...graph,
      version: 6,
      nodes,
    };
  },
};
