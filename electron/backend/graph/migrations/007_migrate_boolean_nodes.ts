import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 007_migrate_boolean_nodes — migrates legacy update_flag_variable node types to new granular boolean nodes:
 * - set_true -> set_boolean_variable (output_name: name, value: "true")
 * - set_false -> set_boolean_variable (output_name: name, value: "false")
 * - toggle -> boolean_logical_op (operand1: name, operation: "not", output_name: name)
 */
export const migration007MigrateBooleanNodes: Migration = {
  version: 8,
  description: "Migrate update_flag_variable to granular boolean nodes",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const nodes = graph.nodes.map((node) => {
      if ((node.node_type as string) === "update_flag_variable") {
        const config = node.config as any;
        const name = config?.name ?? "";
        const operation = config?.operation ?? "toggle";

        if (operation === "set_true") {
          return {
            ...node,
            node_type: "set_boolean_variable" as any,
            config: {
              output_name: name,
              value: "true",
            },
          };
        } else if (operation === "set_false") {
          return {
            ...node,
            node_type: "set_boolean_variable" as any,
            config: {
              output_name: name,
              value: "false",
            },
          };
        } else if (operation === "toggle") {
          return {
            ...node,
            node_type: "boolean_logical_op" as any,
            config: {
              operand1: name,
              operation: "not",
              output_name: name,
            },
          };
        }
      }
      return node;
    });

    return {
      ...graph,
      version: 8,
      nodes,
    };
  },
};
