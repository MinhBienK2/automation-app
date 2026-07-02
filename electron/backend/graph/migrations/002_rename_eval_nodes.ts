import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 002_rename_eval_nodes — renames legacy evaluate_logic and evaluate_expression
 * node types to check_conditions and calculate_value respectively.
 */
export const migration002RenameEvalNodes: Migration = {
  version: 3,
  description: "Rename evaluate_logic to check_conditions and evaluate_expression to calculate_value",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const nodes = graph.nodes.map((node) => {
      if ((node.node_type as string) === "evaluate_logic") {
        return {
          ...node,
          node_type: "check_conditions" as any,
        };
      }
      if ((node.node_type as string) === "evaluate_expression") {
        return {
          ...node,
          node_type: "calculate_value" as any,
        };
      }
      return node;
    });

    return {
      ...graph,
      version: 3,
      nodes,
    };
  },
};
